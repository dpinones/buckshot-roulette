import { createAgents } from './agents/agent-manager.js'
import { GameWatcher } from './watcher/game-watcher.js'
import { ensureAllReady, watchQueueAndPlay } from './coordinator/matchmaker.js'
import { checkAndForceTimeout } from './coordinator/timeout-enforcer.js'
import { config } from './config.js'
import { log } from './logger.js'

const BETWEEN_GAMES_MS = 5_000

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function main() {
  log.system('=== Buckshot Roulette AI Agents ===')
  log.system(`RPC: ${config.rpcUrl}`)
  log.system(`Buy-in: ${config.buyIn} wei`)

  // 1. Initialize agents
  const agents = createAgents()
  log.system(`Initialized ${agents.length} agents:`)
  for (const agent of agents) {
    log.info(agent.name, `${agent.address} (${agent.llmProvider.name})`)
  }

  // 2. One-time check: balance & profiles
  const ready = await ensureAllReady(agents)
  if (!ready) {
    log.error('Main', 'Not all agents are ready. Exiting.')
    process.exit(1)
  }

  const watcher = new GameWatcher(agents)

  // 3. Main loop: watch queue → agents join → play → repeat
  while (true) {
    try {
      if (process.env.PAUSED?.toLowerCase() === 'true' || config.paused) {
        log.system('Agents PAUSED. Set PAUSED=false to resume.')
        await sleep(BETWEEN_GAMES_MS)
        continue
      }

      // Watch queue, agents join when external player detected, start game
      const gameId = await watchQueueAndPlay(agents)

      if (gameId === null) {
        log.warn('Main', 'Failed to create match, retrying...')
        await sleep(BETWEEN_GAMES_MS)
        continue
      }

      // Watch the game until it finishes
      watcher.setGameId(gameId)
      watcher.start()

      let tickCount = 0
      while (watcher.getGameId() !== null) {
        tickCount++
        if (tickCount % 3 === 0) {
          const gid = watcher.getGameId()
          if (gid !== null) {
            await checkAndForceTimeout(gid)
          }
        }
        await sleep(config.pollIntervalMs)
      }

      watcher.stop()
      log.game('Game finished! Watching queue again...')
      await sleep(BETWEEN_GAMES_MS)

    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      log.error('Main', `Loop error: ${msg}`)
      await sleep(BETWEEN_GAMES_MS)
    }
  }
}

main().catch((e) => {
  console.error('Fatal error:', e)
  process.exit(1)
})
