import { type GameSummary } from '../hooks/useLobbyState'
import { Phase } from '../config/contracts'
import { getCharacter } from '../config/characters'
import { usePlayerNames } from '../hooks/usePlayerNames'

interface GameCardProps {
  game: GameSummary
  onClick: () => void
}

const AGENT_TEXT: Record<string, string> = {
  calc: '#4A90B8',
  agro: '#D44A6A',
  trap: '#4A9F4A',
  filo: '#7A6AA0',
  apre: '#B8923A',
}

export function GameCard({ game, onClick }: GameCardProps) {
  const names = usePlayerNames(game.players)

  function getLabel(addr: string): string {
    const name = names[addr.toLowerCase()]
    return getCharacter(name || '').name
  }

  function getChar(addr: string) {
    const name = names[addr.toLowerCase()]
    return getCharacter(name || '')
  }

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-paper/90 backdrop-blur-sm border-3 border-paper-shadow/40 rounded-[16px] p-5
                 hover:border-table-border hover:shadow-[0_0_18px_rgba(232,180,216,0.3)] transition-all duration-200
                 cursor-pointer group shadow-[3px_3px_0_var(--color-paper-shadow)]"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="font-display text-lg text-text-dark">
          Game #{game.id.toString()}
        </span>
        <div className="flex items-center gap-2">
          {game.phase === Phase.WAITING && (
            <span className="font-display text-xs px-2.5 py-1 bg-table-pink/25 text-[#9A6B8F] border border-table-border/50 rounded-lg animate-pulse">
              BETTING
            </span>
          )}
          <span className="font-display text-xs px-2.5 py-1 bg-filo/20 text-[#7A6AA0] border border-filo/40 rounded-lg">
            R{game.currentRound}
          </span>
        </div>
      </div>

      {/* Players */}
      <div className="space-y-1.5 mb-3">
        {game.players.map((addr, i) => {
          const char = getChar(addr)
          const isDead = !game.alive[i]
          return (
            <div key={addr} className="flex items-center gap-2.5" style={{ opacity: isDead ? 0.4 : 1 }}>
              <img
                src={char.img}
                alt=""
                className="w-7 h-7 rounded-md object-contain flex-shrink-0"
                style={{ filter: isDead ? 'grayscale(0.8)' : 'none' }}
              />
              <span
                className={`font-data text-sm truncate ${isDead ? 'line-through text-text-light' : ''}`}
                style={{ color: isDead ? undefined : (AGENT_TEXT[char.color] || 'var(--color-text-dark)') }}
              >
                {getLabel(addr)}
              </span>
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t-2 border-table-pink/25">
        <span className="font-data text-sm text-text-light">
          <span className="text-alive font-bold">{game.aliveCount}</span>/{game.players.length} alive
        </span>
        <span className="font-display text-lg text-gold drop-shadow-[1px_1px_0_rgba(0,0,0,0.1)]">
          {game.prizePoolFormatted} ETH
        </span>
      </div>

      {/* Hover CTA */}
      <div className="mt-2.5 text-center">
        <span className="font-display text-xs text-transparent group-hover:text-table-border transition-colors duration-200">
          SPECTATE
        </span>
      </div>
    </button>
  )
}
