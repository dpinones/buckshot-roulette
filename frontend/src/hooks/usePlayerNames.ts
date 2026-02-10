import { useState, useEffect } from 'react'
import { type Address } from 'viem'
import { ADDRESSES, playerProfileAbi } from '../config/contracts'
import { client } from './useGameState'

/**
 * Fetches on-chain names for a list of player addresses.
 * Returns a map of lowercase address → name (empty string if no name set).
 */
export function usePlayerNames(players: readonly Address[]) {
  const [names, setNames] = useState<Record<string, string>>({})

  useEffect(() => {
    if (players.length === 0) return
    let active = true

    async function fetchNames() {
      try {
        const results = await Promise.all(
          players.map(async (addr) => {
            try {
              const name = await client.readContract({
                address: ADDRESSES.playerProfile,
                abi: playerProfileAbi,
                functionName: 'getName',
                args: [addr],
              })
              return { addr, name: name as string }
            } catch {
              return { addr, name: '' }
            }
          })
        )

        if (!active) return

        const map: Record<string, string> = {}
        for (const { addr, name } of results) {
          map[addr.toLowerCase()] = name
        }
        setNames(map)
      } catch {
        // ignore
      }
    }

    fetchNames()
    return () => { active = false }
  }, [players.join(',')])

  return names
}
