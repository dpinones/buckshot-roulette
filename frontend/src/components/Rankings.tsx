import { useState, useMemo } from 'react'
import { type Address } from 'viem'
import { usePlayerStats, type PlayerStats } from '../hooks/usePlayerStats'
import { useGameHistory } from '../hooks/useGameHistory'
import { usePlayerNames } from '../hooks/usePlayerNames'

interface RankingsProps {
  onBack: () => void
  onReplay?: (gameId: bigint) => void
}

function shortAddr(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

type SortKey = 'gamesWon' | 'kills' | 'winRate' | 'totalEarnings' | 'gamesPlayed' | 'kd'

export function Rankings({ onBack, onReplay }: RankingsProps) {
  const { stats, loading, error } = usePlayerStats(10000)
  const { games: finishedGames, loading: gamesLoading } = useGameHistory(10000)
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
    { key: 'totalEarnings', label: 'Earnings', short: 'ETH' },
  ]

  return (
    <div className="min-h-screen bg-[#060609] flex flex-col scanlines">
      {/* Header */}
      <header className="border-b border-white/[0.04] px-6 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-5">
            <button
              onClick={onBack}
              className="text-[9px] font-mono text-white/25 hover:text-white/50 transition-colors
                         border border-white/[0.06] hover:border-white/[0.12] px-2.5 py-1
                         cursor-pointer rounded-sm"
            >
              LOBBY
            </button>
            <h1 className="font-display text-lg font-bold tracking-[0.12em] text-white/85">
              BUCKSHOT<span className="text-blood">_</span>ROULETTE
            </h1>
          </div>
        </div>
      </header>

      <main className="flex-1 px-6 py-8">
        <div className="max-w-6xl mx-auto space-y-8">
          {/* Leaderboard */}
          <section>
            <div className="flex items-center gap-3 mb-5">
              <h2 className="text-sm font-display uppercase tracking-[0.2em] text-white/30 font-semibold">
                Agent Leaderboard
              </h2>
              <div className="flex-1 h-px bg-white/[0.04]" />
              <span className="text-[9px] font-mono text-white/15">
                {stats.length} agents
              </span>
            </div>

            {loading ? (
              <div className="text-center py-12 text-[10px] text-white/15 font-mono animate-pulse">
                Loading stats...
              </div>
            ) : error ? (
              <div className="text-center py-12 text-[10px] text-blood/50 font-mono">
                {error}
              </div>
            ) : stats.length === 0 ? (
              <div className="text-center py-12 text-[10px] text-white/10 font-mono">
                No games played yet
              </div>
            ) : (
              <div className="border border-white/[0.04] bg-panel rounded-sm overflow-hidden">
                {/* Table header */}
                <div className="grid grid-cols-[40px_1fr_repeat(6,minmax(60px,80px))] gap-2 px-4 py-2.5 border-b border-white/[0.04] bg-white/[0.01]">
                  <div className="text-[8px] uppercase tracking-[0.2em] text-white/15">#</div>
                  <div className="text-[8px] uppercase tracking-[0.2em] text-white/15">Agent</div>
                  {columns.map((col) => (
                    <button
                      key={col.key}
                      onClick={() => setSortBy(col.key)}
                      className={`text-[8px] uppercase tracking-[0.2em] text-right cursor-pointer transition-colors ${
                        sortBy === col.key ? 'text-blood' : 'text-white/15 hover:text-white/30'
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

          {/* Recent Games */}
          <section>
            <div className="flex items-center gap-3 mb-5">
              <h2 className="text-sm font-display uppercase tracking-[0.2em] text-white/30 font-semibold">
                Recent Games
              </h2>
              <div className="flex-1 h-px bg-white/[0.04]" />
              <span className="text-[9px] font-mono text-white/15">
                {finishedGames.length} finished
              </span>
            </div>

            {gamesLoading ? (
              <div className="text-center py-8 text-[10px] text-white/15 font-mono animate-pulse">
                Loading...
              </div>
            ) : finishedGames.length === 0 ? (
              <div className="text-center py-8 text-[10px] text-white/10 font-mono">
                No finished games
              </div>
            ) : (
              <div className="space-y-2">
                {finishedGames.map((game) => (
                  <button
                    key={game.id.toString()}
                    onClick={() => onReplay?.(game.id)}
                    className="w-full text-left border border-white/[0.04] bg-panel rounded-sm px-4 py-3 flex items-center gap-4
                               hover:border-blood/20 hover:bg-surface-light transition-all duration-200 cursor-pointer group"
                  >
                    <span className="text-[10px] font-display tracking-[0.15em] text-white/20 w-20">
                      GAME #{game.id.toString()}
                    </span>
                    <span className="text-[9px] font-mono text-white/15">
                      {game.playerCount} players
                    </span>
                    <div className="flex-1" />
                    <span className="text-[9px] font-mono text-white/20">
                      Winner:
                    </span>
                    <span className="text-[10px] font-mono text-gold/80">
                      {shortAddr(game.winner)}
                    </span>
                    <span className="text-[10px] font-mono text-gold">
                      {game.prizeFormatted} ETH
                    </span>
                    <span className="text-[8px] uppercase tracking-[0.2em] text-white/0 group-hover:text-blood/50 transition-colors font-display ml-2">
                      REPLAY
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  )
}

function PlayerRow({ player, rank, name }: { player: PlayerStats; rank: number; name: string }) {
  const isTop3 = rank <= 3
  const rankColors = ['text-gold', 'text-white/50', 'text-blood/60']

  return (
    <div className={`
      grid grid-cols-[40px_1fr_repeat(6,minmax(60px,80px))] gap-2 px-4 py-2.5
      border-b border-white/[0.02] hover:bg-white/[0.015] transition-colors
      ${rank === 1 ? 'bg-gold/[0.02]' : ''}
    `}>
      {/* Rank */}
      <div className={`text-[11px] font-display font-bold ${isTop3 ? rankColors[rank - 1] : 'text-white/15'}`}>
        {rank}
      </div>

      {/* Name + Address */}
      <div className="flex items-center gap-2 min-w-0">
        {name ? (
          <>
            <span className="text-[11px] font-display text-white/70 truncate">{name}</span>
            <span className="text-[9px] font-mono text-white/20">{shortAddr(player.address)}</span>
          </>
        ) : (
          <span className="text-[10px] font-mono text-white/50">{shortAddr(player.address)}</span>
        )}
      </div>

      {/* Wins */}
      <div className="text-[10px] font-mono text-right text-white/60 tabular-nums">
        {player.gamesWon}
      </div>

      {/* Games */}
      <div className="text-[10px] font-mono text-right text-white/30 tabular-nums">
        {player.gamesPlayed}
      </div>

      {/* Win % */}
      <div className={`text-[10px] font-mono text-right tabular-nums ${
        player.winRate >= 50 ? 'text-alive/70' : 'text-white/25'
      }`}>
        {player.winRate}%
      </div>

      {/* Kills */}
      <div className="text-[10px] font-mono text-right text-blood/60 tabular-nums">
        {player.kills}
      </div>

      {/* K/D */}
      <div className="text-[10px] font-mono text-right text-white/30 tabular-nums">
        {player.kd}
      </div>

      {/* Earnings */}
      <div className="text-[10px] font-mono text-right text-gold/80 tabular-nums">
        {player.totalEarningsFormatted}
      </div>
    </div>
  )
}
