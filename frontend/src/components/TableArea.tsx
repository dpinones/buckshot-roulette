import type { ShotAction } from './GameBoard'

interface TableAreaProps {
  liveShells: number
  blankShells: number
  spentShells: number
  round: number
  maxHp: number
  prize: string
  shotAction: ShotAction
}

export function TableArea({ liveShells, blankShells, spentShells, round, maxHp, prize, shotAction }: TableAreaProps) {
  return (
    <div
      className="relative z-20 h-[33.34vh] shrink-0 shadow-[0_-6px_20px_rgba(0,0,0,0.15)]"
      style={{
        background: 'linear-gradient(180deg, var(--color-table-pink) 0%, #D9A0C8 100%)',
        borderTop: '10px solid var(--color-table-border)',
        borderRadius: '50% 50% 0 0 / 40px 40px 0 0',
      }}
    >
      <div className="absolute top-0 left-1/2 -translate-x-1/2 flex flex-col items-center justify-center z-[21] w-[90%] max-w-[900px] h-full py-4 gap-[2vh]">
        {/* Shotgun */}
        <div className="flex items-center justify-center gap-6">
          <img
            src="/characters/shotgun.png"
            alt="shotgun"
            className="w-[min(50vw,450px)] h-auto drop-shadow-[4px_5px_6px_rgba(0,0,0,0.4)] -rotate-[5deg] transition-opacity duration-200"
            style={{ opacity: shotAction ? 0 : 1 }}
          />
        </div>

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
          <div className="inline-flex items-center gap-1.5 bg-[rgba(180,30,30,0.8)] border-[2px] border-red-400/40 rounded-2xl px-3 py-1 font-display text-base text-white shadow-[0_2px_6px_rgba(0,0,0,0.15)]">
            {liveShells} live
          </div>
          <div className="inline-flex items-center gap-1.5 bg-[rgba(120,120,120,0.8)] border-[2px] border-white/20 rounded-2xl px-3 py-1 font-display text-base text-white shadow-[0_2px_6px_rgba(0,0,0,0.15)]">
            {blankShells} blank
          </div>
          {spentShells > 0 && (
            <div className="inline-flex items-center gap-1.5 bg-black/20 border-[2px] border-black/10 rounded-2xl px-3 py-1 font-display text-sm text-white/70">
              {spentShells} spent
            </div>
          )}
        </div>

        {/* Badges */}
        <div className="flex items-center justify-center gap-2.5">
          {/* Round badge */}
          <div className="inline-flex items-center gap-2 bg-[rgba(80,30,80,0.75)] border-[2.5px] border-white/20 rounded-3xl px-5 py-2 font-display text-xl text-white shadow-[0_3px_8px_rgba(0,0,0,0.12)]">
            Round {round}
          </div>

          {/* Max HP badge */}
          <div className="inline-flex items-center gap-2 bg-white/88 border-[2.5px] border-black/15 rounded-3xl px-5 py-2 font-data text-lg font-bold text-text-dark shadow-[0_3px_8px_rgba(0,0,0,0.12)]">
            <span className="text-xl">{'\u2665'}</span> {maxHp} HP Max
          </div>

          {/* Prize badge */}
          <div className="inline-flex items-center gap-2 bg-[rgba(255,215,0,0.9)] border-[2.5px] border-[#DAA520] rounded-3xl px-5 py-2 font-data text-lg font-bold text-text-dark shadow-[0_3px_8px_rgba(0,0,0,0.12)]">
            <span className="text-xl">{'\u{1F3C6}'}</span> {prize} ETH
          </div>
        </div>
      </div>
    </div>
  )
}
