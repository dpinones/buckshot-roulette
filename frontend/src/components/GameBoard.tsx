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
}

function maxHpForRound(round: number): number {
  if (round === 1) return 2
  if (round === 2) return 4
  return 5
}

function playerLabel(index: number): string {
  return `P${index + 1}`
}

export function GameBoard({ state, prevState, events }: GameBoardProps) {
  const players = state.players
  const maxHp = maxHpForRound(state.currentRound)
  const isFinished = state.phase === Phase.FINISHED

  return (
    <div className="min-h-screen bg-[#0a0a1a] flex flex-col">
      {/* Noise overlay */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.03] z-50"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Header */}
      <header className="border-b border-white/5 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-6">
            <h1 className="text-xl font-mono font-bold tracking-[0.15em] text-white/90">
              BUCKSHOT<span className="text-blood">_</span>ROULETTE
            </h1>
            <RoundBanner round={state.currentRound} maxHp={maxHp} />
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-[0.3em] text-white/20">
                Prize Pool
              </div>
              <div className="text-sm font-mono text-gold">
                {state.prizePoolFormatted} ETH
              </div>
            </div>
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          </div>
        </div>
      </header>

      {/* Main arena */}
      <main className="flex-1 flex flex-col justify-center px-6 py-8">
        <div className="max-w-6xl mx-auto w-full">
          {/* Players + Shotgun row */}
          <div className="grid grid-cols-[1fr_auto_1fr] gap-8 items-center mb-8">
            {/* Player 1 (left) */}
            {players.length > 0 && (
              <PlayerCard
                address={players[0]}
                hp={state.hpList[0] ?? 0}
                maxHp={maxHp}
                items={state.playerItems[players[0].toLowerCase()] ?? []}
                isCurrentTurn={state.currentTurn?.toLowerCase() === players[0].toLowerCase()}
                isAlive={state.alive[0] ?? false}
                label={playerLabel(0)}
                side="left"
              />
            )}

            {/* Center: Shotgun + Shells */}
            <div className="flex flex-col items-center gap-4 min-w-[280px]">
              <ShotgunVisual
                shellsRemaining={state.shellsRemaining}
                prevShellsRemaining={prevState?.shellsRemaining}
              />
              <ShellIndicator
                live={state.liveRemaining}
                blank={state.blankRemaining}
              />
            </div>

            {/* Player 2 (right) */}
            {players.length > 1 && (
              <PlayerCard
                address={players[1]}
                hp={state.hpList[1] ?? 0}
                maxHp={maxHp}
                items={state.playerItems[players[1].toLowerCase()] ?? []}
                isCurrentTurn={state.currentTurn?.toLowerCase() === players[1].toLowerCase()}
                isAlive={state.alive[1] ?? false}
                label={playerLabel(1)}
                side="right"
              />
            )}
          </div>

          {/* Event Log */}
          <EventLog events={events} />
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
