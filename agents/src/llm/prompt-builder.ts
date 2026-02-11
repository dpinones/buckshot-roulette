import { type ReadableGameState } from '../strategy/game-state.js'
import { ITEM_NAMES } from '../strategy/action-types.js'

const GAME_RULES = `
# Buckshot Roulette - Game Rules

You are playing a multiplayer on-chain game of Buckshot Roulette.

## Core Mechanics
- All players start with 3 HP. HP persists across rounds (no reset). Max HP is always 3.
- Rounds continue infinitely until only 1 player remains alive.
- Each round loads exactly 6 shells (random split of live/blank, at least 1 of each).
- A shotgun is loaded with a mix of LIVE and BLANK shells. You can see how many of each remain but not the order.
- On your turn: use items (optional), then SHOOT (mandatory). You must end your turn with a shot.
- Shooting an opponent with a LIVE shell deals 1 damage (2 with handsaw active).
- Shooting YOURSELF with a BLANK shell gives you an EXTRA TURN.
- Shooting yourself with a LIVE shell deals 1 damage to you (2 with handsaw).
- When a player reaches 0 HP, they are eliminated.
- Last player standing wins the prize pool.

## Items (2 random items given at game start)
- MAGNIFYING_GLASS (1): Peek at the current shell (live or blank). Knowledge resets after the shell is used.
- BEER (2): Eject the current shell (discards it). A new shell becomes current.
- HANDSAW (3): Double damage for your NEXT shot only. Effect resets after shooting.
- CIGARETTES (4): Heal +1 HP (cannot exceed 3).

## Strategy Tips

### Shell Probability
- You can see how many LIVE and BLANK shells remain. Use this to calculate probability.
- Example: 4 live + 2 blank remaining = 66.7% chance current shell is live.
- After each shot or BEER eject, remaining counts update — recalculate every turn.
- If ALL remaining shells are live, do NOT shoot self. If ALL are blank, shoot self for free extra turn.

### Self-Shot Strategy
- Shooting yourself with a BLANK shell gives an EXTRA TURN — this is extremely powerful.
- Best combo: MAGNIFYING_GLASS → see blank → shoot self → extra turn → HANDSAW → shoot opponent for 2 damage.
- Without glass: if blank probability >= 70%, self-shot is a strong gamble for extra turn.
- NEVER self-shot when all remaining shells are live.

### Item Scarcity
- Items are given ONCE at the start of the game and never replenished.
- Every item use is permanent — use items at the moment of maximum value.
- MAGNIFYING_GLASS is the most valuable item (enables self-shot combos and informed decisions).
- HANDSAW should only be used when you are confident the shell is live (confirmed or high probability).

## Response Format
Respond with ONLY valid JSON (no markdown, no explanation outside JSON):
{
  "thinking": "Your strategic reasoning in character (1-2 sentences)",
  "actions": [
    { "type": "useItem", "itemIndex": 0 },
    { "type": "shootOpponent", "target": "0x..." }
  ]
}

Action types:
- { "type": "useItem", "itemIndex": <number> } — Use item at this index in your items array
- { "type": "shootOpponent", "target": "<address>" } — Shoot an alive opponent
- { "type": "shootSelf" } — Shoot yourself (good if shell is blank)

IMPORTANT: Your actions MUST end with exactly one shoot action (shootOpponent or shootSelf).
You can use 0-3 items before shooting.
`

export function buildSystemPrompt(personality: string): string {
  return `${personality}\n\n${GAME_RULES}`
}

export function buildUserPrompt(state: ReadableGameState): string {
  const playerList = state.players
    .map((p, i) => {
      const isMe = i === state.myIndex ? ' (YOU)' : ''
      const status = p.alive ? `HP=${p.hp}` : 'DEAD'
      const items = p.items.filter((it) => it !== 0).map((it) => ITEM_NAMES[it]).join(', ')
      return `  ${i}. ${p.address}${isMe} — ${status}${items ? ` — Items: [${items}]` : ''}`
    })
    .join('\n')

  const aliveOpponents = state.opponents
    .filter((o) => o.alive)
    .map((o) => `  - ${o.address} (HP=${o.hp})`)
    .join('\n')

  const myItems = state.myItems
    .map((item, idx) => (item !== 0 ? `  [${idx}] ${ITEM_NAMES[item]}` : null))
    .filter(Boolean)
    .join('\n')

  let shellInfo = `Shells remaining: ${state.shellsRemaining} (${state.liveRemaining} live, ${state.blankRemaining} blank)`
  shellInfo += `\nProbability of LIVE shell: ${(state.liveProbability * 100).toFixed(1)}%`

  if (state.shellKnown) {
    shellInfo += `\nYou KNOW the current shell is: ${state.knownShellIsLive ? 'LIVE' : 'BLANK'}`
  }

  if (state.sawActive) {
    shellInfo += `\nHANDSAW is ACTIVE — your next shot deals DOUBLE damage!`
  }

  // Tactical hint based on probability
  let tacticalHint = ''
  if (state.blankRemaining === 0 && state.shellsRemaining > 0) {
    tacticalHint = '\n\n⚠️ TACTICAL NOTE: ALL remaining shells are LIVE — do NOT shoot self!'
  } else if (state.liveRemaining === 0 && state.shellsRemaining > 0) {
    tacticalHint = '\n\n⚠️ TACTICAL NOTE: ALL remaining shells are BLANK — shoot self for guaranteed extra turn!'
  } else if (state.liveProbability >= 0.7) {
    tacticalHint = `\n\n⚠️ TACTICAL NOTE: HIGH live probability (${(state.liveProbability * 100).toFixed(0)}%) — self-shot is RISKY.`
  } else if (state.liveProbability <= 0.3) {
    tacticalHint = `\n\n⚠️ TACTICAL NOTE: LOW live probability (${(state.liveProbability * 100).toFixed(0)}%) — self-shot for extra turn is relatively safe.`
  }

  return `# Current Game State

Round: ${state.currentRound}
It is YOUR TURN.

## Players
${playerList}

## Your Status
- HP: ${state.myHp}
- Your items:
${myItems || '  (none)'}

## Shell Info
${shellInfo}

## Alive Opponents (valid shoot targets)
${aliveOpponents}
${tacticalHint}
Choose your actions wisely. Respond with JSON only.`
}
