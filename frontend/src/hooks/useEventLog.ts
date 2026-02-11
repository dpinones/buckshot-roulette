import { useEffect, useRef, useState } from 'react'
import { type Address } from 'viem'
import { type GameState } from './useGameState'
import { ITEM_NAMES, Phase } from '../config/contracts'
import { getCharacter } from '../config/characters'

export interface GameEvent {
  id: number
  type: 'shot' | 'item' | 'round' | 'turn' | 'gameover' | 'info'
  message: string
  timestamp: number
}

function shortAddr(addr: Address): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

function playerLabel(
  addr: Address,
  players: readonly Address[],
  names?: Record<string, string>
): string {
  const name = names?.[addr.toLowerCase()] || ''
  const idx = players.findIndex(
    (p) => p.toLowerCase() === addr.toLowerCase()
  )
  if (idx >= 0) return getCharacter(name).name
  return shortAddr(addr)
}

export function useEventLog(
  state: GameState | null,
  prevState: GameState | null,
  names?: Record<string, string>
) {
  const [events, setEvents] = useState<GameEvent[]>([])
  const nextId = useRef(0)

  const addEvent = (type: GameEvent['type'], message: string) => {
    setEvents((prev) => [
      ...prev,
      { id: nextId.current++, type, message, timestamp: Date.now() },
    ])
  }

  useEffect(() => {
    if (!state || !prevState) return
    if (!state.players.length) return

    const players = state.players

    // Round change
    if (state.currentRound !== prevState.currentRound && state.currentRound > 0) {
      addEvent('round', `Round ${state.currentRound}`)
    }

    // HP changes (damage)
    for (let i = 0; i < players.length; i++) {
      const prevHp = prevState.hpList[i] ?? 0
      const currHp = state.hpList[i] ?? 0
      if (currHp < prevHp) {
        const dmg = prevHp - currHp
        addEvent(
          'shot',
          `BANG! ${playerLabel(players[i], players, names)} took ${dmg} damage (${prevHp} -> ${currHp} HP)`
        )
      }
      if (currHp > prevHp && state.currentRound === prevState.currentRound) {
        addEvent(
          'item',
          `${playerLabel(players[i], players, names)} healed +${currHp - prevHp} HP`
        )
      }
    }

    // Item changes
    for (const player of players) {
      const key = player.toLowerCase()
      const prevItems = prevState.playerItems[key] ?? []
      const currItems = state.playerItems[key] ?? []
      if (currItems.length < prevItems.length) {
        // Find which item was used (diff)
        const prevCounts: Record<number, number> = {}
        const currCounts: Record<number, number> = {}
        for (const item of prevItems) prevCounts[item] = (prevCounts[item] ?? 0) + 1
        for (const item of currItems) currCounts[item] = (currCounts[item] ?? 0) + 1
        for (const [itemStr, count] of Object.entries(prevCounts)) {
          const itemNum = Number(itemStr)
          const diff = count - (currCounts[itemNum] ?? 0)
          if (diff > 0 && itemNum > 0) {
            addEvent(
              'item',
              `${playerLabel(player, players, names)} used ${ITEM_NAMES[itemNum]}`
            )
          }
        }
      }
    }

    // Shell count changes (shot happened if shells decreased but no round change)
    if (
      state.shellsRemaining < prevState.shellsRemaining &&
      state.currentRound === prevState.currentRound
    ) {
      // Check if any HP changed — if not, it was a blank
      const anyDmg = players.some(
        (_, i) => (state.hpList[i] ?? 0) < (prevState.hpList[i] ?? 0)
      )
      if (!anyDmg) {
        addEvent('shot', '*click* Blank...')
      }
    }

    // Turn change
    if (
      state.currentTurn !== prevState.currentTurn &&
      state.phase === Phase.ACTIVE
    ) {
      addEvent(
        'turn',
        `${playerLabel(state.currentTurn, players, names)}'s turn`
      )
    }

    // Game over
    if (
      state.phase === Phase.FINISHED &&
      prevState.phase !== Phase.FINISHED
    ) {
      const winnerLabel = playerLabel(state.winner, players, names)
      addEvent(
        'gameover',
        `GAME OVER! ${winnerLabel} wins! Prize: ${state.prizePoolFormatted} ETH`
      )
    }
  }, [state, prevState])

  return events
}
