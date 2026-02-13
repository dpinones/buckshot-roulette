import { useState, useEffect, useCallback, useRef } from 'react'
import { type Address, formatEther } from 'viem'
import { ADDRESSES, buckshotGameEventAbi, playerProfileAbi } from '../config/contracts'
import { client } from './useGameState'
import { getCharacter } from '../config/characters'
import { type MessageSegment } from './useEventLog'

const FRIENDLY_ITEM_NAMES: Record<number, string> = {
  1: 'Magnifying Glass',
  2: 'Beer',
  3: 'Handsaw',
  4: 'Cigarettes',
  5: 'Handcuffs',
  6: 'Inverter',
}

export interface ReplayEvent {
  id: number
  type: 'game_created' | 'round_start' | 'shells_loaded' | 'turn' | 'shot' | 'item' | 'shell_ejected' | 'eliminated' | 'round_end' | 'game_end'
  message: string
  segments: MessageSegment[]
  icon: string
  // State snapshot after this event
  state: ReplayState
}

export interface ReplayState {
  players: Address[]
  hp: Record<string, number>
  maxHp: number
  alive: Record<string, boolean>
  currentRound: number
  currentTurn: Address | null
  liveShells: number
  blankShells: number
  winner: Address | null
  prize: string
}

function label(addr: Address, players: Address[], nameMap: Record<string, string>): string {
  const name = nameMap[addr.toLowerCase()]
  if (name) return getCharacter(name).name
  const idx = players.findIndex((p) => p.toLowerCase() === addr.toLowerCase())
  return idx >= 0 ? getCharacter('').name : `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

function playerSeg(addr: Address, players: Address[], nameMap: Record<string, string>): MessageSegment {
  const name = nameMap[addr.toLowerCase()]
  const char = getCharacter(name || '')
  const idx = players.findIndex((p) => p.toLowerCase() === addr.toLowerCase())
  if (idx >= 0) {
    return { text: char.name, color: 'bold' }
  }
  return { text: `${addr.slice(0, 6)}...${addr.slice(-4)}` }
}

function seg(text: string): MessageSegment {
  return { text }
}

function cloneState(s: ReplayState): ReplayState {
  return {
    ...s,
    hp: { ...s.hp },
    alive: { ...s.alive },
  }
}

export function useGameReplay(gameId: bigint) {
  const [events, setEvents] = useState<ReplayEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1500)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Fetch and parse all events
  useEffect(() => {
    let active = true

    async function fetchEvents() {
      try {
        const logs = await client.getContractEvents({
          address: ADDRESSES.buckshotGame,
          abi: buckshotGameEventAbi,
          fromBlock: 0n,
          toBlock: 'latest',
        })

        if (!active) return

        // Filter to this gameId and sort by block + logIndex
        const gameLogs = logs
          .filter((log) => log.args && 'gameId' in log.args && log.args.gameId === gameId)
          .sort((a, b) => {
            if (a.blockNumber !== b.blockNumber) return Number(a.blockNumber! - b.blockNumber!)
            return a.logIndex! - b.logIndex!
          })

        // Fetch player names for character resolution
        const playerAddrs: Address[] = []
        for (const log of gameLogs) {
          if (log.eventName === 'GameCreated' && log.args) {
            const ps = (log.args as Record<string, unknown>).players as Address[]
            playerAddrs.push(...ps)
            break
          }
        }
        const nameMap: Record<string, string> = {}
        await Promise.all(
          playerAddrs.map(async (addr) => {
            try {
              const n = await client.readContract({
                address: ADDRESSES.playerProfile,
                abi: playerProfileAbi,
                functionName: 'getName',
                args: [addr],
              })
              nameMap[addr.toLowerCase()] = n as string
            } catch { /* ignore */ }
          })
        )

        // Build replay events with state reconstruction
        let state: ReplayState = {
          players: [],
          hp: {},
          maxHp: 3,
          alive: {},
          currentRound: 0,
          currentTurn: null,
          liveShells: 0,
          blankShells: 0,
          winner: null,
          prize: '0',
        }

        const replayEvents: ReplayEvent[] = []
        let nextId = 0

        for (const log of gameLogs) {
          const name = log.eventName
          const args = log.args as Record<string, unknown>
          state = cloneState(state)

          if (name === 'GameCreated') {
            const players = args.players as Address[]
            state.players = players
            for (const p of players) {
              state.hp[p.toLowerCase()] = 3
              state.alive[p.toLowerCase()] = true
            }
            const buyIn = formatEther(args.buyIn as bigint)
            replayEvents.push({
              id: nextId++,
              type: 'game_created',
              message: `Game created with ${players.length} players (${buyIn} MON buy-in)`,
              segments: [seg(`Game created with ${players.length} players (${buyIn} MON buy-in)`)],
              icon: '\u{1F3AE}',
              state: cloneState(state),
            })
          } else if (name === 'RoundStarted') {
            const round = Number(args.round)
            state.currentRound = round
            state.maxHp = 3
            replayEvents.push({
              id: nextId++,
              type: 'round_start',
              message: `Round ${round} started`,
              segments: [seg(`Round ${round} started`)],
              icon: '\u{1F3AF}',
              state: cloneState(state),
            })
          } else if (name === 'ShellsLoaded') {
            state.liveShells = Number(args.liveCount)
            state.blankShells = Number(args.blankCount)
            replayEvents.push({
              id: nextId++,
              type: 'shells_loaded',
              message: `Shells loaded: ${state.liveShells} live, ${state.blankShells} blank`,
              segments: [seg(`Shells loaded: ${state.liveShells} live, ${state.blankShells} blank`)],
              icon: '\u{1F4A3}',
              state: cloneState(state),
            })
          } else if (name === 'TurnStarted') {
            const player = args.player as Address
            state.currentTurn = player
            const pSeg = playerSeg(player, state.players, nameMap)
            replayEvents.push({
              id: nextId++,
              type: 'turn',
              message: `${label(player, state.players, nameMap)}'s turn`,
              segments: [pSeg, seg("'s turn")],
              icon: '\u{25B6}',
              state: cloneState(state),
            })
          } else if (name === 'ShotFired') {
            const shooter = args.shooter as Address
            const target = args.target as Address
            const wasLive = args.wasLive as boolean
            const damage = Number(args.damage)
            const isSelf = shooter.toLowerCase() === target.toLowerCase()

            // Update shells
            if (wasLive) {
              state.liveShells = Math.max(0, state.liveShells - 1)
            } else {
              state.blankShells = Math.max(0, state.blankShells - 1)
            }

            // Apply damage
            if (wasLive && damage > 0) {
              const key = target.toLowerCase()
              state.hp[key] = Math.max(0, (state.hp[key] ?? 0) - damage)
            }

            const shooterS = playerSeg(shooter, state.players, nameMap)
            const targetS = playerSeg(target, state.players, nameMap)

            if (wasLive) {
              const dmgStr = damage > 1 ? ` (${damage} damage!)` : ''
              if (isSelf) {
                replayEvents.push({
                  id: nextId++,
                  type: 'shot',
                  message: `${label(shooter, state.players, nameMap)} shot SELF \u2014 BANG!${dmgStr}`,
                  segments: [shooterS, seg(` shot themselves \u2014 BANG!${dmgStr}`)],
                  icon: '\u{1F4A5}',
                  state: cloneState(state),
                })
              } else {
                replayEvents.push({
                  id: nextId++,
                  type: 'shot',
                  message: `${label(shooter, state.players, nameMap)} shot ${label(target, state.players, nameMap)} \u2014 BANG!${dmgStr}`,
                  segments: [shooterS, seg(' shot '), targetS, seg(` \u2014 BANG!${dmgStr}`)],
                  icon: '\u{1F4A5}',
                  state: cloneState(state),
                })
              }
            } else {
              if (isSelf) {
                replayEvents.push({
                  id: nextId++,
                  type: 'shot',
                  message: `${label(shooter, state.players, nameMap)} shot SELF \u2014 *click* blank (extra turn!)`,
                  segments: [shooterS, seg(' shot themselves \u2014 *click* blank, extra turn!')],
                  icon: '\u{1F389}',
                  state: cloneState(state),
                })
              } else {
                replayEvents.push({
                  id: nextId++,
                  type: 'shot',
                  message: `${label(shooter, state.players, nameMap)} shot ${label(target, state.players, nameMap)} \u2014 *click* blank`,
                  segments: [shooterS, seg(' shot '), targetS, seg(' \u2014 *click* blank')],
                  icon: '\u{2B55}',
                  state: cloneState(state),
                })
              }
            }
          } else if (name === 'ItemUsed') {
            const player = args.player as Address
            const itemType = Number(args.itemType)
            const itemName = FRIENDLY_ITEM_NAMES[itemType] ?? `Item #${itemType}`

            // Handle cigarettes HP recovery
            if (itemType === 4) {
              const key = player.toLowerCase()
              const curHp = state.hp[key] ?? 0
              if (curHp < state.maxHp) {
                state.hp[key] = curHp + 1
              }
            }

            const pSeg = playerSeg(player, state.players, nameMap)
            replayEvents.push({
              id: nextId++,
              type: 'item',
              message: `${label(player, state.players, nameMap)} used ${itemName}`,
              segments: [pSeg, seg(` used ${itemName}`)],
              icon: '\u{1F9F0}',
              state: cloneState(state),
            })
          } else if (name === 'ShellEjected') {
            const wasLive = args.wasLive as boolean
            if (wasLive) {
              state.liveShells = Math.max(0, state.liveShells - 1)
            } else {
              state.blankShells = Math.max(0, state.blankShells - 1)
            }
            replayEvents.push({
              id: nextId++,
              type: 'shell_ejected',
              message: `Shell ejected: ${wasLive ? 'LIVE' : 'blank'}`,
              segments: [seg(`Shell ejected: ${wasLive ? 'LIVE' : 'blank'}`)],
              icon: '\u{1F37A}',
              state: cloneState(state),
            })
          } else if (name === 'PlayerEliminated') {
            const player = args.player as Address
            state.alive[player.toLowerCase()] = false
            state.hp[player.toLowerCase()] = 0
            const pSeg = playerSeg(player, state.players, nameMap)
            replayEvents.push({
              id: nextId++,
              type: 'eliminated',
              message: `${label(player, state.players, nameMap)} ELIMINATED`,
              segments: [pSeg, seg(' ELIMINATED')],
              icon: '\u{1F480}',
              state: cloneState(state),
            })
          } else if (name === 'RoundEnded') {
            const round = Number(args.round)
            replayEvents.push({
              id: nextId++,
              type: 'round_end',
              message: `Round ${round} ended`,
              segments: [seg(`Round ${round} ended`)],
              icon: '\u{1F3C1}',
              state: cloneState(state),
            })
          } else if (name === 'GameEnded') {
            const winner = args.winner as Address
            const prize = formatEther(args.prize as bigint)
            state.winner = winner
            state.prize = prize
            state.currentTurn = null
            const winnerS = playerSeg(winner, state.players, nameMap)
            replayEvents.push({
              id: nextId++,
              type: 'game_end',
              message: `GAME OVER! ${label(winner, state.players, nameMap)} wins! Prize: ${prize} MON`,
              segments: [seg('GAME OVER! '), winnerS, seg(` wins! Prize: ${prize} MON`)],
              icon: '\u{1F3C6}',
              state: cloneState(state),
            })
          }
        }

        setEvents(replayEvents)
        setStep(0)
        setLoading(false)
      } catch (e) {
        if (!active) return
        setError(e instanceof Error ? e.message : 'Failed to fetch replay')
        setLoading(false)
      }
    }

    fetchEvents()
    return () => { active = false }
  }, [gameId])

  // Auto-play timer
  useEffect(() => {
    if (playing && step < events.length - 1) {
      timerRef.current = setTimeout(() => {
        setStep((s) => s + 1)
      }, speed)
      return () => {
        if (timerRef.current) clearTimeout(timerRef.current)
      }
    } else if (step >= events.length - 1) {
      setPlaying(false)
    }
  }, [playing, step, events.length, speed])

  const play = useCallback(() => setPlaying(true), [])
  const pause = useCallback(() => setPlaying(false), [])
  const next = useCallback(() => {
    setPlaying(false)
    setStep((s) => Math.min(s + 1, events.length - 1))
  }, [events.length])
  const prev = useCallback(() => {
    setPlaying(false)
    setStep((s) => Math.max(s - 1, 0))
  }, [])
  const goTo = useCallback((i: number) => {
    setPlaying(false)
    setStep(i)
  }, [])
  const restart = useCallback(() => {
    setStep(0)
    setPlaying(true)
  }, [])

  const currentState = events[step]?.state ?? null
  const currentEvent = events[step] ?? null

  return {
    events,
    step,
    currentState,
    currentEvent,
    loading,
    error,
    playing,
    speed,
    setSpeed,
    play,
    pause,
    next,
    prev,
    goTo,
    restart,
  }
}
