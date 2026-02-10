import { useMemo, useEffect, useCallback, useState } from 'react'
import { type Address } from 'viem'
import { useGameReplay, type ReplayState } from '../hooks/useGameReplay'
import { type GameState } from '../hooks/useGameState'
import { type GameEvent } from '../hooks/useEventLog'
import { Phase } from '../config/contracts'
import { getCharacter } from '../config/characters'
import { usePlayerNames } from '../hooks/usePlayerNames'
import { AgentCard } from './AgentCard'
import { CharacterStage } from './CharacterStage'
import { TableArea } from './TableArea'
import { EventLogNotebook } from './EventLogNotebook'
import { TurnFlash } from './TurnFlash'
import { GameOverOverlay } from './GameOverOverlay'
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

function getNextAliveIdx(alive: readonly boolean[], fromIdx: number): number {
  const aliveIdxs = alive.map((a, i) => a ? i : -1).filter(i => i >= 0)
  if (aliveIdxs.length === 0) return fromIdx
  const pos = aliveIdxs.indexOf(fromIdx)
  if (pos < 0) return aliveIdxs[0]
  return aliveIdxs[(pos + 1) % aliveIdxs.length]
}

/** Convert ReplayState into the GameState shape */
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

  const replayPlayers = useMemo(() => {
    for (const e of events) {
      if (e.state.players.length > 0) return e.state.players
    }
    return [] as Address[]
  }, [events])

  const names = usePlayerNames(replayPlayers)

  function getOnChainName(index: number): string {
    const addr = replayPlayers[index]
    return addr ? names[addr.toLowerCase()] || '' : ''
  }

  function getLabel(index: number): string {
    return getCharacter(getOnChainName(index)).name
  }

  // Keyboard controls
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); next() }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); prev() }
    else if (e.key === ' ') { e.preventDefault(); playing ? pause() : play() }
  }, [next, prev, play, pause, playing])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const gameState = useMemo(() => {
    if (!currentState) return null
    return toGameState(currentState, gameId)
  }, [currentState, gameId])

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
      <div className="min-h-screen bg-meadow flex items-center justify-center">
        <div className="font-display text-lg text-text-light animate-pulse">
          Loading replay...
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-meadow flex items-center justify-center">
        <div className="font-data text-blood">{error}</div>
      </div>
    )
  }

  if (!gameState || events.length === 0) {
    return (
      <div className="min-h-screen bg-meadow flex items-center justify-center">
        <div className="font-data text-text-light">No events found for this game</div>
      </div>
    )
  }

  const players = gameState.players
  const maxHp = maxHpForRound(gameState.currentRound)
  const isFinished = gameState.phase === Phase.FINISHED
  const nextAliveIdx = getNextAliveIdx(gameState.alive, gameState.currentTurnIndex)

  return (
    <div className="relative w-screen h-screen overflow-hidden flex flex-col select-none">
      {/* Background */}
      <div className="absolute inset-0 z-0" style={{ background: `url('/characters/bg.png') center center / cover no-repeat` }}>
        <video autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover">
          <source src="/characters/bg.mp4" type="video/mp4" />
        </video>
      </div>

      {/* Turn flash */}
      <TurnFlash currentTurnIndex={gameState.currentTurnIndex} />

      {/* Top buttons */}
      <div className="fixed top-3 left-3 z-[150] flex items-center gap-2">
        <button
          onClick={onBack}
          className="font-display text-[11px] px-3 py-1.5 bg-paper border-2 border-text-dark rounded-[10px] shadow-[2px_2px_0_var(--color-paper-shadow)] cursor-pointer text-text-dark hover:bg-[#FFF3D0] transition-colors"
        >
          BACK
        </button>
        <span className="font-display text-[10px] px-2.5 py-1 bg-blood/10 text-blood border-2 border-blood/30 rounded-[10px]">
          REPLAY
        </span>
        <span className="font-data text-[11px] text-text-light">
          Game #{gameId.toString()}
        </span>
      </div>

      {/* Zone 1: Top Bar — Agent cards */}
      <div className="relative z-50 h-[33.33vh] flex justify-center items-start gap-2 px-3 pt-3 shrink-0">
        {players.map((player, i) => (
          <AgentCard
            key={player}
            address={player}
            hp={gameState.hpList[i] ?? 0}
            maxHp={maxHp}
            items={gameState.playerItems[player.toLowerCase()] ?? []}
            isCurrentTurn={i === gameState.currentTurnIndex}
            isNext={i === nextAliveIdx && i !== gameState.currentTurnIndex}
            isAlive={gameState.alive[i] ?? false}
            label={getOnChainName(i)}
            onClick={() => setSelectedPlayer({ address: player, label: getOnChainName(i) })}
          />
        ))}
      </div>

      {/* Zone 2: Middle — Character Stage */}
      <CharacterStage
        players={players}
        alive={gameState.alive}
        currentTurnIndex={gameState.currentTurnIndex}
        names={names}
        isThinking={false}
      />

      {/* Zone 3: Bottom — Table */}
      <TableArea
        liveShells={gameState.liveRemaining}
        blankShells={gameState.blankRemaining}
        round={gameState.currentRound}
        maxHp={maxHp}
        prize={gameState.prizePoolFormatted}
      />

      {/* Floating event log */}
      <EventLogNotebook events={gameEvents} />

      {/* Game Over overlay */}
      {isFinished && (
        <GameOverOverlay
          winner={gameState.winner}
          label={
            (() => {
              const idx = players.findIndex(
                (p) => p.toLowerCase() === gameState.winner.toLowerCase()
              )
              return idx >= 0 ? getOnChainName(idx) : ''
            })()
          }
          prize={gameState.prizePoolFormatted}
          players={players}
          names={names}
          onHome={onBack}
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
      <div className="fixed bottom-0 left-0 right-0 z-[150] bg-paper/95 border-t-3 border-text-dark/20 shadow-[0_-4px_12px_rgba(0,0,0,0.1)]"
        style={{ backdropFilter: 'blur(8px)' }}
      >
        <div className="max-w-4xl mx-auto px-6 py-3 flex items-center gap-4">
          {/* Progress bar */}
          <div
            className="flex-1 h-2 bg-paper-shadow/40 rounded-full overflow-hidden cursor-pointer group"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect()
              const pct = (e.clientX - rect.left) / rect.width
              const targetStep = Math.round(pct * (events.length - 1))
              goTo(targetStep)
            }}
          >
            <div
              className="h-full bg-gold rounded-full transition-all duration-200 group-hover:bg-gold/80"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Step counter */}
          <span className="font-data text-[11px] text-text-light tabular-nums w-16 text-center">
            {step + 1}/{events.length}
          </span>

          {/* Buttons */}
          <div className="flex items-center gap-1">
            <button
              onClick={restart}
              className="font-data text-sm text-text-dark px-2 py-1.5 bg-meadow border-2 border-text-dark/20 hover:border-text-dark/40 rounded-[10px] cursor-pointer transition-colors"
              title="Restart"
            >
              {'\u23EE'}
            </button>
            <button
              onClick={prev}
              className="font-data text-sm text-text-dark px-2 py-1.5 bg-meadow border-2 border-text-dark/20 hover:border-text-dark/40 rounded-[10px] cursor-pointer transition-colors"
              title="Previous"
            >
              {'\u25C0'}
            </button>
            <button
              onClick={playing ? pause : play}
              className={`font-display text-[10px] px-4 py-1.5 border-2 rounded-[10px] cursor-pointer transition-colors ${
                playing
                  ? 'text-blood border-blood/30 bg-blood/5 hover:border-blood/50'
                  : 'text-text-dark border-text-dark/20 bg-meadow hover:border-text-dark/40'
              }`}
            >
              {playing ? '\u23F8 PAUSE' : '\u25B6 PLAY'}
            </button>
            <button
              onClick={next}
              className="font-data text-sm text-text-dark px-2 py-1.5 bg-meadow border-2 border-text-dark/20 hover:border-text-dark/40 rounded-[10px] cursor-pointer transition-colors"
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
                className={`font-data text-[10px] px-2.5 py-1 rounded-[8px] cursor-pointer transition-colors border-2 ${
                  speed === s
                    ? 'text-text-dark bg-gold/30 border-gold/50'
                    : 'text-text-light border-text-dark/10 hover:border-text-dark/25'
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
