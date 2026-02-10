import { useState, useEffect } from 'react'
import { type Address, formatEther } from 'viem'
import {
  ADDRESSES,
  buckshotGameAbi,
  buckshotGameEventAbi,
} from '../config/contracts'
import { client } from './useGameState'

export interface FinishedGame {
  id: bigint
  players: Address[]
  winner: Address
  prize: bigint
  prizeFormatted: string
  playerCount: number
}

export function useGameHistory(pollInterval = 10000) {
  const [games, setGames] = useState<FinishedGame[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    async function fetchHistory() {
      try {
        // Get all GameEnded events
        const endedLogs = await client.getContractEvents({
          address: ADDRESSES.buckshotGame,
          abi: buckshotGameEventAbi,
          eventName: 'GameEnded',
          fromBlock: 0n,
          toBlock: 'latest',
        })

        if (!active) return

        // For each ended game, get the full game state to know players
        const finishedGames = await Promise.all(
          endedLogs.map(async (log) => {
            const gameId = log.args.gameId!
            const gameView = await client.readContract({
              address: ADDRESSES.buckshotGame,
              abi: buckshotGameAbi,
              functionName: 'getGameState',
              args: [gameId],
            })
            return {
              id: gameId,
              players: [...gameView.players] as Address[],
              winner: log.args.winner as Address,
              prize: log.args.prize!,
              prizeFormatted: formatEther(log.args.prize!),
              playerCount: gameView.players.length,
            } satisfies FinishedGame
          })
        )

        if (!active) return

        // Most recent first
        finishedGames.reverse()
        setGames(finishedGames)
        setLoading(false)
      } catch (e) {
        if (!active) return
        setLoading(false)
      }
    }

    fetchHistory()
    const interval = setInterval(fetchHistory, pollInterval)
    return () => {
      active = false
      clearInterval(interval)
    }
  }, [pollInterval])

  return { games, loading }
}
