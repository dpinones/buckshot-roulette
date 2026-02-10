import { type Abi } from 'viem'

// Deterministic Anvil addresses (same PK always deploys to same addrs)
// Deploy order: PlayerProfile (nonce 0), BuckshotGame (nonce 1),
// setGameContract (nonce 2), GameFactory (nonce 3), BuckshotWager (nonce 4)
export const ADDRESSES = {
  playerProfile: '0x5FbDB2315678afecb367f032d93F642f64180aa3' as const,
  buckshotGame: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512' as const,
  gameFactory: '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9' as const,
  buckshotWager: '0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9' as const,
}

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

export const ITEM_NAMES: Record<number, string> = {
  0: 'NONE',
  1: 'MAGNIFYING_GLASS',
  2: 'BEER',
  3: 'HANDSAW',
  4: 'HANDCUFFS',
  5: 'CIGARETTES',
  6: 'INVERTER',
}

export const ITEM_ICONS: Record<number, string> = {
  1: '\u{1F50D}', // magnifying glass
  2: '\u{1F37A}', // beer
  3: '\u{1FA9A}', // handsaw (carpentry saw)
  4: '\u{1F517}', // handcuffs (link chain)
  5: '\u{1F6AC}', // cigarettes
  6: '\u{1F504}', // inverter (arrows)
}

// Phase enum
export const Phase = {
  WAITING: 0,
  ACTIVE: 1,
  FINISHED: 2,
} as const
