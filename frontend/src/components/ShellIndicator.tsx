interface ShellIndicatorProps {
  live: number
  blank: number
}

export function ShellIndicator({ live, blank }: ShellIndicatorProps) {
  const total = live + blank
  // Build shell array: lives first, then blanks (unknown order to spectator)
  const shells = [
    ...Array(live).fill('live'),
    ...Array(blank).fill('blank'),
  ]

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="text-[10px] uppercase tracking-[0.3em] text-white/30">
        Chamber
      </div>

      {/* Shell circles */}
      <div className="flex gap-2 items-center">
        {shells.map((type, i) => (
          <div
            key={i}
            className={`
              w-4 h-4 rounded-full border transition-all duration-300
              ${type === 'live'
                ? 'bg-shell-live border-shell-live shadow-[0_0_8px_rgba(239,68,68,0.5)]'
                : 'bg-shell-blank/30 border-shell-blank/50'
              }
            `}
          />
        ))}
        {total === 0 && (
          <div className="text-xs text-white/20 italic">empty</div>
        )}
      </div>

      {/* Count text */}
      <div className="flex gap-3 text-xs font-mono">
        <span className="text-shell-live">
          {live}L
        </span>
        <span className="text-white/20">/</span>
        <span className="text-shell-blank">
          {blank}B
        </span>
      </div>
    </div>
  )
}
