import { useState, useEffect, useRef } from 'react'
import { createPublicClient, http, formatEther, type Address } from 'viem'
import { foundry } from 'viem/chains'
import {
  ADDRESSES,
  buckshotGameAbi,
} from '../config/contracts'

export interface GameState {
  id: bigint
  players: readonly Address[]
  hpList: readonly number[]
  alive: readonly boolean[]
  currentRound: number
  currentTurnIndex: number
  shellsRemaining: number
  liveRemaining: number
  blankRemaining: number
  turnDeadline: bigint
  phase: number
  winner: Address
  prizePool: bigint
  prizePoolFormatted: string
  currentTurn: Address
  playerItems: Record<string, readonly number[]>
}

export const client = createPublicClient({
  chain: foundry,
  transport: http('http://127.0.0.1:8545'),
})

export function useGameState(gameId: bigint, pollInterval = 2000) {
  const [state, setState] = useState<GameState | null>(null)
  const [prevState, setPrevState] = useState<GameState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)
  const stateRef = useRef<GameState | null>(null)

  useEffect(() => {
    let active = true
    // Reset state when gameId changes
    setState(null)
    setPrevState(null)
    stateRef.current = null

    async function fetchState() {
      try {
        const [gameView, currentTurn] = await Promise.all([
          client.readContract({
            address: ADDRESSES.buckshotGame,
            abi: buckshotGameAbi,
            functionName: 'getGameState',
            args: [gameId],
          }),
          client.readContract({
            address: ADDRESSES.buckshotGame,
            abi: buckshotGameAbi,
            functionName: 'getCurrentTurn',
            args: [gameId],
          }),
        ])

        if (!active) return

        const players = gameView.players
        const itemResults = await Promise.all(
          players.map((p) =>
            client.readContract({
              address: ADDRESSES.buckshotGame,
              abi: buckshotGameAbi,
              functionName: 'getMyItems',
              args: [gameId, p],
            })
          )
        )

        if (!active) return

        const playerItems: Record<string, readonly number[]> = {}
        players.forEach((p, i) => {
          playerItems[p.toLowerCase()] = itemResults[i]
        })

        const newState: GameState = {
          id: gameView.id,
          players: gameView.players,
          hpList: gameView.hpList,
          alive: gameView.alive,
          currentRound: gameView.currentRound,
          currentTurnIndex: gameView.currentTurnIndex,
          shellsRemaining: gameView.shellsRemaining,
          liveRemaining: gameView.liveRemaining,
          blankRemaining: gameView.blankRemaining,
          turnDeadline: gameView.turnDeadline,
          phase: gameView.phase,
          winner: gameView.winner,
          prizePool: gameView.prizePool,
          prizePoolFormatted: formatEther(gameView.prizePool),
          currentTurn,
          playerItems,
        }

        setConnected(true)
        setError(null)
        setPrevState(stateRef.current)
        stateRef.current = newState
        setState(newState)
      } catch (e) {
        if (!active) return
        setConnected(false)
        setError(e instanceof Error ? e.message : 'Connection failed')
      }
    }

    fetchState()
    const interval = setInterval(fetchState, pollInterval)
    return () => {
      active = false
      clearInterval(interval)
    }
  }, [gameId, pollInterval])

  return { state, prevState, error, connected }
}
