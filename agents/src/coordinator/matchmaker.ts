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

/**
 * Ensures an agent has a profile and sufficient balance.
 */
async function ensureReady(agent: Agent): Promise<boolean> {
  const [balance, hasProfile] = await Promise.all([
    publicClient.getBalance({ address: agent.address }),
    publicClient.readContract({
      ...profileContract,
      functionName: 'hasProfile',
      args: [agent.address],
    }) as Promise<boolean>,
  ])

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

/**
 * Joins a single agent to the queue. Returns true if joined (or already in queue).
 */
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
    await publicClient.waitForTransactionReceipt({ hash })
    log.info(agent.name, 'Joined queue')
    return true
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    log.error(agent.name, `Failed to join queue: ${msg.slice(0, 80)}`)
    return false
  }
}

/**
 * Watches the queue. When external players are detected, agents join
 * to fill the remaining spots and start the game.
 */
export async function waitAndCreateMatch(agents: Agent[]): Promise<bigint | null> {
  // Ensure all agents are ready (profile + balance)
  for (const agent of agents) {
    const ready = await ensureReady(agent)
    if (!ready) return null
  }

  const agentAddresses = new Set(agents.map((a) => a.address.toLowerCase()))

  log.system(`Watching queue (buy-in: ${formatEther(buyIn)} MON)... waiting for external players`)

  // Poll until we detect external players and can start a game
  while (true) {
    const queueLen = Number(
      await publicClient.readContract({
        ...factoryContract,
        functionName: 'getQueueLength',
        args: [buyIn],
      }) as bigint
    )

    // Count how many of our agents are already in queue
    let agentsInQueue = 0
    for (const agent of agents) {
      const inQueue = await publicClient.readContract({
        ...factoryContract,
        functionName: 'isInQueue',
        args: [agent.address],
      }) as boolean
      if (inQueue) agentsInQueue++
    }

    const externalPlayers = queueLen - agentsInQueue

    if (externalPlayers > 0) {
      log.system(`Detected ${externalPlayers} external player(s) in queue (${queueLen} total)`)

      // Calculate how many agents need to join to reach playerCount
      const spotsNeeded = config.playerCount - queueLen
      let joined = 0

      for (const agent of agents) {
        if (joined >= spotsNeeded) break

        const inQueue = await publicClient.readContract({
          ...factoryContract,
          functionName: 'isInQueue',
          args: [agent.address],
        }) as boolean
        if (inQueue) continue

        const ok = await joinAgent(agent)
        if (ok) joined++
        await sleep(500)
      }

      // Check if we have enough to start
      const newQueueLen = Number(
        await publicClient.readContract({
          ...factoryContract,
          functionName: 'getQueueLength',
          args: [buyIn],
        }) as bigint
      )

      if (newQueueLen >= config.playerCount) {
        // Start game
        try {
          const hash = await walletClients[0].writeContract({
            ...factoryContract,
            functionName: 'startGame',
            args: [buyIn, config.playerCount],
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
          log.error('Matchmaker', `Failed to start game: ${msg.slice(0, 80)}`)
          return null
        }
      } else {
        log.system(`Queue at ${newQueueLen}/${config.playerCount}, waiting for more players...`)
      }
    }

    await sleep(config.pollIntervalMs)
  }
}
