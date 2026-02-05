import { useEffect, useState } from 'react'

interface ShotgunVisualProps {
  shellsRemaining: number
  prevShellsRemaining?: number
}

export function ShotgunVisual({ shellsRemaining, prevShellsRemaining }: ShotgunVisualProps) {
  const [flash, setFlash] = useState(false)

  // Detect shot (shells decreased)
  useEffect(() => {
    if (
      prevShellsRemaining !== undefined &&
      shellsRemaining < prevShellsRemaining
    ) {
      setFlash(true)
      const timer = setTimeout(() => setFlash(false), 600)
      return () => clearTimeout(timer)
    }
  }, [shellsRemaining, prevShellsRemaining])

  return (
    <div className="relative flex flex-col items-center justify-center py-6">
      {/* Muzzle flash */}
      {flash && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="w-32 h-32 bg-gold/20 rounded-full animate-ping" />
          <div className="absolute w-16 h-16 bg-blood/30 rounded-full animate-ping" />
        </div>
      )}

      {/* Shotgun ASCII art */}
      <pre
        className={`
          text-white/60 text-[10px] leading-tight select-none transition-all duration-300
          ${flash ? 'text-gold scale-105 drop-shadow-[0_0_20px_rgba(245,158,11,0.5)]' : ''}
        `}
      >
{`
     ____________________________________
    /                                    \\
===|  =====================================>
    \\____________________________________/
         ||    ||    ||
         ||    ||    ||
`}
      </pre>

      {/* Loaded indicator */}
      <div className={`
        mt-2 text-xs font-mono tracking-wider transition-colors duration-300
        ${shellsRemaining > 0 ? 'text-blood' : 'text-white/20'}
      `}>
        {shellsRemaining > 0 ? `${shellsRemaining} LOADED` : 'EMPTY'}
      </div>
    </div>
  )
}
