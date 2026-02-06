import { type Address } from 'viem'
import { type GameAction } from './action-types.js'
import { log } from '../logger.js'

interface LLMResponse {
  thinking: string
  actions: Array<{
    type: 'useItem' | 'shootOpponent' | 'shootSelf'
    itemIndex?: number
    target?: string
  }>
}

export function parseLLMResponse(raw: string, agentName: string): GameAction[] | null {
  try {
    // Extract JSON from markdown code blocks if present
    let jsonStr = raw
    const codeBlockMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (codeBlockMatch) {
      jsonStr = codeBlockMatch[1].trim()
    }

    const parsed: LLMResponse = JSON.parse(jsonStr)

    if (parsed.thinking) {
      log.llm(agentName, `Thinking: ${parsed.thinking}`)
    }

    if (!Array.isArray(parsed.actions) || parsed.actions.length === 0) {
      log.warn(agentName, 'LLM returned no actions')
      return null
    }

    const actions: GameAction[] = []
    for (const action of parsed.actions) {
      switch (action.type) {
        case 'useItem':
          if (typeof action.itemIndex !== 'number') return null
          actions.push({ type: 'useItem', itemIndex: action.itemIndex })
          break
        case 'shootOpponent':
          if (!action.target) return null
          actions.push({ type: 'shootOpponent', target: action.target as Address })
          break
        case 'shootSelf':
          actions.push({ type: 'shootSelf' })
          break
        default:
          log.warn(agentName, `Unknown action type: ${(action as { type: string }).type}`)
          return null
      }
    }

    // Must end with a shoot action
    const lastAction = actions[actions.length - 1]
    if (lastAction.type !== 'shootOpponent' && lastAction.type !== 'shootSelf') {
      log.warn(agentName, 'Actions must end with a shoot')
      return null
    }

    return actions
  } catch (e) {
    log.warn(agentName, `Failed to parse LLM response: ${e}`)
    return null
  }
}
