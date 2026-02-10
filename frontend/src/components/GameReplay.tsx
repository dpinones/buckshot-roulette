import { useMemo, useEffect, useCallback, useState } from 'react'
import { type Address } from 'viem'
import { useGameReplay, type ReplayState } from '../hooks/useGameReplay'
import { type GameState } from '../hooks/useGameState'
import { type GameEvent } from '../hooks/useEventLog'
import { Phase } from '../config/contracts'
import { PlayerCard } from './PlayerCard'
import { ShellIndicator } from './ShellIndicator'
import { ShotgunVisual } from './ShotgunVisual'
import { EventLog } from './EventLog'
import { RoundBanner } from './RoundBanner'
import { GameOverScreen } from './GameOverScreen'
import { PlayerStatsModal } from './PlayerStatsModal'

interface GameReplayProps {
  gameId: bigint
  onBack: () => void
}

function maxHpForRound(round: number): number {
  if (round === 1) return 2
  if (round === 2) return 4
  return 5
}

function playerLabel(index: number): string {
  return `P${index + 1}`
}

/** Convert ReplayState into the GameState shape that GameBoard components expect */
function toGameState(rs: ReplayState, gameId: bigint): GameState {
  const players = rs.players as Address[]
  const hpList = players.map((p) => rs.hp[p.toLowerCase()] ?? 0)
  const alive = players.map((p) => rs.alive[p.toLowerCase()] ?? false)
  const isFinished = rs.winner !== null

  return {
    id: gameId,
    players,
    hpList,
    alive,
    currentRound: rs.currentRound,
    currentTurnIndex: rs.currentTurn
      ? players.findIndex((p) => p.toLowerCase() === rs.currentTurn!.toLowerCase())
      : 0,
    shellsRemaining: rs.liveShells + rs.blankShells,
    liveRemaining: rs.liveShells,
    blankRemaining: rs.blankShells,
    turnDeadline: 0n,
    phase: isFinished ? Phase.FINISHED : rs.currentRound > 0 ? Phase.ACTIVE : Phase.WAITING,
    winner: (rs.winner ?? '0x0000000000000000000000000000000000000000') as Address,
    prizePool: 0n,
    prizePoolFormatted: rs.prize,
    currentTurn: (rs.currentTurn ?? '0x0000000000000000000000000000000000000000') as Address,
    playerItems: {},
  }
}

/** Map replay events up to current step into GameEvent[] for the EventLog */
const REPLAY_TO_GAME_TYPE: Record<string, GameEvent['type']> = {
  game_created: 'info',
  round_start: 'round',
  shells_loaded: 'info',
  turn: 'turn',
  shot: 'shot',
  item: 'item',
  shell_ejected: 'info',
  eliminated: 'shot',
  round_end: 'round',
  game_end: 'gameover',
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

  const [selectedPlayer, setSelectedPlayer] = useState<{ address: Address; label: string } | null>(null)

  // Keyboard controls: arrows left/right for prev/next, space for play/pause
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); next() }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); prev() }
    else if (e.key === ' ') { e.preventDefault(); playing ? pause() : play() }
  }, [next, prev, play, pause, playing])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // Convert ReplayState → GameState
  const gameState = useMemo(() => {
    if (!currentState) return null
    return toGameState(currentState, gameId)
  }, [currentState, gameId])

  // Build prev GameState for ShotgunVisual flash detection
  const prevGameState = useMemo(() => {
    if (step <= 0 || !events[step - 1]) return null
    return toGameState(events[step - 1].state, gameId)
  }, [step, events, gameId])

  // Convert replay events up to current step → GameEvent[] for EventLog
  const gameEvents: GameEvent[] = useMemo(() => {
    return events.slice(0, step + 1).map((e) => ({
      id: e.id,
      type: REPLAY_TO_GAME_TYPE[e.type] ?? 'info',
      message: e.message,
      timestamp: Date.now(),
    }))
  }, [events, step])

  const progress = events.length > 1 ? (step / (events.length - 1)) * 100 : 0

  if (loading) {
    return (
      <div className="min-h-screen bg-[#060609] flex items-center justify-center scanlines">
        <div className="text-[10px] text-white/15 font-mono animate-pulse">
          Loading replay...
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#060609] flex items-center justify-center scanlines">
        <div className="text-[10px] text-blood/50 font-mono">{error}</div>
      </div>
    )
  }

  if (!gameState || events.length === 0) {
    return (
      <div className="min-h-screen bg-[#060609] flex items-center justify-center scanlines">
        <div className="text-[10px] text-white/10 font-mono">No events found for this game</div>
      </div>
    )
  }

  const players = gameState.players
  const maxHp = maxHpForRound(gameState.currentRound)
  const isFinished = gameState.phase === Phase.FINISHED
  const aliveCount = gameState.alive.filter(Boolean).length

  return (
    <div className="min-h-screen bg-[#060609] flex flex-col scanlines">
      {/* Header — same as GameBoard but with REPLAY badge and back goes to rankings */}
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
            {gameState.currentRound > 0 && (
              <RoundBanner round={gameState.currentRound} maxHp={maxHp} />
            )}
            <span className="text-[8px] uppercase tracking-[0.3em] text-blood/60 border border-blood/20 bg-blood/[0.05] px-2 py-0.5 rounded-sm font-display">
              Replay
            </span>
          </div>

          <div className="flex items-center gap-5">
            <span className="text-[10px] font-display tracking-[0.15em] text-white/20">
              GAME #{gameId.toString()}
            </span>
            <div className="text-[10px] font-mono text-white/20">
              <span className="text-alive">{aliveCount}</span>
              <span className="text-white/10">/{players.length} alive</span>
            </div>
            <div className="text-right">
              <div className="text-[8px] uppercase tracking-[0.3em] text-white/15">Prize</div>
              <div className="text-xs font-mono text-gold">
                {gameState.prizePoolFormatted} ETH
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main arena — identical to GameBoard */}
      <main className="flex-1 flex flex-col px-6 py-6 pb-24">
        <div className="max-w-7xl mx-auto w-full flex-1 flex flex-col gap-6">
          {/* Players row */}
          <div className={`grid gap-3 ${
            players.length <= 2 ? 'grid-cols-2' :
            players.length <= 3 ? 'grid-cols-3' :
            players.length <= 4 ? 'grid-cols-2 md:grid-cols-4' :
            players.length <= 5 ? 'grid-cols-2 md:grid-cols-5' :
            'grid-cols-2 md:grid-cols-3 lg:grid-cols-6'
          }`}>
            {players.map((player, i) => (
              <PlayerCard
                key={player}
                address={player}
                hp={gameState.hpList[i] ?? 0}
                maxHp={maxHp}
                items={gameState.playerItems[player.toLowerCase()] ?? []}
                isCurrentTurn={gameState.currentTurn?.toLowerCase() === player.toLowerCase()}
                isAlive={gameState.alive[i] ?? false}
                label={playerLabel(i)}
                onClick={() => setSelectedPlayer({ address: player, label: playerLabel(i) })}
              />
            ))}
          </div>

          {/* Shotgun + Shells center piece */}
          <div className="flex items-center justify-center gap-10 py-2">
            <ShotgunVisual
              shellsRemaining={gameState.shellsRemaining}
              prevShellsRemaining={prevGameState?.shellsRemaining}
            />
            <div className="w-px h-16 bg-white/[0.04]" />
            <ShellIndicator
              live={gameState.liveRemaining}
              blank={gameState.blankRemaining}
            />
          </div>

          {/* Event Log */}
          <div className="flex-1 min-h-0">
            <EventLog events={gameEvents} />
          </div>
        </div>
      </main>

      {/* Game Over overlay (shown when replay reaches the end) */}
      {isFinished && (
        <GameOverScreen
          winner={gameState.winner}
          label={
            players.findIndex(
              (p) => p.toLowerCase() === gameState.winner.toLowerCase()
            ) >= 0
              ? playerLabel(
                  players.findIndex(
                    (p) => p.toLowerCase() === gameState.winner.toLowerCase()
                  )
                )
              : '???'
          }
          prize={gameState.prizePoolFormatted}
        />
      )}

      {/* Player Stats Modal */}
      {selectedPlayer && (
        <PlayerStatsModal
          address={selectedPlayer.address}
          label={selectedPlayer.label}
          onClose={() => setSelectedPlayer(null)}
        />
      )}

      {/* Playback controls — fixed bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/[0.06] bg-[#0a0a10]/95 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center gap-4">
          {/* Progress bar */}
          <div
            className="flex-1 h-1.5 bg-white/[0.04] rounded-full overflow-hidden cursor-pointer group"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect()
              const pct = (e.clientX - rect.left) / rect.width
              const targetStep = Math.round(pct * (events.length - 1))
              goTo(targetStep)
            }}
          >
            <div
              className="h-full bg-blood/60 rounded-full transition-all duration-200 group-hover:bg-blood/80"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Step counter */}
          <span className="text-[9px] font-mono text-white/20 tabular-nums w-16 text-center">
            {step + 1}/{events.length}
          </span>

          {/* Buttons */}
          <div className="flex items-center gap-1">
            <button
              onClick={restart}
              className="text-sm font-mono text-white/25 hover:text-white/50 px-2 py-1.5 border border-white/[0.06] hover:border-white/[0.12] rounded-sm cursor-pointer transition-colors"
              title="Restart"
            >
              {'\u23EE'}
            </button>
            <button
              onClick={prev}
              className="text-sm font-mono text-white/25 hover:text-white/50 px-2 py-1.5 border border-white/[0.06] hover:border-white/[0.12] rounded-sm cursor-pointer transition-colors"
              title="Previous"
            >
              {'\u25C0'}
            </button>
            <button
              onClick={playing ? pause : play}
              className={`text-[10px] font-mono px-4 py-1.5 border rounded-sm cursor-pointer transition-colors ${
                playing
                  ? 'text-blood border-blood/30 hover:border-blood/50 bg-blood/[0.05]'
                  : 'text-white/40 border-white/[0.08] hover:text-white/60 hover:border-white/[0.15]'
              }`}
            >
              {playing ? '\u23F8 PAUSE' : '\u25B6 PLAY'}
            </button>
            <button
              onClick={next}
              className="text-sm font-mono text-white/25 hover:text-white/50 px-2 py-1.5 border border-white/[0.06] hover:border-white/[0.12] rounded-sm cursor-pointer transition-colors"
              title="Next"
            >
              {'\u25B6'}
            </button>
          </div>

          {/* Speed */}
          <div className="flex items-center gap-1">
            {[2500, 1500, 800, 400].map((s) => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className={`text-[9px] font-mono px-2 py-1 rounded-sm cursor-pointer transition-colors ${
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
    </div>
  )
}
