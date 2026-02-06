import {
  createPublicClient,
  createWalletClient,
  http,
  type PublicClient,
  type WalletClient,
  type Transport,
  type Chain,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { foundry } from 'viem/chains'
import { config } from '../config.js'

// Use foundry chain for local, override RPC url
const chain: Chain = {
  ...foundry,
  rpcUrls: {
    default: { http: [config.rpcUrl] },
  },
}

const transport: Transport = http(config.rpcUrl)

export const publicClient: PublicClient = createPublicClient({
  chain,
  transport,
})

// One wallet client per agent
export const walletClients: WalletClient[] = config.agentKeys.map((key) => {
  const account = privateKeyToAccount(key)
  return createWalletClient({
    account,
    chain,
    transport,
  })
})

export function getAgentAddresses() {
  return walletClients.map((wc) => wc.account!.address)
}
