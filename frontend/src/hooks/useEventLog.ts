import { useEffect, useRef, useState } from 'react'
import { type Address } from 'viem'
import { type GameState } from './useGameState'
import { ITEM_NAMES, Phase } from '../config/contracts'
import { getCharacter } from '../config/characters'

export type MessageSegment = { text: string; color?: string }

export interface GameEvent {
  id: number
  type: 'shot' | 'item' | 'round' | 'turn' | 'gameover' | 'info'
  segments: MessageSegment[]
  timestamp: number
}

const FRIENDLY_ITEM_NAMES: Record<number, string> = {
  1: 'Magnifying Glass',
  2: 'Beer',
  3: 'Handsaw',
  4: 'Cigarettes',
  5: 'Handcuffs',
  6: 'Inverter',
}

function friendlyItemName(itemType: number): string {
  return FRIENDLY_ITEM_NAMES[itemType] ?? ITEM_NAMES[itemType] ?? 'Unknown'
}

function playerSegment(
  addr: Address,
  players: readonly Address[],
  names?: Record<string, string>
): MessageSegment {
  const name = names?.[addr.toLowerCase()] || ''
  const char = getCharacter(name)
  const idx = players.findIndex(
    (p) => p.toLowerCase() === addr.toLowerCase()
  )
  if (idx >= 0) {
    return { text: char.name, color: 'bold' }
  }
  return { text: `${addr.slice(0, 6)}...${addr.slice(-4)}` }
}

function seg(text: string): MessageSegment {
  return { text }
}

export function useEventLog(
  state: GameState | null,
  prevState: GameState | null,
  names?: Record<string, string>
) {
  const [events, setEvents] = useState<GameEvent[]>([])
  const nextId = useRef(0)

  const addEvent = (type: GameEvent['type'], segments: MessageSegment[]) => {
    setEvents((prev) => [
      ...prev,
      { id: nextId.current++, type, segments, timestamp: Date.now() },
    ])
  }

  useEffect(() => {
    if (!state || !prevState) return
    if (!state.players.length) return

    const players = state.players

    // Round change
    if (state.currentRound !== prevState.currentRound && state.currentRound > 0) {
      addEvent('round', [seg(`Round ${state.currentRound}`)])
    }

    // Detect shooter from prevState.currentTurn
    const shooterAddr = prevState.currentTurn

    // HP changes (damage)
    for (let i = 0; i < players.length; i++) {
      const prevHp = prevState.hpList[i] ?? 0
      const currHp = state.hpList[i] ?? 0
      if (currHp < prevHp) {
        const dmg = prevHp - currHp
        const targetAddr = players[i]
        const isSelf = shooterAddr.toLowerCase() === targetAddr.toLowerCase()
        const shooterSeg = playerSegment(shooterAddr, players, names)
        const dmgStr = dmg > 1 ? `${dmg} damage` : '1 damage'

        if (isSelf) {
          addEvent('shot', [
            shooterSeg,
            seg(` shot themselves — ${dmgStr}! \u{1F4A5}`),
          ])
        } else {
          const targetSeg = playerSegment(targetAddr, players, names)
          addEvent('shot', [
            shooterSeg,
            seg(' shot '),
            targetSeg,
            seg(` — ${dmgStr}! \u{1F4A5}`),
          ])
        }
      }
      if (currHp > prevHp && state.currentRound === prevState.currentRound) {
        const healSeg = playerSegment(players[i], players, names)
        addEvent('item', [
          healSeg,
          seg(` healed +${currHp - prevHp} HP`),
        ])
      }
    }

    // Item changes
    for (const player of players) {
      const key = player.toLowerCase()
      const prevItems = prevState.playerItems[key] ?? []
      const currItems = state.playerItems[key] ?? []
      if (currItems.length < prevItems.length) {
        const prevCounts: Record<number, number> = {}
        const currCounts: Record<number, number> = {}
        for (const item of prevItems) prevCounts[item] = (prevCounts[item] ?? 0) + 1
        for (const item of currItems) currCounts[item] = (currCounts[item] ?? 0) + 1
        for (const [itemStr, count] of Object.entries(prevCounts)) {
          const itemNum = Number(itemStr)
          const diff = count - (currCounts[itemNum] ?? 0)
          if (diff > 0 && itemNum > 0) {
            const pSeg = playerSegment(player, players, names)
            addEvent('item', [
              pSeg,
              seg(` used ${friendlyItemName(itemNum)}`),
            ])
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
        const shooterSeg = playerSegment(shooterAddr, players, names)
        const turnChanged = state.currentTurn.toLowerCase() !== prevState.currentTurn.toLowerCase()
        if (turnChanged) {
          // Opponent blank — target is the next player (state.currentTurn)
          const targetSeg = playerSegment(state.currentTurn, players, names)
          addEvent('shot', [
            shooterSeg,
            seg(' shot '),
            targetSeg,
            seg(' — *click* blank'),
          ])
        } else {
          // Self blank — extra turn
          addEvent('shot', [
            shooterSeg,
            seg(' shot themselves — *click* blank, extra turn!'),
          ])
        }
      }
    }

    // Turn change — disabled, redundant with agent card highlight
    // if (
    //   state.currentTurn !== prevState.currentTurn &&
    //   state.phase === Phase.ACTIVE
    // ) {
    //   const turnSeg = playerSegment(state.currentTurn, players, names)
    //   addEvent('turn', [turnSeg, seg("'s turn")])
    // }

    // Game over
    if (
      state.phase === Phase.FINISHED &&
      prevState.phase !== Phase.FINISHED
    ) {
      const winnerSeg = playerSegment(state.winner, players, names)
      addEvent('gameover', [
        seg('GAME OVER! '),
        winnerSeg,
        seg(` wins! Prize: ${state.prizePoolFormatted} MON`),
      ])
    }
  }, [state, prevState])

  return events
}
