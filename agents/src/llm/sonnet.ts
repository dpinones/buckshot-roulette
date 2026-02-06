import Anthropic from '@anthropic-ai/sdk'
import { type LLMProvider } from './provider.js'
import { config } from '../config.js'

export function createSonnetProvider(): LLMProvider {
  const client = new Anthropic({ apiKey: config.anthropicApiKey })

  return {
    name: 'claude-sonnet',
    async complete(system: string, user: string): Promise<string> {
      const response = await client.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 1024,
        system,
        messages: [{ role: 'user', content: user }],
      })

      const block = response.content[0]
      if (block.type === 'text') return block.text
      throw new Error('Unexpected response type from Sonnet')
    },
  }
}
