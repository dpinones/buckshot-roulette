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
    <div className="bg-surface border border-white/5 rounded-lg p-4">
      {/* Buy-in tier */}
      <div className="text-center mb-3">
        <div className="text-lg font-mono font-bold text-gold">
          {queue.buyInFormatted}
        </div>
        <div className="text-[10px] uppercase tracking-[0.3em] text-white/20">
          ETH buy-in
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-3">
        <div className="flex justify-between text-[10px] font-mono text-white/30 mb-1">
          <span>{queue.playerCount} queued</span>
          <span>{MIN_PLAYERS} to start</span>
        </div>
        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${progress * 100}%`,
              background:
                progress >= 1
                  ? '#22d3ee'
                  : 'linear-gradient(90deg, #dc2626, #f59e0b)',
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
              className="text-[10px] font-mono text-white/30 flex items-center gap-1.5"
            >
              <div className="w-1 h-1 rounded-full bg-neon/50" />
              {shortAddr(addr)}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-[10px] font-mono text-white/15 text-center">
          Empty
        </div>
      )}
    </div>
  )
}

export function Lobby({ onSelectGame }: LobbyProps) {
  const { queues, games, connected, error } = useLobbyState(3000)

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
          <h1 className="text-xl font-mono font-bold tracking-[0.15em] text-white/90">
            BUCKSHOT<span className="text-blood">_</span>ROULETTE
          </h1>

          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${
                connected ? 'bg-green-500' : 'bg-blood animate-pulse'
              }`}
            />
            <span className="text-[10px] font-mono text-white/30">
              {connected ? 'Connected' : 'Connecting...'}
            </span>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 px-6 py-8">
        <div className="max-w-6xl mx-auto space-y-10">
          {error && (
            <div className="text-xs font-mono text-blood/60 text-center">
              {error}
            </div>
          )}

          {/* Queues Section */}
          <section>
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-sm font-mono uppercase tracking-[0.2em] text-white/40">
                Waiting Queues
              </h2>
              <div className="flex-1 h-px bg-white/5" />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {queues.map((queue) => (
                <QueueCard key={queue.buyIn.toString()} queue={queue} />
              ))}
              {queues.length === 0 && connected && (
                <div className="col-span-full text-center text-xs font-mono text-white/15 py-8">
                  No queues available
                </div>
              )}
            </div>
          </section>

          {/* Active Games Section */}
          <section>
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-sm font-mono uppercase tracking-[0.2em] text-white/40">
                Active Games
              </h2>
              <div className="flex-1 h-px bg-white/5" />
              {games.length > 0 && (
                <span className="text-[10px] font-mono text-blood">
                  {games.length} live
                </span>
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
              <div className="text-center py-12 space-y-3">
                <pre className="text-white/10 text-[10px] leading-tight select-none">
{`     ____________________________________
    /                                    \\
===|  =====================================>
    \\____________________________________/
         ||    ||    ||`}
                </pre>
                <div className="text-xs font-mono text-white/15">
                  No active games
                </div>
                <div className="text-[10px] font-mono text-white/10">
                  Run <code className="text-neon/30">make play-spectate</code> to start a game
                </div>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  )
}
