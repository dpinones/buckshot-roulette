import { useState, useEffect } from 'react'
import { formatEther, type Address } from 'viem'
import {
  ADDRESSES,
  buckshotGameAbi,
  gameFactoryAbi,
  Phase,
} from '../config/contracts'
import { client } from './useGameState'

export interface QueueInfo {
  buyIn: bigint
  buyInFormatted: string
  playerCount: number
  players: Address[]
}

export interface GameSummary {
  id: bigint
  players: Address[]
  alive: boolean[]
  aliveCount: number
  currentRound: number
  phase: number
  winner: Address
  prizePool: bigint
  prizePoolFormatted: string
}

export interface LobbyState {
  queues: QueueInfo[]
  games: GameSummary[]
  connected: boolean
  error: string | null
}

export function useLobbyState(pollInterval = 3000) {
  const [lobby, setLobby] = useState<LobbyState>({
    queues: [],
    games: [],
    connected: false,
    error: null,
  })

  useEffect(() => {
    let active = true

    async function fetchLobby() {
      try {
        // 1. Get supported buy-ins and active game IDs in parallel
        const [buyIns, activeGameIds] = await Promise.all([
          client.readContract({
            address: ADDRESSES.gameFactory,
            abi: gameFactoryAbi,
            functionName: 'getSupportedBuyIns',
          }),
          client.readContract({
            address: ADDRESSES.gameFactory,
            abi: gameFactoryAbi,
            functionName: 'getActiveGames',
          }),
        ])

        if (!active) return

        // 2. Fetch queue info for each tier
        const queueResults = await Promise.all(
          buyIns.map(async (buyIn) => {
            const players = await client.readContract({
              address: ADDRESSES.gameFactory,
              abi: gameFactoryAbi,
              functionName: 'getQueue',
              args: [buyIn],
            })
            return {
              buyIn,
              buyInFormatted: formatEther(buyIn),
              playerCount: players.length,
              players: players as Address[],
            } satisfies QueueInfo
          })
        )

        // 3. Fetch game state for each active game (ignore legacy games < 20)
        const gameResults = await Promise.all(
          (activeGameIds as bigint[]).filter((id) => id >= 20n).map(async (gameId) => {
            const gameView = await client.readContract({
              address: ADDRESSES.buckshotGame,
              abi: buckshotGameAbi,
              functionName: 'getGameState',
              args: [gameId],
            })
            const alive = [...gameView.alive]
            return {
              id: gameView.id,
              players: [...gameView.players] as Address[],
              alive,
              aliveCount: alive.filter(Boolean).length,
              currentRound: gameView.currentRound,
              phase: gameView.phase,
              winner: gameView.winner as Address,
              prizePool: gameView.prizePool,
              prizePoolFormatted: formatEther(gameView.prizePool),
            } satisfies GameSummary
          })
        )

        if (!active) return

        // Filter to active and waiting (betting) games
        const activeGames = gameResults.filter((g) => g.phase === Phase.ACTIVE || g.phase === Phase.WAITING)

        setLobby({
          queues: queueResults,
          games: activeGames,
          connected: true,
          error: null,
        })
      } catch (e) {
        if (!active) return
        setLobby((prev) => ({
          ...prev,
          connected: false,
          error: e instanceof Error ? e.message : 'Connection failed',
        }))
      }
    }

    fetchLobby()
    const interval = setInterval(fetchLobby, pollInterval)
    return () => {
      active = false
      clearInterval(interval)
    }
  }, [pollInterval])

  return lobby
}
