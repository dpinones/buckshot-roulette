import {
  createPublicClient,
  createWalletClient,
  http,
  defineChain,
  parseEther,
  formatEther,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

// ─── Config ──────────────────────────────────────────────────────
const PRIVATE_KEY = process.env.PRIVATE_KEY as Hex;
if (!PRIVATE_KEY) {
  console.error("Set PRIVATE_KEY env var");
  process.exit(1);
}
const RPC_URL = process.env.RPC_URL || "https://testnet-rpc.monad.xyz";
const BUY_IN = parseEther("0.00001");
const PLAYER_COUNT = 4;
const AGENT_NAME =
  process.env.AGENT_NAME || `Agent-${Math.random().toString(36).slice(2, 8)}`;
const POLL_MS = 2000;

// ─── Contract Addresses (Monad Testnet) ─────────────────────────
const ADDRESSES = {
  playerProfile: "0x486cDA4bB851C0A16c8D3feD9f28Ef77f850a42A" as Address,
  buckshotGame: "0x93f08E3AF423BEA46e9d50569b30a31Eb396D8cF" as Address,
  gameFactory: "0x7D82818e6374617A5f3cA43636bd6727d28ADA8c" as Address,
};

// ─── ABIs (minimal — only functions actually called) ────────────
const playerProfileAbi = [
  {
    type: "function", name: "hasProfile",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function", name: "createProfile",
    inputs: [{ name: "_name", type: "string" }],
    outputs: [], stateMutability: "nonpayable",
  },
] as const;

const gameFactoryAbi = [
  {
    type: "function", name: "joinQueue",
    inputs: [{ name: "buyIn", type: "uint256" }],
    outputs: [], stateMutability: "payable",
  },
  {
    type: "function", name: "leaveQueue",
    inputs: [], outputs: [], stateMutability: "nonpayable",
  },
  {
    type: "function", name: "startGame",
    inputs: [{ name: "buyIn", type: "uint256" }, { name: "playerCount", type: "uint8" }],
    outputs: [], stateMutability: "nonpayable",
  },
  {
    type: "function", name: "getQueueLength",
    inputs: [{ name: "buyIn", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function", name: "isInQueue",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function", name: "getActiveGames",
    inputs: [],
    outputs: [{ name: "", type: "uint256[]" }],
    stateMutability: "view",
  },
] as const;

const buckshotGameAbi = [
  {
    type: "function", name: "getGameState",
    inputs: [{ name: "gameId", type: "uint256" }],
    outputs: [{
      name: "", type: "tuple",
      components: [
        { name: "id", type: "uint256" },
        { name: "players", type: "address[]" },
        { name: "hpList", type: "uint8[]" },
        { name: "alive", type: "bool[]" },
        { name: "currentRound", type: "uint8" },
        { name: "currentTurnIndex", type: "uint8" },
        { name: "shellsRemaining", type: "uint8" },
        { name: "liveRemaining", type: "uint8" },
        { name: "blankRemaining", type: "uint8" },
        { name: "turnDeadline", type: "uint256" },
        { name: "phase", type: "uint8" },
        { name: "winner", type: "address" },
        { name: "prizePool", type: "uint256" },
      ],
    }],
    stateMutability: "view",
  },
  {
    type: "function", name: "getCurrentTurn",
    inputs: [{ name: "gameId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function", name: "getMyItems",
    inputs: [{ name: "gameId", type: "uint256" }, { name: "player", type: "address" }],
    outputs: [{ name: "", type: "uint8[]" }],
    stateMutability: "view",
  },
  {
    type: "function", name: "sawActive",
    inputs: [{ name: "", type: "uint256" }, { name: "", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function", name: "currentShellKnown",
    inputs: [{ name: "", type: "uint256" }, { name: "", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function", name: "knownShellValue",
    inputs: [{ name: "", type: "uint256" }, { name: "", type: "address" }],
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
  },
  {
    type: "function", name: "bettingDeadline",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function", name: "activateGame",
    inputs: [{ name: "gameId", type: "uint256" }],
    outputs: [], stateMutability: "nonpayable",
  },
  {
    type: "function", name: "nextGameId",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function", name: "getPhase",
    inputs: [{ name: "gameId", type: "uint256" }],
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
  },
  {
    type: "function", name: "shootOpponent",
    inputs: [{ name: "gameId", type: "uint256" }, { name: "target", type: "address" }],
    outputs: [], stateMutability: "nonpayable",
  },
  {
    type: "function", name: "shootSelf",
    inputs: [{ name: "gameId", type: "uint256" }],
    outputs: [], stateMutability: "nonpayable",
  },
  {
    type: "function", name: "useItem",
    inputs: [{ name: "gameId", type: "uint256" }, { name: "itemIndex", type: "uint8" }],
    outputs: [], stateMutability: "nonpayable",
  },
] as const;

// ─── Types ──────────────────────────────────────────────────────
export interface PlayerInfo {
  address: Address;
  hp: number;
  alive: boolean;
  items: number[];
}

export interface GameState {
  gameId: bigint;
  phase: number; // 0=WAITING, 1=ACTIVE, 2=FINISHED
  currentRound: number;
  currentTurn: Address;
  turnDeadline: bigint;
  shellsRemaining: number;
  liveRemaining: number;
  blankRemaining: number;
  liveProbability: number;
  players: PlayerInfo[];
  myIndex: number;
  myHp: number;
  myItems: number[]; // 0=NONE, 1=GLASS, 2=BEER, 3=HANDSAW, 4=CIGARETTES
  sawActive: boolean;
  shellKnown: boolean;
  knownShellIsLive: boolean;
  opponents: PlayerInfo[];
  winner: Address;
  prizePool: bigint;
}

export type Action =
  | { type: "useItem"; itemIndex: number }
  | { type: "shootOpponent"; target: Address }
  | { type: "shootSelf" };

const ITEM_NAMES: Record<number, string> = {
  0: "NONE", 1: "MAGNIFYING_GLASS", 2: "BEER", 3: "HANDSAW", 4: "CIGARETTES",
};

// ─── Chain & Clients ────────────────────────────────────────────
const monadTestnet = defineChain({
  id: 10143,
  name: "Monad Testnet",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
});

const account = privateKeyToAccount(PRIVATE_KEY);
const MY_ADDRESS = account.address;

const publicClient = createPublicClient({
  chain: monadTestnet,
  transport: http(RPC_URL),
});

const walletClient = createWalletClient({
  account,
  chain: monadTestnet,
  transport: http(RPC_URL),
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function log(...args: unknown[]) {
  console.log(`[${AGENT_NAME}]`, ...args);
}

// ================================================================
// YOUR AGENT LOGIC — Replace this function with your own strategy
// ================================================================
// Input:  state (GameState) — full game state including your items,
//         shell probabilities, opponent info, etc.
// Output: Action[] — list of actions to take this turn.
//         Use items first, MUST end with a shoot action.
//
// Item IDs: 1=MAGNIFYING_GLASS, 2=BEER, 3=HANDSAW, 4=CIGARETTES
//
// The default picks a random opponent and shoots.
// See BUCKSHOT_ROULETTE_SKILL.md Section 4 for a smarter strategy.
// ================================================================
function chooseAction(state: GameState): Action[] {
  const aliveOpponents = state.opponents.filter((o) => o.alive);
  if (aliveOpponents.length === 0) return [{ type: "shootSelf" }];
  const target =
    aliveOpponents[Math.floor(Math.random() * aliveOpponents.length)].address;
  return [{ type: "shootOpponent", target }];
}

// ─── Ensure Profile ─────────────────────────────────────────────
async function ensureProfile() {
  const has = await publicClient.readContract({
    address: ADDRESSES.playerProfile,
    abi: playerProfileAbi,
    functionName: "hasProfile",
    args: [MY_ADDRESS],
  });
  if (!has) {
    log("Creating profile:", AGENT_NAME);
    const hash = await walletClient.writeContract({
      address: ADDRESSES.playerProfile,
      abi: playerProfileAbi,
      functionName: "createProfile",
      args: [AGENT_NAME],
    });
    await publicClient.waitForTransactionReceipt({ hash });
    log("Profile created");
  } else {
    log("Profile exists");
  }
}

// ─── Join Queue & Start Game ────────────────────────────────────
async function joinAndStartGame(): Promise<bigint> {
  const inQueue = await publicClient.readContract({
    address: ADDRESSES.gameFactory,
    abi: gameFactoryAbi,
    functionName: "isInQueue",
    args: [MY_ADDRESS],
  });

  if (!inQueue) {
    log(`Joining queue (buy-in: ${formatEther(BUY_IN)} MON)...`);
    const hash = await walletClient.writeContract({
      address: ADDRESSES.gameFactory,
      abi: gameFactoryAbi,
      functionName: "joinQueue",
      args: [BUY_IN],
      value: BUY_IN,
    });
    await publicClient.waitForTransactionReceipt({ hash });
    log("Joined queue");
  } else {
    log("Already in queue");
  }

  const nextGameIdBefore = await publicClient.readContract({
    address: ADDRESSES.buckshotGame,
    abi: buckshotGameAbi,
    functionName: "nextGameId",
  });

  while (true) {
    const queueLen = await publicClient.readContract({
      address: ADDRESSES.gameFactory,
      abi: gameFactoryAbi,
      functionName: "getQueueLength",
      args: [BUY_IN],
    });
    log(`Queue: ${queueLen}/${PLAYER_COUNT} players`);

    if (Number(queueLen) >= PLAYER_COUNT) {
      try {
        log("Starting game...");
        const hash = await walletClient.writeContract({
          address: ADDRESSES.gameFactory,
          abi: gameFactoryAbi,
          functionName: "startGame",
          args: [BUY_IN, PLAYER_COUNT],
        });
        await publicClient.waitForTransactionReceipt({ hash });
        log("Game started!");
        break;
      } catch (e: any) {
        log("startGame failed (maybe already started):", e.message?.slice(0, 80));
      }
    }

    // Check if a new game was created by someone else
    const nextGameIdNow = await publicClient.readContract({
      address: ADDRESSES.buckshotGame,
      abi: buckshotGameAbi,
      functionName: "nextGameId",
    });
    if (nextGameIdNow > nextGameIdBefore) {
      for (let gid = nextGameIdBefore; gid < nextGameIdNow; gid++) {
        const gs = await publicClient.readContract({
          address: ADDRESSES.buckshotGame,
          abi: buckshotGameAbi,
          functionName: "getGameState",
          args: [gid],
        });
        const players = (gs as any).players as Address[];
        if (players.some((p) => p.toLowerCase() === MY_ADDRESS.toLowerCase())) {
          log("Found our game:", gid.toString());
          return gid;
        }
      }
    }

    await sleep(POLL_MS);
  }

  const nextGameIdAfter = await publicClient.readContract({
    address: ADDRESSES.buckshotGame,
    abi: buckshotGameAbi,
    functionName: "nextGameId",
  });
  return nextGameIdAfter - 1n;
}

// ─── Wait for Activation ────────────────────────────────────────
async function waitForActivation(gameId: bigint) {
  log("Waiting for betting window to close...");

  while (true) {
    const phase = await publicClient.readContract({
      address: ADDRESSES.buckshotGame,
      abi: buckshotGameAbi,
      functionName: "getPhase",
      args: [gameId],
    });

    if (Number(phase) === 1) { log("Game is ACTIVE"); return; }
    if (Number(phase) === 2) { log("Game already FINISHED"); return; }

    const deadline = await publicClient.readContract({
      address: ADDRESSES.buckshotGame,
      abi: buckshotGameAbi,
      functionName: "bettingDeadline",
      args: [gameId],
    });

    const block = await publicClient.getBlock();
    if (block.timestamp >= deadline) {
      try {
        log("Activating game...");
        const hash = await walletClient.writeContract({
          address: ADDRESSES.buckshotGame,
          abi: buckshotGameAbi,
          functionName: "activateGame",
          args: [gameId],
        });
        await publicClient.waitForTransactionReceipt({ hash });
        log("Game activated!");
        return;
      } catch (e: any) {
        log("Activation failed (maybe already activated):", e.message?.slice(0, 80));
      }
    }

    await sleep(POLL_MS);
  }
}

// ─── Read Game State ────────────────────────────────────────────
async function readGameState(gameId: bigint): Promise<GameState> {
  const contract = { address: ADDRESSES.buckshotGame, abi: buckshotGameAbi } as const;

  const [gameView, currentTurn] = await Promise.all([
    publicClient.readContract({ ...contract, functionName: "getGameState", args: [gameId] }),
    publicClient.readContract({ ...contract, functionName: "getCurrentTurn", args: [gameId] }),
  ]);

  const playerAddresses = gameView.players as Address[];

  const [itemsResults, sawResult, shellKnownResult, shellValueResult] =
    await Promise.all([
      Promise.all(
        playerAddresses.map((p) =>
          publicClient.readContract({ ...contract, functionName: "getMyItems", args: [gameId, p] })
        )
      ),
      publicClient.readContract({ ...contract, functionName: "sawActive", args: [gameId, MY_ADDRESS] }),
      publicClient.readContract({ ...contract, functionName: "currentShellKnown", args: [gameId, MY_ADDRESS] }),
      publicClient.readContract({ ...contract, functionName: "knownShellValue", args: [gameId, MY_ADDRESS] }),
    ]);

  const players: PlayerInfo[] = playerAddresses.map((addr, i) => ({
    address: addr,
    hp: gameView.hpList[i],
    alive: gameView.alive[i],
    items: [...(itemsResults[i] as number[])],
  }));

  const myIndex = players.findIndex(
    (p) => p.address.toLowerCase() === MY_ADDRESS.toLowerCase()
  );
  const me = players[myIndex];
  const opponents = players.filter((_, i) => i !== myIndex);
  const live = gameView.liveRemaining;
  const blank = gameView.blankRemaining;
  const total = live + blank;

  return {
    gameId,
    phase: gameView.phase,
    currentRound: gameView.currentRound,
    currentTurn: currentTurn as Address,
    turnDeadline: gameView.turnDeadline,
    shellsRemaining: gameView.shellsRemaining,
    liveRemaining: live,
    blankRemaining: blank,
    liveProbability: total > 0 ? live / total : 0,
    players,
    myIndex,
    myHp: me.hp,
    myItems: me.items,
    sawActive: sawResult as boolean,
    shellKnown: shellKnownResult as boolean,
    knownShellIsLive: (shellValueResult as number) === 1,
    opponents,
    winner: gameView.winner as Address,
    prizePool: gameView.prizePool,
  };
}

// ─── Execute Actions ────────────────────────────────────────────
async function executeActions(gameId: bigint, actions: Action[]) {
  for (const action of actions) {
    try {
      if (action.type === "useItem") {
        log(`Using item index ${action.itemIndex}...`);
        const hash = await walletClient.writeContract({
          address: ADDRESSES.buckshotGame, abi: buckshotGameAbi,
          functionName: "useItem", args: [gameId, action.itemIndex],
        });
        await publicClient.waitForTransactionReceipt({ hash });
        log("Item used");
      } else if (action.type === "shootOpponent") {
        log(`Shooting opponent ${action.target.slice(0, 10)}...`);
        const hash = await walletClient.writeContract({
          address: ADDRESSES.buckshotGame, abi: buckshotGameAbi,
          functionName: "shootOpponent", args: [gameId, action.target],
        });
        await publicClient.waitForTransactionReceipt({ hash });
        log("Shot fired at opponent");
      } else if (action.type === "shootSelf") {
        log("Shooting self...");
        const hash = await walletClient.writeContract({
          address: ADDRESSES.buckshotGame, abi: buckshotGameAbi,
          functionName: "shootSelf", args: [gameId],
        });
        await publicClient.waitForTransactionReceipt({ hash });
        log("Shot self");
      }
    } catch (e: any) {
      log(`Action failed (${action.type}):`, e.message?.slice(0, 120));
      break;
    }
  }
}

// ─── Play Game Loop ─────────────────────────────────────────────
async function playGame(gameId: bigint) {
  log(`Playing game ${gameId}...`);

  while (true) {
    const state = await readGameState(gameId);

    if (state.phase === 2) {
      const won = state.winner.toLowerCase() === MY_ADDRESS.toLowerCase();
      log(`GAME OVER! Winner: ${state.winner.slice(0, 10)}... ${won ? "(THAT'S US!)" : "(we lost)"} Prize: ${formatEther(state.prizePool)} MON`);
      return;
    }

    if (state.phase !== 1) { await sleep(POLL_MS); continue; }
    if (state.currentTurn.toLowerCase() !== MY_ADDRESS.toLowerCase()) { await sleep(POLL_MS); continue; }

    log(`MY TURN | HP: ${state.myHp} | Shells: ${state.shellsRemaining} (${state.liveRemaining}L/${state.blankRemaining}B) | Items: [${state.myItems.map((i) => ITEM_NAMES[i]).join(", ")}]`);

    const actions = chooseAction(state);
    log("Actions:", actions.map((a) => {
      if (a.type === "useItem") return `useItem(${a.itemIndex}:${ITEM_NAMES[state.myItems[a.itemIndex]] || "?"})`;
      if (a.type === "shootOpponent") return `shoot(${a.target.slice(0, 10)}...)`;
      return "shootSelf";
    }));

    await executeActions(gameId, actions);
    await sleep(1000);
  }
}

// ─── Main ───────────────────────────────────────────────────────
async function main() {
  log(`Wallet: ${MY_ADDRESS}`);
  log(`Buy-in: ${formatEther(BUY_IN)} MON | Players: ${PLAYER_COUNT}`);

  await ensureProfile();

  while (true) {
    try {
      const gameId = await joinAndStartGame();
      await waitForActivation(gameId);
      await playGame(gameId);
      log("Game complete. Looking for next game in 5s...");
      await sleep(5000);
    } catch (e: any) {
      log("Error:", e.message?.slice(0, 200));
      log("Retrying in 5s...");
      await sleep(5000);
    }
  }
}

main().catch((e) => { console.error("Fatal:", e); process.exit(1); });
