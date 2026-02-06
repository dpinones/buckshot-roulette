import OpenAI from 'openai'
import { type LLMProvider } from './provider.js'
import { config } from '../config.js'

export function createGPTProvider(): LLMProvider {
  const client = new OpenAI({ apiKey: config.openaiApiKey })

  return {
    name: 'gpt-4o',
    async complete(system: string, user: string): Promise<string> {
      const response = await client.chat.completions.create({
        model: 'gpt-4o',
        max_tokens: 1024,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      })

      const content = response.choices[0]?.message?.content
      if (!content) throw new Error('Empty response from GPT-4o')
      return content
    },
  }
}
