import type { ShotAction } from './GameBoard'

interface TableAreaProps {
  liveShells: number
  blankShells: number
  spentShells: number
  shotAction: ShotAction
}

export function TableArea({ liveShells, blankShells, spentShells, shotAction }: TableAreaProps) {
  return (
    <div
      className="relative z-20 h-[33.34vh] shrink-0"
      style={{
        borderRadius: '50% 50% 0 0 / 48px 48px 0 0',
        background: 'white',
        padding: '6px 6px 0 6px',
        boxShadow: '0 -6px 20px rgba(0,0,0,0.15)',
      }}
    >
    <div
      className="relative w-full h-full"
      style={{
        background: 'linear-gradient(180deg, var(--color-table-pink) 0%, #D9A0C8 100%)',
        borderTop: '5px solid var(--color-table-border)',
        borderRadius: '50% 50% 0 0 / 40px 40px 0 0',
      }}
    >
      {/* Shotgun — absolute so it doesn't push content down */}
      <div className="absolute top-[2vh] left-1/2 -translate-x-1/2 z-[22] flex items-center justify-center">
        <img
          src="/characters/shotgun.png"
          alt="shotgun"
          className="w-[min(50vw,450px)] h-auto drop-shadow-[4px_5px_6px_rgba(0,0,0,0.4)] -rotate-[5deg] transition-opacity duration-200"
          style={{ opacity: shotAction ? 0 : 1 }}
        />
      </div>

      <div className="absolute top-0 left-1/2 -translate-x-1/2 flex flex-col items-center justify-center z-[21] w-[90%] max-w-[900px] h-full gap-[2vh]">
        {/* Shells display */}
        <div className="flex items-center gap-3">
          {/* Spent shells */}
          {spentShells > 0 && (
            <div className="flex items-center gap-1 opacity-30">
              {Array.from({ length: spentShells }, (_, i) => (
                <img
                  key={`spent-${i}`}
                  src="/characters/bala_gris.png"
                  alt="spent"
                  className="h-[5vh] w-auto grayscale"
                />
              ))}
            </div>
          )}

          {/* Separator */}
          {spentShells > 0 && (liveShells > 0 || blankShells > 0) && (
            <div className="w-[2px] h-[6vh] bg-black/15 rounded-full" />
          )}

          {/* Remaining shells */}
          <div className="flex items-center gap-1.5">
            {Array.from({ length: liveShells }, (_, i) => (
              <img
                key={`live-${i}`}
                src="/characters/bala_roja.png"
                alt="live"
                className="h-[8vh] w-auto drop-shadow-[2px_3px_2px_rgba(0,0,0,0.3)] hover:scale-110 transition-transform"
              />
            ))}
            {Array.from({ length: blankShells }, (_, i) => (
              <img
                key={`blank-${i}`}
                src="/characters/bala_gris.png"
                alt="blank"
                className="h-[8vh] w-auto drop-shadow-[2px_3px_2px_rgba(0,0,0,0.3)] hover:scale-110 transition-transform"
              />
            ))}
          </div>
        </div>

        {/* Shell count badges */}
        <div className="flex items-center gap-2">
          {spentShells > 0 && (
            <div className="inline-flex items-center gap-1.5 bg-black/20 border-[2px] border-black/10 rounded-2xl px-3 py-1 font-display text-sm text-white/70">
              {spentShells} spent
            </div>
          )}
          <div className="inline-flex items-center gap-1.5 bg-[rgba(180,30,30,0.8)] border-[2px] border-red-400/40 rounded-2xl px-3 py-1 font-display text-base text-white shadow-[0_2px_6px_rgba(0,0,0,0.15)]">
            {liveShells} live
          </div>
          <div className="inline-flex items-center gap-1.5 bg-[rgba(46,149,251,0.85)] border-[2px] border-[#5bb0ff]/40 rounded-2xl px-3 py-1 font-display text-base text-white shadow-[0_2px_6px_rgba(0,0,0,0.15)]">
            {blankShells} blank
          </div>
        </div>

      </div>
    </div>
    </div>
  )
}
