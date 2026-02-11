import { type Abi } from 'viem'

// Deterministic Anvil addresses (same PK always deploys to same addrs)
// Deploy order: PlayerProfile (nonce 0), BuckshotGame (nonce 1),
// setGameContract (nonce 2), GameFactory (nonce 3), BuckshotWager (nonce 4)
const ANVIL_ADDRESSES = {
  playerProfile: '0x5fbdb2315678afecb367f032d93f642f64180aa3' as const,
  buckshotGame: '0xe7f1725e7734ce288f8367e1bb143e90bb3f0512' as const,
  gameFactory: '0xcf7ed3acca5a467e9e704c703e8d87f634fb0fc9' as const,
  buckshotWager: '0xdc64a140aa3e981100a9beca4e685f962f0cf6c9' as const,
  buckshotBetting: '0x5fc8d32690cc91d4c39d9d3abcbd16989f875707' as const,
}

// Monad testnet addresses — update after deploying with `make deploy`
const TESTNET_ADDRESSES = {
  playerProfile: '0x0000000000000000000000000000000000000000' as const,
  buckshotGame: '0x0000000000000000000000000000000000000000' as const,
  gameFactory: '0x0000000000000000000000000000000000000000' as const,
  buckshotWager: '0x0000000000000000000000000000000000000000' as const,
  buckshotBetting: '0x0000000000000000000000000000000000000000' as const,
}

export const ADDRESSES =
  import.meta.env.VITE_NETWORK === 'testnet' ? TESTNET_ADDRESSES : ANVIL_ADDRESSES

// Player addresses from Anvil default accounts
export const PLAYERS = {
  P1: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' as const,
  P2: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' as const,
}

export const buckshotGameAbi = [
  {
    type: 'function',
    name: 'getGameState',
    inputs: [{ name: 'gameId', type: 'uint256' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'id', type: 'uint256' },
          { name: 'players', type: 'address[]' },
          { name: 'hpList', type: 'uint8[]' },
          { name: 'alive', type: 'bool[]' },
          { name: 'currentRound', type: 'uint8' },
          { name: 'currentTurnIndex', type: 'uint8' },
          { name: 'shellsRemaining', type: 'uint8' },
          { name: 'liveRemaining', type: 'uint8' },
          { name: 'blankRemaining', type: 'uint8' },
          { name: 'turnDeadline', type: 'uint256' },
          { name: 'phase', type: 'uint8' },
          { name: 'winner', type: 'address' },
          { name: 'prizePool', type: 'uint256' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getCurrentTurn',
    inputs: [{ name: 'gameId', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getMyItems',
    inputs: [
      { name: 'gameId', type: 'uint256' },
      { name: 'player', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint8[]' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getVisibleShells',
    inputs: [{ name: 'gameId', type: 'uint256' }],
    outputs: [
      { name: 'liveRem', type: 'uint8' },
      { name: 'blankRem', type: 'uint8' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getPhase',
    inputs: [{ name: 'gameId', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'hp',
    inputs: [
      { name: 'gameId', type: 'uint256' },
      { name: 'player', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'nextGameId',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'bettingDeadline',
    inputs: [{ name: 'gameId', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'activateGame',
    inputs: [{ name: 'gameId', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'deathOrder',
    inputs: [
      { name: 'gameId', type: 'uint256' },
      { name: 'player', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'gameKills',
    inputs: [
      { name: 'gameId', type: 'uint256' },
      { name: 'player', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view',
  },
] as const satisfies Abi

export const gameFactoryAbi = [
  {
    type: 'function',
    name: 'getSupportedBuyIns',
    inputs: [],
    outputs: [{ name: '', type: 'uint256[]' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getQueueLength',
    inputs: [{ name: 'buyIn', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getQueue',
    inputs: [{ name: 'buyIn', type: 'uint256' }],
    outputs: [{ name: '', type: 'address[]' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getActiveGames',
    inputs: [],
    outputs: [{ name: '', type: 'uint256[]' }],
    stateMutability: 'view',
  },
] as const satisfies Abi

export const buckshotWagerAbi = [
  {
    type: 'function',
    name: 'totalPool',
    inputs: [{ name: 'gameId', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getOdds',
    inputs: [{ name: 'gameId', type: 'uint256' }],
    outputs: [
      { name: 'players', type: 'address[]' },
      { name: 'odds', type: 'uint256[]' },
    ],
    stateMutability: 'view',
  },
] as const satisfies Abi

export const buckshotBettingAbi = [
  {
    type: 'function',
    name: 'placeBet',
    inputs: [
      { name: 'gameId', type: 'uint256' },
      { name: 'betType', type: 'uint8' },
      { name: 'betParams', type: 'bytes' },
    ],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'claimWinnings',
    inputs: [{ name: 'gameId', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getPoolOdds',
    inputs: [
      { name: 'poolKey', type: 'bytes32' },
      { name: 'outcomeKeys', type: 'bytes32[]' },
    ],
    outputs: [{ name: '', type: 'uint256[]' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getMyBets',
    inputs: [
      { name: 'gameId', type: 'uint256' },
      { name: 'bettor', type: 'address' },
    ],
    outputs: [
      { name: 'poolKeys', type: 'bytes32[]' },
      { name: 'outcomeKeys', type: 'bytes32[]' },
      { name: 'amounts', type: 'uint256[]' },
      { name: 'claimed', type: 'bool[]' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'winnerPoolKey',
    inputs: [{ name: 'gameId', type: 'uint256' }],
    outputs: [{ name: '', type: 'bytes32' }],
    stateMutability: 'pure',
  },
  {
    type: 'function',
    name: 'firstDeathPoolKey',
    inputs: [
      { name: 'gameId', type: 'uint256' },
      { name: 'position', type: 'uint8' },
    ],
    outputs: [{ name: '', type: 'bytes32' }],
    stateMutability: 'pure',
  },
  {
    type: 'function',
    name: 'overKillsPoolKey',
    inputs: [
      { name: 'gameId', type: 'uint256' },
      { name: 'player', type: 'address' },
      { name: 'threshold', type: 'uint8' },
    ],
    outputs: [{ name: '', type: 'bytes32' }],
    stateMutability: 'pure',
  },
  {
    type: 'function',
    name: 'playerOutcomeKey',
    inputs: [{ name: 'player', type: 'address' }],
    outputs: [{ name: '', type: 'bytes32' }],
    stateMutability: 'pure',
  },
  {
    type: 'function',
    name: 'boolOutcomeKey',
    inputs: [{ name: 'value', type: 'bool' }],
    outputs: [{ name: '', type: 'bytes32' }],
    stateMutability: 'pure',
  },
  {
    type: 'function',
    name: 'poolTotal',
    inputs: [{ name: 'poolKey', type: 'bytes32' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'MIN_BET',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getKillThresholds',
    inputs: [],
    outputs: [{ name: '', type: 'uint8[]' }],
    stateMutability: 'view',
  },
] as const satisfies Abi

// BetType enum values
export const BetType = {
  WINNER: 0,
  FIRST_DEATH: 1,
  OVER_KILLS: 2,
} as const

export const ITEM_NAMES: Record<number, string> = {
  0: 'NONE',
  1: 'MAGNIFYING_GLASS',
  2: 'BEER',
  3: 'HANDSAW',
  4: 'CIGARETTES',
}

export const ITEM_ICONS: Record<number, string> = {
  1: '\u{1F50D}', // magnifying glass
  2: '\u{1F37A}', // beer
  3: '\u{1FA9A}', // handsaw (carpentry saw)
  4: '\u{1F6AC}', // cigarettes
}

// Phase enum
export const Phase = {
  WAITING: 0,
  ACTIVE: 1,
  FINISHED: 2,
} as const

// PlayerProfile ABI
export const playerProfileAbi = [
  {
    type: 'function',
    name: 'getStats',
    inputs: [{ name: 'player', type: 'address' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'gamesPlayed', type: 'uint32' },
          { name: 'gamesWon', type: 'uint32' },
          { name: 'kills', type: 'uint32' },
          { name: 'deaths', type: 'uint32' },
          { name: 'shotsFired', type: 'uint32' },
          { name: 'itemsUsed', type: 'uint32' },
          { name: 'totalEarnings', type: 'uint256' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'hasProfile',
    inputs: [{ name: '', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getName',
    inputs: [{ name: 'player', type: 'address' }],
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
  },
] as const satisfies Abi

// BuckshotGame event ABIs (for getLogs)
export const buckshotGameEventAbi = [
  {
    type: 'event',
    name: 'GameCreated',
    inputs: [
      { name: 'gameId', type: 'uint256', indexed: true },
      { name: 'players', type: 'address[]', indexed: false },
      { name: 'buyIn', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'GameEnded',
    inputs: [
      { name: 'gameId', type: 'uint256', indexed: true },
      { name: 'winner', type: 'address', indexed: true },
      { name: 'prize', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'ShotFired',
    inputs: [
      { name: 'gameId', type: 'uint256', indexed: true },
      { name: 'shooter', type: 'address', indexed: true },
      { name: 'target', type: 'address', indexed: true },
      { name: 'wasLive', type: 'bool', indexed: false },
      { name: 'damage', type: 'uint8', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'ItemUsed',
    inputs: [
      { name: 'gameId', type: 'uint256', indexed: true },
      { name: 'player', type: 'address', indexed: true },
      { name: 'itemType', type: 'uint8', indexed: false },
      { name: 'data', type: 'bytes', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'PlayerEliminated',
    inputs: [
      { name: 'gameId', type: 'uint256', indexed: true },
      { name: 'player', type: 'address', indexed: true },
      { name: 'placement', type: 'uint8', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'RoundStarted',
    inputs: [
      { name: 'gameId', type: 'uint256', indexed: true },
      { name: 'round', type: 'uint8', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'TurnStarted',
    inputs: [
      { name: 'gameId', type: 'uint256', indexed: true },
      { name: 'player', type: 'address', indexed: true },
      { name: 'deadline', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'ShellsLoaded',
    inputs: [
      { name: 'gameId', type: 'uint256', indexed: true },
      { name: 'liveCount', type: 'uint8', indexed: false },
      { name: 'blankCount', type: 'uint8', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'ShellEjected',
    inputs: [
      { name: 'gameId', type: 'uint256', indexed: true },
      { name: 'wasLive', type: 'bool', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'RoundEnded',
    inputs: [
      { name: 'gameId', type: 'uint256', indexed: true },
      { name: 'round', type: 'uint8', indexed: false },
    ],
  },
] as const satisfies Abi
