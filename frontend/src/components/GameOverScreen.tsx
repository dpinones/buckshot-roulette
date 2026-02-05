import { type Address } from 'viem'

interface GameOverScreenProps {
  winner: Address
  label: string
  prize: string
}

function truncateAddr(addr: Address): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

export function GameOverScreen({ winner, label, prize }: GameOverScreenProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-[fadeIn_0.5s_ease-out]">
      {/* Background blood drip effect */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-px h-full bg-gradient-to-b from-blood/40 to-transparent animate-[drip_2s_ease-in_forwards]" />
        <div className="absolute top-0 left-1/2 w-px h-full bg-gradient-to-b from-blood/30 to-transparent animate-[drip_2.5s_ease-in_0.3s_forwards]" />
        <div className="absolute top-0 left-3/4 w-px h-full bg-gradient-to-b from-blood/20 to-transparent animate-[drip_3s_ease-in_0.6s_forwards]" />
      </div>

      <div className="relative text-center space-y-8 animate-[scaleIn_0.6s_ease-out]">
        {/* GAME OVER text */}
        <div className="space-y-2">
          <h1 className="text-6xl font-mono font-bold tracking-[0.2em] text-blood drop-shadow-[0_0_40px_rgba(220,38,38,0.5)]">
            GAME OVER
          </h1>
          <div className="h-px w-full bg-gradient-to-r from-transparent via-blood/50 to-transparent" />
        </div>

        {/* Winner */}
        <div className="space-y-3">
          <div className="text-[10px] uppercase tracking-[0.4em] text-white/30">
            Winner
          </div>
          <div className="text-3xl font-mono text-gold drop-shadow-[0_0_20px_rgba(245,158,11,0.4)]">
            {label}
          </div>
          <div className="text-sm font-mono text-white/40">
            {truncateAddr(winner)}
          </div>
        </div>

        {/* Prize */}
        <div className="border border-gold/20 bg-gold/5 px-8 py-4 inline-block">
          <div className="text-[10px] uppercase tracking-[0.3em] text-gold/50 mb-1">
            Prize Pool
          </div>
          <div className="text-2xl font-mono text-gold">
            {prize} ETH
          </div>
        </div>

        {/* Waiting message */}
        <div className="text-xs text-white/20 animate-pulse">
          Waiting for next game...
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes drip {
          from { transform: translateY(-100%); }
          to { transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
