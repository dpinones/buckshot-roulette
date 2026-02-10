import { useLobbyState, type QueueInfo } from '../hooks/useLobbyState'
import { GameCard } from './GameCard'

interface LobbyProps {
  onSelectGame: (gameId: bigint) => void
  onOpenRankings?: () => void
}

function shortAddr(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

const MIN_PLAYERS = 2

function QueueCard({ queue }: { queue: QueueInfo }) {
  const progress = Math.min(queue.playerCount / MIN_PLAYERS, 1)

  return (
    <div className="bg-[rgba(200,230,200,0.92)] border-3 border-alive rounded-[14px] p-4 shadow-[0_4px_12px_rgba(0,0,0,0.1)]">
      {/* Buy-in */}
      <div className="text-center mb-3">
        <div className="text-lg font-display text-gold drop-shadow-[1px_1px_0_rgba(0,0,0,0.2)]">
          {queue.buyInFormatted}
        </div>
        <div className="text-[10px] font-data text-text-light">
          ETH buy-in
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-3">
        <div className="flex justify-between font-data text-[10px] text-text-light mb-1">
          <span>{queue.playerCount} queued</span>
          <span>{MIN_PLAYERS} to start</span>
        </div>
        <div className="h-1.5 bg-paper-shadow/40 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${progress * 100}%`,
              background: progress >= 1 ? 'var(--color-alive)' : 'linear-gradient(90deg, var(--color-gold), var(--color-agro))',
            }}
          />
        </div>
      </div>

      {/* Queued players */}
      {queue.playerCount > 0 ? (
        <div className="space-y-1">
          {queue.players.map((addr) => (
            <div
              key={addr}
              className="font-data text-[10px] text-text-light flex items-center gap-1.5"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-alive" />
              {shortAddr(addr)}
            </div>
          ))}
        </div>
      ) : (
        <div className="font-data text-[10px] text-text-light/60 text-center">
          Empty
        </div>
      )}
    </div>
  )
}

export function Lobby({ onSelectGame, onOpenRankings }: LobbyProps) {
  const { queues, games, connected, error } = useLobbyState(3000)

  return (
    <div className="min-h-screen bg-meadow flex flex-col">
      {/* Header */}
      <header className="border-b-3 border-paper-shadow/40 px-6 py-5">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="font-display text-2xl text-text-dark">
              Buckshot Roulette
            </h1>
          </div>

          <div className="flex items-center gap-4">
            {onOpenRankings && (
              <button
                onClick={onOpenRankings}
                className="font-display text-[11px] text-text-dark px-3 py-1.5 bg-paper border-2 border-text-dark/20 hover:border-gold rounded-[10px] shadow-[2px_2px_0_var(--color-paper-shadow)] cursor-pointer transition-colors hover:bg-[#FFF3D0]"
              >
                RANKINGS
              </button>
            )}
            <div className="flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full ${
                  connected ? 'bg-alive' : 'bg-blood animate-pulse'
                }`}
              />
              <span className="font-data text-[11px] text-text-light">
                {connected ? 'Connected' : 'Connecting...'}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 px-6 py-8">
        <div className="max-w-6xl mx-auto space-y-10">
          {error && (
            <div className="font-data text-sm text-blood text-center py-2">
              {error}
            </div>
          )}

          {/* Active Games */}
          <section>
            <div className="flex items-center gap-3 mb-5">
              <h2 className="font-display text-lg text-text-dark">
                Active Games
              </h2>
              <div className="flex-1 h-0.5 bg-paper-shadow/40" />
              {games.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-alive animate-pulse" />
                  <span className="font-data text-[11px] text-alive font-bold">
                    {games.length} live
                  </span>
                </div>
              )}
            </div>

            {games.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {games.map((game) => (
                  <GameCard
                    key={game.id.toString()}
                    game={game}
                    onClick={() => onSelectGame(game.id)}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-16 space-y-4">
                <img
                  src="/characters/shotgun.png"
                  alt="shotgun"
                  className="mx-auto w-48 opacity-30 -rotate-[5deg]"
                />
                <div className="font-data text-sm text-text-light">
                  No active games
                </div>
                <div className="font-data text-xs text-text-light/60">
                  Run <code className="text-text-dark bg-paper px-1.5 py-0.5 rounded border border-paper-shadow">make play-spectate</code> to start a game
                </div>
              </div>
            )}
          </section>

          {/* Queues Section */}
          <section>
            <div className="flex items-center gap-3 mb-4">
              <h2 className="font-display text-lg text-text-dark">
                Waiting Queues
              </h2>
              <div className="flex-1 h-0.5 bg-paper-shadow/40" />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {queues.map((queue) => (
                <QueueCard key={queue.buyIn.toString()} queue={queue} />
              ))}
              {queues.length === 0 && connected && (
                <div className="col-span-full text-center font-data text-sm text-text-light/60 py-8">
                  No queues available
                </div>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
