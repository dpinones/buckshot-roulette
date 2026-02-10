import { connectorsForWallets } from '@rainbow-me/rainbowkit'
import {
  injectedWallet,
  metaMaskWallet,
  walletConnectWallet,
} from '@rainbow-me/rainbowkit/wallets'
import { createConfig, http } from 'wagmi'
import { mock } from 'wagmi/connectors'
import { defineChain, createPublicClient, createWalletClient, type WalletClient } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { foundry } from 'viem/chains'

export const monadTestnet = defineChain({
  id: 10143,
  name: 'Monad Testnet',
  nativeCurrency: { name: 'Monad', symbol: 'MON', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://testnet-rpc.monad.xyz'] },
  },
  blockExplorers: {
    default: { name: 'Monad Explorer', url: 'https://testnet.monadexplorer.com' },
  },
  testnet: true,
})

const isTestnet = import.meta.env.VITE_NETWORK === 'testnet'
export const isLocal = !isTestnet

export const activeChain = isTestnet ? monadTestnet : foundry

// Anvil default accounts for local dev
export const BURNER_ACCOUNTS = [
  '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
  '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
] as const

// Anvil default private keys (well-known, NOT secrets)
const BURNER_KEYS = [
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
  '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
] as const

// RainbowKit wallets (MetaMask, WalletConnect, etc.)
const rainbowConnectors = connectorsForWallets(
  [
    {
      groupName: 'Wallets',
      wallets: [injectedWallet, metaMaskWallet, walletConnectWallet],
    },
  ],
  {
    appName: 'Buckshot Roulette',
    projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'buckshot-dev',
  }
)

// Mock connectors for Anvil burner accounts (local only)
const burnerConnectors = isLocal
  ? BURNER_ACCOUNTS.map((addr) =>
      mock({ accounts: [addr], features: { defaultConnected: false, connectError: false } })
    )
  : []

const rpcUrl = isTestnet ? 'https://testnet-rpc.monad.xyz' : 'http://127.0.0.1:8545'

export const config = isTestnet
  ? createConfig({
      connectors: rainbowConnectors,
      chains: [monadTestnet],
      transports: { [monadTestnet.id]: http(rpcUrl) },
    })
  : createConfig({
      connectors: [...rainbowConnectors, ...burnerConnectors],
      chains: [foundry],
      transports: { [foundry.id]: http(rpcUrl) },
    })

export const publicClient = createPublicClient({
  chain: activeChain,
  transport: http(
    isTestnet ? 'https://testnet-rpc.monad.xyz' : 'http://127.0.0.1:8545'
  ),
})

// Anvil wallet clients with real private keys for local tx signing
export const burnerWalletClients: Record<string, WalletClient> = isLocal
  ? Object.fromEntries(
      BURNER_KEYS.map((key, i) => {
        const account = privateKeyToAccount(key)
        const client = createWalletClient({
          account,
          chain: foundry,
          transport: http('http://127.0.0.1:8545'),
        })
        return [BURNER_ACCOUNTS[i].toLowerCase(), client]
      })
    )
  : {}
