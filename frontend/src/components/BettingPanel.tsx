import { useState, useEffect, useRef } from 'react'
import { type Address, parseEther, formatEther } from 'viem'
import { useAccount } from 'wagmi'
import { type GameState } from '../hooks/useGameState'
import { useBetting } from '../hooks/useBetting'
import { usePlayerNames } from '../hooks/usePlayerNames'
import { useLobbyMusic } from '../hooks/useLobbyMusic'
import { getCharacter } from '../config/characters'
import { VolumeControl } from './VolumeControl'

interface BettingPanelProps {
  gameId: bigint
  state: GameState
  onBack?: () => void
}

type BetTab = 'winner' | 'first_death' | 'over_kills'

const AGENT_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  calc: { bg: 'rgba(137,207,240,0.25)', border: '#89CFF0', text: '#4A90B8' },
  agro: { bg: 'rgba(255,107,138,0.2)', border: '#FF6B8A', text: '#D44A6A' },
  trap: { bg: 'rgba(119,221,119,0.2)', border: '#77DD77', text: '#4A9F4A' },
  filo: { bg: 'rgba(195,177,225,0.25)', border: '#C3B1E1', text: '#7A6AA0' },
  apre: { bg: 'rgba(255,213,128,0.25)', border: '#FFD580', text: '#B8923A' },
}

function getAgentStyle(colorKey: string) {
  return AGENT_COLORS[colorKey] || AGENT_COLORS.filo
}

const GUIDE_STEPS = [
  { num: 1, title: 'Pick a character', desc: 'Tap on your favorite player above' },
  { num: 2, title: 'Choose bet type', desc: 'Winner, First Death, or Over/Under' },
  { num: 3, title: 'Set your wager', desc: 'Enter how much MON to bet' },
  { num: 4, title: 'Place your bet!', desc: 'Confirm and watch the game unfold' },
]

/* Animated character with blinking */
function BettingCharacter({
  char,
  index: _index,
  isSelected,
  onClick,
  label
}: {
  char: ReturnType<typeof getCharacter>
  index: number
  isSelected: boolean
  onClick: () => void
  label: string
}) {
  const imgRef = useRef<HTMLImageElement>(null)
  const blinkTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    const preload = new Image()
    preload.src = char.blinkImg

    function scheduleBlink() {
      if (blinkTimerRef.current) clearTimeout(blinkTimerRef.current)
      const delay = 2000 + Math.random() * 4000
      blinkTimerRef.current = setTimeout(doBlink, delay)
    }

    function doBlink() {
      if (!imgRef.current) { scheduleBlink(); return }
      imgRef.current.src = char.blinkImg
      const blinkDuration = 120 + Math.random() * 80
      setTimeout(() => {
        if (!imgRef.current) return
        imgRef.current.src = char.img
        if (Math.random() < 0.3) {
          setTimeout(() => {
            if (!imgRef.current) return
            imgRef.current.src = char.blinkImg
            setTimeout(() => {
              if (!imgRef.current) return
              imgRef.current.src = char.img
              scheduleBlink()
            }, blinkDuration)
          }, 100)
        } else {
          scheduleBlink()
        }
      }, blinkDuration)
    }

    const initialDelay = 500 + Math.random() * 3000
    blinkTimerRef.current = setTimeout(doBlink, initialDelay)
    return () => { if (blinkTimerRef.current) clearTimeout(blinkTimerRef.current) }
  }, [char.img, char.blinkImg])

  const style = getAgentStyle(char.color)

  return (
    <div
      className={`betting-char ${isSelected ? 'selected' : ''}`}
      onClick={onClick}
    >
      <img
        ref={imgRef}
        src={char.img}
        alt={char.name}
        className="char-img"
      />
      <div
        className="char-label"
        style={{
          background: isSelected ? style.bg : 'rgba(255,253,245,0.9)',
          borderColor: isSelected ? style.border : 'rgba(255,255,255,0.8)',
          color: style.text,
        }}
      >
        {label}
      </div>
    </div>
  )
}

export function BettingPanel({ gameId, state, onBack }: BettingPanelProps) {
  const { volume, setVolume } = useLobbyMusic()
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

  const tabColors: Record<BetTab, { active: string; hover: string }> = {
    winner: { active: 'bg-[rgba(255,213,128,0.3)] border-[#FFD580] text-text-dark', hover: 'hover:border-[#FFD580]/60' },
    first_death: { active: 'bg-[rgba(255,107,138,0.2)] border-[#FF6B8A] text-[#D44A6A]', hover: 'hover:border-[#FF6B8A]/50' },
    over_kills: { active: 'bg-[rgba(195,177,225,0.25)] border-[#C3B1E1] text-[#7A6AA0]', hover: 'hover:border-[#C3B1E1]/60' },
  }

  // Countdown
  const minutes = Math.floor(betting.timeLeft / 60)
  const seconds = betting.timeLeft % 60
  const isUrgent = betting.timeLeft < 10 && betting.timeLeft > 0

  // Selected player info
  const selChar = selectedPlayer ? getCharacter(getOnChainName(selectedPlayer)) : null
  const selStyle = selChar ? getAgentStyle(selChar.color) : null

  return (
    <div className="relative min-h-screen flex flex-col">
      {/* Background */}
      <div className="fixed inset-0 z-0" style={{ background: "url('/bg-lobby.png') center/cover no-repeat" }} />
      <div className="fixed inset-0 z-0 bg-meadow/70" />

      {/* Wallet not connected — inline hint instead of blocking overlay */}

      {/* Header row */}
      <header className="relative z-10 px-6 pt-4 pb-2">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            {onBack && (
              <button
                onClick={onBack}
                className="font-display text-sm text-text-dark px-4 py-2 bg-paper/80 backdrop-blur-sm border-2 border-text-dark/20 hover:border-gold rounded-[10px] shadow-[2px_2px_0_var(--color-paper-shadow)] cursor-pointer transition-colors hover:bg-[#FFF3D0]"
              >
                LOBBY
              </button>
            )}
            <div>
              <h1 className="font-display text-3xl text-text-dark leading-tight">
                Fluffy Fate
              </h1>
              <span className="font-display text-xs px-2.5 py-0.5 bg-table-pink/30 text-[#9A6B8F] border border-table-border/40 rounded-lg">
                Betting
              </span>
            </div>
          </div>

          <div className="flex items-center gap-6">
            {/* Timer */}
            <div className="text-center">
              <div className="font-data text-xs text-text-light">closes in</div>
              <div className={`font-display text-3xl tracking-wider leading-tight ${
                isUrgent ? 'text-blood animate-pulse' : betting.timeLeft === 0 ? 'text-text-light' : 'text-gold'
              }`}>
                {betting.timeLeft > 0
                  ? `${minutes}:${seconds.toString().padStart(2, '0')}`
                  : 'Waiting...'
                }
              </div>
            </div>
            {/* Game info */}
            <div className="text-right">
              <div className="font-data text-sm text-text-light">Game #{gameId.toString()}</div>
              <div className="font-display text-xl text-gold leading-tight">{state.prizePoolFormatted} MON</div>
            </div>
          </div>
        </div>
      </header>

      {/* Animated Characters — clickable to select player */}
      <div className="relative z-10 betting-stage">
        {players.map((player, i) => {
          const char = getCharacter(getOnChainName(player))
          return (
            <BettingCharacter
              key={player}
              char={char}
              index={i}
              isSelected={selectedPlayer === player}
              onClick={() => setSelectedPlayer(player)}
              label={getLabel(player)}
            />
          )
        })}
      </div>

      {/* Guide Steps */}
      {myBetsCount === 0 && (
        <div className="relative z-10 px-6 pt-6 pb-4">
          <div className="max-w-5xl mx-auto flex justify-center gap-3">
            {GUIDE_STEPS.map((step) => (
              <div
                key={step.num}
                className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl border-2 bg-paper/70 border-paper-shadow/30"
              >
                <span className="font-display text-sm w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 bg-table-pink/25 text-[#9A6B8F]">
                  {step.num}
                </span>
                <div>
                  <div className="font-display text-sm leading-tight text-text-dark">
                    {step.title}
                  </div>
                  <div className="font-data text-xs text-text-light/60">{step.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="relative z-10 flex justify-center gap-2 py-2 px-6">
        {(['winner', 'first_death', 'over_kills'] as BetTab[]).map((tab) => {
          const colors = tabColors[tab]
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`font-display text-sm px-5 py-2 rounded-[10px] transition-all cursor-pointer border-2 ${
                activeTab === tab
                  ? `${colors.active} shadow-[2px_2px_0_var(--color-paper-shadow)]`
                  : `text-text-light border-paper-shadow/40 ${colors.hover} hover:text-text-dark`
              }`}
            >
              {tab === 'winner' ? 'Winner' : tab === 'first_death' ? 'First Death' : 'Over/Under Kills'}
            </button>
          )
        })}
      </div>

      {/* Bet Form */}
      <div className="relative z-10 flex-1 px-6 py-3 flex flex-col gap-3 min-h-0">
        <div className="max-w-7xl mx-auto w-full glass-panel px-6 py-4 space-y-4" style={{ background: 'rgba(255,253,245,0.9)' }}>

          {/* Selected player indicator */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {selChar ? (
                <>
                  <img src={selChar.img} alt="" className="w-10 h-10 rounded-lg object-contain" />
                  <div>
                    <span className="font-display text-lg" style={{ color: selStyle!.text }}>
                      {getLabel(selectedPlayer!)}
                    </span>
                    <span className="font-data text-sm text-text-light ml-2">{selChar.role}</span>
                  </div>
                </>
              ) : (
                <span className="font-data text-base text-text-light">Select a character above</span>
              )}
            </div>

            {/* Tab-specific inline controls */}
            {activeTab === 'first_death' && (
              <div className="flex items-center gap-2.5">
                <span className="font-data text-sm text-text-light">Death #</span>
                {[1, 2, 3].map((pos) => (
                  <button
                    key={pos}
                    onClick={() => setSelectedPosition(pos)}
                    className={`font-data text-sm px-3.5 py-1 rounded-lg border-2 transition-colors cursor-pointer ${
                      selectedPosition === pos
                        ? 'bg-[rgba(255,107,138,0.15)] border-[#FF6B8A] text-[#D44A6A]'
                        : 'border-paper-shadow/40 text-text-light hover:border-[#FF6B8A]/40'
                    }`}
                  >
                    {pos}
                  </button>
                ))}
              </div>
            )}

            {activeTab === 'over_kills' && (
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="font-data text-sm text-text-light">Kills {'>='}</span>
                  {[1, 2, 3].map((t) => (
                    <button
                      key={t}
                      onClick={() => setSelectedThreshold(t)}
                      className={`font-data text-sm px-3.5 py-1 rounded-lg border-2 transition-colors cursor-pointer ${
                        selectedThreshold === t
                          ? 'bg-[rgba(195,177,225,0.25)] border-[#C3B1E1] text-[#7A6AA0]'
                          : 'border-paper-shadow/40 text-text-light hover:border-[#C3B1E1]/40'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setBetYes(true)}
                    className={`font-display text-sm px-3.5 py-1 rounded-lg border-2 transition-colors cursor-pointer ${
                      betYes ? 'bg-[rgba(119,221,119,0.2)] border-[#77DD77] text-[#4A9F4A]' : 'border-paper-shadow/40 text-text-light'
                    }`}
                  >
                    YES
                  </button>
                  <button
                    onClick={() => setBetYes(false)}
                    className={`font-display text-sm px-3.5 py-1 rounded-lg border-2 transition-colors cursor-pointer ${
                      !betYes ? 'bg-[rgba(255,107,138,0.15)] border-[#FF6B8A] text-[#D44A6A]' : 'border-paper-shadow/40 text-text-light'
                    }`}
                  >
                    NO
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Amount + submit */}
          <div className="flex items-end gap-4 pt-3 border-t-2 border-table-pink/30">
            <div className="flex-1 space-y-1">
              <label className="font-display text-xs text-text-light">Bet Amount (MON)</label>
              <input
                type="number"
                step="0.001"
                min="0.001"
                value={betAmount}
                onChange={(e) => setBetAmount(e.target.value)}
                className="w-full bg-[rgba(232,180,216,0.1)] border-2 border-table-pink/40 rounded-xl px-4 py-2.5
                           font-data text-base text-text-dark outline-none focus:border-table-pink"
              />
            </div>
            <button
              onClick={handlePlaceBet}
              disabled={!canBet || betting.isPending}
              className="px-8 py-2.5 border-2 text-text-dark font-display text-base
                         rounded-xl transition-all cursor-pointer
                         shadow-[2px_2px_0_var(--color-paper-shadow)]
                         disabled:opacity-30 disabled:cursor-not-allowed"
              style={{ background: 'rgba(232,180,216,0.3)', borderColor: '#C88FBB' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(232,180,216,0.5)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(232,180,216,0.3)' }}
            >
              {betting.isPending ? 'Placing...' : 'Place Bet'}
            </button>
          </div>

        </div>

        {/* My Bets */}
        {myBetsCount > 0 && (
          <div className="max-w-7xl mx-auto w-full glass-panel px-5 py-3" style={{ background: 'rgba(255,253,245,0.9)' }}>
            <div className="flex items-center justify-between mb-2">
              <span className="font-display text-sm text-text-dark">My Bets ({myBetsCount})</span>
              <span className="font-data text-sm text-gold font-bold">{formatEther(myBetsTotal)} MON</span>
            </div>
            <div className="space-y-1.5">
              {betting.decodedBets.map((bet, i) => {
                const betChar = bet.player ? getCharacter(getOnChainName(bet.player)) : null
                const betStyle = betChar ? getAgentStyle(betChar.color) : null
                return (
                  <div key={i} className="flex items-center justify-between font-data text-sm rounded-lg px-3 py-1.5"
                    style={{ background: betStyle ? betStyle.bg : 'rgba(232,180,216,0.15)' }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-display px-2 py-0.5 rounded-md"
                        style={{
                          background: bet.type === 'winner' ? 'rgba(255,213,128,0.3)' :
                            bet.type === 'first_death' ? 'rgba(255,107,138,0.2)' : 'rgba(119,221,119,0.2)',
                          color: bet.type === 'winner' ? '#B8923A' :
                            bet.type === 'first_death' ? '#D44A6A' : '#4A9F4A',
                        }}
                      >
                        {bet.type === 'winner' ? 'WIN' :
                         bet.type === 'first_death' ? `DEATH #${bet.position}` :
                         `>=${bet.threshold}K`}
                      </span>
                      <span style={{ color: betStyle?.text || 'var(--color-text-dark)' }}>
                        {bet.player ? getLabel(bet.player) : '?'}
                        {bet.type === 'over_kills' && (
                          <span style={{ color: bet.betYes ? '#4A9F4A' : '#D44A6A' }}>
                            {' '}{bet.betYes ? 'YES' : 'NO'}
                          </span>
                        )}
                      </span>
                    </div>
                    <span className="text-gold font-bold">{formatEther(bet.amount)}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Pool info */}
        <div className="text-center font-data text-sm text-text-light pb-2">
          Winner pool: {betting.winnerPoolFormatted} MON
        </div>
      </div>

      {/* Volume control */}
      <div className="fixed bottom-5 right-5 z-50">
        <VolumeControl volume={volume} setVolume={setVolume} />
      </div>
    </div>
  )
}
