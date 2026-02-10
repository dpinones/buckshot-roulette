interface RoundBannerProps {
  round: number
  maxHp: number
}

export function RoundBanner({ round, maxHp }: RoundBannerProps) {
  return (
    <div className="flex items-center gap-3">
      {/* Round segments */}
      <div className="flex gap-0.5">
        {[1, 2, 3].map((r) => (
          <div
            key={r}
            className={`
              w-6 h-1 transition-all duration-500 rounded-full
              ${r <= round ? 'bg-blood' : 'bg-white/[0.06]'}
              ${r === round ? 'shadow-[0_0_8px_rgba(220,38,38,0.5)]' : ''}
            `}
          />
        ))}
      </div>

      <div className="flex items-baseline gap-2">
        <span className={`
          text-xs font-display tracking-wider uppercase font-semibold
          ${round >= 3 ? 'text-blood' : round >= 2 ? 'text-gold' : 'text-white/50'}
        `}>
          Round {round}
        </span>
        <span className="text-[9px] text-white/15 font-mono">
          HP:{maxHp}
        </span>
      </div>
    </div>
  )
}
