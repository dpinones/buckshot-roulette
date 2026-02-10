interface TableAreaProps {
  liveShells: number
  blankShells: number
  round: number
  maxHp: number
  prize: string
}

export function TableArea({ liveShells, blankShells, round, maxHp, prize }: TableAreaProps) {
  const shells = [
    ...Array(liveShells).fill('live'),
    ...Array(blankShells).fill('blank'),
  ]

  return (
    <div
      className="relative z-20 h-[33.34vh] shrink-0 shadow-[0_-6px_20px_rgba(0,0,0,0.15)]"
      style={{
        background: 'linear-gradient(180deg, var(--color-table-pink) 0%, #D9A0C8 100%)',
        borderTop: '5px solid var(--color-table-border)',
        borderRadius: '50% 50% 0 0 / 40px 40px 0 0',
      }}
    >
      <div className="absolute top-0 left-1/2 -translate-x-1/2 flex flex-col items-center justify-center z-[21] w-[90%] max-w-[900px] h-full py-4 gap-[2vh]">
        {/* Shotgun */}
        <div className="flex items-center justify-center gap-6">
          <img
            src="/characters/shotgun.png"
            alt="shotgun"
            className="w-[min(40vw,360px)] h-auto drop-shadow-[4px_5px_6px_rgba(0,0,0,0.4)] -rotate-[5deg]"
          />
        </div>

        {/* Shells row */}
        <div className="flex items-center gap-2.5">
          <span className="font-display text-lg text-text-dark drop-shadow-[0_1px_2px_rgba(255,255,255,0.5)]">
            {liveShells} live
          </span>
          {shells.map((type, i) => (
            <img
              key={i}
              src={type === 'live' ? '/characters/bala_roja.png' : '/characters/bala_gris.png'}
              alt={type}
              title={type === 'live' ? 'Live' : 'Blank'}
              className="h-[8vh] w-auto drop-shadow-[2px_3px_2px_rgba(0,0,0,0.3)] transition-transform duration-200 hover:scale-110"
            />
          ))}
          <span className="font-display text-lg text-text-dark drop-shadow-[0_1px_2px_rgba(255,255,255,0.5)]">
            {blankShells} blank
          </span>
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
