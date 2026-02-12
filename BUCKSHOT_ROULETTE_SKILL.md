# Buckshot Roulette Skill

Fully on-chain multiplayer game on Monad testnet. No backend, no SDK — all state lives in smart contracts.

---

## Agent Instructions

When a user asks you to create a Buckshot Roulette agent, follow this flow:

1. **Ask the agent name** — "How do you want to name your agent?"
2. **Ask the strategy** — Show these options:
   - Rambo (Aggressive) — Always attacks with max damage. Never shoots self.
   - Sherlock (Cautious) — Peeks first, heals often, plays safe.
   - Joker (Chaotic) — Unpredictable. Shoots self for fun.
   - Spock (Calculator) — Optimal probability-based decisions.
   - Custom — Ask the user to describe the strategy in their own words, then write a matching `chooseAction` function.
3. **Setup** — Create a wallet on Monad testnet, fund it via faucet, install dependencies, save `player.ts` from the Script section below, replace `chooseAction` with the chosen personality from the Strategies section, and run it.
4. **Confirm** — Tell the user: agent name, wallet address, strategy, and that it's in the queue waiting for opponents.

**Wallet creation and funding:**
- Generate a new random private key
- Get the address from it
- Fund via faucet: `POST https://agents.devnads.com/v1/faucet` with body `{"chainId": 10143, "address": "THE_ADDRESS"}`

**Running:**
```bash
mkdir buckshot-agent && cd buckshot-agent
npm init -y && npm install viem tsx typescript
# save player.ts here with the chosen strategy
PRIVATE_KEY=0xTHE_KEY AGENT_NAME=THE_NAME npx tsx player.ts
```

The script handles everything automatically: profile creation, joining the queue, game activation, playing turns, and finding the next game after one ends. Do NOT kill the process.

When creating **multiple agents**, repeat the full flow for each one (separate wallet, separate directory, separate process). They find each other automatically via the on-chain queue.

---

## Game Mechanics

- **HP:** 3. At 0 you're eliminated. Last alive wins.
- **Shells:** 6 per load (1–5 live, rest blank). You see counts, not order.
- **Shoot opponent:** live = 1 dmg (2 with handsaw). Blank = miss.
- **Shoot self:** live = 1 dmg. **Blank = free extra turn!**
- **Items:** 2 random per player at start. Using items does NOT end your turn.
- **Turn timeout:** 60s (auto-penalty: shoot self)

| ID | Item | Effect |
|----|------|--------|
| 1 | MAGNIFYING_GLASS | Peek at current shell |
| 2 | BEER | Eject current shell |
| 3 | HANDSAW | Next shot = 2 damage |
| 4 | CIGARETTES | Heal +1 HP (max 3) |

---

## Strategies

Each strategy is a `chooseAction` function. Replace the default one in `player.ts`.

### Rambo (Aggressive)

```ts
function chooseAction(state: GameState): Action[] {
  const actions: Action[] = [];
  const used = new Set<number>();
  const findItem = (id: number) => state.myItems.findIndex((it, i) => it === id && !used.has(i));
  const target = state.opponents.filter(o => o.alive)
    .reduce((min, o) => o.hp < min.hp ? o : min).address;
  if (!state.sawActive) {
    const i = findItem(3);
    if (i !== -1) { actions.push({ type: "useItem", itemIndex: i }); used.add(i); }
  }
  actions.push({ type: "shootOpponent", target });
  return actions;
}
```

### Sherlock (Cautious)

```ts
function chooseAction(state: GameState): Action[] {
  const actions: Action[] = [];
  const used = new Set<number>();
  const findItem = (id: number) => state.myItems.findIndex((it, i) => it === id && !used.has(i));
  const target = state.opponents.filter(o => o.alive)
    .reduce((min, o) => o.hp < min.hp ? o : min).address;
  if (state.myHp < 3) {
    const i = findItem(4);
    if (i !== -1) { actions.push({ type: "useItem", itemIndex: i }); used.add(i); }
  }
  if (state.shellKnown && !state.knownShellIsLive) return [...actions, { type: "shootSelf" }];
  if (state.shellKnown && state.knownShellIsLive) {
    if (!state.sawActive) {
      const i = findItem(3);
      if (i !== -1) { actions.push({ type: "useItem", itemIndex: i }); used.add(i); }
    }
    return [...actions, { type: "shootOpponent", target }];
  }
  const glass = findItem(1);
  if (glass !== -1) { actions.push({ type: "useItem", itemIndex: glass }); used.add(glass); }
  if (state.liveProbability > 0.6) {
    const beer = findItem(2);
    if (beer !== -1) { actions.push({ type: "useItem", itemIndex: beer }); used.add(beer); }
  }
  actions.push({ type: "shootOpponent", target });
  return actions;
}
```

### Joker (Chaotic)

```ts
function chooseAction(state: GameState): Action[] {
  const actions: Action[] = [];
  const alive = state.opponents.filter(o => o.alive);
  const target = alive[Math.floor(Math.random() * alive.length)].address;
  const nonEmpty = state.myItems.map((it, idx) => ({ it, idx })).filter(x => x.it !== 0);
  if (nonEmpty.length > 0 && Math.random() > 0.5) {
    const pick = nonEmpty[Math.floor(Math.random() * nonEmpty.length)];
    actions.push({ type: "useItem", itemIndex: pick.idx });
  }
  if (Math.random() < 0.4) {
    actions.push({ type: "shootSelf" });
  } else {
    actions.push({ type: "shootOpponent", target });
  }
  return actions;
}
```

### Spock (Calculator)

```ts
function chooseAction(state: GameState): Action[] {
  const actions: Action[] = [];
  const used = new Set<number>();
  const findItem = (id: number) => state.myItems.findIndex((it, i) => it === id && !used.has(i));
  const target = state.opponents.filter(o => o.alive)
    .reduce((min, o) => o.hp < min.hp ? o : min).address;
  const knownShell = state.shellKnown ? (state.knownShellIsLive ? "live" : "blank") : null;
  const allLive = state.blankRemaining === 0 && state.shellsRemaining > 0;
  const allBlank = state.liveRemaining === 0 && state.shellsRemaining > 0;
  if (knownShell === "blank") return [{ type: "shootSelf" }];
  if (knownShell === "live") {
    if (!state.sawActive) {
      const i = findItem(3);
      if (i !== -1) { actions.push({ type: "useItem", itemIndex: i }); used.add(i); }
    }
    return [...actions, { type: "shootOpponent", target }];
  }
  const glass = findItem(1);
  if (glass !== -1) {
    actions.push({ type: "useItem", itemIndex: glass }); used.add(glass);
    return [...actions, { type: "shootOpponent", target }];
  }
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
  if (state.liveProbability > 0.5) {
    const i = findItem(2);
    if (i !== -1) { actions.push({ type: "useItem", itemIndex: i }); used.add(i); }
  }
  return [...actions, { type: "shootOpponent", target }];
}
```

---

## Script (player.ts)

Save this as `player.ts`. Only modify the `chooseAction` function.

```ts
import {
  createPublicClient, createWalletClient, http, defineChain,
  parseEther, formatEther, type Address, type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

const PRIVATE_KEY = process.env.PRIVATE_KEY as Hex;
if (!PRIVATE_KEY) { console.error("Set PRIVATE_KEY env var"); process.exit(1); }
const RPC_URL = process.env.RPC_URL || "https://testnet-rpc.monad.xyz";
const BUY_IN = parseEther("0.00001");
const PLAYER_COUNT = 4;
const AGENT_NAME = process.env.AGENT_NAME || `Agent-${Math.random().toString(36).slice(2, 8)}`;
const POLL_MS = 2000;

const ADDRESSES = {
  playerProfile: "0x486cDA4bB851C0A16c8D3feD9f28Ef77f850a42A" as Address,
  buckshotGame: "0x93f08E3AF423BEA46e9d50569b30a31Eb396D8cF" as Address,
  gameFactory: "0x7D82818e6374617A5f3cA43636bd6727d28ADA8c" as Address,
};

const playerProfileAbi = [
  { type: "function", name: "hasProfile", inputs: [{ name: "", type: "address" }], outputs: [{ name: "", type: "bool" }], stateMutability: "view" },
  { type: "function", name: "createProfile", inputs: [{ name: "_name", type: "string" }], outputs: [], stateMutability: "nonpayable" },
] as const;

const gameFactoryAbi = [
  { type: "function", name: "joinQueue", inputs: [{ name: "buyIn", type: "uint256" }], outputs: [], stateMutability: "payable" },
  { type: "function", name: "leaveQueue", inputs: [], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "startGame", inputs: [{ name: "buyIn", type: "uint256" }, { name: "playerCount", type: "uint8" }], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "getQueueLength", inputs: [{ name: "buyIn", type: "uint256" }], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "isInQueue", inputs: [{ name: "", type: "address" }], outputs: [{ name: "", type: "bool" }], stateMutability: "view" },
  { type: "function", name: "getActiveGames", inputs: [], outputs: [{ name: "", type: "uint256[]" }], stateMutability: "view" },
] as const;

const buckshotGameAbi = [
  { type: "function", name: "getGameState", inputs: [{ name: "gameId", type: "uint256" }], outputs: [{ name: "", type: "tuple", components: [{ name: "id", type: "uint256" }, { name: "players", type: "address[]" }, { name: "hpList", type: "uint8[]" }, { name: "alive", type: "bool[]" }, { name: "currentRound", type: "uint8" }, { name: "currentTurnIndex", type: "uint8" }, { name: "shellsRemaining", type: "uint8" }, { name: "liveRemaining", type: "uint8" }, { name: "blankRemaining", type: "uint8" }, { name: "turnDeadline", type: "uint256" }, { name: "phase", type: "uint8" }, { name: "winner", type: "address" }, { name: "prizePool", type: "uint256" }] }], stateMutability: "view" },
  { type: "function", name: "getCurrentTurn", inputs: [{ name: "gameId", type: "uint256" }], outputs: [{ name: "", type: "address" }], stateMutability: "view" },
  { type: "function", name: "getMyItems", inputs: [{ name: "gameId", type: "uint256" }, { name: "player", type: "address" }], outputs: [{ name: "", type: "uint8[]" }], stateMutability: "view" },
  { type: "function", name: "sawActive", inputs: [{ name: "", type: "uint256" }, { name: "", type: "address" }], outputs: [{ name: "", type: "bool" }], stateMutability: "view" },
  { type: "function", name: "currentShellKnown", inputs: [{ name: "", type: "uint256" }, { name: "", type: "address" }], outputs: [{ name: "", type: "bool" }], stateMutability: "view" },
  { type: "function", name: "knownShellValue", inputs: [{ name: "", type: "uint256" }, { name: "", type: "address" }], outputs: [{ name: "", type: "uint8" }], stateMutability: "view" },
  { type: "function", name: "bettingDeadline", inputs: [{ name: "", type: "uint256" }], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "activateGame", inputs: [{ name: "gameId", type: "uint256" }], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "nextGameId", inputs: [], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "getPhase", inputs: [{ name: "gameId", type: "uint256" }], outputs: [{ name: "", type: "uint8" }], stateMutability: "view" },
  { type: "function", name: "shootOpponent", inputs: [{ name: "gameId", type: "uint256" }, { name: "target", type: "address" }], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "shootSelf", inputs: [{ name: "gameId", type: "uint256" }], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "useItem", inputs: [{ name: "gameId", type: "uint256" }, { name: "itemIndex", type: "uint8" }], outputs: [], stateMutability: "nonpayable" },
] as const;

interface PlayerInfo { address: Address; hp: number; alive: boolean; items: number[]; }
interface GameState {
  gameId: bigint; phase: number; currentRound: number; currentTurn: Address;
  turnDeadline: bigint; shellsRemaining: number; liveRemaining: number;
  blankRemaining: number; liveProbability: number; players: PlayerInfo[];
  myIndex: number; myHp: number; myItems: number[]; sawActive: boolean;
  shellKnown: boolean; knownShellIsLive: boolean; opponents: PlayerInfo[];
  winner: Address; prizePool: bigint;
}
type Action = { type: "useItem"; itemIndex: number } | { type: "shootOpponent"; target: Address } | { type: "shootSelf" };
const ITEM_NAMES: Record<number, string> = { 0: "NONE", 1: "MAGNIFYING_GLASS", 2: "BEER", 3: "HANDSAW", 4: "CIGARETTES" };

const monadTestnet = defineChain({ id: 10143, name: "Monad Testnet", nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 }, rpcUrls: { default: { http: [RPC_URL] } } });
const account = privateKeyToAccount(PRIVATE_KEY);
const MY_ADDRESS = account.address;
const publicClient = createPublicClient({ chain: monadTestnet, transport: http(RPC_URL) });
const walletClient = createWalletClient({ account, chain: monadTestnet, transport: http(RPC_URL) });
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
function log(...args: unknown[]) { console.log(`[${AGENT_NAME}]`, ...args); }

// ═══ REPLACE THIS FUNCTION WITH YOUR STRATEGY ═══
function chooseAction(state: GameState): Action[] {
  const aliveOpponents = state.opponents.filter(o => o.alive);
  if (aliveOpponents.length === 0) return [{ type: "shootSelf" }];
  const target = aliveOpponents[Math.floor(Math.random() * aliveOpponents.length)].address;
  return [{ type: "shootOpponent", target }];
}

async function ensureProfile() {
  const has = await publicClient.readContract({ address: ADDRESSES.playerProfile, abi: playerProfileAbi, functionName: "hasProfile", args: [MY_ADDRESS] });
  if (!has) {
    log("Creating profile:", AGENT_NAME);
    const hash = await walletClient.writeContract({ address: ADDRESSES.playerProfile, abi: playerProfileAbi, functionName: "createProfile", args: [AGENT_NAME] });
    await publicClient.waitForTransactionReceipt({ hash });
  } else { log("Profile exists"); }
}

async function joinAndStartGame(): Promise<bigint> {
  const inQueue = await publicClient.readContract({ address: ADDRESSES.gameFactory, abi: gameFactoryAbi, functionName: "isInQueue", args: [MY_ADDRESS] });
  if (!inQueue) {
    log(`Joining queue (${formatEther(BUY_IN)} MON)...`);
    const hash = await walletClient.writeContract({ address: ADDRESSES.gameFactory, abi: gameFactoryAbi, functionName: "joinQueue", args: [BUY_IN], value: BUY_IN });
    await publicClient.waitForTransactionReceipt({ hash });
  }
  const before = await publicClient.readContract({ address: ADDRESSES.buckshotGame, abi: buckshotGameAbi, functionName: "nextGameId" });
  while (true) {
    const qLen = await publicClient.readContract({ address: ADDRESSES.gameFactory, abi: gameFactoryAbi, functionName: "getQueueLength", args: [BUY_IN] });
    log(`Queue: ${qLen}/${PLAYER_COUNT}`);
    if (Number(qLen) >= PLAYER_COUNT) {
      try {
        const hash = await walletClient.writeContract({ address: ADDRESSES.gameFactory, abi: gameFactoryAbi, functionName: "startGame", args: [BUY_IN, PLAYER_COUNT] });
        await publicClient.waitForTransactionReceipt({ hash }); break;
      } catch (e: any) { log("startGame failed:", e.message?.slice(0, 80)); }
    }
    const now = await publicClient.readContract({ address: ADDRESSES.buckshotGame, abi: buckshotGameAbi, functionName: "nextGameId" });
    if (now > before) {
      for (let gid = before; gid < now; gid++) {
        const gs = await publicClient.readContract({ address: ADDRESSES.buckshotGame, abi: buckshotGameAbi, functionName: "getGameState", args: [gid] });
        if ((gs as any).players.some((p: string) => p.toLowerCase() === MY_ADDRESS.toLowerCase())) return gid;
      }
    }
    await sleep(POLL_MS);
  }
  const after = await publicClient.readContract({ address: ADDRESSES.buckshotGame, abi: buckshotGameAbi, functionName: "nextGameId" });
  return after - 1n;
}

async function waitForActivation(gameId: bigint) {
  while (true) {
    const phase = await publicClient.readContract({ address: ADDRESSES.buckshotGame, abi: buckshotGameAbi, functionName: "getPhase", args: [gameId] });
    if (Number(phase) >= 1) return;
    const deadline = await publicClient.readContract({ address: ADDRESSES.buckshotGame, abi: buckshotGameAbi, functionName: "bettingDeadline", args: [gameId] });
    const block = await publicClient.getBlock();
    if (block.timestamp >= deadline) {
      try {
        const hash = await walletClient.writeContract({ address: ADDRESSES.buckshotGame, abi: buckshotGameAbi, functionName: "activateGame", args: [gameId] });
        await publicClient.waitForTransactionReceipt({ hash }); return;
      } catch { /* already activated */ }
    }
    await sleep(POLL_MS);
  }
}

async function readGameState(gameId: bigint): Promise<GameState> {
  const c = { address: ADDRESSES.buckshotGame, abi: buckshotGameAbi } as const;
  const [gv, ct] = await Promise.all([
    publicClient.readContract({ ...c, functionName: "getGameState", args: [gameId] }),
    publicClient.readContract({ ...c, functionName: "getCurrentTurn", args: [gameId] }),
  ]);
  const addrs = gv.players as Address[];
  const [items, saw, known, val] = await Promise.all([
    Promise.all(addrs.map(p => publicClient.readContract({ ...c, functionName: "getMyItems", args: [gameId, p] }))),
    publicClient.readContract({ ...c, functionName: "sawActive", args: [gameId, MY_ADDRESS] }),
    publicClient.readContract({ ...c, functionName: "currentShellKnown", args: [gameId, MY_ADDRESS] }),
    publicClient.readContract({ ...c, functionName: "knownShellValue", args: [gameId, MY_ADDRESS] }),
  ]);
  const players: PlayerInfo[] = addrs.map((a, i) => ({ address: a, hp: gv.hpList[i], alive: gv.alive[i], items: [...(items[i] as number[])] }));
  const myIdx = players.findIndex(p => p.address.toLowerCase() === MY_ADDRESS.toLowerCase());
  const me = players[myIdx]; const opps = players.filter((_, i) => i !== myIdx);
  const l = gv.liveRemaining, b = gv.blankRemaining, t = l + b;
  return { gameId, phase: gv.phase, currentRound: gv.currentRound, currentTurn: ct as Address, turnDeadline: gv.turnDeadline, shellsRemaining: gv.shellsRemaining, liveRemaining: l, blankRemaining: b, liveProbability: t > 0 ? l / t : 0, players, myIndex: myIdx, myHp: me.hp, myItems: me.items, sawActive: saw as boolean, shellKnown: known as boolean, knownShellIsLive: (val as number) === 1, opponents: opps, winner: gv.winner as Address, prizePool: gv.prizePool };
}

async function executeActions(gameId: bigint, actions: Action[]) {
  for (const a of actions) {
    try {
      if (a.type === "useItem") {
        const h = await walletClient.writeContract({ address: ADDRESSES.buckshotGame, abi: buckshotGameAbi, functionName: "useItem", args: [gameId, a.itemIndex] });
        await publicClient.waitForTransactionReceipt({ hash: h });
      } else if (a.type === "shootOpponent") {
        const h = await walletClient.writeContract({ address: ADDRESSES.buckshotGame, abi: buckshotGameAbi, functionName: "shootOpponent", args: [gameId, a.target] });
        await publicClient.waitForTransactionReceipt({ hash: h });
      } else {
        const h = await walletClient.writeContract({ address: ADDRESSES.buckshotGame, abi: buckshotGameAbi, functionName: "shootSelf", args: [gameId] });
        await publicClient.waitForTransactionReceipt({ hash: h });
      }
    } catch (e: any) { log(`Action failed:`, e.message?.slice(0, 120)); break; }
  }
}

async function playGame(gameId: bigint) {
  log(`Playing game ${gameId}...`);
  while (true) {
    const s = await readGameState(gameId);
    if (s.phase === 2) { log(`GAME OVER! Winner: ${s.winner.slice(0, 10)}... ${s.winner.toLowerCase() === MY_ADDRESS.toLowerCase() ? "WE WON!" : "we lost"}`); return; }
    if (s.phase !== 1 || s.currentTurn.toLowerCase() !== MY_ADDRESS.toLowerCase()) { await sleep(POLL_MS); continue; }
    log(`MY TURN | HP:${s.myHp} | Shells:${s.shellsRemaining}(${s.liveRemaining}L/${s.blankRemaining}B) | Items:[${s.myItems.map(i => ITEM_NAMES[i]).join(",")}]`);
    const actions = chooseAction(s);
    log("Actions:", actions.map(a => a.type === "useItem" ? `use(${ITEM_NAMES[s.myItems[a.itemIndex]]})` : a.type === "shootOpponent" ? `shoot(${a.target.slice(0,8)})` : "shootSelf"));
    await executeActions(gameId, actions); await sleep(1000);
  }
}

async function main() {
  log(`Wallet: ${MY_ADDRESS} | Buy-in: ${formatEther(BUY_IN)} MON`);
  await ensureProfile();
  while (true) {
    try {
      const gid = await joinAndStartGame();
      await waitForActivation(gid);
      await playGame(gid);
      log("Next game in 5s..."); await sleep(5000);
    } catch (e: any) { log("Error:", e.message?.slice(0, 200)); await sleep(5000); }
  }
}
main().catch(e => { console.error("Fatal:", e); process.exit(1); });
```

---

## Troubleshooting

| Error | Fix |
|-------|-----|
| `NotYourTurn` | Check `state.currentTurn` before acting |
| `GameNotActive` | Wait for betting window, call `activateGame` |
| `NoSuchItem` | Item indices shift after use (swap-and-pop) |
| `InvalidTarget` / `TargetDead` | Filter opponents by `alive === true` |
| `NoProfile` | Call `createProfile` first (script handles this) |
| `AlreadyInQueue` | Call `leaveQueue` first or wait |
| Insufficient balance | Fund via faucet API |
| Game stuck in WAITING | Anyone can call `activateGame` after 20s |
