import { type Address } from 'viem'

interface GameOverScreenProps {
  winner: Address
  label: string
  prize: string
  onHome?: () => void
}

function truncateAddr(addr: Address): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

export function GameOverScreen({ winner, label, prize, onHome }: GameOverScreenProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm animate-[fadeIn_0.5s_ease-out]">
      {/* Blood drip lines */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[20, 35, 50, 65, 80].map((left, i) => (
          <div
            key={i}
            className="absolute top-0 w-px h-full bg-gradient-to-b from-blood/30 to-transparent"
            style={{
              left: `${left}%`,
              animation: `drip ${2 + i * 0.4}s ease-in ${i * 0.2}s forwards`,
            }}
          />
        ))}
      </div>

      <div className="relative text-center space-y-8 animate-[scaleIn_0.6s_ease-out]">
        {/* GAME OVER */}
        <div className="space-y-3">
          <h1 className="font-display text-7xl font-bold tracking-[0.15em] text-blood drop-shadow-[0_0_60px_rgba(220,38,38,0.4)]">
            GAME OVER
          </h1>
          <div className="h-px w-full bg-gradient-to-r from-transparent via-blood/40 to-transparent" />
        </div>

        {/* Winner */}
        <div className="space-y-3">
          <div className="text-[9px] uppercase tracking-[0.5em] text-white/20 font-display">
            Winner
          </div>
          <div className="font-display text-4xl font-bold text-gold drop-shadow-[0_0_30px_rgba(245,166,35,0.3)]">
            {label}
          </div>
          <div className="text-xs font-mono text-white/30">
            {truncateAddr(winner)}
          </div>
        </div>

        {/* Prize */}
        <div className="inline-block border border-gold/20 bg-gold/[0.03] px-10 py-5 rounded-sm">
          <div className="text-[8px] uppercase tracking-[0.4em] text-gold/40 mb-1.5 font-display">
            Prize Pool
          </div>
          <div className="text-3xl font-display font-bold text-gold">
            {prize} ETH
          </div>
        </div>

        {/* Home button */}
        {onHome && (
          <button
            onClick={onHome}
            className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/30 hover:text-white/60
                       border border-white/[0.08] hover:border-white/[0.2] px-6 py-2.5
                       cursor-pointer rounded-sm transition-colors"
          >
            Back to Lobby
          </button>
        )}
      </div>
    </div>
  )
}
