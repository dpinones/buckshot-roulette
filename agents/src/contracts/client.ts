import {
  createPublicClient,
  createWalletClient,
  http,
  defineChain,
  type PublicClient,
  type WalletClient,
  type Transport,
  type Chain,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { foundry } from 'viem/chains'
import { config } from '../config.js'

const monadTestnet = defineChain({
  id: 10143,
  name: 'Monad Testnet',
  nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
  rpcUrls: { default: { http: [config.rpcUrl] } },
})

const isLocal = config.rpcUrl.includes('127.0.0.1') || config.rpcUrl.includes('localhost')

const chain: Chain = isLocal
  ? { ...foundry, rpcUrls: { default: { http: [config.rpcUrl] } } }
  : monadTestnet

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
