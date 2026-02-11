import { useState, useEffect, useRef, useCallback } from 'react'
import { type Address } from 'viem'
import { type GameState } from '../hooks/useGameState'
import { type GameEvent } from '../hooks/useEventLog'
import { Phase } from '../config/contracts'
import { getCharacter } from '../config/characters'
import { usePlayerNames } from '../hooks/usePlayerNames'
import { useAudio } from '../hooks/useAudio'
import { AgentCard } from './AgentCard'
import { CharacterStage } from './CharacterStage'
import { TableArea } from './TableArea'
import { EventLogNotebook } from './EventLogNotebook'
import { TurnFlash } from './TurnFlash'
import { GameOverOverlay } from './GameOverOverlay'
import { PlayerStatsModal } from './PlayerStatsModal'
import { ReadyGoOverlay } from './ReadyGoOverlay'
import { VolumeControl } from './VolumeControl'

export type ShotAction = {
  phase: 'prepare' | 'fire'
  shooterIdx: number
  targetIdx: number
  isSelf: boolean
  isLive: boolean
  damage: number
} | null

interface GameBoardProps {
  state: GameState
  prevState: GameState | null
  events: GameEvent[]
  onBack?: () => void
}

function getNextAliveIdx(alive: readonly boolean[], fromIdx: number): number {
  const aliveIdxs = alive.map((a, i) => a ? i : -1).filter(i => i >= 0)
  if (aliveIdxs.length === 0) return fromIdx
  const pos = aliveIdxs.indexOf(fromIdx)
  if (pos < 0) return aliveIdxs[0]
  return aliveIdxs[(pos + 1) % aliveIdxs.length]
}

export function GameBoard({ state, prevState, events, onBack }: GameBoardProps) {
  const [selectedPlayer, setSelectedPlayer] = useState<{ address: Address; label: string } | null>(null)
  const [isThinking, setIsThinking] = useState(false)
  const [showReadyGo, setShowReadyGo] = useState(true)
  const [shotAction, setShotAction] = useState<ShotAction>(null)
  const [damagedIdx, setDamagedIdx] = useState<number | null>(null)
  const [roundTotalShells, setRoundTotalShells] = useState(state.shellsRemaining)
  const [flashTurnIdx, setFlashTurnIdx] = useState(state.currentTurnIndex)
  const [showGameOver, setShowGameOver] = useState(false)
  const players = state.players
  const names = usePlayerNames(players)
  const { playTurnSfx, playShotSfx, playBlankSfx, playPrepareSfx, playReloadSfx, volume, setVolume } = useAudio()
  const prevTurnRef = useRef(state.currentTurnIndex)
  const shotTimersRef = useRef<ReturnType<typeof setTimeout>[]>([])

  // Frozen display state: captures pre-shot values so UI doesn't update until the fire phase
  const frozenRef = useRef<{
    hpList: readonly number[]
    alive: readonly boolean[]
    currentTurnIndex: number
    liveRemaining: number
    blankRemaining: number
    shellsRemaining: number
    currentRound: number
  } | null>(null)

  const clearShotTimers = useCallback(() => {
    shotTimersRef.current.forEach(t => clearTimeout(t))
    shotTimersRef.current = []
    frozenRef.current = null
  }, [])

  function getOnChainName(index: number): string {
    return names[players[index]?.toLowerCase()] || ''
  }

  function getLabel(index: number): string {
    return getCharacter(getOnChainName(index)).name
  }

  const maxHp = 3
  const isFinished = state.phase === Phase.FINISHED

  // Display values: frozen during prepare phase, real state during fire/idle
  const frozen = frozenRef.current
  const dHpList = frozen?.hpList ?? state.hpList
  const dAlive = frozen?.alive ?? state.alive
  const dTurnIdx = frozen?.currentTurnIndex ?? state.currentTurnIndex
  const dLiveRemaining = frozen?.liveRemaining ?? state.liveRemaining
  const dBlankRemaining = frozen?.blankRemaining ?? state.blankRemaining
  const dShellsRemaining = frozen?.shellsRemaining ?? state.shellsRemaining
  const dCurrentRound = frozen?.currentRound ?? state.currentRound

  const nextAliveIdx = getNextAliveIdx(dAlive, dTurnIdx)

  // Synchronous shot detection: freeze character positions during shot animation
  // Detect shot: shells decreased, OR round changed (last shell caused reload), OR game just ended
  const shellDecreased = prevState != null && state.shellsRemaining < prevState.shellsRemaining
  const roundChanged = prevState != null && state.currentRound > prevState.currentRound
  const gameJustEnded = prevState != null && state.phase === Phase.FINISHED && prevState.phase !== Phase.FINISHED
  const shotJustHappened = shellDecreased || roundChanged || gameJustEnded
  const centerOverrideIdx = shotJustHappened ? prevState!.currentTurnIndex : undefined

  // Play turn SFX and toggle thinking on turn change
  // Skip when a shot just happened — the shot animation handles it with delay
  useEffect(() => {
    if (showReadyGo) return
    if (state.currentTurnIndex !== prevTurnRef.current) {
      prevTurnRef.current = state.currentTurnIndex
      if (!shotJustHappened) {
        playTurnSfx()
        setFlashTurnIdx(state.currentTurnIndex)
        setIsThinking(false)
        const timer = setTimeout(() => setIsThinking(true), 1500)
        return () => clearTimeout(timer)
      }
    }
  }, [state.currentTurnIndex, playTurnSfx, showReadyGo, shotJustHappened])

  // Hide thinking when items are used or shots happen
  useEffect(() => {
    if (showReadyGo) return
    if (prevState && (
      state.shellsRemaining !== prevState.shellsRemaining ||
      JSON.stringify(state.playerItems) !== JSON.stringify(prevState.playerItems)
    )) {
      setIsThinking(false)
      const timer = setTimeout(() => setIsThinking(true), 800)
      return () => clearTimeout(timer)
    }
  }, [state.shellsRemaining, state.playerItems, showReadyGo])

  // Shot detection: shells decreased, round changed (reload after last shell), or game ended
  useEffect(() => {
    if (showReadyGo) return
    if (!prevState) return
    if (!shellDecreased && !roundChanged && !gameJustEnded) return

    // A shell was fired
    const shooterIdx = prevState.currentTurnIndex

    // Check if anyone took damage
    let targetIdx = shooterIdx
    let isLive = false
    let damage = 0
    for (let i = 0; i < state.hpList.length; i++) {
      const hpDiff = (prevState.hpList[i] ?? 0) - (state.hpList[i] ?? 0)
      if (hpDiff > 0) {
        targetIdx = i
        isLive = true
        damage = hpDiff
        break
      }
    }

    // For blank shots: if turn didn't change → self-shot blank (extra turn), else → opponent blank
    if (!isLive) {
      if (state.currentTurnIndex === prevState.currentTurnIndex) {
        targetIdx = shooterIdx // self-shot blank
      } else {
        // Shot opponent with blank — find who the next alive player was (the probable target)
        const aliveIdxs = prevState.alive.map((a, i) => a ? i : -1).filter(i => i >= 0)
        const shooterPos = aliveIdxs.indexOf(shooterIdx)
        if (shooterPos >= 0 && aliveIdxs.length > 1) {
          targetIdx = aliveIdxs[(shooterPos + 1) % aliveIdxs.length]
        }
      }
    }

    const isSelf = shooterIdx === targetIdx

    console.log('[SHOT]', {
      shooterIdx,
      targetIdx,
      isSelf,
      isLive,
      damage,
      prevShells: prevState.shellsRemaining,
      newShells: state.shellsRemaining,
      prevTurn: prevState.currentTurnIndex,
      newTurn: state.currentTurnIndex,
      prevHp: [...prevState.hpList],
      newHp: [...state.hpList],
    })

    // Animation sequence
    clearShotTimers()

    // t=0: freeze display at pre-shot values + prepare
    frozenRef.current = {
      hpList: prevState.hpList,
      alive: prevState.alive,
      currentTurnIndex: prevState.currentTurnIndex,
      liveRemaining: prevState.liveRemaining,
      blankRemaining: prevState.blankRemaining,
      shellsRemaining: prevState.shellsRemaining,
      currentRound: prevState.currentRound,
    }
    setShotAction({ phase: 'prepare', shooterIdx, targetIdx, isSelf, isLive, damage })
    playPrepareSfx()

    // t=700ms: fire — shot sound + damage animation
    const t1 = setTimeout(() => {
      setShotAction({ phase: 'fire', shooterIdx, targetIdx, isSelf, isLive, damage })
      if (isLive) {
        playShotSfx()
        setDamagedIdx(targetIdx)
      } else {
        playBlankSfx()
      }
    }, 700)

    // t=1200ms: unfreeze display — positions start shifting, HP/shells/alive update
    const t2 = setTimeout(() => {
      frozenRef.current = null
      setDamagedIdx(null)
      setIsThinking(false)
    }, 1200)

    // t=1900ms: turn SFX + flash (after 0.7s CSS transition completes)
    const t3 = setTimeout(() => {
      if (state.currentTurnIndex !== prevState.currentTurnIndex) {
        playTurnSfx()
        setFlashTurnIdx(state.currentTurnIndex)
      }
    }, 1900)

    // t=2200ms: clear shot animation + re-enable thinking
    const t4 = setTimeout(() => {
      setShotAction(null)
      setIsThinking(true)
    }, 2200)

    shotTimersRef.current = [t1, t2, t3, t4]

    return () => clearShotTimers()
  }, [state.shellsRemaining, state.hpList, state.currentRound, state.phase, prevState, clearShotTimers, playShotSfx, playBlankSfx, playPrepareSfx, playTurnSfx, showReadyGo])

  // Track total shells for the round: update when shells increase (reload) or first appear
  useEffect(() => {
    if (state.shellsRemaining > roundTotalShells) {
      setRoundTotalShells(state.shellsRemaining)
    }
  }, [state.shellsRemaining, roundTotalShells])

  // Shell reload detection (SFX only) — delay if it coincides with a shot (round transition)
  useEffect(() => {
    if (showReadyGo) return
    if (!prevState) return
    if (state.shellsRemaining <= prevState.shellsRemaining) return
    // If a round just changed, delay reload SFX so it plays after the shot animation
    if (state.currentRound > prevState.currentRound) {
      const timer = setTimeout(() => playReloadSfx(), 2200)
      return () => clearTimeout(timer)
    }
    playReloadSfx()
  }, [state.shellsRemaining, state.currentRound, prevState, playReloadSfx, showReadyGo])

  // Delay game over overlay so the last shot animation plays out
  useEffect(() => {
    if (isFinished && !showGameOver) {
      const timer = setTimeout(() => setShowGameOver(true), 3000)
      return () => clearTimeout(timer)
    }
  }, [isFinished, showGameOver])

  return (
    <div className="relative w-screen h-screen overflow-hidden flex flex-col select-none">
      {/* Background */}
      <div className="absolute inset-0 z-0" style={{ background: `url('/characters/bg.png') center center / cover no-repeat` }}>
        <video autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover">
          <source src="/characters/bg.mp4" type="video/mp4" />
        </video>
      </div>

      {/* Turn flash */}
      <TurnFlash currentTurnIndex={flashTurnIdx} />

      {/* Back button */}
      {onBack && (
        <button
          onClick={onBack}
          className="fixed top-3 left-3 z-[150] font-display text-[11px] px-3 py-1.5 bg-paper border-2 border-text-dark rounded-[10px] shadow-[2px_2px_0_var(--color-paper-shadow)] cursor-pointer text-text-dark hover:bg-[#FFF3D0] transition-colors"
        >
          LOBBY
        </button>
      )}

      {/* Zone 1: Top Bar — Agent cards */}
      <div className="relative z-50 h-[33.33vh] flex justify-center items-start gap-3 px-4 pt-4 shrink-0">
        {players.map((player, i) => (
          <AgentCard
            key={player}
            address={player}
            hp={dHpList[i] ?? 0}
            maxHp={maxHp}
            items={state.playerItems[player.toLowerCase()] ?? []}
            isCurrentTurn={i === dTurnIdx}
            isNext={i === nextAliveIdx && i !== dTurnIdx}
            isAlive={dAlive[i] ?? false}
            label={getOnChainName(i)}
            isDamaged={damagedIdx === i}
            onClick={() => setSelectedPlayer({ address: player, label: getOnChainName(i) })}
          />
        ))}
      </div>

      {/* Zone 2: Middle — Character Stage */}
      <CharacterStage
        players={players}
        alive={dAlive}
        currentTurnIndex={dTurnIdx}
        centerOverrideIdx={centerOverrideIdx}
        names={names}
        isThinking={isThinking}
        shotAction={shotAction}
        damagedIdx={damagedIdx}
      />

      {/* Zone 3: Bottom — Table */}
      <TableArea
        liveShells={dLiveRemaining}
        blankShells={dBlankRemaining}
        spentShells={roundTotalShells - dShellsRemaining}
        round={dCurrentRound}
        maxHp={maxHp}
        prize={state.prizePoolFormatted}
        shotAction={shotAction}
      />

      {/* Floating event log */}
      <EventLogNotebook events={events} />

      {/* Game Over overlay */}
      {showGameOver && (
        <GameOverOverlay
          winner={state.winner}
          label={
            (() => {
              const idx = players.findIndex(
                (p) => p.toLowerCase() === state.winner.toLowerCase()
              )
              return idx >= 0 ? getOnChainName(idx) : ''
            })()
          }
          prize={state.prizePoolFormatted}
          players={players}
          names={names}
          onHome={onBack}
          gameId={state.id}
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

      {/* Ready / Go intro */}
      {showReadyGo && <ReadyGoOverlay onDone={() => setShowReadyGo(false)} />}

      {/* Volume control */}
      <VolumeControl volume={volume} setVolume={setVolume} />
    </div>
  )
}
