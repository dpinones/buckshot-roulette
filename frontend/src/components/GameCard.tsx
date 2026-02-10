import { type GameSummary } from '../hooks/useLobbyState'
import { Phase } from '../config/contracts'
import { getCharacter } from '../config/characters'
import { usePlayerNames } from '../hooks/usePlayerNames'

interface GameCardProps {
  game: GameSummary
  onClick: () => void
}

function shortAddr(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

export function GameCard({ game, onClick }: GameCardProps) {
  const names = usePlayerNames(game.players)

  function getLabel(addr: string): string {
    const name = names[addr.toLowerCase()]
    return getCharacter(name || '').name
  }

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-paper border-3 border-paper-shadow/60 rounded-[14px] p-4
                 hover:border-gold hover:shadow-[0_0_15px_rgba(255,215,0,0.2)] transition-all duration-200
                 cursor-pointer group shadow-[3px_3px_0_var(--color-paper-shadow)]"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="font-display text-sm text-text-dark">
          Game #{game.id.toString()}
        </span>
        <div className="flex items-center gap-2">
          {game.phase === Phase.WAITING && (
            <span className="font-display text-[10px] px-2 py-0.5 bg-gold/20 text-text-dark border-2 border-gold/40 rounded-lg animate-pulse">
              BETTING
            </span>
          )}
          <span className="font-display text-[10px] px-2 py-0.5 bg-[rgba(80,30,80,0.75)] text-white border-2 border-white/20 rounded-lg">
            R{game.currentRound}
          </span>
        </div>
      </div>

      {/* Players grid */}
      <div className="space-y-1 mb-3">
        {game.players.map((addr, i) => (
          <div key={addr} className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full flex-shrink-0 ${
                game.alive[i] ? 'bg-alive' : 'bg-paper-shadow'
              }`}
            />
            <span className={`font-data text-[11px] truncate ${
              game.alive[i] ? 'text-text-dark' : 'text-text-light/50 line-through'
            }`}>
              {getLabel(addr)}
            </span>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-2.5 border-t-2 border-paper-shadow/30">
        <span className="font-data text-[11px] text-text-light">
          <span className="text-alive font-bold">{game.aliveCount}</span>/{game.players.length} alive
        </span>
        <span className="font-display text-sm text-gold drop-shadow-[1px_1px_0_rgba(0,0,0,0.15)]">
          {game.prizePoolFormatted} ETH
        </span>
      </div>

      {/* Hover CTA */}
      <div className="mt-2.5 text-center">
        <span className="font-display text-[10px] text-transparent group-hover:text-gold transition-colors duration-200">
          SPECTATE
        </span>
      </div>
    </button>
  )
}
