import { useState, useEffect } from 'react'
import { type Address, formatEther } from 'viem'
import {
  ADDRESSES,
  playerProfileAbi,
  buckshotGameEventAbi,
} from '../config/contracts'
import { client } from './useGameState'

export interface PlayerStats {
  address: Address
  gamesPlayed: number
  gamesWon: number
  kills: number
  deaths: number
  shotsFired: number
  itemsUsed: number
  totalEarnings: bigint
  totalEarningsFormatted: string
  winRate: number
  kd: string
}

export function usePlayerStats(pollInterval = 10000) {
  const [stats, setStats] = useState<PlayerStats[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    async function fetchStats() {
      try {
        // Get all GameCreated events to discover player addresses
        const logs = await client.getContractEvents({
          address: ADDRESSES.buckshotGame,
          abi: buckshotGameEventAbi,
          eventName: 'GameCreated',
          fromBlock: 0n,
          toBlock: 'latest',
        })

        if (!active) return

        // Collect unique addresses (ignore legacy games < 17)
        const addressSet = new Set<string>()
        for (const log of logs) {
          if (log.args.gameId! < 17n) continue
          const players = log.args.players
          if (players) {
            for (const p of players) {
              addressSet.add(p.toLowerCase())
            }
          }
        }

        if (addressSet.size === 0) {
          setStats([])
          setLoading(false)
          return
        }

        const addresses = Array.from(addressSet)

        // Batch fetch stats for each player
        const results = await Promise.all(
          addresses.map(async (addr) => {
            const result = await client.readContract({
              address: ADDRESSES.playerProfile,
              abi: playerProfileAbi,
              functionName: 'getStats',
              args: [addr as Address],
            })
            return { address: addr as Address, raw: result }
          })
        )

        if (!active) return

        const playerStats: PlayerStats[] = results
          .filter((r) => r.raw.gamesPlayed > 0)
          .map(({ address, raw }) => {
            const kd = raw.deaths > 0
              ? (raw.kills / raw.deaths).toFixed(2)
              : raw.kills > 0 ? `${raw.kills}.00` : '0.00'

            return {
              address,
              gamesPlayed: raw.gamesPlayed,
              gamesWon: raw.gamesWon,
              kills: raw.kills,
              deaths: raw.deaths,
              shotsFired: raw.shotsFired,
              itemsUsed: raw.itemsUsed,
              totalEarnings: raw.totalEarnings,
              totalEarningsFormatted: formatEther(raw.totalEarnings),
              winRate: raw.gamesPlayed > 0
                ? Math.round((raw.gamesWon / raw.gamesPlayed) * 100)
                : 0,
              kd,
            }
          })

        // Sort by wins desc, then earnings desc
        playerStats.sort((a, b) => {
          if (b.gamesWon !== a.gamesWon) return b.gamesWon - a.gamesWon
          if (b.totalEarnings !== a.totalEarnings) {
            return b.totalEarnings > a.totalEarnings ? 1 : -1
          }
          return b.kills - a.kills
        })

        setStats(playerStats)
        setError(null)
        setLoading(false)
      } catch (e) {
        if (!active) return
        setError(e instanceof Error ? e.message : 'Failed to fetch stats')
        setLoading(false)
      }
    }

    fetchStats()
    const interval = setInterval(fetchStats, pollInterval)
    return () => {
      active = false
      clearInterval(interval)
    }
  }, [pollInterval])

  return { stats, loading, error }
}
