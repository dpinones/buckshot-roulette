import { type GameSummary } from '../hooks/useLobbyState'
import { Phase } from '../config/contracts'

interface GameCardProps {
  game: GameSummary
  onClick: () => void
}

function shortAddr(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

export function GameCard({ game, onClick }: GameCardProps) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-panel border border-white/[0.04] rounded-sm p-4
                 hover:border-blood/30 hover:bg-surface-light transition-all duration-200
                 cursor-pointer group"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-display tracking-[0.15em] text-white/25 uppercase">
          Game #{game.id.toString()}
        </span>
        <div className="flex items-center gap-2">
          {game.phase === Phase.WAITING && (
            <span className="text-[8px] font-mono px-1.5 py-0.5 bg-gold/10 text-gold/80 border border-gold/20 rounded-sm animate-pulse">
              BETTING
            </span>
          )}
          <span className="text-[8px] font-mono px-1.5 py-0.5 bg-blood/10 text-blood/70 border border-blood/15 rounded-sm">
            R{game.currentRound}
          </span>
        </div>
      </div>

      {/* Players grid */}
      <div className="space-y-1 mb-3">
        {game.players.map((addr, i) => (
          <div key={addr} className="flex items-center gap-2">
            <div
              className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                game.alive[i] ? 'bg-alive' : 'bg-white/[0.06]'
              }`}
            />
            <span className={`text-[10px] font-mono truncate ${
              game.alive[i] ? 'text-white/50' : 'text-white/15 line-through'
            }`}>
              P{i + 1}
            </span>
            <span className={`text-[9px] font-mono truncate ${
              game.alive[i] ? 'text-white/25' : 'text-white/10 line-through'
            }`}>
              {shortAddr(addr)}
            </span>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-2.5 border-t border-white/[0.04]">
        <span className="text-[9px] font-mono text-white/15">
          <span className="text-alive/60">{game.aliveCount}</span>/{game.players.length} alive
        </span>
        <span className="text-[10px] font-mono text-gold/80">
          {game.prizePoolFormatted} ETH
        </span>
      </div>

      {/* Hover CTA */}
      <div className="mt-2.5 text-center">
        <span className="text-[8px] uppercase tracking-[0.3em] text-white/0 group-hover:text-blood/50 transition-colors duration-200 font-display">
          Spectate
        </span>
      </div>
    </button>
  )
}
