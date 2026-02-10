import { type GameSummary } from '../hooks/useLobbyState'

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
      className="w-full text-left bg-surface border border-white/5 rounded-lg p-4
                 hover:border-blood/40 hover:bg-surface-light transition-all duration-200
                 cursor-pointer group"
    >
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-mono tracking-widest text-white/30">
          GAME #{game.id.toString()}
        </span>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blood/20 text-blood">
          R{game.currentRound}
        </span>
      </div>

      {/* Players */}
      <div className="space-y-1.5 mb-3">
        {game.players.map((addr, i) => (
          <div key={addr} className="flex items-center gap-2">
            <div
              className={`w-1.5 h-1.5 rounded-full ${
                game.alive[i] ? 'bg-green-500' : 'bg-white/10'
              }`}
            />
            <span
              className={`text-xs font-mono ${
                game.alive[i] ? 'text-white/60' : 'text-white/20 line-through'
              }`}
            >
              P{i + 1} {shortAddr(addr)}
            </span>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-white/5">
        <span className="text-[10px] font-mono text-white/25">
          {game.aliveCount}/{game.players.length} alive
        </span>
        <span className="text-xs font-mono text-gold">
          {game.prizePoolFormatted} ETH
        </span>
      </div>

      {/* Hover hint */}
      <div className="mt-2 text-[10px] font-mono text-white/0 group-hover:text-white/20 transition-colors text-center">
        SPECTATE
      </div>
    </button>
  )
}
