import { useState, useEffect } from 'react'
import { type Address, formatEther } from 'viem'
import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { BURNER_ACCOUNTS, publicClient, isLocal, burnerWalletClients } from '../config/wagmi'
import { ADDRESSES, buckshotGameAbi, buckshotBettingAbi } from '../config/contracts'

function shortAddr(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

function useBalance(address: Address | undefined) {
  const [balance, setBalance] = useState<bigint>(0n)

  useEffect(() => {
    if (!address) return
    let active = true

    async function fetch() {
      const bal = await publicClient.getBalance({ address: address! })
      if (active) setBalance(bal)
    }

    fetch()
    const interval = setInterval(fetch, 5000)
    return () => { active = false; clearInterval(interval) }
  }, [address])

  return balance
}

interface ClaimableGame {
  gameId: bigint
  total: bigint
}

function useClaimableRewards(address: Address | undefined) {
  const [claimable, setClaimable] = useState<ClaimableGame[]>([])
  const [claiming, setClaiming] = useState(false)

  useEffect(() => {
    if (!address) return
    let active = true

    async function scan() {
      try {
        const nextId = await publicClient.readContract({
          address: ADDRESSES.buckshotGame,
          abi: buckshotGameAbi,
          functionName: 'nextGameId',
        }) as bigint

        const results: ClaimableGame[] = []

        for (let i = 0n; i < nextId; i++) {
          const phase = await publicClient.readContract({
            address: ADDRESSES.buckshotGame,
            abi: buckshotGameAbi,
            functionName: 'getPhase',
            args: [i],
          }) as number

          // Only check finished games (phase 2)
          if (phase !== 2) continue

          const bets = await publicClient.readContract({
            address: ADDRESSES.buckshotBetting,
            abi: buckshotBettingAbi,
            functionName: 'getMyBets',
            args: [i, address!],
          }) as readonly [readonly `0x${string}`[], readonly `0x${string}`[], readonly bigint[], readonly boolean[]]

          const amounts = bets[2]
          const claimed = bets[3]

          // Sum unclaimed amounts
          let unclaimed = 0n
          for (let j = 0; j < amounts.length; j++) {
            if (!claimed[j]) unclaimed += amounts[j]
          }

          if (unclaimed > 0n) {
            results.push({ gameId: i, total: unclaimed })
          }
        }

        if (active) setClaimable(results)
      } catch {
        // ignore
      }
    }

    scan()
    const interval = setInterval(scan, 10000)
    return () => { active = false; clearInterval(interval) }
  }, [address, claiming])

  async function claimAll() {
    if (!address || claimable.length === 0) return
    const wc = burnerWalletClients[address.toLowerCase()]
    if (!isLocal || !wc) return

    setClaiming(true)
    try {
      for (const game of claimable) {
        const hash = await wc.writeContract({
          address: ADDRESSES.buckshotBetting,
          abi: buckshotBettingAbi,
          functionName: 'claimWinnings',
          args: [game.gameId],
        } as any)
        await publicClient.waitForTransactionReceipt({ hash })
      }
    } catch (e) {
      console.error('claimAll failed:', e)
    } finally {
      setClaiming(false)
    }
  }

  return { claimable, claimAll, claiming }
}

export function BurnerWallets() {
  const { address } = useAccount()
  const { connect, connectors } = useConnect()
  const { disconnect } = useDisconnect()
  const balance = useBalance(address)
  const { claimable, claimAll, claiming } = useClaimableRewards(address)

  const burnerConnectors = connectors.filter((c) => c.type === 'mock')

  const totalClaimable = claimable.reduce((sum, g) => sum + g.total, 0n)

  if (address) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-[9px] font-mono text-white/30">
          {parseFloat(formatEther(balance)).toFixed(4)} ETH
        </span>
        <span className="text-[9px] font-mono text-neon/60">
          {shortAddr(address)}
        </span>
        {totalClaimable > 0n && (
          <button
            onClick={claimAll}
            disabled={claiming}
            className="text-[8px] font-mono uppercase tracking-wider text-gold/80 hover:text-gold
                       bg-gold/10 border border-gold/30 hover:border-gold/60 px-2 py-0.5
                       cursor-pointer rounded-sm transition-colors animate-pulse
                       disabled:opacity-50 disabled:animate-none"
          >
            {claiming ? 'Claiming...' : `Claim ${parseFloat(formatEther(totalClaimable)).toFixed(4)} ETH`}
          </button>
        )}
        <button
          onClick={() => disconnect()}
          className="text-[8px] font-mono text-white/20 hover:text-blood/60 transition-colors cursor-pointer"
        >
          [x]
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-[8px] uppercase tracking-[0.2em] text-white/15">dev</span>
      {burnerConnectors.map((connector, i) => (
        <button
          key={connector.uid}
          onClick={() => connect({ connector })}
          className="text-[9px] font-mono text-white/25 hover:text-neon/60 transition-colors
                     border border-white/[0.06] hover:border-neon/20 px-2 py-0.5
                     cursor-pointer rounded-sm"
        >
          {shortAddr(BURNER_ACCOUNTS[i])}
        </button>
      ))}
    </div>
  )
}
