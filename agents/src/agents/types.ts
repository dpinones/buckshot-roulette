import { type Address, type WalletClient } from 'viem'
import { type LLMProvider } from '../llm/provider.js'

export interface Agent {
  name: string
  address: Address
  walletClient: WalletClient
  llmProvider: LLMProvider
  personality: string // Loaded from .md file
}
