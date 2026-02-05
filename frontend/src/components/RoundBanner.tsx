interface RoundBannerProps {
  round: number
  maxHp: number
}

export function RoundBanner({ round, maxHp }: RoundBannerProps) {
  const intensity = round // 1-3 maps to visual intensity

  return (
    <div className="flex items-center gap-4">
      {/* Round blocks */}
      <div className="flex gap-1">
        {[1, 2, 3].map((r) => (
          <div
            key={r}
            className={`
              w-8 h-1 transition-all duration-500
              ${r <= round ? 'bg-blood' : 'bg-white/10'}
              ${r === round ? 'shadow-[0_0_8px_rgba(220,38,38,0.5)]' : ''}
            `}
          />
        ))}
      </div>

      <div className="flex items-baseline gap-2">
        <span
          className={`
            text-sm font-mono tracking-wider uppercase
            ${intensity >= 3 ? 'text-blood' : intensity >= 2 ? 'text-gold' : 'text-white/60'}
          `}
        >
          Round {round}
        </span>
        <span className="text-[10px] text-white/20">
          HP:{maxHp}
        </span>
      </div>
    </div>
  )
}
