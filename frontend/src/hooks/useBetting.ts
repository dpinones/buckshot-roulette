import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { type Address, formatEther, encodeAbiParameters, parseAbiParameters, keccak256 } from 'viem'
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import {
  ADDRESSES,
  buckshotGameAbi,
  buckshotBettingAbi,
  BetType,
} from '../config/contracts'
import { publicClient, isLocal, burnerWalletClients } from '../config/wagmi'

export interface BettingState {
  deadline: bigint
  blockTimestamp: bigint
  players: Address[]
  winnerPoolTotal: bigint
  myBets: {
    poolKeys: readonly `0x${string}`[]
    outcomeKeys: readonly `0x${string}`[]
    amounts: readonly bigint[]
    claimed: readonly boolean[]
  } | null
}

export interface DecodedBet {
  type: 'winner' | 'first_death' | 'over_kills'
  player?: Address
  position?: number
  threshold?: number
  betYes?: boolean
  amount: bigint
}

// ── Client-side key computation (mirrors Solidity abi.encode + keccak256) ──

function computeWinnerPoolKey(gameId: bigint): `0x${string}` {
  return keccak256(encodeAbiParameters(parseAbiParameters('uint256, uint8'), [gameId, BetType.WINNER]))
}

function computeFirstDeathPoolKey(gameId: bigint, position: number): `0x${string}` {
  return keccak256(encodeAbiParameters(parseAbiParameters('uint256, uint8, uint8'), [gameId, BetType.FIRST_DEATH, position]))
}

function computeOverKillsPoolKey(gameId: bigint, player: Address, threshold: number): `0x${string}` {
  return keccak256(encodeAbiParameters(parseAbiParameters('uint256, uint8, address, uint8'), [gameId, BetType.OVER_KILLS, player, threshold]))
}

function computePlayerOutcomeKey(player: Address): `0x${string}` {
  return keccak256(encodeAbiParameters(parseAbiParameters('address'), [player]))
}

function computeBoolOutcomeKey(value: boolean): `0x${string}` {
  return keccak256(encodeAbiParameters(parseAbiParameters('bool'), [value]))
}

function decodeBets(
  gameId: bigint,
  players: Address[],
  myBets: BettingState['myBets']
): DecodedBet[] {
  if (!myBets || myBets.amounts.length === 0) return []

  const winnerPK = computeWinnerPoolKey(gameId)
  const firstDeathPKs = [1, 2, 3].map(pos => ({
    pos,
    key: computeFirstDeathPoolKey(gameId, pos),
  }))
  const overKillsPKs = players.flatMap(player =>
    [1, 2, 3].map(threshold => ({
      player,
      threshold,
      key: computeOverKillsPoolKey(gameId, player, threshold),
    }))
  )

  const playerOKs = players.map(p => ({
    player: p,
    key: computePlayerOutcomeKey(p),
  }))
  const boolYesOK = computeBoolOutcomeKey(true)

  return myBets.amounts.map((amount, i) => {
    const poolKey = myBets.poolKeys[i]
    const outcomeKey = myBets.outcomeKeys[i]

    if (poolKey === winnerPK) {
      const match = playerOKs.find(p => p.key === outcomeKey)
      return { type: 'winner' as const, player: match?.player, amount }
    }

    const fdMatch = firstDeathPKs.find(fd => fd.key === poolKey)
    if (fdMatch) {
      const match = playerOKs.find(p => p.key === outcomeKey)
      return { type: 'first_death' as const, player: match?.player, position: fdMatch.pos, amount }
    }

    const okMatch = overKillsPKs.find(ok => ok.key === poolKey)
    if (okMatch) {
      const betYes = outcomeKey === boolYesOK
      return { type: 'over_kills' as const, player: okMatch.player, threshold: okMatch.threshold, betYes, amount }
    }

    return { type: 'winner' as const, amount }
  })
}

export function useBetting(gameId: bigint, pollInterval = 1000) {
  const { address } = useAccount()
  const [state, setState] = useState<BettingState | null>(null)
  const [timeLeft, setTimeLeft] = useState(0)
  const anchorRef = useRef<{ serverTimeLeft: number; clientTime: number } | null>(null)
  const lastBlockTsRef = useRef<number>(0)

  // Poll betting state
  useEffect(() => {
    let active = true

    async function fetch() {
      try {
        const [deadline, players, block] = await Promise.all([
          publicClient.readContract({
            address: ADDRESSES.buckshotGame,
            abi: buckshotGameAbi,
            functionName: 'bettingDeadline',
            args: [gameId],
          }),
          publicClient.readContract({
            address: ADDRESSES.buckshotGame,
            abi: buckshotGameAbi,
            functionName: 'getGameState',
            args: [gameId],
          }).then(s => [...s.players] as Address[]),
          publicClient.getBlock(),
        ])

        if (!active) return

        const winnerPoolKey = await publicClient.readContract({
          address: ADDRESSES.buckshotBetting,
          abi: buckshotBettingAbi,
          functionName: 'winnerPoolKey',
          args: [gameId],
        })

        const winnerPoolTotal = await publicClient.readContract({
          address: ADDRESSES.buckshotBetting,
          abi: buckshotBettingAbi,
          functionName: 'poolTotal',
          args: [winnerPoolKey],
        })

        if (!active) return

        let myBets = null
        if (address) {
          const result = await publicClient.readContract({
            address: ADDRESSES.buckshotBetting,
            abi: buckshotBettingAbi,
            functionName: 'getMyBets',
            args: [gameId, address],
          })
          myBets = {
            poolKeys: result[0],
            outcomeKeys: result[1],
            amounts: result[2],
            claimed: result[3],
          }
        }

        if (!active) return

        const blockTs = Number(block.timestamp)
        const serverTimeLeft = Math.max(0, Number(deadline) - blockTs)

        // Only re-sync anchor when blockchain timestamp actually advances,
        // otherwise the poll resets the client-side countdown every time
        if (!anchorRef.current || blockTs !== lastBlockTsRef.current) {
          lastBlockTsRef.current = blockTs
          anchorRef.current = { serverTimeLeft, clientTime: Date.now() / 1000 }
          setTimeLeft(serverTimeLeft)
        }

        setState({
          deadline,
          blockTimestamp: block.timestamp,
          players,
          winnerPoolTotal,
          myBets,
        })
      } catch {
        // Ignore errors during polling
      }
    }

    fetch()
    const interval = setInterval(fetch, pollInterval)
    return () => {
      active = false
      clearInterval(interval)
    }
  }, [gameId, address, pollInterval])

  // Client-side countdown — ticks every 200ms for smooth display
  useEffect(() => {
    const tick = setInterval(() => {
      if (!anchorRef.current) return
      const elapsed = Date.now() / 1000 - anchorRef.current.clientTime
      const next = Math.max(0, Math.round(anchorRef.current.serverTimeLeft - elapsed))
      setTimeLeft(prev => prev !== next ? next : prev)
    }, 200)
    return () => clearInterval(tick)
  }, [])

  // Decode bets for display
  const decodedBets = useMemo(() => {
    if (!state) return []
    return decodeBets(gameId, state.players, state.myBets)
  }, [gameId, state])

  const [isPending, setIsPending] = useState(false)
  const [isActivating, setIsActivating] = useState(false)
  const [isClaiming, setIsClaiming] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  // Get the burner walletClient for the connected address (local only)
  const walletClient = address ? burnerWalletClients[address.toLowerCase()] : null

  // For testnet, fall back to wagmi's useWriteContract
  const { writeContract: wagmiWrite, data: wagmiTxHash, isPending: wagmiPending } = useWriteContract()
  const { isLoading: wagmiConfirming, isSuccess: wagmiSuccess } = useWaitForTransactionReceipt({ hash: wagmiTxHash })

  // Helper: send tx via local burner or wagmi
  const sendTx = useCallback(async (params: {
    address: Address
    abi: readonly any[]
    functionName: string
    args: any[]
    value?: bigint
  }) => {
    if (isLocal && walletClient) {
      const hash = await walletClient.writeContract(params as any)
      await publicClient.waitForTransactionReceipt({ hash })
      return hash
    } else {
      wagmiWrite(params as any)
      return null
    }
  }, [walletClient, wagmiWrite])

  const placeBetWinner = useCallback(async (player: Address, amount: bigint) => {
    const betParams = encodeAbiParameters(parseAbiParameters('address'), [player])
    setIsPending(true)
    try {
      await sendTx({
        address: ADDRESSES.buckshotBetting,
        abi: buckshotBettingAbi,
        functionName: 'placeBet',
        args: [gameId, BetType.WINNER, betParams],
        value: amount,
      })
      setIsSuccess(true)
    } catch (e) {
      console.error('placeBetWinner failed:', e)
    } finally {
      setIsPending(false)
    }
  }, [gameId, sendTx])

  const placeBetFirstDeath = useCallback(async (position: number, player: Address, amount: bigint) => {
    const betParams = encodeAbiParameters(parseAbiParameters('uint8, address'), [position, player])
    setIsPending(true)
    try {
      await sendTx({
        address: ADDRESSES.buckshotBetting,
        abi: buckshotBettingAbi,
        functionName: 'placeBet',
        args: [gameId, BetType.FIRST_DEATH, betParams],
        value: amount,
      })
      setIsSuccess(true)
    } catch (e) {
      console.error('placeBetFirstDeath failed:', e)
    } finally {
      setIsPending(false)
    }
  }, [gameId, sendTx])

  const placeBetOverKills = useCallback(async (player: Address, threshold: number, betYes: boolean, amount: bigint) => {
    const betParams = encodeAbiParameters(parseAbiParameters('address, uint8, bool'), [player, threshold, betYes])
    setIsPending(true)
    try {
      await sendTx({
        address: ADDRESSES.buckshotBetting,
        abi: buckshotBettingAbi,
        functionName: 'placeBet',
        args: [gameId, BetType.OVER_KILLS, betParams],
        value: amount,
      })
      setIsSuccess(true)
    } catch (e) {
      console.error('placeBetOverKills failed:', e)
    } finally {
      setIsPending(false)
    }
  }, [gameId, sendTx])

  const activateGame = useCallback(async () => {
    setIsActivating(true)
    try {
      await sendTx({
        address: ADDRESSES.buckshotGame,
        abi: buckshotGameAbi,
        functionName: 'activateGame',
        args: [gameId],
      })
    } catch (e) {
      console.error('activateGame failed:', e)
    } finally {
      setIsActivating(false)
    }
  }, [gameId, sendTx])

  const claimWinnings = useCallback(async () => {
    setIsClaiming(true)
    try {
      await sendTx({
        address: ADDRESSES.buckshotBetting,
        abi: buckshotBettingAbi,
        functionName: 'claimWinnings',
        args: [gameId],
      })
    } catch (e) {
      console.error('claimWinnings failed:', e)
    } finally {
      setIsClaiming(false)
    }
  }, [gameId, sendTx])

  return {
    state,
    timeLeft,
    decodedBets,
    placeBetWinner,
    placeBetFirstDeath,
    placeBetOverKills,
    activateGame,
    claimWinnings,
    isPending: isPending || wagmiPending || wagmiConfirming,
    isSuccess: isSuccess || wagmiSuccess,
    isActivating,
    isClaiming,
    winnerPoolFormatted: state ? formatEther(state.winnerPoolTotal) : '0',
  }
}
