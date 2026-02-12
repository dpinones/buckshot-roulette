import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useLobbyState, type QueueInfo } from '../hooks/useLobbyState'
import { GameCard } from './GameCard'
import { BurnerWallets } from './BurnerWallets'
import { isLocal } from '../config/wagmi'

interface LobbyProps {
  onSelectGame: (gameId: bigint) => void
  onOpenRankings?: () => void
}

function shortAddr(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

const MIN_PLAYERS = 5

function QueueCard({ queue }: { queue: QueueInfo }) {
  const progress = Math.min(queue.playerCount / MIN_PLAYERS, 1)

  return (
    <div className="glass-panel p-5">
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <span className="font-display text-xl text-gold drop-shadow-[1px_1px_0_rgba(0,0,0,0.15)]">
            {queue.buyInFormatted}
          </span>
          <span className="font-data text-sm text-text-light ml-2">ETH buy-in</span>
        </div>
        <div className="font-data text-sm text-text-light">
          <span className="text-table-border font-bold text-base">{queue.playerCount}</span>/{MIN_PLAYERS} to start
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-3">
        <div className="h-3 bg-table-pink/20 rounded-full overflow-hidden border border-table-border/30">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${progress * 100}%`,
              background: progress >= 1
                ? 'linear-gradient(90deg, var(--color-alive), #8FD88F)'
                : 'linear-gradient(90deg, var(--color-table-pink), var(--color-agro))',
            }}
          />
        </div>
      </div>

      {/* Queued players */}
      {queue.playerCount > 0 ? (
        <div className="flex flex-wrap gap-2">
          {queue.players.map((addr) => (
            <span
              key={addr}
              className="inline-flex items-center gap-1.5 font-data text-xs text-text-light bg-table-pink/12 border border-table-border/25 rounded-lg px-2.5 py-1"
            >
              <span className="w-2 h-2 rounded-full bg-alive" />
              {shortAddr(addr)}
            </span>
          ))}
        </div>
      ) : (
        <div className="font-data text-sm text-text-light/40 text-center">
          Waiting for players...
        </div>
      )}
    </div>
  )
}

/* Section header with pastel divider */
function SectionHeader({ title, badge }: { title: string; badge?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4 mb-4">
      <h2 className="font-display text-xl text-text-dark">{title}</h2>
      <div className="flex-1 h-[2px] rounded-full" style={{ background: 'linear-gradient(90deg, var(--color-table-pink), transparent)' }} />
      {badge}
    </div>
  )
}

export function Lobby({ onSelectGame, onOpenRankings }: LobbyProps) {
  const { queues, games, connected, error } = useLobbyState(3000)

  const filteredQueues = queues.filter((q) => q.buyIn === 10_000_000_000_000n)

  return (
    <div className="relative min-h-screen flex flex-col">
      {/* Background */}
      <div className="fixed inset-0 z-0" style={{ background: "url('/bg-lobby.png') center/cover no-repeat" }} />
      <div className="fixed inset-0 z-0 bg-meadow/70" />

      {/* Header */}
      <header className="relative z-10 px-6 pt-5 pb-2">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img src="/characters/logo.png" alt="Fluffy Fate" className="h-12 md:h-14 drop-shadow-[2px_3px_0_rgba(0,0,0,0.1)]" />
            <h1 className="font-display text-4xl md:text-5xl text-text-dark drop-shadow-[2px_3px_0_rgba(0,0,0,0.1)]">
              Fluffy Fate
            </h1>
            <div className="w-12 h-1.5 rounded-full bg-table-pink/60 hidden md:block" />
          </div>
          <div className="flex items-center gap-3">
            {onOpenRankings && (
              <button
                onClick={onOpenRankings}
                className="font-display text-sm text-[#9A6B8F] px-4 py-2 bg-table-pink/15 backdrop-blur-sm border-2 border-table-border/40 hover:border-table-border rounded-[10px] shadow-[2px_2px_0_var(--color-paper-shadow)] cursor-pointer transition-colors hover:bg-table-pink/25"
              >
                RANKINGS
              </button>
            )}
            {isLocal ? <BurnerWallets /> : <ConnectButton accountStatus="address" chainStatus="icon" showBalance={false} />}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="relative z-10 flex-1 px-6 py-4">
        <div className="max-w-7xl mx-auto space-y-6">
          {error && (
            <div className="font-data text-base text-blood text-center py-2">
              {error}
            </div>
          )}

          {/* Active Games */}
          <section className="glass-panel p-6">
            <SectionHeader
              title="Active Games"
              badge={games.length > 0 ? (
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-alive animate-pulse" />
                  <span className="font-data text-sm text-alive font-bold">{games.length} live</span>
                </div>
              ) : undefined}
            />

            {games.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {games.map((game) => (
                  <GameCard
                    key={game.id.toString()}
                    game={game}
                    onClick={() => onSelectGame(game.id)}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-14 space-y-4">
                <img
                  src="/characters/cigarette.png"
                  alt="cigarette"
                  className="mx-auto w-24 opacity-20 -rotate-[5deg]"
                />
                <div className="font-data text-base text-text-light/50">
                  No active games
                </div>
              </div>
            )}
          </section>

          {/* Queues */}
          <section>
            <SectionHeader title="Waiting Queues" />

            <div className="max-w-2xl mx-auto space-y-4">
              {filteredQueues.map((queue) => (
                <QueueCard key={queue.buyIn.toString()} queue={queue} />
              ))}
              {filteredQueues.length === 0 && connected && (
                <div className="text-center font-data text-base text-text-light/40 py-8">
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
