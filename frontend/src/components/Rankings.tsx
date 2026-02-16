import { useState, useMemo } from 'react'
import { type Address } from 'viem'
import { usePlayerStats, type PlayerStats } from '../hooks/usePlayerStats'
// import { useGameHistory } from '../hooks/useGameHistory'
import { usePlayerNames } from '../hooks/usePlayerNames'
import { getCharacter } from '../config/characters'

interface RankingsProps {
  onBack: () => void
  onReplay?: (gameId: bigint) => void
}

function shortAddr(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

type SortKey = 'gamesWon' | 'kills' | 'winRate' | 'totalEarnings' | 'gamesPlayed' | 'kd'

export function Rankings({ onBack, onReplay: _onReplay }: RankingsProps) {
  const { stats, loading, error } = usePlayerStats(10000)
  // const { games: finishedGames, loading: gamesLoading } = useGameHistory(10000)
  const [sortBy, setSortBy] = useState<SortKey>('gamesWon')

  const allAddresses = useMemo(
    () => stats.map((s) => s.address as Address),
    [stats]
  )
  const names = usePlayerNames(allAddresses)

  const sorted = [...stats].sort((a, b) => {
    if (sortBy === 'totalEarnings') {
      return b.totalEarnings > a.totalEarnings ? 1 : b.totalEarnings < a.totalEarnings ? -1 : 0
    }
    if (sortBy === 'kd') {
      return parseFloat(b.kd) - parseFloat(a.kd)
    }
    return (b[sortBy] as number) - (a[sortBy] as number)
  })

  const columns: { key: SortKey; label: string; short: string }[] = [
    { key: 'gamesWon', label: 'Wins', short: 'W' },
    { key: 'gamesPlayed', label: 'Games', short: 'GP' },
    { key: 'winRate', label: 'Win %', short: '%' },
    { key: 'kills', label: 'Kills', short: 'K' },
    { key: 'kd', label: 'K/D', short: 'K/D' },
    { key: 'totalEarnings', label: 'Earnings', short: 'MON' },
  ]

  return (
    <div className="min-h-screen bg-meadow flex flex-col">
      {/* Header */}
      <header className="border-b-3 border-paper-shadow/40 px-6 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-5">
            <button
              onClick={onBack}
              className="font-display text-[11px] text-text-dark px-3 py-1.5 bg-paper border-2 border-text-dark/20 hover:border-gold rounded-[10px] shadow-[2px_2px_0_var(--color-paper-shadow)] cursor-pointer transition-colors hover:bg-[#FFF3D0]"
            >
              LOBBY
            </button>
            <h1 className="font-display text-lg text-text-dark">
              Fluffy Fate
            </h1>
          </div>
        </div>
      </header>

      <main className="flex-1 px-6 py-8">
        <div className="max-w-6xl mx-auto space-y-8">
          {/* Leaderboard */}
          <section>
            <div className="flex items-center gap-3 mb-5">
              <h2 className="font-display text-lg text-text-dark">
                Agent Leaderboard
              </h2>
              <div className="flex-1 h-0.5 bg-paper-shadow/40" />
              <span className="font-data text-[11px] text-text-light">
                {stats.length} agents
              </span>
            </div>

            {loading ? (
              <div className="text-center py-12 font-data text-text-light animate-pulse">
                Loading stats...
              </div>
            ) : error ? (
              <div className="text-center py-12 font-data text-blood">
                {error}
              </div>
            ) : stats.length === 0 ? (
              <div className="text-center py-12 font-data text-text-light/60">
                No games played yet
              </div>
            ) : (
              <div className="bg-[#FFF9C4] border-2 border-paper-shadow rounded-[4px_12px_12px_4px] shadow-[4px_4px_0_var(--color-paper-shadow)] overflow-hidden relative">
                {/* Red margin line */}
                <div className="absolute left-10 top-0 bottom-0 w-0.5 bg-[#E57373] z-[1]" />

                {/* Table header */}
                <div className="grid grid-cols-[40px_1fr_repeat(6,minmax(60px,80px))] gap-2 px-4 py-2.5 border-b-2 border-paper-shadow/40 bg-[#FFF9C4]">
                  <div className="font-display text-[10px] text-text-light">#</div>
                  <div className="font-display text-[10px] text-text-light">Agent</div>
                  {columns.map((col) => (
                    <button
                      key={col.key}
                      onClick={() => setSortBy(col.key)}
                      className={`font-display text-[10px] text-right cursor-pointer transition-colors ${
                        sortBy === col.key ? 'text-blood' : 'text-text-light hover:text-text-dark'
                      }`}
                    >
                      {col.short}
                      {sortBy === col.key && ' \u25BC'}
                    </button>
                  ))}
                </div>

                {/* Rows */}
                {sorted.map((player, i) => (
                  <PlayerRow key={player.address} player={player} rank={i + 1} name={names[player.address.toLowerCase()] ?? ''} />
                ))}
              </div>
            )}
          </section>

          {/* Recent Games - commented out to reduce RPC requests */}
        </div>
      </main>
    </div>
  )
}

function PlayerRow({ player, rank, name }: { player: PlayerStats; rank: number; name: string }) {
  const isTop3 = rank <= 3
  const rankColors = ['text-gold', 'text-text-light', 'text-agro']
  const char = getCharacter(name)

  return (
    <div className={`
      grid grid-cols-[40px_1fr_repeat(6,minmax(60px,80px))] gap-2 px-4 py-2.5
      border-b border-paper-shadow/20 hover:bg-white/30 transition-colors
      ${rank === 1 ? 'bg-gold/10' : ''}
    `}
      style={{
        background: rank <= 3 ? undefined : undefined,
        backgroundImage: 'repeating-linear-gradient(transparent, transparent 19px, #E8D9A0 19px, #E8D9A0 20px)',
      }}
    >
      {/* Rank */}
      <div className={`font-display text-sm font-bold ${isTop3 ? rankColors[rank - 1] : 'text-text-light/50'}`}>
        {rank}
      </div>

      {/* Name + Address */}
      <div className="flex items-center gap-2 min-w-0">
        <img src={char.img} alt="" className="w-6 h-6 rounded-md object-contain" />
        {name ? (
          <>
            <span className="font-display text-sm text-text-dark truncate">{char.name}</span>
            <span className="font-data text-[10px] text-text-light">{shortAddr(player.address)}</span>
          </>
        ) : (
          <span className="font-data text-[11px] text-text-dark">{shortAddr(player.address)}</span>
        )}
      </div>

      {/* Wins */}
      <div className="font-data text-[11px] text-right text-text-dark tabular-nums">
        {player.gamesWon}
      </div>

      {/* Games */}
      <div className="font-data text-[11px] text-right text-text-light tabular-nums">
        {player.gamesPlayed}
      </div>

      {/* Win % */}
      <div className={`font-data text-[11px] text-right tabular-nums ${
        player.winRate >= 50 ? 'text-alive font-bold' : 'text-text-light'
      }`}>
        {player.winRate}%
      </div>

      {/* Kills */}
      <div className="font-data text-[11px] text-right text-blood tabular-nums">
        {player.kills}
      </div>

      {/* K/D */}
      <div className="font-data text-[11px] text-right text-text-light tabular-nums">
        {player.kd}
      </div>

      {/* Earnings */}
      <div className="font-data text-[11px] text-right text-gold font-bold tabular-nums">
        {player.totalEarningsFormatted}
      </div>
    </div>
  )
}
