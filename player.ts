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
const PLAYER_COUNT = parseInt(process.env.PLAYER_COUNT || "4");
const AUTO_REJOIN = (process.env.AUTO_REJOIN || "true").toLowerCase() === "true";
const NOTIFY_URL = process.env.NOTIFY_URL || ""; // webhook URL to POST game results
const AGENT_NAME =
  process.env.AGENT_NAME || `Agent-${Math.random().toString(36).slice(2, 8)}`;
const POLL_MS = 2000;

// ─── LLM Config ─────────────────────────────────────────────────
const LLM_API_KEY = process.env.LLM_API_KEY || "";
const LLM_API_URL = process.env.LLM_API_URL || "https://api.openai.com/v1/chat/completions";
const LLM_MODEL = process.env.LLM_MODEL || "gpt-4o-mini";
const LLM_TIMEOUT_MS = 10_000; // max time to wait for LLM response
const MIN_TURN_TIME_MS = 8_000; // skip LLM if less than this time left on turn
const PERSONALITY = process.env.PERSONALITY || "You are a strategic player. Analyze probabilities, use items wisely, and make optimal decisions to survive and win.";

// ─── Contract Addresses (Monad Testnet) ─────────────────────────
const ADDRESSES = {
  playerProfile: "0x3F8495b51AE715B3E0dFE0D4243c7511b3D82044" as Address,
  buckshotGame: "0x0739327F110d19051Ce2B0B4275FbCa6d1638335" as Address,
  gameFactory: "0xD613fda1Ef2aA6852B0D1f797ea149ecF37c7A7d" as Address,
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
// FALLBACK STRATEGY (deterministic — used when LLM is unavailable)
// ================================================================
function fallbackStrategy(state: GameState): Action[] {
  const actions: Action[] = [];
  const used = new Set<number>();
  const findItem = (id: number) =>
    state.myItems.findIndex((it, i) => it === id && !used.has(i));
  const aliveOpps = state.opponents.filter((o) => o.alive);
  if (aliveOpps.length === 0) return [{ type: "shootSelf" }];
  const target = aliveOpps.reduce((min, o) => (o.hp < min.hp ? o : min)).address;

  const knownShell = state.shellKnown
    ? state.knownShellIsLive ? "live" : "blank"
    : null;
  const allLive = state.blankRemaining === 0 && state.shellsRemaining > 0;
  const allBlank = state.liveRemaining === 0 && state.shellsRemaining > 0;

  // Known blank → shoot self for extra turn
  if (knownShell === "blank") return [{ type: "shootSelf" }];

  // Known live → handsaw + shoot opponent
  if (knownShell === "live") {
    if (!state.sawActive) {
      const i = findItem(3);
      if (i !== -1) { actions.push({ type: "useItem", itemIndex: i }); used.add(i); }
    }
    return [...actions, { type: "shootOpponent", target }];
  }

  // Unknown shell → use magnifying glass if available
  const glass = findItem(1);
  if (glass !== -1) {
    actions.push({ type: "useItem", itemIndex: glass }); used.add(glass);
    // After glass we'll see the result next call, shoot opponent for now
    return [...actions, { type: "shootOpponent", target }];
  }

  // Heal if low HP
  if (state.myHp < 3) {
    const i = findItem(4);
    if (i !== -1) { actions.push({ type: "useItem", itemIndex: i }); used.add(i); }
  }

  if (allLive) {
    if (!state.sawActive) {
      const i = findItem(3);
      if (i !== -1) { actions.push({ type: "useItem", itemIndex: i }); used.add(i); }
    }
    return [...actions, { type: "shootOpponent", target }];
  }
  if (allBlank) return [...actions, { type: "shootSelf" }];

  // High live probability → eject with beer
  if (state.liveProbability > 0.5) {
    const i = findItem(2);
    if (i !== -1) { actions.push({ type: "useItem", itemIndex: i }); used.add(i); }
  }

  return [...actions, { type: "shootOpponent", target }];
}

// ================================================================
// LLM DECISION MAKING (primary — asks the model for a decision)
// ================================================================
function buildGamePrompt(state: GameState): string {
  const aliveOpps = state.opponents.filter((o) => o.alive);
  const timeLeft = Number(state.turnDeadline) * 1000 - Date.now();
  const timeLeftSec = Math.max(0, Math.floor(timeLeft / 1000));

  return `It's your turn in Buckshot Roulette. You have ${timeLeftSec}s to decide.

YOUR STATUS:
- HP: ${state.myHp}/3
- Items: [${state.myItems.map((id, idx) => id !== 0 ? `${idx}:${ITEM_NAMES[id]}` : null).filter(Boolean).join(", ")}]
- Handsaw active: ${state.sawActive} (next shot deals 2 damage)

SHELL INFO:
- Remaining: ${state.shellsRemaining} (${state.liveRemaining} live, ${state.blankRemaining} blank)
- Live probability: ${(state.liveProbability * 100).toFixed(0)}%
- Current shell known: ${state.shellKnown ? (state.knownShellIsLive ? "YES - LIVE" : "YES - BLANK") : "NO"}

OPPONENTS:
${aliveOpps.map((o) => `- ${o.address.slice(0, 10)}... HP:${o.hp} Items:[${o.items.filter(i => i !== 0).map(i => ITEM_NAMES[i]).join(",")}]`).join("\n")}

AVAILABLE ACTIONS:
- useItem(itemIndex) — use one of your items (does NOT end turn)
- shootOpponent(target) — shoot an opponent (ends turn)
- shootSelf — shoot yourself. If blank, you get an extra turn!

RULES:
- You MUST end with exactly one shoot action (shootOpponent or shootSelf)
- You can use multiple items before shooting
- Shooting self with a blank gives you another turn (powerful!)
- Item indices shift after use (swap-and-pop), so use items in order from the response

Respond ONLY with a JSON array of actions. Examples:
[{"type":"shootSelf"}]
[{"type":"useItem","itemIndex":0},{"type":"shootOpponent","target":"0xABC..."}]
[{"type":"useItem","itemIndex":1},{"type":"useItem","itemIndex":0},{"type":"shootSelf"}]`;
}

async function askLLM(state: GameState): Promise<Action[] | null> {
  if (!LLM_API_KEY) return null;

  // Check if we have enough time for an LLM call
  const timeLeftMs = Number(state.turnDeadline) * 1000 - Date.now();
  if (timeLeftMs < MIN_TURN_TIME_MS) {
    log(`Only ${Math.floor(timeLeftMs / 1000)}s left on turn, skipping LLM`);
    return null;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);

    const res = await fetch(LLM_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LLM_API_KEY}`,
      },
      body: JSON.stringify({
        model: LLM_MODEL,
        messages: [
          { role: "system", content: `You are an AI agent playing Buckshot Roulette, an on-chain game.\n\n${PERSONALITY}\n\nRespond ONLY with a valid JSON array of actions. No explanation, no markdown, just the JSON array.` },
          { role: "user", content: buildGamePrompt(state) },
        ],
        temperature: 0.7,
        max_tokens: 300,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      log(`LLM API error: ${res.status} ${res.statusText}`);
      return null;
    }

    const data = await res.json();
    const content: string = data.choices?.[0]?.message?.content?.trim() || "";
    log("LLM raw:", content);

    // Extract JSON array from response (handles ```json wrapping)
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) { log("LLM: no JSON array found"); return null; }

    const parsed = JSON.parse(jsonMatch[0]) as any[];
    if (!Array.isArray(parsed) || parsed.length === 0) return null;

    // Validate actions
    const aliveAddrs = new Set(
      state.opponents.filter((o) => o.alive).map((o) => o.address.toLowerCase())
    );
    const validActions: Action[] = [];
    for (const a of parsed) {
      if (a.type === "useItem" && typeof a.itemIndex === "number") {
        if (a.itemIndex >= 0 && a.itemIndex < state.myItems.length && state.myItems[a.itemIndex] !== 0) {
          validActions.push({ type: "useItem", itemIndex: a.itemIndex });
        }
      } else if (a.type === "shootOpponent" && typeof a.target === "string") {
        if (aliveAddrs.has(a.target.toLowerCase())) {
          validActions.push({ type: "shootOpponent", target: a.target as Address });
        }
      } else if (a.type === "shootSelf") {
        validActions.push({ type: "shootSelf" });
      }
    }

    // Must end with a shoot action
    const lastAction = validActions[validActions.length - 1];
    if (!lastAction || (lastAction.type !== "shootOpponent" && lastAction.type !== "shootSelf")) {
      log("LLM: actions don't end with shoot");
      return null;
    }

    // Make sure only the last action is a shoot
    const shootCount = validActions.filter(
      (a) => a.type === "shootOpponent" || a.type === "shootSelf"
    ).length;
    if (shootCount !== 1) {
      log("LLM: multiple shoot actions, invalid");
      return null;
    }

    return validActions;
  } catch (e: any) {
    if (e.name === "AbortError") {
      log("LLM: timed out");
    } else {
      log("LLM error:", e.message?.slice(0, 100));
    }
    return null;
  }
}

// ================================================================
// CHOOSE ACTION — LLM first, deterministic fallback
// ================================================================
async function chooseAction(state: GameState): Promise<Action[]> {
  const llmActions = await askLLM(state);
  if (llmActions) {
    log("Using LLM decision");
    return llmActions;
  }
  log("Using fallback strategy");
  return fallbackStrategy(state);
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

// ─── Notify Result ──────────────────────────────────────────────
async function notifyResult(gameId: bigint, won: boolean, prize: bigint) {
  const result = {
    agent: AGENT_NAME,
    wallet: MY_ADDRESS,
    gameId: gameId.toString(),
    result: won ? "WIN" : "LOSS",
    prize: formatEther(prize),
  };
  log(`GAME OVER! ${won ? "WE WON!" : "We lost."} Prize: ${formatEther(prize)} MON`);

  if (NOTIFY_URL) {
    try {
      await fetch(NOTIFY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result),
      });
    } catch { /* notification is best-effort */ }
  }
}

// ─── Play Game Loop ─────────────────────────────────────────────
async function playGame(gameId: bigint) {
  log(`Playing game ${gameId}...`);

  while (true) {
    const state = await readGameState(gameId);

    if (state.phase === 2) {
      const won = state.winner.toLowerCase() === MY_ADDRESS.toLowerCase();
      await notifyResult(gameId, won, state.prizePool);
      return;
    }

    if (state.phase !== 1) { await sleep(POLL_MS); continue; }
    if (state.currentTurn.toLowerCase() !== MY_ADDRESS.toLowerCase()) { await sleep(POLL_MS); continue; }

    log(`MY TURN | HP: ${state.myHp} | Shells: ${state.shellsRemaining} (${state.liveRemaining}L/${state.blankRemaining}B) | Items: [${state.myItems.map((i) => ITEM_NAMES[i]).join(", ")}]`);

    const actions = await chooseAction(state);
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
  log(`Buy-in: ${formatEther(BUY_IN)} MON | Players: ${PLAYER_COUNT} | Auto-rejoin: ${AUTO_REJOIN}`);
  if (LLM_API_KEY) log(`LLM: ${LLM_MODEL} via ${LLM_API_URL}`);
  else log("No LLM_API_KEY — using deterministic fallback strategy");

  await ensureProfile();

  do {
    try {
      const gameId = await joinAndStartGame();
      await waitForActivation(gameId);
      await playGame(gameId);
      if (AUTO_REJOIN) {
        log("Looking for next game in 5s...");
        await sleep(5000);
      }
    } catch (e: any) {
      log("Error:", e.message?.slice(0, 200));
      if (AUTO_REJOIN) { log("Retrying in 5s..."); await sleep(5000); }
    }
  } while (AUTO_REJOIN);

  log("Game finished. Auto-rejoin is off, exiting.");
}

main().catch((e) => { console.error("Fatal:", e); process.exit(1); });
