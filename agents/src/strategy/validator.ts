import { type Address } from 'viem'
import { type GameAction, ITEM_NAMES } from './action-types.js'
import { type ReadableGameState } from './game-state.js'
import { log } from '../logger.js'

/**
 * Validates LLM actions against actual game state.
 * Returns validated actions or null if invalid.
 */
export function validateActions(
  actions: GameAction[],
  state: ReadableGameState,
  agentName: string,
): GameAction[] | null {
  const validActions: GameAction[] = []
  const usedItemIndices = new Set<number>()

  for (const action of actions) {
    switch (action.type) {
      case 'useItem': {
        const idx = action.itemIndex
        if (idx < 0 || idx >= state.myItems.length) {
          log.warn(agentName, `Invalid item index: ${idx}`)
          continue // Skip invalid item, don't fail entirely
        }
        if (state.myItems[idx] === 0) {
          log.warn(agentName, `Item at index ${idx} is NONE`)
          continue
        }
        if (usedItemIndices.has(idx)) {
          log.warn(agentName, `Item index ${idx} already used this turn`)
          continue
        }
        usedItemIndices.add(idx)
        validActions.push(action)
        break
      }
      case 'shootOpponent': {
        const target = action.target.toLowerCase() as Address
        const opponent = state.opponents.find(
          (o) => o.address.toLowerCase() === target,
        )
        if (!opponent) {
          log.warn(agentName, `Target ${action.target} not found in opponents`)
          return null // Critical: can't shoot non-existent target
        }
        if (!opponent.alive) {
          log.warn(agentName, `Target ${action.target} is dead`)
          return null
        }
        validActions.push(action)
        break
      }
      case 'shootSelf':
        validActions.push(action)
        break
    }
  }

  // Must have at least a shoot action
  const lastAction = validActions[validActions.length - 1]
  if (!lastAction || (lastAction.type !== 'shootOpponent' && lastAction.type !== 'shootSelf')) {
    return null
  }

  return validActions
}

/**
 * Deterministic fallback strategy based on play_local.sh logic.
 * Used when LLM fails or returns invalid actions.
 */
export function fallbackStrategy(state: ReadableGameState): GameAction[] {
  const actions: GameAction[] = []

  // Priority-ordered item usage (up to 3 items)
  let knownShell: 'live' | 'blank' | null = state.shellKnown
    ? (state.knownShellIsLive ? 'live' : 'blank')
    : null

  let itemsUsed = 0
  const usedIndices = new Set<number>()

  for (let pass = 0; pass < 3 && itemsUsed < 3; pass++) {
    let usedThisPass = false

    for (let idx = 0; idx < state.myItems.length; idx++) {
      if (usedIndices.has(idx)) continue
      const item = state.myItems[idx]
      if (item === 0) continue

      const name = ITEM_NAMES[item]

      // 1. MAGNIFYING_GLASS - always use first if shell unknown
      if (item === 1 && knownShell === null) {
        actions.push({ type: 'useItem', itemIndex: idx })
        usedIndices.add(idx)
        // After using magnifying glass, we'll know the shell
        // For fallback, assume we need to re-read state, but we continue planning
        knownShell = 'unknown-will-read' as 'live' // placeholder
        usedThisPass = true
        itemsUsed++
        break
      }

      // 2. CIGARETTES - heal
      if (item === 5) {
        actions.push({ type: 'useItem', itemIndex: idx })
        usedIndices.add(idx)
        usedThisPass = true
        itemsUsed++
        break
      }

      // 3. HANDSAW - double damage (skip if shell known blank)
      if (item === 3 && knownShell !== 'blank' && !state.sawActive) {
        actions.push({ type: 'useItem', itemIndex: idx })
        usedIndices.add(idx)
        usedThisPass = true
        itemsUsed++
        break
      }

      // 4. BEER - eject if known blank
      if (item === 2 && knownShell === 'blank') {
        actions.push({ type: 'useItem', itemIndex: idx })
        usedIndices.add(idx)
        knownShell = null // shell ejected, next is unknown
        usedThisPass = true
        itemsUsed++
        break
      }

      // 5. INVERTER - flip if known blank
      if (item === 6 && knownShell === 'blank') {
        actions.push({ type: 'useItem', itemIndex: idx })
        usedIndices.add(idx)
        knownShell = 'live'
        usedThisPass = true
        itemsUsed++
        break
      }

      // 6. HANDCUFFS - use on strongest alive opponent
      if (item === 4) {
        actions.push({ type: 'useItem', itemIndex: idx })
        usedIndices.add(idx)
        usedThisPass = true
        itemsUsed++
        break
      }
    }

    if (!usedThisPass) break
  }

  // Shooting decision
  if (knownShell === 'blank') {
    actions.push({ type: 'shootSelf' })
  } else {
    // Target the opponent with the lowest HP (more likely to eliminate)
    const aliveOpponents = state.opponents.filter((o) => o.alive)
    if (aliveOpponents.length > 0) {
      const target = aliveOpponents.reduce((min, o) => (o.hp < min.hp ? o : min))
      actions.push({ type: 'shootOpponent', target: target.address })
    } else {
      actions.push({ type: 'shootSelf' }) // No opponents alive (shouldn't happen)
    }
  }

  return actions
}
