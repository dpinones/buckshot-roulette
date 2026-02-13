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
const buyIn = config.buyIn

const WAIT_AFTER_JOIN_MS = 10_000 // wait 10s after detecting players before starting
const MIN_PLAYERS = 4
const RPC_DELAY_MS = 200 // delay between RPC calls to avoid 429 rate limits
const POLL_INTERVAL_MS = 5_000 // how often to check the queue

async function ensureReady(agent: Agent): Promise<boolean> {
  const balance = await publicClient.getBalance({ address: agent.address })
  await sleep(RPC_DELAY_MS)
  const hasProfile = await publicClient.readContract({
    ...profileContract,
    functionName: 'hasProfile',
    args: [agent.address],
  }) as boolean
  await sleep(RPC_DELAY_MS)

  if (balance < buyIn * 2n) {
    log.error(agent.name, `Insufficient balance: ${formatEther(balance)} MON`)
    return false
  }

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

async function leaveQueueIfStuck(agent: Agent): Promise<void> {
  try {
    const inQueue = await publicClient.readContract({
      ...factoryContract,
      functionName: 'isInQueue',
      args: [agent.address],
    }) as boolean
    if (!inQueue) return

    log.info(agent.name, 'Stuck in queue from previous run, leaving...')
    const hash = await agent.walletClient.writeContract({
      ...factoryContract,
      functionName: 'leaveQueue',
    } as any)
    await publicClient.waitForTransactionReceipt({ hash })
    log.info(agent.name, 'Left stale queue')
  } catch {
    // Best-effort cleanup; if it fails we'll handle it in joinAgent
  }
}

async function joinAgent(agent: Agent): Promise<boolean> {
  try {
    const inQueue = await publicClient.readContract({
      ...factoryContract,
      functionName: 'isInQueue',
      args: [agent.address],
    }) as boolean

    if (inQueue) return true

    const hash = await agent.walletClient.writeContract({
      ...factoryContract,
      functionName: 'joinQueue',
      args: [buyIn],
      value: buyIn,
    } as any)
    const receipt = await publicClient.waitForTransactionReceipt({ hash })
    if (receipt.status === 'reverted') {
      log.error(agent.name, `joinQueue tx reverted (${hash})`)
      return false
    }
    log.info(agent.name, 'Joined queue')
    return true
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    // AlreadyInQueue (0xf91d7f9b) means the agent is in the queue — treat as success
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
    }) as bigint
  )
}

async function countAgentsInQueue(agents: Agent[]): Promise<number> {
  let count = 0
  for (const agent of agents) {
    const inQueue = await publicClient.readContract({
      ...factoryContract,
      functionName: 'isInQueue',
      args: [agent.address],
    }) as boolean
    if (inQueue) count++
    await sleep(RPC_DELAY_MS)
  }
  return count
}

/**
 * Watches the queue. When external players are detected, agents join
 * to fill spots. Waits 10s after reaching MIN_PLAYERS before starting
 * to give more players time to join.
 */
export async function waitAndCreateMatch(agents: Agent[]): Promise<bigint | null> {
  // Clean up agents stuck in queue from a previous run
  for (const agent of agents) {
    await leaveQueueIfStuck(agent)
    await sleep(RPC_DELAY_MS)
  }

  for (const agent of agents) {
    const ready = await ensureReady(agent)
    if (!ready) return null
  }

  log.system(`Watching queue (buy-in: ${formatEther(buyIn)} MON)... waiting for external players`)

  while (true) {
    const queueLen = await getQueueLen()
    await sleep(RPC_DELAY_MS)
    const agentsInQueue = await countAgentsInQueue(agents)
    const externalPlayers = queueLen - agentsInQueue

    if (externalPlayers > 0) {
      log.system(`Detected ${externalPlayers} external player(s) in queue (${queueLen} total)`)

      // Join agents to fill remaining spots up to MIN_PLAYERS
      const spotsToFill = Math.max(0, MIN_PLAYERS - queueLen)
      let joined = 0
      for (const agent of agents) {
        if (joined >= spotsToFill) break
        const inQueue = await publicClient.readContract({
          ...factoryContract,
          functionName: 'isInQueue',
          args: [agent.address],
        }) as boolean
        await sleep(RPC_DELAY_MS)
        if (inQueue) continue
        const ok = await joinAgent(agent)
        if (ok) joined++
        await sleep(1000)
      }

      // Wait for RPC to catch up with recent join txs (Monad testnet needs extra time)
      await sleep(5000)
      const afterJoinLen = await getQueueLen()

      if (afterJoinLen >= MIN_PLAYERS) {
        // Wait 10s to let more players join
        log.system(`${afterJoinLen} players in queue. Waiting 10s before starting...`)
        await sleep(WAIT_AFTER_JOIN_MS)

        // Final check — start with however many are in the queue now (min 4, max 6)
        const finalLen = await getQueueLen()
        if (finalLen < MIN_PLAYERS) {
          log.system(`Queue dropped to ${finalLen}, players may have left. Continuing to watch...`)
          await sleep(POLL_INTERVAL_MS)
          continue
        }

        const startWith = Math.min(finalLen, 6)
        log.system(`Starting game with ${startWith} players`)

        try {
          const hash = await walletClients[0].writeContract({
            ...factoryContract,
            functionName: 'startGame',
            args: [buyIn, startWith],
          } as any)
          await publicClient.waitForTransactionReceipt({ hash })

          const gameContract = { address: addresses.buckshotGame as Address, abi: buckshotGameAbi } as const
          const nextId = await publicClient.readContract({
            ...gameContract,
            functionName: 'nextGameId',
          }) as bigint

          const gameId = nextId - 1n
          log.game(`Game #${gameId} created!`)
          return gameId
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e)
          log.warn('Matchmaker', `startGame failed: ${msg.slice(0, 80)}. Retrying...`)
          await sleep(POLL_INTERVAL_MS)
          continue
        }
      } else {
        log.system(`Queue at ${afterJoinLen}/${MIN_PLAYERS}, waiting for more players...`)
      }
    }

    await sleep(POLL_INTERVAL_MS)
  }
}
