#!/usr/bin/env node
import { type Address, formatEther } from 'viem'
import { publicClient, walletClients, getAgentAddresses } from './contracts/client.js'
import { addresses } from './contracts/addresses.js'
import { buckshotGameAbi, gameFactoryAbi } from './contracts/abis.js'
import { readGameState } from './strategy/game-state.js'
import { fallbackStrategy } from './strategy/validator.js'
import { ITEM_NAMES, Phase } from './strategy/action-types.js'
import { config } from './config.js'

// ── Helpers ──────────────────────────────────────────────────────────

function fail(msg: string): never {
  console.error(JSON.stringify({ error: msg }))
  process.exit(1)
}

function ok(data: unknown): never {
  console.log(JSON.stringify(data, (_k, v) => (typeof v === 'bigint' ? v.toString() : v), 2))
  process.exit(0)
}

function requireArg(args: string[], index: number, name: string): string {
  const val = args[index]
  if (val === undefined) fail(`Missing argument: ${name}`)
  return val
}

function parseAgentIndex(raw: string): number {
  const idx = parseInt(raw, 10)
  if (isNaN(idx) || idx < 0 || idx >= walletClients.length) {
    fail(`Invalid agent index: ${raw} (must be 0-${walletClients.length - 1})`)
  }
  return idx
}

function parseBigInt(raw: string, name: string): bigint {
  try {
    return BigInt(raw)
  } catch {
    fail(`Invalid ${name}: ${raw}`)
  }
}

const gameContract = { address: addresses.buckshotGame as Address, abi: buckshotGameAbi } as const
const factoryContract = { address: addresses.gameFactory as Address, abi: gameFactoryAbi } as const

async function sendTx(
  walletClientIndex: number,
  contractAddr: Address,
  abi: readonly unknown[],
  functionName: string,
  args: unknown[],
  value?: bigint,
): Promise<`0x${string}`> {
  const wallet = walletClients[walletClientIndex]
  const hash = await wallet.writeContract({
    address: contractAddr,
    abi,
    functionName,
    args,
    value,
  } as any)
  const receipt = await publicClient.waitForTransactionReceipt({ hash })
  if (receipt.status !== 'success') {
    fail(`Transaction reverted: ${functionName}`)
  }
  return hash
}

// ── Commands ─────────────────────────────────────────────────────────

async function cmdAgents() {
  const addrs = getAgentAddresses()
  const agents = addrs.map((address, index) => ({ index, address }))
  ok(agents)
}

async function cmdGameStatus() {
  // Get active games from factory
  const activeGames = await publicClient.readContract({
    ...factoryContract,
    functionName: 'getActiveGames',
  }) as bigint[]

  if (activeGames.length === 0) {
    // Check if there are any games at all by looking at nextGameId
    const nextId = await publicClient.readContract({
      ...gameContract,
      functionName: 'nextGameId',
    }) as bigint

    if (nextId === 0n) {
      ok({ hasActiveGame: false, gameId: null, phase: 'NONE', currentTurn: null })
      return
    }

    // Check the latest game
    const latestId = nextId - 1n
    const gameView = await publicClient.readContract({
      ...gameContract,
      functionName: 'getGameState',
      args: [latestId],
    }) as any

    const phaseStr = gameView.phase === Phase.ACTIVE ? 'ACTIVE'
      : gameView.phase === Phase.FINISHED ? 'FINISHED' : 'WAITING'

    if (phaseStr === 'ACTIVE') {
      const currentTurn = await publicClient.readContract({
        ...gameContract,
        functionName: 'getCurrentTurn',
        args: [latestId],
      }) as Address

      ok({
        hasActiveGame: true,
        gameId: latestId.toString(),
        phase: phaseStr,
        currentTurn,
        turnDeadline: gameView.turnDeadline.toString(),
        round: gameView.currentRound,
      })
      return
    }

    ok({
      hasActiveGame: false,
      gameId: latestId.toString(),
      phase: phaseStr,
      currentTurn: null,
    })
    return
  }

  // Use the first active game
  const gameId = activeGames[0]
  const gameView = await publicClient.readContract({
    ...gameContract,
    functionName: 'getGameState',
    args: [gameId],
  }) as any

  const currentTurn = await publicClient.readContract({
    ...gameContract,
    functionName: 'getCurrentTurn',
    args: [gameId],
  }) as Address

  const phaseStr = gameView.phase === Phase.ACTIVE ? 'ACTIVE'
    : gameView.phase === Phase.FINISHED ? 'FINISHED' : 'WAITING'

  ok({
    hasActiveGame: phaseStr === 'ACTIVE',
    gameId: gameId.toString(),
    phase: phaseStr,
    currentTurn,
    turnDeadline: gameView.turnDeadline.toString(),
    round: gameView.currentRound,
  })
}

async function cmdReadState(args: string[]) {
  const gameId = parseBigInt(requireArg(args, 0, 'gameId'), 'gameId')
  const agentIndex = parseAgentIndex(requireArg(args, 1, 'agentIndex'))
  const agentAddr = walletClients[agentIndex].account!.address

  const state = await readGameState(gameId, agentAddr)

  // Format as human-readable text for the LLM
  const maxHp = state.currentRound === 1 ? 2 : state.currentRound === 2 ? 4 : 5
  const total = state.liveRemaining + state.blankRemaining

  let output = `=== Round ${state.currentRound}/3 | Shells: ${total} remaining (${state.liveRemaining} live, ${state.blankRemaining} blank) | Live probability: ${(state.liveProbability * 100).toFixed(0)}% ===\n\n`

  output += 'Players:\n'
  for (const p of state.players) {
    const isMe = p.address.toLowerCase() === agentAddr.toLowerCase() ? ' (YOU)' : ''
    if (!p.alive) {
      output += `  [${state.players.indexOf(p)}] ${p.address}${isMe} — DEAD\n`
    } else {
      const items = p.itemNames.filter(n => n !== 'NONE').join(', ')
      output += `  [${state.players.indexOf(p)}] ${p.address}${isMe} — HP: ${p.hp}/${maxHp} — Items: ${items || 'none'}\n`
    }
  }

  output += `\nCurrent turn: ${state.currentTurn}`
  output += `\nShell: ${state.shellKnown ? (state.knownShellIsLive ? 'LIVE (known)' : 'BLANK (known)') : 'UNKNOWN'}`
  output += `\nHandsaw: ${state.sawActive ? 'ACTIVE' : 'NOT ACTIVE'}`

  const aliveOpponents = state.opponents.filter(o => o.alive)
  output += `\nAlive opponents: ${aliveOpponents.map(o => `${o.address.slice(0, 6)} (HP:${o.hp})`).join(', ')}`

  // Print as plain text (not JSON) so the LLM reads it naturally
  console.log(output)
  process.exit(0)
}

async function cmdQueueLength() {
  const len = await publicClient.readContract({
    ...factoryContract,
    functionName: 'getQueueLength',
    args: [config.buyIn],
  }) as bigint

  ok({ queueLength: Number(len), buyIn: formatEther(config.buyIn) })
}

async function cmdJoinQueue(args: string[]) {
  const agentIndex = parseAgentIndex(requireArg(args, 0, 'agentIndex'))
  const agentAddr = walletClients[agentIndex].account!.address

  // Check if already in queue
  const inQueue = await publicClient.readContract({
    ...factoryContract,
    functionName: 'isInQueue',
    args: [agentAddr],
  }) as boolean

  if (inQueue) {
    ok({ status: 'already_in_queue', agent: agentIndex, address: agentAddr })
    return
  }

  const hash = await sendTx(
    agentIndex,
    addresses.gameFactory as Address,
    gameFactoryAbi,
    'joinQueue',
    [config.buyIn],
    config.buyIn,
  )

  ok({ status: 'joined', agent: agentIndex, address: agentAddr, tx: hash })
}

async function cmdStartGame() {
  const hash = await sendTx(
    0,
    addresses.gameFactory as Address,
    gameFactoryAbi,
    'startGame',
    [config.buyIn, config.playerCount],
  )

  // Get the new game ID
  const nextId = await publicClient.readContract({
    ...gameContract,
    functionName: 'nextGameId',
  }) as bigint
  const gameId = nextId - 1n

  ok({ status: 'game_created', gameId: gameId.toString(), tx: hash })
}

async function cmdUseItem(args: string[]) {
  const gameId = parseBigInt(requireArg(args, 0, 'gameId'), 'gameId')
  const agentIndex = parseAgentIndex(requireArg(args, 1, 'agentIndex'))
  const itemIndex = parseInt(requireArg(args, 2, 'itemIndex'), 10)

  if (isNaN(itemIndex) || itemIndex < 0) {
    fail(`Invalid item index: ${args[2]}`)
  }

  const hash = await sendTx(
    agentIndex,
    addresses.buckshotGame as Address,
    buckshotGameAbi,
    'useItem',
    [gameId, itemIndex],
  )

  ok({ status: 'item_used', agent: agentIndex, itemIndex, tx: hash })
}

async function cmdShootOpponent(args: string[]) {
  const gameId = parseBigInt(requireArg(args, 0, 'gameId'), 'gameId')
  const agentIndex = parseAgentIndex(requireArg(args, 1, 'agentIndex'))
  const target = requireArg(args, 2, 'targetAddress') as Address

  const hash = await sendTx(
    agentIndex,
    addresses.buckshotGame as Address,
    buckshotGameAbi,
    'shootOpponent',
    [gameId, target],
  )

  ok({ status: 'shot_fired', agent: agentIndex, target, tx: hash })
}

async function cmdShootSelf(args: string[]) {
  const gameId = parseBigInt(requireArg(args, 0, 'gameId'), 'gameId')
  const agentIndex = parseAgentIndex(requireArg(args, 1, 'agentIndex'))

  const hash = await sendTx(
    agentIndex,
    addresses.buckshotGame as Address,
    buckshotGameAbi,
    'shootSelf',
    [gameId],
  )

  ok({ status: 'shot_self', agent: agentIndex, tx: hash })
}

async function cmdForceTimeout(args: string[]) {
  const gameId = parseBigInt(requireArg(args, 0, 'gameId'), 'gameId')

  // Check if timeout is actually needed
  const gameView = await publicClient.readContract({
    ...gameContract,
    functionName: 'getGameState',
    args: [gameId],
  }) as any

  if (gameView.phase !== Phase.ACTIVE) {
    ok({ status: 'game_not_active', phase: gameView.phase })
    return
  }

  const block = await publicClient.getBlock()
  if (block.timestamp <= gameView.turnDeadline) {
    ok({
      status: 'not_expired',
      currentTime: block.timestamp.toString(),
      deadline: gameView.turnDeadline.toString(),
      secondsLeft: (gameView.turnDeadline - block.timestamp).toString(),
    })
    return
  }

  const hash = await sendTx(
    0,
    addresses.buckshotGame as Address,
    buckshotGameAbi,
    'forceTimeout',
    [gameId],
  )

  ok({ status: 'timeout_forced', gameId: gameId.toString(), tx: hash })
}

async function cmdFallbackStrategy(args: string[]) {
  const gameId = parseBigInt(requireArg(args, 0, 'gameId'), 'gameId')
  const agentIndex = parseAgentIndex(requireArg(args, 1, 'agentIndex'))
  const agentAddr = walletClients[agentIndex].account!.address

  const state = await readGameState(gameId, agentAddr)
  const actions = fallbackStrategy(state)

  // Format actions as CLI commands for OpenClaw to execute
  const commands: string[] = []
  for (const action of actions) {
    switch (action.type) {
      case 'useItem':
        commands.push(`npx tsx src/cli.ts use-item ${gameId} ${agentIndex} ${action.itemIndex}`)
        break
      case 'shootOpponent':
        commands.push(`npx tsx src/cli.ts shoot-opponent ${gameId} ${agentIndex} ${action.target}`)
        break
      case 'shootSelf':
        commands.push(`npx tsx src/cli.ts shoot-self ${gameId} ${agentIndex}`)
        break
    }
  }

  ok({ actions, commands })
}

// ── Main router ──────────────────────────────────────────────────────

const USAGE = `Usage: npx tsx src/cli.ts <command> [args]

Read-only:
  agents                                        List all agent addresses
  game-status                                   Current game status
  read-state <gameId> <agentIndex>              Full game state for an agent
  queue-length                                  Players in queue

Matchmaking:
  join-queue <agentIndex>                       Join the queue
  start-game                                    Create game from queue

Game actions:
  use-item <gameId> <agentIndex> <itemIndex>    Use an item
  shoot-opponent <gameId> <agentIndex> <addr>   Shoot an opponent
  shoot-self <gameId> <agentIndex>              Shoot yourself

Utilities:
  force-timeout <gameId>                        Force turn timeout
  fallback-strategy <gameId> <agentIndex>       Get deterministic actions`

async function main() {
  const args = process.argv.slice(2)
  const command = args[0]
  const cmdArgs = args.slice(1)

  if (!command || command === '--help' || command === '-h') {
    console.log(USAGE)
    process.exit(0)
  }

  try {
    switch (command) {
      case 'agents':
        await cmdAgents()
        break
      case 'game-status':
        await cmdGameStatus()
        break
      case 'read-state':
        await cmdReadState(cmdArgs)
        break
      case 'queue-length':
        await cmdQueueLength()
        break
      case 'join-queue':
        await cmdJoinQueue(cmdArgs)
        break
      case 'start-game':
        await cmdStartGame()
        break
      case 'use-item':
        await cmdUseItem(cmdArgs)
        break
      case 'shoot-opponent':
        await cmdShootOpponent(cmdArgs)
        break
      case 'shoot-self':
        await cmdShootSelf(cmdArgs)
        break
      case 'force-timeout':
        await cmdForceTimeout(cmdArgs)
        break
      case 'fallback-strategy':
        await cmdFallbackStrategy(cmdArgs)
        break
      default:
        console.error(`Unknown command: ${command}`)
        console.log(USAGE)
        process.exit(1)
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    fail(msg.slice(0, 200))
  }
}

main()
