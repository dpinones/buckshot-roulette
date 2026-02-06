import { type Address, type WalletClient } from 'viem'
import { publicClient } from '../contracts/client.js'
import { addresses } from '../contracts/addresses.js'
import { buckshotGameAbi } from '../contracts/abis.js'
import { type GameAction, ITEM_NAMES } from '../strategy/action-types.js'
import { config } from '../config.js'
import { log } from '../logger.js'

const MAX_RETRIES = 3
const RETRY_DELAY_MS = 2000

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function sendTx(
  walletClient: WalletClient,
  functionName: string,
  args: unknown[],
  agentName: string,
  retries = MAX_RETRIES,
): Promise<boolean> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const hash = await walletClient.writeContract({
        address: addresses.buckshotGame as Address,
        abi: buckshotGameAbi,
        functionName,
        args,
        gas: 500_000n,
      } as any)

      const receipt = await publicClient.waitForTransactionReceipt({ hash })

      if (receipt.status === 'success') {
        return true
      }

      log.warn(agentName, `TX reverted: ${functionName} (attempt ${attempt}/${retries})`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      // Don't retry on known contract errors
      if (msg.includes('NotYourTurn') || msg.includes('GameNotActive') || msg.includes('GameAlreadyFinished')) {
        log.warn(agentName, `TX rejected: ${msg.slice(0, 80)}`)
        return false
      }
      log.warn(agentName, `TX failed: ${functionName} — ${msg.slice(0, 80)} (attempt ${attempt}/${retries})`)
    }

    if (attempt < retries) {
      await sleep(RETRY_DELAY_MS * attempt)
    }
  }

  return false
}

/**
 * Execute a sequence of game actions (items + shoot).
 * Returns true if the shoot was successful.
 */
export async function executeActions(
  actions: GameAction[],
  gameId: bigint,
  walletClient: WalletClient,
  agentName: string,
): Promise<boolean> {
  for (const action of actions) {
    switch (action.type) {
      case 'useItem': {
        log.action(agentName, `Using item [${action.itemIndex}]...`)
        const ok = await sendTx(
          walletClient,
          'useItem',
          [gameId, action.itemIndex],
          agentName,
        )
        if (!ok) {
          log.warn(agentName, `Item use failed, skipping remaining items`)
          // Don't fail entirely — skip to shoot
          continue
        }
        await sleep(config.actionDelayMs)
        break
      }
      case 'shootOpponent': {
        log.action(agentName, `Shooting opponent ${action.target.slice(0, 10)}...`)
        const ok = await sendTx(
          walletClient,
          'shootOpponent',
          [gameId, action.target],
          agentName,
        )
        return ok
      }
      case 'shootSelf': {
        log.action(agentName, `Shooting self (expecting blank)...`)
        const ok = await sendTx(
          walletClient,
          'shootSelf',
          [gameId],
          agentName,
        )
        return ok
      }
    }
  }

  // Shouldn't reach here if actions are valid (always end with shoot)
  log.error(agentName, 'No shoot action executed!')
  return false
}
