import { type Address } from 'viem'
import { publicClient, walletClients } from '../contracts/client.js'
import { addresses } from '../contracts/addresses.js'
import { buckshotGameAbi } from '../contracts/abis.js'
import { log } from '../logger.js'

/**
 * Checks if the current turn has expired and forces a timeout.
 * Uses the first agent's wallet to send the forceTimeout tx.
 */
export async function checkAndForceTimeout(gameId: bigint): Promise<boolean> {
  const contract = { address: addresses.buckshotGame as Address, abi: buckshotGameAbi } as const

  try {
    const gameView = await publicClient.readContract({
      ...contract,
      functionName: 'getGameState',
      args: [gameId],
    }) as { turnDeadline: bigint; phase: number }

    // Only check if game is active
    if (gameView.phase !== 1) return false

    const block = await publicClient.getBlock()
    const now = block.timestamp

    if (now > gameView.turnDeadline) {
      log.warn('Timeout', `Turn deadline exceeded, forcing timeout on game #${gameId}`)

      const wallet = walletClients[0]
      const hash = await wallet.writeContract({
        ...contract,
        functionName: 'forceTimeout',
        args: [gameId],
      } as any)

      await publicClient.waitForTransactionReceipt({ hash })
      log.action('Timeout', `forceTimeout successful on game #${gameId}`)
      return true
    }
  } catch (e) {
    // TurnNotExpired is expected when timeout hasn't elapsed
    const msg = e instanceof Error ? e.message : String(e)
    if (!msg.includes('TurnNotExpired')) {
      log.warn('Timeout', `Timeout check error: ${msg.slice(0, 80)}`)
    }
  }

  return false
}
