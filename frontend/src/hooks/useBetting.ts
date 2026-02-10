import { useState, useEffect, useCallback } from 'react'
import { type Address, formatEther, encodeAbiParameters, parseAbiParameters } from 'viem'
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
  timeLeft: number
  players: Address[]
  winnerPoolTotal: bigint
  myBets: {
    poolKeys: readonly `0x${string}`[]
    outcomeKeys: readonly `0x${string}`[]
    amounts: readonly bigint[]
    claimed: readonly boolean[]
  } | null
}

export function useBetting(gameId: bigint, pollInterval = 1000) {
  const { address } = useAccount()
  const [state, setState] = useState<BettingState | null>(null)

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

        // Get winner pool total
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

        // Get user bets if connected
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
        setState({
          deadline,
          blockTimestamp: block.timestamp,
          timeLeft: Math.max(0, Number(deadline) - blockTs),
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

  // Use timeLeft from latest poll (computed from block timestamp for Anvil compat)
  const timeLeft = state?.timeLeft ?? 0

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
