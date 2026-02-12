import { useState, useEffect, useMemo, useRef } from 'react'
import { type Address } from 'viem'
import { useAccount, useWriteContract } from 'wagmi'
import { ADDRESSES, buckshotBettingAbi } from '../config/contracts'
import { isLocal, burnerWalletClients, publicClient } from '../config/wagmi'
import { getCharacter } from '../config/characters'

interface GameOverOverlayProps {
  winner: Address
  label: string
  prize: string
  players: readonly Address[]
  names: Record<string, string>
  onHome?: () => void
  gameId?: bigint
}

const CONFETTI_COLORS = ['#FF6B8A', '#89CFF0', '#77DD77', '#C3B1E1', '#FFD580', '#FFD700', '#FF4081', '#90CAF9']

export function GameOverOverlay({ winner, label, prize, players, names, onHome, gameId }: GameOverOverlayProps) {
  const { address: wallet } = useAccount()
  const { writeContract, isPending: wagmiPending } = useWriteContract()
  const [localPending, setLocalPending] = useState(false)
  const isPending = localPending || wagmiPending

  const winnerChar = getCharacter(label)
  const yaySfxRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    yaySfxRef.current = new Audio('/sfx/yay.mp3')
    yaySfxRef.current.volume = 0.6
    yaySfxRef.current.play().catch(() => {})
    return () => {
      if (yaySfxRef.current) {
        yaySfxRef.current.pause()
        yaySfxRef.current = null
      }
    }
  }, [])

  const losers = useMemo(() => {
    return players
      .filter((p) => p.toLowerCase() !== winner.toLowerCase())
      .map((p) => {
        const name = names[p.toLowerCase()] || ''
        return getCharacter(name)
      })
  }, [players, winner, names])

  // Confetti pieces
  const confetti = useMemo(() => {
    return Array.from({ length: 35 }, (_, i) => ({
      id: i,
      left: `${Math.random() * 100}vw`,
      bg: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      width: `${6 + Math.random() * 10}px`,
      height: `${10 + Math.random() * 14}px`,
      duration: `${2 + Math.random() * 3}s`,
      delay: `${Math.random() * 2}s`,
    }))
  }, [])

  async function handleClaim() {
    if (!gameId) return
    const wc = wallet ? burnerWalletClients[wallet.toLowerCase()] : null
    if (isLocal && wc) {
      setLocalPending(true)
      try {
        const hash = await wc.writeContract({
          address: ADDRESSES.buckshotBetting,
          abi: buckshotBettingAbi,
          functionName: 'claimWinnings',
          args: [gameId],
        } as any)
        await publicClient.waitForTransactionReceipt({ hash })
      } catch (e) {
        console.error('claimWinnings failed:', e)
      } finally {
        setLocalPending(false)
      }
    } else {
      writeContract({
        address: ADDRESSES.buckshotBetting,
        abi: buckshotBettingAbi,
        functionName: 'claimWinnings',
        args: [gameId],
      })
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center flex-col animate-[fadeIn_0.5s_ease-out]"
      style={{ background: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(4px)' }}
    >
      {/* Confetti */}
      {confetti.map((c) => (
        <div
          key={c.id}
          className="fixed top-[-20px] z-[201] rounded-sm"
          style={{
            left: c.left,
            background: c.bg,
            width: c.width,
            height: c.height,
            animation: `confDrop ${c.duration} linear ${c.delay} forwards`,
          }}
        />
      ))}

      {/* Title */}
      <div className="font-display text-[52px] text-white drop-shadow-[3px_3px_0_rgba(0,0,0,0.4)] mb-4">
        GAME OVER!
      </div>

      {/* Winner character image */}
      <img
        src={winnerChar.img}
        alt={label}
        className="h-[33%] w-auto"
        style={{
          filter: 'drop-shadow(0 0 20px rgba(255, 215, 0, 0.6))',
          animation: 'winBounce 0.5s ease infinite alternate',
        }}
      />

      {/* Winner name */}
      <div className="font-display text-[28px] text-gold mt-2.5 drop-shadow-[2px_2px_0_rgba(0,0,0,0.3)]">
        {winnerChar.name} Wins!
      </div>

      {/* Prize badge */}
      <div className="mt-3.5 px-7 py-2.5 rounded-[14px] border-3 border-[#DAA520] shadow-[3px_3px_0_rgba(0,0,0,0.2)]"
        style={{ background: 'linear-gradient(135deg, var(--color-gold), #FFC107, var(--color-gold))' }}
      >
        <div className="font-semibold text-xs text-text-dark">Prize Pool</div>
        <div className="font-display text-[26px] text-text-dark">{prize} MON</div>
      </div>

      {/* Losers */}
      <div className="flex gap-5 mt-5">
        {losers.map((loser, i) => (
          <img
            key={i}
            src={loser.img}
            alt={loser.name}
            className="h-25 w-auto opacity-60 -rotate-[10deg]"
            style={{ filter: 'grayscale(0.8) brightness(0.5) drop-shadow(2px 3px 4px rgba(0,0,0,0.3))' }}
          />
        ))}
      </div>

      {/* Claim betting winnings */}
      {wallet && gameId !== undefined && (
        <button
          onClick={handleClaim}
          disabled={isPending}
          className="mt-5 font-display text-sm px-7 py-2.5 bg-white border-3 border-text-dark rounded-[14px] cursor-pointer shadow-[3px_3px_0_var(--color-paper-shadow)] text-text-dark hover:bg-[#FFF3D0] transition-colors disabled:opacity-30"
        >
          {isPending ? 'Claiming...' : 'Claim Betting Winnings'}
        </button>
      )}

      {/* Close button */}
      {onHome && (
        <button
          onClick={onHome}
          className="mt-3 font-display text-sm px-7 py-2.5 bg-white border-3 border-text-dark rounded-[14px] cursor-pointer shadow-[3px_3px_0_var(--color-paper-shadow)] text-text-dark hover:bg-[#FFF3D0] transition-colors"
        >
          Back to Lobby
        </button>
      )}
    </div>
  )
}
