import { type Address } from 'viem'
import { publicClient } from '../contracts/client.js'
import { addresses } from '../contracts/addresses.js'
import { buckshotGameAbi } from '../contracts/abis.js'
import { ITEM_NAMES } from './action-types.js'

export interface PlayerInfo {
  address: Address
  hp: number
  alive: boolean
  items: number[]
  itemNames: string[]
}

export interface ReadableGameState {
  gameId: bigint
  phase: number
  currentRound: number
  currentTurn: Address
  turnDeadline: bigint
  shellsRemaining: number
  liveRemaining: number
  blankRemaining: number
  liveProbability: number
  players: PlayerInfo[]
  myIndex: number
  myHp: number
  myItems: number[]
  myItemNames: string[]
  sawActive: boolean
  shellKnown: boolean
  knownShellIsLive: boolean
  opponents: PlayerInfo[]
  winner: Address
  prizePool: bigint
}

export async function readGameState(
  gameId: bigint,
  agentAddress: Address,
): Promise<ReadableGameState> {
  const contract = { address: addresses.buckshotGame, abi: buckshotGameAbi } as const

  const [gameView, currentTurn] = await Promise.all([
    publicClient.readContract({ ...contract, functionName: 'getGameState', args: [gameId] }),
    publicClient.readContract({ ...contract, functionName: 'getCurrentTurn', args: [gameId] }),
  ])

  const playerAddresses = gameView.players as Address[]

  // Fetch per-player data in parallel
  const [itemsResults, sawResult, shellKnownResult, shellValueResult] = await Promise.all([
    Promise.all(
      playerAddresses.map((p) =>
        publicClient.readContract({ ...contract, functionName: 'getMyItems', args: [gameId, p] })
      ),
    ),
    publicClient.readContract({ ...contract, functionName: 'sawActive', args: [gameId, agentAddress] }),
    publicClient.readContract({ ...contract, functionName: 'currentShellKnown', args: [gameId, agentAddress] }),
    publicClient.readContract({ ...contract, functionName: 'knownShellValue', args: [gameId, agentAddress] }),
  ])

  const players: PlayerInfo[] = playerAddresses.map((addr, i) => {
    const items = [...(itemsResults[i] as number[])]
    return {
      address: addr,
      hp: gameView.hpList[i],
      alive: gameView.alive[i],
      items,
      itemNames: items.map((it) => ITEM_NAMES[it] ?? 'UNKNOWN'),
    }
  })

  const myIndex = players.findIndex(
    (p) => p.address.toLowerCase() === agentAddress.toLowerCase(),
  )
  const me = players[myIndex]
  const opponents = players.filter((_, i) => i !== myIndex)

  const live = gameView.liveRemaining
  const blank = gameView.blankRemaining
  const total = live + blank
  const liveProbability = total > 0 ? live / total : 0

  return {
    gameId,
    phase: gameView.phase,
    currentRound: gameView.currentRound,
    currentTurn: currentTurn as Address,
    turnDeadline: gameView.turnDeadline,
    shellsRemaining: gameView.shellsRemaining,
    liveRemaining: live,
    blankRemaining: blank,
    liveProbability,
    players,
    myIndex,
    myHp: me.hp,
    myItems: me.items,
    myItemNames: me.itemNames,
    sawActive: sawResult as boolean,
    shellKnown: shellKnownResult as boolean,
    knownShellIsLive: (shellValueResult as number) === 1,
    opponents,
    winner: gameView.winner as Address,
    prizePool: gameView.prizePool,
  }
}
