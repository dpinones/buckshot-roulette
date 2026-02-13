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
  buckshotGameAddress: env('BUCKSHOT_GAME_ADDRESS', '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512'),
  gameFactoryAddress: env('GAME_FACTORY_ADDRESS', '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9'),
  playerProfileAddress: env('PLAYER_PROFILE_ADDRESS', '0x5FbDB2315678afecb367f032d93F642f64180aa3'),

  // Agent private keys
  agentKeys: [
    env('AGENT_1_PRIVATE_KEY', '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a'),
    env('AGENT_2_PRIVATE_KEY', '0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6'),
    env('AGENT_3_PRIVATE_KEY', '0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a'),
  ] as `0x${string}`[],

  // LLM keys
  anthropicApiKey: env('ANTHROPIC_API_KEY', ''),
  openaiApiKey: env('OPENAI_API_KEY', ''),

  // Game
  paused: env('PAUSED', 'false').toLowerCase() === 'true',
  buyIn: parseEther(env('BUY_IN', '0.00001')),
  pollIntervalMs: parseInt(env('POLL_INTERVAL_MS', '2000')),
  actionDelayMs: parseInt(env('ACTION_DELAY_MS', '3000')),
  playerCount: 4 as const,
}
