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

          if (phase !== 2) continue

          const bets = await publicClient.readContract({
            address: ADDRESSES.buckshotBetting,
            abi: buckshotBettingAbi,
            functionName: 'getMyBets',
            args: [i, address!],
          }) as readonly [readonly `0x${string}`[], readonly `0x${string}`[], readonly bigint[], readonly boolean[]]

          const amounts = bets[2]
          const claimed = bets[3]

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
      <div className="flex items-center gap-2">
        {totalClaimable > 0n && (
          <button
            onClick={claimAll}
            disabled={claiming}
            className="font-display text-[10px] text-text-dark
                       bg-gold/25 border-2 border-gold/60 hover:border-gold hover:bg-gold/40
                       px-2.5 py-1.5 cursor-pointer rounded-[10px] transition-colors
                       shadow-[2px_2px_0_var(--color-paper-shadow)]
                       disabled:opacity-50"
          >
            {claiming ? 'CLAIMING...' : `CLAIM ${parseFloat(formatEther(totalClaimable)).toFixed(4)} ETH`}
          </button>
        )}
        <div className="flex items-center bg-paper border-2 border-text-dark/20 rounded-[10px] shadow-[2px_2px_0_var(--color-paper-shadow)] overflow-hidden">
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 border-r border-text-dark/10">
            <div className="w-1.5 h-1.5 rounded-full bg-alive" />
            <span className="font-data text-[11px] text-text-light">
              {parseFloat(formatEther(balance)).toFixed(4)}
            </span>
            <span className="font-display text-[9px] text-text-light/60">
              ETH
            </span>
          </div>
          <div className="px-2.5 py-1.5 border-r border-text-dark/10">
            <span className="font-data text-[11px] text-text-dark font-bold">
              {shortAddr(address)}
            </span>
          </div>
          <button
            onClick={() => disconnect()}
            className="px-2 py-1.5 text-text-light/50 hover:text-blood hover:bg-blood/8 transition-colors cursor-pointer"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M2 2l6 6M8 2l-6 6" />
            </svg>
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <span className="font-display text-[9px] text-text-light">dev</span>
      {burnerConnectors.map((connector, i) => (
        <button
          key={connector.uid}
          onClick={() => connect({ connector })}
          className="font-data text-[10px] text-text-dark hover:text-gold transition-colors
                     border-2 border-paper-shadow/40 hover:border-gold px-2 py-0.5
                     cursor-pointer rounded-lg bg-paper"
        >
          {shortAddr(BURNER_ACCOUNTS[i])}
        </button>
      ))}
    </div>
  )
}
