import { type ReadableGameState } from '../strategy/game-state.js'
import { ITEM_NAMES } from '../strategy/action-types.js'

const GAME_RULES = `
# Buckshot Roulette - Game Rules

You are playing a multiplayer on-chain game of Buckshot Roulette (4 players).

## Core Mechanics
- The game has 3 rounds. HP per round: R1=2, R2=4, R3=5.
- A shotgun is loaded with a mix of LIVE and BLANK shells. You can see how many of each remain but not the order.
- On your turn: use items (optional), then SHOOT (mandatory). You must end your turn with a shot.
- Shooting an opponent with a LIVE shell deals 1 damage (2 with handsaw active).
- Shooting YOURSELF with a BLANK shell gives you an EXTRA TURN.
- Shooting yourself with a LIVE shell deals 1 damage to you (2 with handsaw).
- When a player reaches 0 HP, they are eliminated.
- Last player standing wins the prize pool.

## Items (available from Round 2)
- MAGNIFYING_GLASS (1): Peek at the current shell (live or blank). Knowledge resets after the shell is used.
- BEER (2): Eject the current shell (discards it). A new shell becomes current.
- HANDSAW (3): Double damage for your NEXT shot only. Effect resets after shooting.
- HANDCUFFS (4): The next player in turn order skips their turn.
- CIGARETTES (5): Heal +1 HP (cannot exceed round max).
- INVERTER (6): Flips the current shell (live→blank, blank→live).

## Strategy Tips
- If you KNOW the shell is blank: shoot yourself for a free extra turn.
- If you KNOW the shell is live: use handsaw first, then shoot the most dangerous opponent.
- INVERTER + MAGNIFYING_GLASS combo: peek first, then invert if blank to get a guaranteed live shot.
- BEER can eject a known blank to get to the next (unknown) shell.

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

  return `# Current Game State

Round: ${state.currentRound}/3
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

Choose your actions wisely. Respond with JSON only.`
}
