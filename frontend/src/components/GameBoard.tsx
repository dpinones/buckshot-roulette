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

export function GameBoard({ state, prevState, events, onBack }: GameBoardProps) {
  const [selectedPlayer, setSelectedPlayer] = useState<{ address: Address; label: string } | null>(null)
  const [isThinking, setIsThinking] = useState(false)
  const [showReadyGo, setShowReadyGo] = useState(true)
  const [shotAction, setShotAction] = useState<ShotAction>(null)
  const [damagedIdx, setDamagedIdx] = useState<number | null>(null)
  const players = state.players
  const names = usePlayerNames(players)
  const { playTurnSfx, playShotSfx, playBlankSfx, playPrepareSfx, playReloadSfx } = useAudio()
  const prevTurnRef = useRef(state.currentTurnIndex)
  const shotTimersRef = useRef<ReturnType<typeof setTimeout>[]>([])

  const clearShotTimers = useCallback(() => {
    shotTimersRef.current.forEach(t => clearTimeout(t))
    shotTimersRef.current = []
  }, [])

  function getOnChainName(index: number): string {
    return names[players[index]?.toLowerCase()] || ''
  }

  function getLabel(index: number): string {
    return getCharacter(getOnChainName(index)).name
  }

  const maxHp = maxHpForRound(state.currentRound)
  const isFinished = state.phase === Phase.FINISHED
  const nextAliveIdx = getNextAliveIdx(state.alive, state.currentTurnIndex)

  // Synchronous shot detection: freeze character positions during shot animation
  // This is computed during render so CharacterStage sees the override immediately
  const shotJustHappened = prevState != null && state.shellsRemaining < prevState.shellsRemaining
  const centerOverrideIdx = shotJustHappened ? prevState.currentTurnIndex : undefined

  // Play turn SFX and toggle thinking on turn change
  useEffect(() => {
    if (showReadyGo) return
    if (state.currentTurnIndex !== prevTurnRef.current) {
      playTurnSfx()
      setIsThinking(false)
      const timer = setTimeout(() => setIsThinking(true), 1500)
      prevTurnRef.current = state.currentTurnIndex
      return () => clearTimeout(timer)
    }
  }, [state.currentTurnIndex, playTurnSfx, showReadyGo])

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

  // Shot detection: compare shells remaining to detect a shot was fired
  useEffect(() => {
    if (showReadyGo) return
    if (!prevState) return
    if (state.shellsRemaining >= prevState.shellsRemaining) return

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

    // t=0: prepare
    setShotAction({ phase: 'prepare', shooterIdx, targetIdx, isSelf, isLive, damage })
    playPrepareSfx()

    // t=800ms: fire
    const t1 = setTimeout(() => {
      setShotAction({ phase: 'fire', shooterIdx, targetIdx, isSelf, isLive, damage })
      if (isLive) {
        playShotSfx()
        setDamagedIdx(targetIdx)
      } else {
        playBlankSfx()
      }
    }, 800)

    // t=2000ms: clear
    const t2 = setTimeout(() => {
      setShotAction(null)
      setDamagedIdx(null)
    }, 2000)

    shotTimersRef.current = [t1, t2]

    return () => clearShotTimers()
  }, [state.shellsRemaining, state.hpList, prevState, clearShotTimers, playShotSfx, playBlankSfx, playPrepareSfx, showReadyGo])

  // Shell reload detection
  useEffect(() => {
    if (showReadyGo) return
    if (!prevState) return
    if (state.shellsRemaining > prevState.shellsRemaining) {
      playReloadSfx()
    }
  }, [state.shellsRemaining, prevState, playReloadSfx, showReadyGo])

  return (
    <div className="relative w-screen h-screen overflow-hidden flex flex-col select-none">
      {/* Background */}
      <div className="absolute inset-0 z-0" style={{ background: `url('/characters/bg.png') center center / cover no-repeat` }}>
        <video autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover">
          <source src="/characters/bg.mp4" type="video/mp4" />
        </video>
      </div>

      {/* Turn flash */}
      <TurnFlash currentTurnIndex={state.currentTurnIndex} />

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
      <div className="relative z-50 h-[33.33vh] flex justify-center items-start gap-2 px-3 pt-3 shrink-0">
        {players.map((player, i) => (
          <AgentCard
            key={player}
            address={player}
            hp={state.hpList[i] ?? 0}
            maxHp={maxHp}
            items={state.playerItems[player.toLowerCase()] ?? []}
            isCurrentTurn={i === state.currentTurnIndex}
            isNext={i === nextAliveIdx && i !== state.currentTurnIndex}
            isAlive={state.alive[i] ?? false}
            label={getOnChainName(i)}
            isDamaged={damagedIdx === i}
            onClick={() => setSelectedPlayer({ address: player, label: getOnChainName(i) })}
          />
        ))}
      </div>

      {/* Zone 2: Middle — Character Stage */}
      <CharacterStage
        players={players}
        alive={state.alive}
        currentTurnIndex={state.currentTurnIndex}
        centerOverrideIdx={centerOverrideIdx}
        names={names}
        isThinking={isThinking}
        shotAction={shotAction}
        damagedIdx={damagedIdx}
      />

      {/* Zone 3: Bottom — Table */}
      <TableArea
        liveShells={state.liveRemaining}
        blankShells={state.blankRemaining}
        round={state.currentRound}
        maxHp={maxHp}
        prize={state.prizePoolFormatted}
        shotAction={shotAction}
      />

      {/* Floating event log */}
      <EventLogNotebook events={events} />

      {/* Game Over overlay */}
      {isFinished && (
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
    </div>
  )
}
