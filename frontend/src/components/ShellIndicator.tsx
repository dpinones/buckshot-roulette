interface ShellIndicatorProps {
  live: number
  blank: number
}

export function ShellIndicator({ live, blank }: ShellIndicatorProps) {
  const total = live + blank
  const shells = [
    ...Array(live).fill('live'),
    ...Array(blank).fill('blank'),
  ]

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="text-[8px] uppercase tracking-[0.4em] text-white/20 font-display">
        Chamber
      </div>

      {/* Shell pills */}
      <div className="flex gap-1.5 items-center">
        {shells.map((type, i) => (
          <div
            key={i}
            className={`
              w-3 h-6 rounded-full border transition-all duration-300
              ${type === 'live'
                ? 'bg-blood/80 border-blood/60 shadow-[0_0_8px_rgba(220,38,38,0.4)]'
                : 'bg-white/[0.06] border-white/[0.08]'
              }
            `}
          />
        ))}
        {total === 0 && (
          <div className="text-[10px] text-white/10 italic">empty</div>
        )}
      </div>

      {/* Count */}
      <div className="flex gap-2 text-[10px] font-mono tabular-nums">
        <span className="text-blood">{live}L</span>
        <span className="text-white/10">/</span>
        <span className="text-white/20">{blank}B</span>
      </div>
    </div>
  )
}
