import { type Address, formatEther } from 'viem'
import { publicClient, walletClients } from '../contracts/client.js'
import { addresses } from '../contracts/addresses.js'
import { gameFactoryAbi, buckshotGameAbi, playerProfileAbi } from '../contracts/abis.js'
import { type Agent } from '../agents/types.js'
import { config } from '../config.js'
import { log } from '../logger.js'

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

const factoryContract = { address: addresses.gameFactory as Address, abi: gameFactoryAbi } as const
const profileContract = { address: addresses.playerProfile as Address, abi: playerProfileAbi } as const
const gameContract = { address: addresses.buckshotGame as Address, abi: buckshotGameAbi } as const
const buyIn = config.buyIn

const POLL_MS = 5_000
const RPC_DELAY_MS = 200

// ── Helpers ───────────────────────────────────────────────────

async function ensureReady(agent: Agent): Promise<boolean> {
  const balance = await publicClient.getBalance({ address: agent.address })
  await sleep(RPC_DELAY_MS)

  if (balance < buyIn * 2n) {
    log.error(agent.name, `Insufficient balance: ${formatEther(balance)} MON`)
    return false
  }

  const hasProfile = await publicClient.readContract({
    ...profileContract,
    functionName: 'hasProfile',
    args: [agent.address],
  }) as boolean
  await sleep(RPC_DELAY_MS)

  if (!hasProfile) {
    try {
      const hash = await agent.walletClient.writeContract({
        ...profileContract,
        functionName: 'createProfile',
        args: [agent.name],
      } as any)
      await publicClient.waitForTransactionReceipt({ hash })
      log.info(agent.name, 'Created player profile')
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      log.error(agent.name, `Failed to create profile: ${msg.slice(0, 80)}`)
      return false
    }
  }

  return true
}

async function joinAgent(agent: Agent): Promise<boolean> {
  try {
    const inQueue = await publicClient.readContract({
      ...factoryContract,
      functionName: 'isInQueue',
      args: [agent.address],
    }) as boolean

    if (inQueue) {
      log.info(agent.name, 'Already in queue')
      return true
    }

    const hash = await agent.walletClient.writeContract({
      ...factoryContract,
      functionName: 'joinQueue',
      args: [buyIn],
      value: buyIn,
    } as any)
    const receipt = await publicClient.waitForTransactionReceipt({ hash })
    if (receipt.status === 'reverted') {
      log.error(agent.name, `joinQueue tx reverted`)
      return false
    }
    log.info(agent.name, 'Joined queue')
    return true
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes('0xf91d7f9b') || msg.includes('AlreadyInQueue')) {
      log.info(agent.name, 'Already in queue (ok)')
      return true
    }
    log.error(agent.name, `Failed to join queue: ${msg.slice(0, 120)}`)
    return false
  }
}

async function getQueueLen(): Promise<number> {
  return Number(
    await publicClient.readContract({
      ...factoryContract,
      functionName: 'getQueueLength',
      args: [buyIn],
    }) as bigint,
  )
}

async function getNextGameId(): Promise<bigint> {
  return await publicClient.readContract({
    ...gameContract,
    functionName: 'nextGameId',
  }) as bigint
}

/**
 * Check if a game was created (by someone else) that includes any of our agents.
 * Scans games from `fromId` to current `nextGameId - 1`.
 */
async function findGameWithAgents(agents: Agent[], fromId: bigint): Promise<bigint | null> {
  const nextId = await getNextGameId()
  const agentAddrs = new Set(agents.map((a) => a.address.toLowerCase()))

  for (let id = fromId; id < nextId; id++) {
    const players = await publicClient.readContract({
      ...gameContract,
      functionName: 'getPlayers',
      args: [id],
    }) as Address[]

    const hasAgent = players.some((p) => agentAddrs.has(p.toLowerCase()))
    if (hasAgent) {
      log.game(`Found game #${id} (created externally) with our agents`)
      return id
    }
    await sleep(RPC_DELAY_MS)
  }

  return null
}

// ── Public API ────────────────────────────────────────────────

/**
 * One-time startup: check balance & create profiles for all agents.
 */
export async function ensureAllReady(agents: Agent[]): Promise<boolean> {
  for (const agent of agents) {
    const ok = await ensureReady(agent)
    if (!ok) return false
  }
  return true
}

/**
 * Watch the queue. When an external player is detected:
 * 1. Save nextGameId (to detect games created by others)
 * 2. Agents join the queue
 * 3. Try to start the game
 * 4. If queue emptied (someone else started) → find that game
 */
export async function watchQueueAndPlay(agents: Agent[]): Promise<bigint | null> {
  log.system(`Watching queue (buy-in: ${formatEther(buyIn)} MON)... waiting for players`)

  while (true) {
    const queueLen = await getQueueLen()

    if (queueLen > 0) {
      log.system(`Detected ${queueLen} player(s) in queue!`)

      // Save nextGameId before joining so we can detect externally-created games
      const nextIdBefore = await getNextGameId()

      // Agents join to fill the queue
      log.system('Agents joining queue...')
      for (const agent of agents) {
        await joinAgent(agent)
        await sleep(RPC_DELAY_MS)
      }

      // Small delay for RPC to sync, then try to start
      await sleep(2000)

      const finalLen = await getQueueLen()

      if (finalLen >= 2) {
        // We can start the game
        const startWith = Math.min(finalLen, 6)
        log.system(`Starting game with ${startWith} players`)

        try {
          const hash = await walletClients[0].writeContract({
            ...factoryContract,
            functionName: 'startGame',
            args: [buyIn, startWith],
          } as any)
          await publicClient.waitForTransactionReceipt({ hash })

          const gameId = (await getNextGameId()) - 1n
          log.game(`Game #${gameId} created!`)
          return gameId
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e)
          log.warn('Matchmaker', `startGame failed: ${msg.slice(0, 100)}`)
          // Someone else may have started it — fall through to check
        }
      }

      // Queue is empty or startGame failed → someone else created the game
      log.system('Queue emptied — checking if a game was created externally...')
      await sleep(2000)
      const gameId = await findGameWithAgents(agents, nextIdBefore)
      if (gameId !== null) {
        return gameId
      }

      log.system('No game found with our agents, continuing to watch...')
    }

    await sleep(POLL_MS)
  }
}
