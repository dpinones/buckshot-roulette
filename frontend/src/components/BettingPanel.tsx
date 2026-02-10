import { useState } from 'react'
import { type Address, parseEther, formatEther } from 'viem'
import { useAccount } from 'wagmi'
import { type GameState } from '../hooks/useGameState'
import { useBetting } from '../hooks/useBetting'
import { usePlayerNames } from '../hooks/usePlayerNames'

interface BettingPanelProps {
  gameId: bigint
  state: GameState
  onBack?: () => void
}

type BetTab = 'winner' | 'first_death' | 'over_kills'

function shortAddr(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

function CountdownTimer({ timeLeft }: { timeLeft: number }) {
  const minutes = Math.floor(timeLeft / 60)
  const seconds = timeLeft % 60
  const isUrgent = timeLeft < 10

  return (
    <div className={`font-mono text-4xl font-bold tracking-wider ${
      isUrgent ? 'text-blood animate-pulse' : 'text-gold'
    }`}>
      {minutes}:{seconds.toString().padStart(2, '0')}
    </div>
  )
}

export function BettingPanel({ gameId, state, onBack }: BettingPanelProps) {
  const { address: wallet } = useAccount()
  const betting = useBetting(gameId)
  const names = usePlayerNames(state.players)
  const [activeTab, setActiveTab] = useState<BetTab>('winner')
  const [betAmount, setBetAmount] = useState('0.01')
  const [selectedPlayer, setSelectedPlayer] = useState<Address | null>(null)
  const [selectedPosition, setSelectedPosition] = useState(1)
  const [selectedThreshold, setSelectedThreshold] = useState(1)
  const [betYes, setBetYes] = useState(true)

  const players = state.players

  function getLabel(addr: Address): string {
    const name = names[addr.toLowerCase()]
    return name || shortAddr(addr)
  }

  function handlePlaceBet() {
    if (!selectedPlayer && activeTab !== 'over_kills') return
    const amount = parseEther(betAmount)

    if (activeTab === 'winner' && selectedPlayer) {
      betting.placeBetWinner(selectedPlayer, amount)
    } else if (activeTab === 'first_death' && selectedPlayer) {
      betting.placeBetFirstDeath(selectedPosition, selectedPlayer, amount)
    } else if (activeTab === 'over_kills' && selectedPlayer) {
      betting.placeBetOverKills(selectedPlayer, selectedThreshold, betYes, amount)
    }
  }

  const canBet = wallet && betting.timeLeft > 0 && selectedPlayer && parseFloat(betAmount) >= 0.001
  const myBetsCount = betting.state?.myBets?.amounts?.length ?? 0
  const myBetsTotal = betting.state?.myBets?.amounts?.reduce((sum, a) => sum + a, 0n) ?? 0n

  return (
    <div className="min-h-screen bg-[#060609] flex flex-col scanlines">
      {/* Header */}
      <header className="border-b border-white/[0.04] px-6 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
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
            <span className="text-[9px] font-mono px-2 py-0.5 bg-gold/10 text-gold/80 border border-gold/20 rounded-sm uppercase tracking-wider">
              Betting
            </span>
          </div>

          <div className="text-right">
            <div className="text-[8px] uppercase tracking-[0.3em] text-white/15">
              Game #{gameId.toString()}
            </div>
            <div className="text-xs font-mono text-gold">
              {state.prizePoolFormatted} ETH
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 px-6 py-8">
        <div className="max-w-5xl mx-auto space-y-8">
          {/* Countdown */}
          <div className="text-center space-y-2">
            <div className="text-[9px] uppercase tracking-[0.4em] text-white/20 font-display">
              Betting closes in
            </div>
            <CountdownTimer timeLeft={betting.timeLeft} />
            {betting.timeLeft === 0 && (
              <div className="space-y-2">
                <div className="text-[10px] font-mono text-white/30">
                  Betting window closed
                </div>
                {wallet && (
                  <button
                    onClick={betting.activateGame}
                    disabled={betting.isActivating}
                    className="text-[10px] font-mono uppercase tracking-[0.15em] text-gold/80 hover:text-gold
                               border border-gold/30 hover:border-gold/60 px-5 py-2
                               cursor-pointer rounded-sm transition-colors disabled:opacity-30"
                  >
                    {betting.isActivating ? 'Activating...' : 'Start Game'}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Players list */}
          <div className="flex justify-center gap-4">
            {players.map((player, i) => (
              <div key={player} className="text-center space-y-1">
                <div className="w-10 h-10 rounded-full bg-panel border border-white/[0.06] flex items-center justify-center mx-auto">
                  <span className="text-xs font-display text-white/50">P{i + 1}</span>
                </div>
                <div className="text-[9px] font-mono text-white/40">{getLabel(player)}</div>
              </div>
            ))}
          </div>

          {/* Bet Type Tabs */}
          <div className="flex justify-center gap-1">
            {(['winner', 'first_death', 'over_kills'] as BetTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => { setActiveTab(tab); setSelectedPlayer(null) }}
                className={`text-[9px] font-mono uppercase tracking-[0.15em] px-4 py-2 rounded-sm transition-colors cursor-pointer
                  ${activeTab === tab
                    ? 'bg-gold/10 text-gold border border-gold/30'
                    : 'text-white/25 border border-white/[0.04] hover:border-white/[0.1] hover:text-white/40'
                  }`}
              >
                {tab === 'winner' ? 'Winner' : tab === 'first_death' ? 'First Death' : 'Over/Under Kills'}
              </button>
            ))}
          </div>

          {/* Bet Form */}
          <div className="bg-panel border border-white/[0.04] rounded-sm p-6 space-y-5">
            {/* Tab-specific content */}
            {activeTab === 'winner' && (
              <div className="space-y-3">
                <div className="text-[9px] uppercase tracking-[0.3em] text-white/20 font-display">
                  Who will win?
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {players.map((player, i) => (
                    <button
                      key={player}
                      onClick={() => setSelectedPlayer(player)}
                      className={`text-left p-3 rounded-sm border transition-colors cursor-pointer ${
                        selectedPlayer === player
                          ? 'bg-gold/10 border-gold/30 text-gold'
                          : 'border-white/[0.04] text-white/40 hover:border-white/[0.1]'
                      }`}
                    >
                      <div className="text-xs font-display font-bold">P{i + 1}</div>
                      <div className="text-[8px] font-mono text-inherit/60">{getLabel(player)}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'first_death' && (
              <div className="space-y-4">
                <div className="text-[9px] uppercase tracking-[0.3em] text-white/20 font-display">
                  Who dies at position?
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[9px] font-mono text-white/30">Death #</span>
                  {[1, 2, 3].map((pos) => (
                    <button
                      key={pos}
                      onClick={() => setSelectedPosition(pos)}
                      className={`text-xs font-mono px-3 py-1 rounded-sm border transition-colors cursor-pointer ${
                        selectedPosition === pos
                          ? 'bg-blood/10 border-blood/30 text-blood'
                          : 'border-white/[0.04] text-white/30 hover:border-white/[0.1]'
                      }`}
                    >
                      {pos}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {players.map((player, i) => (
                    <button
                      key={player}
                      onClick={() => setSelectedPlayer(player)}
                      className={`text-left p-3 rounded-sm border transition-colors cursor-pointer ${
                        selectedPlayer === player
                          ? 'bg-blood/10 border-blood/30 text-blood'
                          : 'border-white/[0.04] text-white/40 hover:border-white/[0.1]'
                      }`}
                    >
                      <div className="text-xs font-display font-bold">P{i + 1}</div>
                      <div className="text-[8px] font-mono text-inherit/60">{getLabel(player)}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'over_kills' && (
              <div className="space-y-4">
                <div className="text-[9px] uppercase tracking-[0.3em] text-white/20 font-display">
                  Will player get X+ kills?
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {players.map((player, i) => (
                    <button
                      key={player}
                      onClick={() => setSelectedPlayer(player)}
                      className={`text-left p-3 rounded-sm border transition-colors cursor-pointer ${
                        selectedPlayer === player
                          ? 'bg-gold/10 border-gold/30 text-gold'
                          : 'border-white/[0.04] text-white/40 hover:border-white/[0.1]'
                      }`}
                    >
                      <div className="text-xs font-display font-bold">P{i + 1}</div>
                      <div className="text-[8px] font-mono text-inherit/60">{getLabel(player)}</div>
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-3">
                    <span className="text-[9px] font-mono text-white/30">Kills {'>='}  </span>
                    {[1, 2, 3].map((t) => (
                      <button
                        key={t}
                        onClick={() => setSelectedThreshold(t)}
                        className={`text-xs font-mono px-3 py-1 rounded-sm border transition-colors cursor-pointer ${
                          selectedThreshold === t
                            ? 'bg-gold/10 border-gold/30 text-gold'
                            : 'border-white/[0.04] text-white/30 hover:border-white/[0.1]'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setBetYes(true)}
                      className={`text-[10px] font-mono px-3 py-1 rounded-sm border transition-colors cursor-pointer ${
                        betYes ? 'bg-alive/10 border-alive/30 text-alive' : 'border-white/[0.04] text-white/30'
                      }`}
                    >
                      YES
                    </button>
                    <button
                      onClick={() => setBetYes(false)}
                      className={`text-[10px] font-mono px-3 py-1 rounded-sm border transition-colors cursor-pointer ${
                        !betYes ? 'bg-blood/10 border-blood/30 text-blood' : 'border-white/[0.04] text-white/30'
                      }`}
                    >
                      NO
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Amount input + submit */}
            <div className="flex items-end gap-4 pt-3 border-t border-white/[0.04]">
              <div className="flex-1 space-y-1">
                <label className="text-[8px] uppercase tracking-[0.3em] text-white/15">
                  Bet Amount (ETH)
                </label>
                <input
                  type="number"
                  step="0.001"
                  min="0.001"
                  value={betAmount}
                  onChange={(e) => setBetAmount(e.target.value)}
                  className="w-full bg-surface-light border border-white/[0.06] rounded-sm px-3 py-2
                             text-sm font-mono text-white/80 outline-none focus:border-gold/30"
                />
              </div>
              <button
                onClick={handlePlaceBet}
                disabled={!canBet || betting.isPending}
                className="px-6 py-2.5 bg-gold/10 border border-gold/30 text-gold text-[10px] font-mono
                           uppercase tracking-[0.15em] rounded-sm transition-colors cursor-pointer
                           hover:bg-gold/20 hover:border-gold/50
                           disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {betting.isPending ? 'Placing...' : 'Place Bet'}
              </button>
            </div>

            {!wallet && (
              <div className="text-[9px] font-mono text-white/20 text-center py-2">
                Connect wallet to place bets
              </div>
            )}
          </div>

          {/* My Bets */}
          {myBetsCount > 0 && (
            <div className="bg-panel border border-white/[0.04] rounded-sm p-4">
              <div className="text-[9px] uppercase tracking-[0.3em] text-white/20 font-display mb-3">
                My Bets ({myBetsCount})
              </div>
              <div className="space-y-1">
                {betting.state?.myBets?.amounts.map((amount, i) => (
                  <div key={i} className="flex items-center justify-between text-[10px] font-mono">
                    <span className="text-white/30">Bet #{i + 1}</span>
                    <span className="text-gold/70">{formatEther(amount)} ETH</span>
                  </div>
                ))}
              </div>
              <div className="mt-2 pt-2 border-t border-white/[0.04] flex justify-between text-[10px] font-mono">
                <span className="text-white/20">Total</span>
                <span className="text-gold">{formatEther(myBetsTotal)} ETH</span>
              </div>
            </div>
          )}

          {/* Pool info */}
          <div className="text-center text-[9px] font-mono text-white/15">
            Winner pool: {betting.winnerPoolFormatted} ETH
          </div>
        </div>
      </main>
    </div>
  )
}
