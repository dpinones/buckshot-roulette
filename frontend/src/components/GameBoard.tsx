import { type GameState } from '../hooks/useGameState'
import { type GameEvent } from '../hooks/useEventLog'
import { Phase } from '../config/contracts'
import { PlayerCard } from './PlayerCard'
import { ShellIndicator } from './ShellIndicator'
import { ShotgunVisual } from './ShotgunVisual'
import { EventLog } from './EventLog'
import { RoundBanner } from './RoundBanner'
import { GameOverScreen } from './GameOverScreen'

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

function playerLabel(index: number): string {
  return `P${index + 1}`
}

export function GameBoard({ state, prevState, events, onBack }: GameBoardProps) {
  const players = state.players
  const maxHp = maxHpForRound(state.currentRound)
  const isFinished = state.phase === Phase.FINISHED
  const aliveCount = state.alive.filter(Boolean).length

  return (
    <div className="min-h-screen bg-[#060609] flex flex-col scanlines">
      {/* Header */}
      <header className="border-b border-white/[0.04] px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-5">
            {onBack && (
              <button
                onClick={onBack}
                className="text-[9px] font-mono text-white/25 hover:text-white/50 transition-colors
                           border border-white/[0.06] hover:border-white/[0.12] px-2.5 py-1
                           cursor-pointer rounded-sm"
              >
                LOBBY
              </button>
            )}
            <h1 className="font-display text-lg font-bold tracking-[0.12em] text-white/85">
              BUCKSHOT<span className="text-blood">_</span>ROULETTE
            </h1>
            <RoundBanner round={state.currentRound} maxHp={maxHp} />
          </div>

          <div className="flex items-center gap-5">
            {/* Alive count */}
            <div className="text-[10px] font-mono text-white/20">
              <span className="text-alive">{aliveCount}</span>
              <span className="text-white/10">/{players.length} alive</span>
            </div>

            {/* Prize pool */}
            <div className="text-right">
              <div className="text-[8px] uppercase tracking-[0.3em] text-white/15">
                Prize
              </div>
              <div className="text-xs font-mono text-gold">
                {state.prizePoolFormatted} ETH
              </div>
            </div>
            <div className="w-1.5 h-1.5 rounded-full bg-alive animate-pulse" />
          </div>
        </div>
      </header>

      {/* Main arena */}
      <main className="flex-1 flex flex-col px-6 py-6">
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
                hp={state.hpList[i] ?? 0}
                maxHp={maxHp}
                items={state.playerItems[player.toLowerCase()] ?? []}
                isCurrentTurn={state.currentTurn?.toLowerCase() === player.toLowerCase()}
                isAlive={state.alive[i] ?? false}
                label={playerLabel(i)}
              />
            ))}
          </div>

          {/* Shotgun + Shells center piece */}
          <div className="flex items-center justify-center gap-10 py-2">
            <ShotgunVisual
              shellsRemaining={state.shellsRemaining}
              prevShellsRemaining={prevState?.shellsRemaining}
            />
            <div className="w-px h-16 bg-white/[0.04]" />
            <ShellIndicator
              live={state.liveRemaining}
              blank={state.blankRemaining}
            />
          </div>

          {/* Event Log */}
          <div className="flex-1 min-h-0">
            <EventLog events={events} />
          </div>
        </div>
      </main>

      {/* Game Over overlay */}
      {isFinished && (
        <GameOverScreen
          winner={state.winner}
          label={
            players.findIndex(
              (p) => p.toLowerCase() === state.winner.toLowerCase()
            ) >= 0
              ? playerLabel(
                  players.findIndex(
                    (p) => p.toLowerCase() === state.winner.toLowerCase()
                  )
                )
              : '???'
          }
          prize={state.prizePoolFormatted}
        />
      )}
    </div>
  )
}
