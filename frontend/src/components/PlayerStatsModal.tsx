import { useState, useEffect } from 'react'
import { type Address, formatEther } from 'viem'
import { ADDRESSES, playerProfileAbi } from '../config/contracts'
import { client } from '../hooks/useGameState'

interface PlayerStatsModalProps {
  address: Address
  label: string
  onClose: () => void
}

interface Stats {
  gamesPlayed: number
  gamesWon: number
  kills: number
  deaths: number
  shotsFired: number
  itemsUsed: number
  totalEarnings: string
  winRate: number
  kd: string
}

function shortAddr(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

export function PlayerStatsModal({ address, label, onClose }: PlayerStatsModalProps) {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    async function fetch() {
      try {
        const raw = await client.readContract({
          address: ADDRESSES.playerProfile,
          abi: playerProfileAbi,
          functionName: 'getStats',
          args: [address],
        })

        if (!active) return

        const kd = raw.deaths > 0
          ? (raw.kills / raw.deaths).toFixed(2)
          : raw.kills > 0 ? `${raw.kills}.00` : '0.00'

        setStats({
          gamesPlayed: raw.gamesPlayed,
          gamesWon: raw.gamesWon,
          kills: raw.kills,
          deaths: raw.deaths,
          shotsFired: raw.shotsFired,
          itemsUsed: raw.itemsUsed,
          totalEarnings: formatEther(raw.totalEarnings),
          winRate: raw.gamesPlayed > 0
            ? Math.round((raw.gamesWon / raw.gamesPlayed) * 100)
            : 0,
          kd,
        })
      } catch {
        // No profile yet
        setStats({
          gamesPlayed: 0, gamesWon: 0, kills: 0, deaths: 0,
          shotsFired: 0, itemsUsed: 0, totalEarnings: '0',
          winRate: 0, kd: '0.00',
        })
      }
      setLoading(false)
    }

    fetch()
    return () => { active = false }
  }, [address])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const rows: { label: string; value: string; color?: string }[] = stats ? [
    { label: 'Games Played', value: String(stats.gamesPlayed) },
    { label: 'Wins', value: String(stats.gamesWon), color: 'text-alive' },
    { label: 'Win Rate', value: `${stats.winRate}%`, color: stats.winRate >= 50 ? 'text-alive' : undefined },
    { label: 'Kills', value: String(stats.kills), color: 'text-blood' },
    { label: 'Deaths', value: String(stats.deaths) },
    { label: 'K/D', value: stats.kd },
    { label: 'Shots Fired', value: String(stats.shotsFired) },
    { label: 'Items Used', value: String(stats.itemsUsed) },
    { label: 'Earnings', value: `${stats.totalEarnings} ETH`, color: 'text-gold' },
  ] : []

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]"
      onClick={onClose}
    >
      <div
        className="bg-[#0c0c14] border border-white/[0.08] rounded-sm w-[340px] animate-[scaleIn_0.2s_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/[0.06]">
          <div className="flex items-center justify-between">
            <div>
              <span className="font-display text-xl font-bold text-white/90">{label}</span>
              <div className="text-[10px] font-mono text-white/20 mt-0.5">{shortAddr(address)}</div>
            </div>
            <button
              onClick={onClose}
              className="text-white/20 hover:text-white/50 text-lg cursor-pointer transition-colors px-1"
            >
              {'\u2715'}
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="px-5 py-4">
          {loading ? (
            <div className="text-[10px] text-white/15 font-mono animate-pulse text-center py-6">
              Loading stats...
            </div>
          ) : (
            <div className="space-y-2.5">
              {rows.map((row) => (
                <div key={row.label} className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-[0.15em] text-white/25 font-display">
                    {row.label}
                  </span>
                  <span className={`text-[12px] font-mono tabular-nums ${row.color ?? 'text-white/50'}`}>
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
