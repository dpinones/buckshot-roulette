import { type Abi } from 'viem'

export const buckshotGameAbi = [
  { type: 'function', name: 'TURN_TIMEOUT', inputs: [], outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view' },
  {
    type: 'function', name: 'createGame',
    inputs: [{ name: 'players', type: 'address[]' }, { name: 'buyIn', type: 'uint256' }],
    outputs: [{ name: 'gameId', type: 'uint256' }], stateMutability: 'payable',
  },
  {
    type: 'function', name: 'currentShellKnown',
    inputs: [{ name: '', type: 'uint256' }, { name: '', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }], stateMutability: 'view',
  },
  {
    type: 'function', name: 'forceTimeout',
    inputs: [{ name: 'gameId', type: 'uint256' }],
    outputs: [], stateMutability: 'nonpayable',
  },
  {
    type: 'function', name: 'getCurrentTurn',
    inputs: [{ name: 'gameId', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }], stateMutability: 'view',
  },
  {
    type: 'function', name: 'getGameState',
    inputs: [{ name: 'gameId', type: 'uint256' }],
    outputs: [{
      name: '', type: 'tuple',
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
    }],
    stateMutability: 'view',
  },
  {
    type: 'function', name: 'getMyItems',
    inputs: [{ name: 'gameId', type: 'uint256' }, { name: 'player', type: 'address' }],
    outputs: [{ name: '', type: 'uint8[]' }], stateMutability: 'view',
  },
  {
    type: 'function', name: 'getPhase',
    inputs: [{ name: 'gameId', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint8' }], stateMutability: 'view',
  },
  {
    type: 'function', name: 'getPlayers',
    inputs: [{ name: 'gameId', type: 'uint256' }],
    outputs: [{ name: '', type: 'address[]' }], stateMutability: 'view',
  },
  {
    type: 'function', name: 'getVisibleShells',
    inputs: [{ name: 'gameId', type: 'uint256' }],
    outputs: [{ name: 'liveRem', type: 'uint8' }, { name: 'blankRem', type: 'uint8' }],
    stateMutability: 'view',
  },
  {
    type: 'function', name: 'hp',
    inputs: [{ name: '', type: 'uint256' }, { name: '', type: 'address' }],
    outputs: [{ name: '', type: 'uint8' }], stateMutability: 'view',
  },
  {
    type: 'function', name: 'knownShellValue',
    inputs: [{ name: '', type: 'uint256' }, { name: '', type: 'address' }],
    outputs: [{ name: '', type: 'uint8' }], stateMutability: 'view',
  },
  { type: 'function', name: 'nextGameId', inputs: [], outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view' },
  {
    type: 'function', name: 'sawActive',
    inputs: [{ name: '', type: 'uint256' }, { name: '', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }], stateMutability: 'view',
  },
  {
    type: 'function', name: 'shootOpponent',
    inputs: [{ name: 'gameId', type: 'uint256' }, { name: 'target', type: 'address' }],
    outputs: [], stateMutability: 'nonpayable',
  },
  {
    type: 'function', name: 'shootSelf',
    inputs: [{ name: 'gameId', type: 'uint256' }],
    outputs: [], stateMutability: 'nonpayable',
  },
  {
    type: 'function', name: 'skipNextTurn',
    inputs: [{ name: '', type: 'uint256' }, { name: '', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }], stateMutability: 'view',
  },
  {
    type: 'function', name: 'useItem',
    inputs: [{ name: 'gameId', type: 'uint256' }, { name: 'itemIndex', type: 'uint8' }],
    outputs: [], stateMutability: 'nonpayable',
  },
  // Events
  {
    type: 'event', name: 'GameCreated',
    inputs: [
      { name: 'gameId', type: 'uint256', indexed: true },
      { name: 'players', type: 'address[]', indexed: false },
      { name: 'buyIn', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event', name: 'GameEnded',
    inputs: [
      { name: 'gameId', type: 'uint256', indexed: true },
      { name: 'winner', type: 'address', indexed: true },
      { name: 'prize', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event', name: 'ShotFired',
    inputs: [
      { name: 'gameId', type: 'uint256', indexed: true },
      { name: 'shooter', type: 'address', indexed: true },
      { name: 'target', type: 'address', indexed: true },
      { name: 'wasLive', type: 'bool', indexed: false },
      { name: 'damage', type: 'uint8', indexed: false },
    ],
  },
  {
    type: 'event', name: 'ItemUsed',
    inputs: [
      { name: 'gameId', type: 'uint256', indexed: true },
      { name: 'player', type: 'address', indexed: true },
      { name: 'itemType', type: 'uint8', indexed: false },
      { name: 'data', type: 'bytes', indexed: false },
    ],
  },
  {
    type: 'event', name: 'TurnStarted',
    inputs: [
      { name: 'gameId', type: 'uint256', indexed: true },
      { name: 'player', type: 'address', indexed: true },
      { name: 'deadline', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event', name: 'ShellsLoaded',
    inputs: [
      { name: 'gameId', type: 'uint256', indexed: true },
      { name: 'liveCount', type: 'uint8', indexed: false },
      { name: 'blankCount', type: 'uint8', indexed: false },
    ],
  },
  {
    type: 'event', name: 'RoundStarted',
    inputs: [
      { name: 'gameId', type: 'uint256', indexed: true },
      { name: 'round', type: 'uint8', indexed: false },
    ],
  },
  {
    type: 'event', name: 'PlayerEliminated',
    inputs: [
      { name: 'gameId', type: 'uint256', indexed: true },
      { name: 'player', type: 'address', indexed: true },
      { name: 'placement', type: 'uint8', indexed: false },
    ],
  },
] as const satisfies Abi

export const gameFactoryAbi = [
  {
    type: 'function', name: 'joinQueue',
    inputs: [{ name: 'buyIn', type: 'uint256' }],
    outputs: [], stateMutability: 'payable',
  },
  {
    type: 'function', name: 'leaveQueue',
    inputs: [], outputs: [], stateMutability: 'nonpayable',
  },
  {
    type: 'function', name: 'startGame',
    inputs: [{ name: 'buyIn', type: 'uint256' }, { name: 'playerCount', type: 'uint8' }],
    outputs: [], stateMutability: 'nonpayable',
  },
  {
    type: 'function', name: 'getQueueLength',
    inputs: [{ name: 'buyIn', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view',
  },
  {
    type: 'function', name: 'getQueue',
    inputs: [{ name: 'buyIn', type: 'uint256' }],
    outputs: [{ name: '', type: 'address[]' }], stateMutability: 'view',
  },
  {
    type: 'function', name: 'getActiveGames',
    inputs: [],
    outputs: [{ name: '', type: 'uint256[]' }], stateMutability: 'view',
  },
  {
    type: 'function', name: 'getSupportedBuyIns',
    inputs: [],
    outputs: [{ name: '', type: 'uint256[]' }], stateMutability: 'view',
  },
  {
    type: 'function', name: 'isInQueue',
    inputs: [{ name: '', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }], stateMutability: 'view',
  },
  // Events
  {
    type: 'event', name: 'PlayerJoinedQueue',
    inputs: [
      { name: 'player', type: 'address', indexed: true },
      { name: 'buyIn', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event', name: 'GameCreated',
    inputs: [
      { name: 'gameId', type: 'uint256', indexed: true },
      { name: 'players', type: 'address[]', indexed: false },
      { name: 'buyIn', type: 'uint256', indexed: false },
    ],
  },
] as const satisfies Abi
