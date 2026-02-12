import { type Address } from 'viem'
import { publicClient, walletClients } from '../contracts/client.js'
import { addresses } from '../contracts/addresses.js'
import { buckshotGameAbi } from '../contracts/abis.js'
import { Phase } from '../strategy/action-types.js'
import { readGameState } from '../strategy/game-state.js'
import { parseLLMResponse } from '../strategy/action-parser.js'
import { validateActions, fallbackStrategy } from '../strategy/validator.js'
import { executeActions } from '../executor/tx-executor.js'
import { buildSystemPrompt, buildUserPrompt } from '../llm/prompt-builder.js'
import { TurnDetector } from './turn-detector.js'
import { type Agent } from '../agents/types.js'
import { findAgentByAddress } from '../agents/agent-manager.js'
import { config } from '../config.js'
import { log } from '../logger.js'

export class GameWatcher {
  private agents: Agent[]
  private gameId: bigint | null = null
  private turnDetector = new TurnDetector()
  private running = false
  private processing = false

  constructor(agents: Agent[]) {
    this.agents = agents
  }

  setGameId(gameId: bigint) {
    this.gameId = gameId
    this.turnDetector.reset()
    log.game(`Watching game #${gameId}`)
  }

  getGameId(): bigint | null {
    return this.gameId
  }

  start() {
    if (this.running) return
    this.running = true
    this.poll()
  }

  stop() {
    this.running = false
  }

  private async poll() {
    while (this.running) {
      try {
        await this.tick()
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        log.error('Watcher', `Poll error: ${msg.slice(0, 100)}`)
      }
      await new Promise((r) => setTimeout(r, config.pollIntervalMs))
    }
  }

  private async tick() {
    if (this.gameId === null || this.processing) return

    const contract = { address: addresses.buckshotGame as Address, abi: buckshotGameAbi } as const

    // 1. Check phase
    const phase = await publicClient.readContract({
      ...contract,
      functionName: 'getPhase',
      args: [this.gameId],
    }) as number

    if (phase === Phase.FINISHED) {
      log.game(`Game #${this.gameId} FINISHED`)
      this.gameId = null
      return
    }

    if (phase === Phase.WAITING) {
      await this.tryActivateGame(this.gameId, contract)
      return
    }

    if (phase !== Phase.ACTIVE) return

    // 2. Check whose turn it is
    const currentTurn = (await publicClient.readContract({
      ...contract,
      functionName: 'getCurrentTurn',
      args: [this.gameId],
    })) as Address

    // 3. Is it one of our agents?
    const agent = findAgentByAddress(this.agents, currentTurn)
    if (!agent) return

    // 4. Read game state to get deadline for dedup
    const gameView = await publicClient.readContract({
      ...contract,
      functionName: 'getGameState',
      args: [this.gameId],
    }) as { turnDeadline: bigint }

    // 5. Dedup check
    if (!this.turnDetector.claim(this.gameId, currentTurn, gameView.turnDeadline)) {
      return
    }

    // 6. Process this turn
    this.processing = true
    try {
      await this.processTurn(agent, this.gameId)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      log.error(agent.name, `Turn processing error: ${msg.slice(0, 100)}`)
    } finally {
      this.processing = false
    }
  }

  private async tryActivateGame(gameId: bigint, contract: { address: Address; abi: typeof buckshotGameAbi }) {
    try {
      const [deadline, block] = await Promise.all([
        publicClient.readContract({
          ...contract,
          functionName: 'bettingDeadline',
          args: [gameId],
        }) as Promise<bigint>,
        publicClient.getBlock(),
      ])

      if (block.timestamp < deadline) {
        const remaining = Number(deadline - block.timestamp)
        log.game(`Game #${gameId} WAITING — ${remaining}s until betting closes`)
        return
      }

      log.game(`Game #${gameId} betting window closed, activating...`)
      const wallet = walletClients[0]
      const hash = await wallet.writeContract({
        ...contract,
        functionName: 'activateGame',
        args: [gameId],
        gas: 1_000_000n,
      } as any)

      const receipt = await publicClient.waitForTransactionReceipt({ hash })
      if (receipt.status === 'reverted') {
        log.warn('Activator', `activateGame tx reverted (hash: ${hash.slice(0, 18)}...)`)
        return
      }
      log.game(`Game #${gameId} ACTIVATED!`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (!msg.includes('BettingWindowActive') && !msg.includes('GameNotWaiting')) {
        log.warn('Activator', `activateGame failed: ${msg.slice(0, 100)}`)
      }
    }
  }

  private async processTurn(agent: Agent, gameId: bigint) {
    log.game(`--- ${agent.name}'s turn ---`)

    // Read full state
    const state = await readGameState(gameId, agent.address)

    // Consult LLM
    let actions = null
    try {
      const systemPrompt = buildSystemPrompt(agent.personality)
      const userPrompt = buildUserPrompt(state)

      log.llm(agent.name, `Consulting ${agent.llmProvider.name}...`)
      const raw = await agent.llmProvider.complete(systemPrompt, userPrompt)

      // Parse and validate
      const parsed = parseLLMResponse(raw, agent.name)
      if (parsed) {
        actions = validateActions(parsed, state, agent.name)
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      log.warn(agent.name, `LLM error: ${msg.slice(0, 80)}`)
    }

    // Fallback if LLM failed
    if (!actions) {
      log.warn(agent.name, 'Using fallback strategy')
      actions = fallbackStrategy(state)
    }

    // Execute
    const actionsDesc = actions.map((a) => {
      if (a.type === 'useItem') return `useItem[${a.itemIndex}]`
      if (a.type === 'shootOpponent') return `shootOpponent(${a.target.slice(0, 10)})`
      return 'shootSelf'
    }).join(' → ')
    log.info(agent.name, `Actions: ${actionsDesc}`)

    await executeActions(actions, gameId, agent.walletClient, agent.name)
  }
}
