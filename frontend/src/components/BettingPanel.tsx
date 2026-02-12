import { useState } from 'react'
import { type Address, parseEther, formatEther } from 'viem'
import { useAccount } from 'wagmi'
import { type GameState } from '../hooks/useGameState'
import { useBetting } from '../hooks/useBetting'
import { usePlayerNames } from '../hooks/usePlayerNames'
import { getCharacter } from '../config/characters'

interface BettingPanelProps {
  gameId: bigint
  state: GameState
  onBack?: () => void
}

type BetTab = 'winner' | 'first_death' | 'over_kills'

function CountdownTimer({ timeLeft }: { timeLeft: number }) {
  const minutes = Math.floor(timeLeft / 60)
  const seconds = timeLeft % 60
  const isUrgent = timeLeft < 10

  return (
    <div className="glass-panel inline-block px-8 py-3">
      <div className="font-display text-[10px] text-text-light mb-1">
        Betting closes in
      </div>
      <div className={`font-display text-5xl tracking-wider ${
        isUrgent ? 'text-blood animate-pulse' : 'text-gold'
      }`}>
        {minutes}:{seconds.toString().padStart(2, '0')}
      </div>
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

  function getOnChainName(addr: Address): string {
    return names[addr.toLowerCase()] || ''
  }

  function getLabel(addr: Address): string {
    return getCharacter(getOnChainName(addr)).name
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
    <div className="relative min-h-screen flex flex-col">
      {/* Background image + overlay */}
      <div className="fixed inset-0 z-0" style={{ background: "url('/bg-lobby.png') center/cover no-repeat" }} />
      <div className="fixed inset-0 z-0 bg-meadow/70" />

      {/* Header */}
      <header className="relative z-10 px-6 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            {onBack && (
              <button
                onClick={onBack}
                className="font-display text-[11px] text-text-dark px-3 py-1.5 bg-paper/80 backdrop-blur-sm border-2 border-text-dark/20 hover:border-gold rounded-[10px] shadow-[2px_2px_0_var(--color-paper-shadow)] cursor-pointer transition-colors hover:bg-[#FFF3D0]"
              >
                LOBBY
              </button>
            )}
          </div>

          <div className="text-right">
            <div className="font-data text-[10px] text-text-light">
              Game #{gameId.toString()}
            </div>
            <div className="font-display text-sm text-gold">
              {state.prizePoolFormatted} ETH
            </div>
          </div>
        </div>
      </header>

      {/* Big Centered Title */}
      <div className="relative z-10 text-center pt-1 pb-4">
        <h1 className="font-display text-4xl md:text-5xl text-text-dark drop-shadow-[2px_3px_0_rgba(0,0,0,0.12)] animate-title-drop">
          Buckshot Roulette
        </h1>
        <span className="inline-block mt-2 font-display text-[11px] px-3 py-1 bg-gold/20 text-text-dark border-2 border-gold/40 rounded-lg">
          Betting
        </span>
      </div>

      <main className="relative z-10 flex-1 px-6 py-4">
        <div className="max-w-5xl mx-auto space-y-8">
          {/* Countdown */}
          <div className="text-center space-y-2">
            <CountdownTimer timeLeft={betting.timeLeft} />
            {betting.timeLeft === 0 && (
              <div className="font-data text-sm text-text-light animate-pulse">
                Waiting for game to start...
              </div>
            )}
          </div>

          {/* Players list */}
          <div className="glass-panel py-4 px-6">
            <div className="flex justify-center gap-4">
              {players.map((player) => {
                const char = getCharacter(getOnChainName(player))
                return (
                  <div key={player} className="text-center space-y-1">
                    <img
                      src={char.img}
                      alt={char.name}
                      className="w-14 h-14 rounded-[10px] object-contain bg-white/50 p-1 mx-auto border-2 border-alive/40"
                    />
                    <div className="font-data text-[10px] text-text-dark">{getLabel(player)}</div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Bet Type Tabs */}
          <div className="flex justify-center gap-1">
            {(['winner', 'first_death', 'over_kills'] as BetTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => { setActiveTab(tab); setSelectedPlayer(null) }}
                className={`font-display text-[11px] px-4 py-2 rounded-[10px] transition-colors cursor-pointer border-2 ${
                  activeTab === tab
                    ? 'bg-gold/20 text-text-dark border-gold shadow-[2px_2px_0_var(--color-paper-shadow)]'
                    : 'text-text-light border-paper-shadow/40 hover:border-gold/40 hover:text-text-dark'
                }`}
              >
                {tab === 'winner' ? 'Winner' : tab === 'first_death' ? 'First Death' : 'Over/Under Kills'}
              </button>
            ))}
          </div>

          {/* Bet Form */}
          <div className="glass-panel !bg-[rgba(255,253,245,0.9)] p-6 space-y-5">
            {/* Tab-specific content */}
            {activeTab === 'winner' && (
              <div className="space-y-3">
                <div className="font-display text-sm text-text-dark">
                  Who will win?
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {players.map((player) => {
                    const char = getCharacter(getOnChainName(player))
                    return (
                      <button
                        key={player}
                        onClick={() => setSelectedPlayer(player)}
                        className={`text-left p-3 rounded-[10px] border-2 transition-colors cursor-pointer flex items-center gap-2 ${
                          selectedPlayer === player
                            ? 'bg-gold/15 border-gold shadow-[2px_2px_0_var(--color-paper-shadow)]'
                            : 'border-paper-shadow/40 hover:border-gold/40'
                        }`}
                      >
                        <img src={char.img} alt="" className="w-8 h-8 rounded-md object-contain" />
                        <div>
                          <div className="font-display text-sm text-text-dark">{getLabel(player)}</div>
                          <div className="font-data text-[10px] text-text-light">{char.role}</div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {activeTab === 'first_death' && (
              <div className="space-y-4">
                <div className="font-display text-sm text-text-dark">
                  Who dies at position?
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-data text-sm text-text-light">Death #</span>
                  {[1, 2, 3].map((pos) => (
                    <button
                      key={pos}
                      onClick={() => setSelectedPosition(pos)}
                      className={`font-data text-sm px-3 py-1 rounded-[8px] border-2 transition-colors cursor-pointer ${
                        selectedPosition === pos
                          ? 'bg-blood/10 border-blood text-blood'
                          : 'border-paper-shadow/40 text-text-light hover:border-blood/40'
                      }`}
                    >
                      {pos}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {players.map((player) => {
                    const char = getCharacter(getOnChainName(player))
                    return (
                      <button
                        key={player}
                        onClick={() => setSelectedPlayer(player)}
                        className={`text-left p-3 rounded-[10px] border-2 transition-colors cursor-pointer flex items-center gap-2 ${
                          selectedPlayer === player
                            ? 'bg-blood/10 border-blood'
                            : 'border-paper-shadow/40 hover:border-blood/40'
                        }`}
                      >
                        <img src={char.img} alt="" className="w-8 h-8 rounded-md object-contain" />
                        <div>
                          <div className="font-display text-sm text-text-dark">{getLabel(player)}</div>
                          <div className="font-data text-[10px] text-text-light">{char.role}</div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {activeTab === 'over_kills' && (
              <div className="space-y-4">
                <div className="font-display text-sm text-text-dark">
                  Will player get X+ kills?
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {players.map((player) => {
                    const char = getCharacter(getOnChainName(player))
                    return (
                      <button
                        key={player}
                        onClick={() => setSelectedPlayer(player)}
                        className={`text-left p-3 rounded-[10px] border-2 transition-colors cursor-pointer flex items-center gap-2 ${
                          selectedPlayer === player
                            ? 'bg-gold/15 border-gold'
                            : 'border-paper-shadow/40 hover:border-gold/40'
                        }`}
                      >
                        <img src={char.img} alt="" className="w-8 h-8 rounded-md object-contain" />
                        <div>
                          <div className="font-display text-sm text-text-dark">{getLabel(player)}</div>
                          <div className="font-data text-[10px] text-text-light">{char.role}</div>
                        </div>
                      </button>
                    )
                  })}
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-3">
                    <span className="font-data text-sm text-text-light">Kills {'>='}  </span>
                    {[1, 2, 3].map((t) => (
                      <button
                        key={t}
                        onClick={() => setSelectedThreshold(t)}
                        className={`font-data text-sm px-3 py-1 rounded-[8px] border-2 transition-colors cursor-pointer ${
                          selectedThreshold === t
                            ? 'bg-gold/15 border-gold text-text-dark'
                            : 'border-paper-shadow/40 text-text-light hover:border-gold/40'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setBetYes(true)}
                      className={`font-display text-sm px-3 py-1 rounded-[8px] border-2 transition-colors cursor-pointer ${
                        betYes ? 'bg-alive/15 border-alive text-alive' : 'border-paper-shadow/40 text-text-light'
                      }`}
                    >
                      YES
                    </button>
                    <button
                      onClick={() => setBetYes(false)}
                      className={`font-display text-sm px-3 py-1 rounded-[8px] border-2 transition-colors cursor-pointer ${
                        !betYes ? 'bg-blood/10 border-blood text-blood' : 'border-paper-shadow/40 text-text-light'
                      }`}
                    >
                      NO
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Amount input + submit */}
            <div className="flex items-end gap-4 pt-3 border-t-2 border-paper-shadow/30">
              <div className="flex-1 space-y-1">
                <label className="font-display text-[10px] text-text-light">
                  Bet Amount (ETH)
                </label>
                <input
                  type="number"
                  step="0.001"
                  min="0.001"
                  value={betAmount}
                  onChange={(e) => setBetAmount(e.target.value)}
                  className="w-full bg-meadow/60 border-2 border-paper-shadow/60 rounded-[10px] px-3 py-2
                             font-data text-sm text-text-dark outline-none focus:border-gold"
                />
              </div>
              <button
                onClick={handlePlaceBet}
                disabled={!canBet || betting.isPending}
                className="px-6 py-2.5 bg-gold/30 border-2 border-gold text-text-dark font-display text-sm
                           rounded-[10px] transition-colors cursor-pointer
                           hover:bg-gold/50 shadow-[2px_2px_0_var(--color-paper-shadow)]
                           disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {betting.isPending ? 'Placing...' : 'Place Bet'}
              </button>
            </div>

            {!wallet && (
              <div className="font-data text-sm text-text-light text-center py-2">
                Connect wallet to place bets
              </div>
            )}
          </div>

          {/* My Bets */}
          {myBetsCount > 0 && (
            <div className="glass-panel !bg-[rgba(255,253,245,0.9)] p-4">
              <div className="font-display text-sm text-text-dark mb-3">
                My Bets ({myBetsCount})
              </div>
              <div className="space-y-2">
                {betting.decodedBets.map((bet, i) => (
                  <div key={i} className="flex items-center justify-between font-data text-sm bg-meadow/50 rounded-[8px] px-3 py-1.5">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-display px-1.5 py-0.5 rounded ${
                        bet.type === 'winner' ? 'bg-gold/20 text-text-dark' :
                        bet.type === 'first_death' ? 'bg-blood/15 text-blood' :
                        'bg-alive/15 text-alive'
                      }`}>
                        {bet.type === 'winner' ? 'WINNER' :
                         bet.type === 'first_death' ? `DEATH #${bet.position}` :
                         `>=${bet.threshold} KILLS`}
                      </span>
                      <span className="text-text-dark">
                        {bet.player ? getLabel(bet.player) : '?'}
                        {bet.type === 'over_kills' && (
                          <span className={bet.betYes ? 'text-alive' : 'text-blood'}>
                            {' '}{bet.betYes ? 'YES' : 'NO'}
                          </span>
                        )}
                      </span>
                    </div>
                    <span className="text-gold font-bold">{formatEther(bet.amount)} ETH</span>
                  </div>
                ))}
              </div>
              <div className="mt-2 pt-2 border-t-2 border-paper-shadow/30 flex justify-between font-data text-sm">
                <span className="text-text-light">Total</span>
                <span className="text-gold font-bold">{formatEther(myBetsTotal)} ETH</span>
              </div>
            </div>
          )}

          {/* Pool info */}
          <div className="text-center font-data text-[11px] text-text-light">
            Winner pool: {betting.winnerPoolFormatted} ETH
          </div>
        </div>
      </main>
    </div>
  )
}
