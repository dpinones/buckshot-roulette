import { publicClient, walletClients } from './contracts/client.js'
import { addresses } from './contracts/addresses.js'
import { gameFactoryAbi } from './contracts/abis.js'
import { type Address } from 'viem'

const factory = { address: addresses.gameFactory as Address, abi: gameFactoryAbi } as const

async function main() {
  for (const wc of walletClients) {
    const addr = wc.account!.address
    const inQueue = await publicClient.readContract({
      ...factory,
      functionName: 'isInQueue',
      args: [addr],
    }) as boolean

    if (!inQueue) {
      console.log(`${addr} — not in queue, skipping`)
      continue
    }

    console.log(`${addr} — leaving queue...`)
    const hash = await wc.writeContract({
      ...factory,
      functionName: 'leaveQueue',
    } as any)
    await publicClient.waitForTransactionReceipt({ hash })
    console.log(`${addr} — left queue ✓`)
  }

  const qLen = await publicClient.readContract({
    ...factory,
    functionName: 'getQueueLength',
    args: [10000000000000n],
  })
  console.log(`Queue length: ${qLen}`)
}

main().catch((e) => { console.error('Error:', e); process.exit(1) })
