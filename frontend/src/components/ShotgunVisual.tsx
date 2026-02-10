import { useEffect, useState } from 'react'

interface ShotgunVisualProps {
  shellsRemaining: number
  prevShellsRemaining?: number
}

export function ShotgunVisual({ shellsRemaining, prevShellsRemaining }: ShotgunVisualProps) {
  const [flash, setFlash] = useState(false)

  useEffect(() => {
    if (
      prevShellsRemaining !== undefined &&
      shellsRemaining < prevShellsRemaining
    ) {
      setFlash(true)
      const timer = setTimeout(() => setFlash(false), 700)
      return () => clearTimeout(timer)
    }
  }, [shellsRemaining, prevShellsRemaining])

  return (
    <div className="relative flex flex-col items-center justify-center py-4">
      {/* Muzzle flash */}
      {flash && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div
            className="w-24 h-24 rounded-full bg-gold/20"
            style={{ animation: 'muzzleFlash 0.7s ease-out forwards' }}
          />
          <div
            className="absolute w-12 h-12 rounded-full bg-blood/30"
            style={{ animation: 'muzzleFlash 0.5s ease-out forwards' }}
          />
        </div>
      )}

      {/* Shotgun ASCII */}
      <pre
        className={`
          text-[9px] leading-tight select-none transition-all duration-300 font-mono
          ${flash
            ? 'text-gold/80 scale-105 drop-shadow-[0_0_20px_rgba(245,166,35,0.4)]'
            : 'text-white/20'
          }
        `}
      >
{`     ____________________________________
    /                                    \\
===|  =====================================>
    \\____________________________________/
         ||    ||    ||
         ||    ||    ||`}
      </pre>

      {/* Status */}
      <div className={`
        mt-3 text-[10px] tracking-[0.3em] uppercase font-display transition-colors duration-300
        ${shellsRemaining > 0 ? 'text-blood/80' : 'text-white/10'}
      `}>
        {shellsRemaining > 0 ? `${shellsRemaining} loaded` : 'empty'}
      </div>
    </div>
  )
}
