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
 * Pick the alive opponent with the lowest HP (most likely to eliminate).
 */
function pickTarget(state: ReadableGameState): Address {
  const aliveOpponents = state.opponents.filter((o) => o.alive)
  if (aliveOpponents.length === 0) {
    return state.opponents[0].address // shouldn't happen
  }
  return aliveOpponents.reduce((min, o) => (o.hp < min.hp ? o : min)).address
}

/**
 * Find index of a specific item in myItems (0 = NONE, 1 = GLASS, 2 = BEER, 3 = HANDSAW, 4 = CIGARETTES).
 * Returns -1 if not found. Skips already-used indices.
 */
function findItem(state: ReadableGameState, itemId: number, usedIndices: Set<number>): number {
  return state.myItems.findIndex((it, idx) => it === itemId && !usedIndices.has(idx))
}

/**
 * Smart fallback strategy with probability-aware decision making.
 * Used when LLM fails or returns invalid actions.
 */
export function fallbackStrategy(state: ReadableGameState): GameAction[] {
  const actions: GameAction[] = []
  const usedIndices = new Set<number>()

  const knownShell: 'live' | 'blank' | null = state.shellKnown
    ? (state.knownShellIsLive ? 'live' : 'blank')
    : null

  const allLive = state.blankRemaining === 0 && state.shellsRemaining > 0
  const allBlank = state.liveRemaining === 0 && state.shellsRemaining > 0

  // --- Case 1: Shell is KNOWN BLANK → self-shot immediately (don't waste items) ---
  if (knownShell === 'blank') {
    actions.push({ type: 'shootSelf' })
    return actions
  }

  // --- Case 2: Shell is KNOWN LIVE → HANDSAW + shoot lowest-HP opponent ---
  if (knownShell === 'live') {
    if (!state.sawActive) {
      const sawIdx = findItem(state, 3, usedIndices)
      if (sawIdx !== -1) {
        actions.push({ type: 'useItem', itemIndex: sawIdx })
        usedIndices.add(sawIdx)
      }
    }
    actions.push({ type: 'shootOpponent', target: pickTarget(state) })
    return actions
  }

  // --- Case 3: Shell is UNKNOWN ---

  // Use MAGNIFYING_GLASS if available (information is highest priority)
  const glassIdx = findItem(state, 1, usedIndices)
  if (glassIdx !== -1) {
    actions.push({ type: 'useItem', itemIndex: glassIdx })
    usedIndices.add(glassIdx)
    // After glass, we won't know the result in fallback, so make a probability-based shot
    // The glass will reveal it on-chain and the next fallback call will handle it
    // For now, shoot opponent as safe default
    actions.push({ type: 'shootOpponent', target: pickTarget(state) })
    return actions
  }

  // Use CIGARETTES if HP < 3
  if (state.myHp < 3) {
    const cigIdx = findItem(state, 4, usedIndices)
    if (cigIdx !== -1) {
      actions.push({ type: 'useItem', itemIndex: cigIdx })
      usedIndices.add(cigIdx)
    }
  }

  // All remaining shells are LIVE → HANDSAW + shoot opponent
  if (allLive) {
    if (!state.sawActive) {
      const sawIdx = findItem(state, 3, usedIndices)
      if (sawIdx !== -1) {
        actions.push({ type: 'useItem', itemIndex: sawIdx })
        usedIndices.add(sawIdx)
      }
    }
    actions.push({ type: 'shootOpponent', target: pickTarget(state) })
    return actions
  }

  // All remaining shells are BLANK → self-shot for free extra turn
  if (allBlank) {
    actions.push({ type: 'shootSelf' })
    return actions
  }

  // Mixed shells, unknown → shoot opponent (conservative default)
  actions.push({ type: 'shootOpponent', target: pickTarget(state) })
  return actions
}
