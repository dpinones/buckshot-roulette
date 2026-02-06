import { type Address, formatEther } from 'viem'
import { publicClient, walletClients } from '../contracts/client.js'
import { addresses } from '../contracts/addresses.js'
import { gameFactoryAbi, buckshotGameAbi } from '../contracts/abis.js'
import { type Agent } from '../agents/types.js'
import { config } from '../config.js'
import { log } from '../logger.js'

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Creates a new 4-player game by joining all agents to the queue
 * and then calling startGame.
 */
export async function createMatch(agents: Agent[]): Promise<bigint | null> {
  const factoryAddr = addresses.gameFactory as Address
  const factoryContract = { address: factoryAddr, abi: gameFactoryAbi } as const
  const buyIn = config.buyIn

  log.system(`Creating new match (buy-in: ${formatEther(buyIn)} ETH)...`)

  // Check balances
  for (const agent of agents) {
    const balance = await publicClient.getBalance({ address: agent.address })
    if (balance < buyIn * 2n) {
      log.error(agent.name, `Insufficient balance: ${formatEther(balance)} ETH`)
      return null
    }
  }

  // Join queue for each agent
  for (const agent of agents) {
    try {
      // Check if already in queue
      const inQueue = await publicClient.readContract({
        ...factoryContract,
        functionName: 'isInQueue',
        args: [agent.address],
      }) as boolean

      if (inQueue) {
        log.info(agent.name, 'Already in queue, skipping')
        continue
      }

      const hash = await agent.walletClient.writeContract({
        ...factoryContract,
        functionName: 'joinQueue',
        args: [buyIn],
        value: buyIn,
        gas: 200_000n,
      } as any)

      await publicClient.waitForTransactionReceipt({ hash })
      log.info(agent.name, 'Joined queue')
      await sleep(500) // Small delay between joins
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      log.error(agent.name, `Failed to join queue: ${msg.slice(0, 80)}`)
      return null
    }
  }

  // Verify queue length
  const queueLen = await publicClient.readContract({
    ...factoryContract,
    functionName: 'getQueueLength',
    args: [buyIn],
  }) as bigint

  if (queueLen < BigInt(config.playerCount)) {
    log.error('Matchmaker', `Queue has ${queueLen} players, need ${config.playerCount}`)
    return null
  }

  // Start game (any wallet can call this)
  try {
    const hash = await walletClients[0].writeContract({
      ...factoryContract,
      functionName: 'startGame',
      args: [buyIn, config.playerCount],
      gas: 1_000_000n,
    } as any)

    const receipt = await publicClient.waitForTransactionReceipt({ hash })

    // Get the game ID from the BuckshotGame contract
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
}
