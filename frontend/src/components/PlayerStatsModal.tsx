import { useState, useEffect } from 'react'
import { type Address, formatEther } from 'viem'
import { ADDRESSES, playerProfileAbi } from '../config/contracts'
import { client } from '../hooks/useGameState'
import { getCharacter } from '../config/characters'

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
  const char = getCharacter(label)

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
      className="fixed inset-0 z-[200] flex items-center justify-center animate-[fadeIn_0.2s_ease-out]"
      style={{ background: 'rgba(62, 39, 35, 0.5)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="bg-paper border-3 border-text-dark rounded-[16px] w-[340px] animate-[scaleIn_0.2s_ease-out] shadow-[4px_4px_0_var(--color-paper-shadow)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b-2 border-paper-shadow/40">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src={char.img} alt={label} className="w-12 h-12 rounded-[10px] object-contain bg-white/50 p-0.5" />
              <div>
                <span className="font-display text-lg text-text-dark">{char.name}</span>
                <div className="font-data text-[10px] text-text-light mt-0.5">{shortAddr(address)}</div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-text-light hover:text-text-dark text-lg cursor-pointer transition-colors px-1"
            >
              {'\u2715'}
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="px-5 py-4">
          {loading ? (
            <div className="font-data text-sm text-text-light animate-pulse text-center py-6">
              Loading stats...
            </div>
          ) : (
            <div className="space-y-2.5">
              {rows.map((row) => (
                <div key={row.label} className="flex items-center justify-between">
                  <span className="font-display text-[11px] text-text-light">
                    {row.label}
                  </span>
                  <span className={`font-data text-sm font-bold tabular-nums ${row.color ?? 'text-text-dark'}`}>
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
