import { createAgents } from './agents/agent-manager.js'
import { GameWatcher } from './watcher/game-watcher.js'
import { waitAndCreateMatch } from './coordinator/matchmaker.js'
import { checkAndForceTimeout } from './coordinator/timeout-enforcer.js'
import { config } from './config.js'
import { log } from './logger.js'

const BETWEEN_GAMES_DELAY_MS = 10_000

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function main() {
  log.system('=== Buckshot Roulette AI Agents ===')
  log.system(`RPC: ${config.rpcUrl}`)
  log.system(`Buy-in: ${config.buyIn} wei`)
  log.system(`Poll interval: ${config.pollIntervalMs}ms`)

  // Initialize agents
  const agents = createAgents()
  log.system(`Initialized ${agents.length} agents:`)
  for (const agent of agents) {
    log.info(agent.name, `${agent.address} (${agent.llmProvider.name})`)
  }

  // Create game watcher
  const watcher = new GameWatcher(agents)

  // Main loop: create matches and watch games
  while (true) {
    try {
      // Check if paused (re-read env each iteration so it can be toggled live)
      if (process.env.PAUSED?.toLowerCase() === 'true' || config.paused) {
        log.system('Agents PAUSED. Set PAUSED=false to resume.')
        await sleep(BETWEEN_GAMES_DELAY_MS)
        continue
      }

      // Wait for external players and create match
      const gameId = await waitAndCreateMatch(agents)

      if (gameId === null) {
        log.warn('Main', 'Failed to create match, retrying in 10s...')
        await sleep(BETWEEN_GAMES_DELAY_MS)
        continue
      }

      // Start watching
      watcher.setGameId(gameId)
      watcher.start()

      // Wait for game to finish
      let tickCount = 0
      while (watcher.getGameId() !== null) {
        // Check for timeouts every 3rd tick to reduce RPC calls
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
      log.game('Game finished! Starting new match...')
      await sleep(BETWEEN_GAMES_DELAY_MS)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      log.error('Main', `Loop error: ${msg}`)
      await sleep(BETWEEN_GAMES_DELAY_MS)
    }
  }
}

main().catch((e) => {
  console.error('Fatal error:', e)
  process.exit(1)
})
