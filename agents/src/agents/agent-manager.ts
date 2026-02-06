import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { type Address } from 'viem'
import { type Agent } from './types.js'
import { walletClients } from '../contracts/client.js'
import { type LLMProvider } from '../llm/provider.js'
import { createSonnetProvider } from '../llm/sonnet.js'
import { createGPTProvider } from '../llm/gpt.js'
import { config } from '../config.js'
import { log } from '../logger.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

interface AgentDef {
  name: string
  personalityFile: string
  llm: 'sonnet' | 'gpt'
}

const AGENT_DEFS: AgentDef[] = [
  { name: 'El Calculador', personalityFile: 'el-calculador.md', llm: 'sonnet' },
  { name: 'El Agresivo', personalityFile: 'el-agresivo.md', llm: 'gpt' },
  { name: 'La Tramposa', personalityFile: 'la-tramposa.md', llm: 'gpt' },
  { name: 'El Filosofo', personalityFile: 'el-filosofo.md', llm: 'sonnet' },
  { name: 'El Aprendiz', personalityFile: 'el-aprendiz.md', llm: 'sonnet' },
]

function loadPersonality(filename: string): string {
  const path = join(__dirname, 'personalities', filename)
  return readFileSync(path, 'utf-8')
}

export function createAgents(): Agent[] {
  // Create LLM providers (shared instances)
  let sonnetProvider: LLMProvider | null = null
  let gptProvider: LLMProvider | null = null

  if (config.anthropicApiKey) {
    sonnetProvider = createSonnetProvider()
  }
  if (config.openaiApiKey) {
    gptProvider = createGPTProvider()
  }

  const agents: Agent[] = AGENT_DEFS.map((def, i) => {
    const wc = walletClients[i]
    const address = wc.account!.address

    let provider: LLMProvider
    if (def.llm === 'sonnet' && sonnetProvider) {
      provider = sonnetProvider
    } else if (def.llm === 'gpt' && gptProvider) {
      provider = gptProvider
    } else if (sonnetProvider) {
      provider = sonnetProvider
    } else if (gptProvider) {
      provider = gptProvider
    } else {
      // No LLM available — create a dummy that always returns empty
      // Fallback strategy will kick in
      provider = {
        name: 'none',
        async complete() { return '{}' },
      }
      log.warn(def.name, 'No LLM API key configured, will use fallback strategy')
    }

    const personality = loadPersonality(def.personalityFile)

    log.info(def.name, `Initialized at ${address} with ${provider.name}`)

    return {
      name: def.name,
      address: address as Address,
      walletClient: wc,
      llmProvider: provider,
      personality,
    }
  })

  return agents
}

export function findAgentByAddress(agents: Agent[], address: Address): Agent | undefined {
  return agents.find(
    (a) => a.address.toLowerCase() === address.toLowerCase(),
  )
}
