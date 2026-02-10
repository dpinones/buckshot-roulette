import { useRef, useEffect } from 'react'
import { type Address } from 'viem'
import { useGameReplay, type ReplayEvent, type ReplayState } from '../hooks/useGameReplay'

interface GameReplayProps {
  gameId: bigint
  onBack: () => void
}

function shortAddr(addr: Address): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

function playerLabel(addr: Address, players: Address[]): string {
  const idx = players.findIndex((p) => p.toLowerCase() === addr.toLowerCase())
  return idx >= 0 ? `P${idx + 1}` : shortAddr(addr)
}

const EVENT_COLORS: Record<ReplayEvent['type'], string> = {
  game_created: 'text-white/50',
  round_start: 'text-gold',
  shells_loaded: 'text-white/30',
  turn: 'text-white/25',
  shot: 'text-shell-live',
  item: 'text-neon',
  shell_ejected: 'text-white/30',
  eliminated: 'text-blood',
  round_end: 'text-gold/50',
  game_end: 'text-gold font-bold',
}

function ReplayPlayerCard({
  address,
  state,
}: {
  address: Address
  state: ReplayState
}) {
  const key = address.toLowerCase()
  const hp = state.hp[key] ?? 0
  const alive = state.alive[key] ?? false
  const isTurn = state.currentTurn?.toLowerCase() === key
  const hpPercent = state.maxHp > 0 ? (hp / state.maxHp) * 100 : 0
  const hpColor = hp <= 1 ? '#dc2626' : hp <= 2 ? '#f5a623' : '#10b981'
  const label = playerLabel(address, state.players)

  return (
    <div
      className={`
        relative overflow-hidden rounded-sm transition-all duration-300
        ${isTurn ? 'border border-blood/50' : 'border border-white/[0.04]'}
        ${!alive ? 'opacity-30 saturate-0' : ''}
        bg-panel
      `}
      style={isTurn ? { animation: 'glowPulse 2s ease-in-out infinite' } : undefined}
    >
      <div className={`h-[2px] w-full ${
        isTurn ? 'bg-blood' : !alive ? 'bg-white/[0.02]' : 'bg-white/[0.06]'
      }`} />

      <div className="p-3">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-display text-base font-semibold text-white/90">
            {label}
          </span>
          {isTurn && (
            <span className="text-[7px] uppercase tracking-[0.2em] px-1.5 py-[2px] bg-blood/15 text-blood border border-blood/20 animate-pulse rounded-sm">
              TURN
            </span>
          )}
          {!alive && (
            <span className="text-[7px] uppercase tracking-[0.2em] px-1.5 py-[2px] bg-white/[0.03] text-white/15 rounded-sm">
              DEAD
            </span>
          )}
          {address.toLowerCase() === state.winner?.toLowerCase() && (
            <span className="text-[7px] uppercase tracking-[0.2em] px-1.5 py-[2px] bg-gold/10 text-gold border border-gold/20 rounded-sm">
              WINNER
            </span>
          )}
        </div>

        <div className="text-[9px] text-white/15 font-mono mb-2">
          {shortAddr(address)}
        </div>

        {/* HP bar */}
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1 bg-white/[0.04] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${hpPercent}%`, background: alive ? hpColor : '#333' }}
            />
          </div>
          <span className="text-[9px] font-mono tabular-nums" style={{ color: alive ? hpColor : '#444' }}>
            {hp}/{state.maxHp}
          </span>
        </div>
      </div>
    </div>
  )
}

export function GameReplay({ gameId, onBack }: GameReplayProps) {
  const {
    events,
    step,
    currentState,
    loading,
    error,
    playing,
    speed,
    setSpeed,
    play,
    pause,
    next,
    prev,
    goTo,
    restart,
  } = useGameReplay(gameId)

  const timelineRef = useRef<HTMLDivElement>(null)

  // Auto-scroll timeline to current event
  useEffect(() => {
    if (timelineRef.current) {
      const el = timelineRef.current.children[step] as HTMLElement | undefined
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }
    }
  }, [step])

  const progress = events.length > 1 ? (step / (events.length - 1)) * 100 : 0

  return (
    <div className="min-h-screen bg-[#060609] flex flex-col scanlines">
      {/* Header */}
      <header className="border-b border-white/[0.04] px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-5">
            <button
              onClick={onBack}
              className="text-[9px] font-mono text-white/25 hover:text-white/50 transition-colors
                         border border-white/[0.06] hover:border-white/[0.12] px-2.5 py-1
                         cursor-pointer rounded-sm"
            >
              BACK
            </button>
            <h1 className="font-display text-lg font-bold tracking-[0.12em] text-white/85">
              BUCKSHOT<span className="text-blood">_</span>ROULETTE
            </h1>
            <span className="text-[8px] uppercase tracking-[0.3em] text-white/10 border border-white/[0.06] px-2 py-0.5 rounded-sm">
              Replay
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[10px] font-display tracking-[0.15em] text-white/20">
              GAME #{gameId.toString()}
            </span>
            {currentState?.currentRound ? (
              <span className="text-[9px] font-mono text-blood/60">
                Round {currentState.currentRound}
              </span>
            ) : null}
          </div>
        </div>
      </header>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-[10px] text-white/15 font-mono animate-pulse">
            Loading replay...
          </div>
        </div>
      ) : error ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-[10px] text-blood/50 font-mono">{error}</div>
        </div>
      ) : events.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-[10px] text-white/10 font-mono">No events found for this game</div>
        </div>
      ) : (
        <main className="flex-1 flex flex-col px-6 py-6 min-h-0">
          <div className="max-w-7xl mx-auto w-full flex-1 flex flex-col gap-4 min-h-0">

            {/* Player cards */}
            {currentState && currentState.players.length > 0 && (
              <div className={`grid gap-3 ${
                currentState.players.length <= 2 ? 'grid-cols-2' :
                currentState.players.length <= 3 ? 'grid-cols-3' :
                currentState.players.length <= 5 ? 'grid-cols-5' :
                'grid-cols-6'
              }`}>
                {currentState.players.map((player) => (
                  <ReplayPlayerCard key={player} address={player} state={currentState} />
                ))}
              </div>
            )}

            {/* Shell status */}
            {currentState && (
              <div className="flex items-center justify-center gap-4 py-1">
                <div className="flex items-center gap-1.5">
                  {Array(currentState.liveShells).fill(0).map((_, i) => (
                    <div key={`l${i}`} className="w-2.5 h-5 rounded-full bg-blood/70 border border-blood/50 shadow-[0_0_6px_rgba(220,38,38,0.3)]" />
                  ))}
                  {Array(currentState.blankShells).fill(0).map((_, i) => (
                    <div key={`b${i}`} className="w-2.5 h-5 rounded-full bg-white/[0.06] border border-white/[0.08]" />
                  ))}
                </div>
                <span className="text-[9px] font-mono text-white/15 tabular-nums">
                  {currentState.liveShells}L / {currentState.blankShells}B
                </span>
              </div>
            )}

            {/* Event timeline */}
            <div className="flex-1 min-h-0 border border-white/[0.04] bg-panel rounded-sm overflow-hidden flex flex-col">
              {/* Timeline header */}
              <div className="px-4 py-2 border-b border-white/[0.04] bg-white/[0.01] flex items-center gap-3">
                <span className="text-[9px] uppercase tracking-[0.3em] text-white/20 font-display">
                  Timeline
                </span>
                <div className="flex-1" />
                <span className="text-[9px] font-mono text-white/10 tabular-nums">
                  {step + 1}/{events.length}
                </span>
              </div>

              {/* Events list */}
              <div ref={timelineRef} className="flex-1 overflow-y-auto px-2 py-1">
                {events.map((event, i) => (
                  <button
                    key={event.id}
                    onClick={() => goTo(i)}
                    className={`
                      w-full text-left px-3 py-2 flex items-start gap-3 rounded-sm transition-all duration-200 cursor-pointer
                      ${i === step
                        ? 'bg-white/[0.04] border-l-2 border-blood'
                        : i < step
                          ? 'opacity-40 hover:opacity-70'
                          : 'opacity-20 hover:opacity-40'
                      }
                    `}
                  >
                    <span className="flex-shrink-0 w-5 text-center text-sm leading-none pt-[1px]">
                      {event.icon}
                    </span>
                    <span className={`text-[11px] font-mono leading-relaxed ${
                      i === step ? EVENT_COLORS[event.type] : 'text-white/30'
                    }`}>
                      {event.message}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Playback controls */}
            <div className="flex items-center gap-4 py-2">
              {/* Progress bar */}
              <div className="flex-1 h-1 bg-white/[0.04] rounded-full overflow-hidden cursor-pointer"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect()
                  const pct = (e.clientX - rect.left) / rect.width
                  const targetStep = Math.round(pct * (events.length - 1))
                  goTo(targetStep)
                }}
              >
                <div
                  className="h-full bg-blood/60 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>

              {/* Buttons */}
              <div className="flex items-center gap-1">
                <button
                  onClick={restart}
                  className="text-[9px] font-mono text-white/20 hover:text-white/50 px-2 py-1 border border-white/[0.06] hover:border-white/[0.12] rounded-sm cursor-pointer transition-colors"
                  title="Restart"
                >
                  {'\u23EE'}
                </button>
                <button
                  onClick={prev}
                  className="text-[9px] font-mono text-white/20 hover:text-white/50 px-2 py-1 border border-white/[0.06] hover:border-white/[0.12] rounded-sm cursor-pointer transition-colors"
                  title="Previous"
                >
                  {'\u25C0'}
                </button>
                <button
                  onClick={playing ? pause : play}
                  className={`text-[9px] font-mono px-3 py-1 border rounded-sm cursor-pointer transition-colors ${
                    playing
                      ? 'text-blood border-blood/30 hover:border-blood/50'
                      : 'text-white/30 border-white/[0.06] hover:text-white/50 hover:border-white/[0.12]'
                  }`}
                >
                  {playing ? '\u23F8 PAUSE' : '\u25B6 PLAY'}
                </button>
                <button
                  onClick={next}
                  className="text-[9px] font-mono text-white/20 hover:text-white/50 px-2 py-1 border border-white/[0.06] hover:border-white/[0.12] rounded-sm cursor-pointer transition-colors"
                  title="Next"
                >
                  {'\u25B6'}
                </button>
              </div>

              {/* Speed */}
              <div className="flex items-center gap-1.5">
                {[2500, 1500, 800, 400].map((s) => (
                  <button
                    key={s}
                    onClick={() => setSpeed(s)}
                    className={`text-[8px] font-mono px-1.5 py-0.5 rounded-sm cursor-pointer transition-colors ${
                      speed === s
                        ? 'text-blood bg-blood/10 border border-blood/20'
                        : 'text-white/15 border border-white/[0.04] hover:text-white/30'
                    }`}
                  >
                    {s === 2500 ? '0.5x' : s === 1500 ? '1x' : s === 800 ? '2x' : '4x'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </main>
      )}
    </div>
  )
}
