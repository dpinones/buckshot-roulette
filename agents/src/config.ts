import 'dotenv/config'
import { parseEther } from 'viem'

function env(key: string, fallback?: string): string {
  const val = process.env[key] ?? fallback
  if (val === undefined) throw new Error(`Missing env var: ${key}`)
  return val
}

export const config = {
  // RPC
  rpcUrl: env('RPC_URL', 'http://127.0.0.1:8545'),

  // Contracts
  buckshotGameAddress: env('BUCKSHOT_GAME_ADDRESS', '0x5FbDB2315678afecb367f032d93F642f64180aa3'),
  gameFactoryAddress: env('GAME_FACTORY_ADDRESS', '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512'),

  // Agent private keys
  agentKeys: [
    env('AGENT_1_PRIVATE_KEY', '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a'),
    env('AGENT_2_PRIVATE_KEY', '0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6'),
    env('AGENT_3_PRIVATE_KEY', '0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a'),
    env('AGENT_4_PRIVATE_KEY', '0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba'),
    env('AGENT_5_PRIVATE_KEY', '0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564e'),
  ] as `0x${string}`[],

  // LLM keys
  anthropicApiKey: env('ANTHROPIC_API_KEY', ''),
  openaiApiKey: env('OPENAI_API_KEY', ''),

  // Game
  paused: env('PAUSED', 'false').toLowerCase() === 'true',
  buyIn: parseEther(env('BUY_IN', '0.00001')),
  pollIntervalMs: parseInt(env('POLL_INTERVAL_MS', '2000')),
  actionDelayMs: parseInt(env('ACTION_DELAY_MS', '2500')),
  playerCount: 5 as const,
}
