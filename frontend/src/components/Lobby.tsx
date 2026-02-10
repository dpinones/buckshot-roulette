import { useLobbyState, type QueueInfo } from '../hooks/useLobbyState'
import { GameCard } from './GameCard'

interface LobbyProps {
  onSelectGame: (gameId: bigint) => void
}

function shortAddr(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

const MIN_PLAYERS = 2

function QueueCard({ queue }: { queue: QueueInfo }) {
  const progress = Math.min(queue.playerCount / MIN_PLAYERS, 1)

  return (
    <div className="bg-panel border border-white/[0.04] rounded-sm p-4">
      {/* Buy-in */}
      <div className="text-center mb-3">
        <div className="text-lg font-display font-bold text-gold">
          {queue.buyInFormatted}
        </div>
        <div className="text-[8px] uppercase tracking-[0.3em] text-white/15">
          ETH buy-in
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-3">
        <div className="flex justify-between text-[9px] font-mono text-white/20 mb-1">
          <span>{queue.playerCount} queued</span>
          <span>{MIN_PLAYERS} to start</span>
        </div>
        <div className="h-1 bg-white/[0.04] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${progress * 100}%`,
              background:
                progress >= 1
                  ? '#10b981'
                  : 'linear-gradient(90deg, #dc2626, #f5a623)',
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
              className="text-[9px] font-mono text-white/20 flex items-center gap-1.5"
            >
              <div className="w-1 h-1 rounded-full bg-alive/40" />
              {shortAddr(addr)}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-[9px] font-mono text-white/10 text-center">
          Empty
        </div>
      )}
    </div>
  )
}

export function Lobby({ onSelectGame }: LobbyProps) {
  const { queues, games, connected, error } = useLobbyState(3000)

  return (
    <div className="min-h-screen bg-[#060609] flex flex-col scanlines">
      {/* Header */}
      <header className="border-b border-white/[0.04] px-6 py-5">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="font-display text-2xl font-bold tracking-[0.12em] text-white/85">
              BUCKSHOT<span className="text-blood">_</span>ROULETTE
            </h1>
            <span className="text-[8px] uppercase tracking-[0.3em] text-white/10 border border-white/[0.06] px-2 py-0.5 rounded-sm">
              Spectator
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <div
              className={`w-1.5 h-1.5 rounded-full ${
                connected ? 'bg-alive' : 'bg-blood animate-pulse'
              }`}
            />
            <span className="text-[9px] font-mono text-white/20">
              {connected ? 'Connected' : 'Connecting...'}
            </span>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 px-6 py-8">
        <div className="max-w-6xl mx-auto space-y-10">
          {error && (
            <div className="text-[10px] font-mono text-blood/50 text-center py-2">
              {error}
            </div>
          )}

          {/* Active Games — main focus */}
          <section>
            <div className="flex items-center gap-3 mb-5">
              <h2 className="text-sm font-display uppercase tracking-[0.2em] text-white/30 font-semibold">
                Active Games
              </h2>
              <div className="flex-1 h-px bg-white/[0.04]" />
              {games.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-blood animate-pulse" />
                  <span className="text-[9px] font-mono text-blood/70">
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
                <pre className="text-white/[0.06] text-[9px] leading-tight select-none">
{`     ____________________________________
    /                                    \\
===|  =====================================>
    \\____________________________________/
         ||    ||    ||`}
                </pre>
                <div className="text-[10px] font-mono text-white/10">
                  No active games
                </div>
                <div className="text-[9px] font-mono text-white/[0.06]">
                  Run <code className="text-neon/20">make play-spectate</code> to start a game
                </div>
              </div>
            )}
          </section>

          {/* Queues Section */}
          <section>
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-sm font-display uppercase tracking-[0.2em] text-white/20 font-semibold">
                Waiting Queues
              </h2>
              <div className="flex-1 h-px bg-white/[0.04]" />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {queues.map((queue) => (
                <QueueCard key={queue.buyIn.toString()} queue={queue} />
              ))}
              {queues.length === 0 && connected && (
                <div className="col-span-full text-center text-[10px] font-mono text-white/10 py-8">
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
