import { useEffect, useRef, useCallback } from 'react'
import { type Address } from 'viem'
import { getCharacter } from '../config/characters'
import { ThinkingBubble } from './ThinkingBubble'
import type { ShotAction } from './GameBoard'

interface CharacterStageProps {
  players: readonly Address[]
  alive: readonly boolean[]
  currentTurnIndex: number
  centerOverrideIdx?: number
  names: Record<string, string>
  isThinking: boolean
  shotAction: ShotAction
  damagedIdx: number | null
}

type PosClass = 'pos-center' | 'pos-left' | 'pos-right' | 'pos-off-left' | 'pos-off-right' | 'pos-hidden'

function getAliveIndices(alive: readonly boolean[]): number[] {
  return alive.map((a, i) => a ? i : -1).filter(i => i >= 0)
}

function getNextAliveIdx(alive: readonly boolean[], fromIdx: number): number {
  const aliveIdxs = getAliveIndices(alive)
  if (aliveIdxs.length === 0) return fromIdx
  const pos = aliveIdxs.indexOf(fromIdx)
  if (pos < 0) return aliveIdxs[0]
  return aliveIdxs[(pos + 1) % aliveIdxs.length]
}

function getPrevAliveIdx(alive: readonly boolean[], fromIdx: number): number {
  const aliveIdxs = getAliveIndices(alive)
  if (aliveIdxs.length === 0) return fromIdx
  const pos = aliveIdxs.indexOf(fromIdx)
  if (pos < 0) return aliveIdxs[aliveIdxs.length - 1]
  return aliveIdxs[(pos - 1 + aliveIdxs.length) % aliveIdxs.length]
}

const ALL_POS: PosClass[] = ['pos-center', 'pos-left', 'pos-right', 'pos-off-left', 'pos-off-right', 'pos-hidden']

export function CharacterStage({ players, alive, currentTurnIndex, centerOverrideIdx, names, isThinking, shotAction, damagedIdx }: CharacterStageProps) {
  const positionsRef = useRef<Record<number, PosClass>>({})
  const blinkTimersRef = useRef<Record<number, ReturnType<typeof setTimeout>>>({})
  const stageRef = useRef<HTMLDivElement>(null)

  const getOnChainName = useCallback((index: number): string => {
    const addr = players[index]
    if (!addr) return ''
    return names[addr.toLowerCase()] || ''
  }, [players, names])

  // Keep a ref so blink closures always read the latest names
  const getOnChainNameRef = useRef(getOnChainName)
  getOnChainNameRef.current = getOnChainName

  // Calculate positions — freeze at shooter during shot animation
  const centerIdx = centerOverrideIdx ?? currentTurnIndex
  const leftIdx = getPrevAliveIdx(alive, centerIdx)
  const rightIdx = getNextAliveIdx(alive, centerIdx)

  const posMap: Record<number, PosClass> = {}
  posMap[centerIdx] = 'pos-center'
  if (leftIdx !== centerIdx) posMap[leftIdx] = 'pos-left'
  if (rightIdx !== centerIdx && !(rightIdx in posMap)) posMap[rightIdx] = 'pos-right'

  // Update slot classes
  useEffect(() => {
    if (!stageRef.current) return

    players.forEach((_, i) => {
      const slot = stageRef.current!.querySelector(`[data-char-idx="${i}"]`) as HTMLElement
      if (!slot) return

      const oldPos = positionsRef.current[i] || 'pos-hidden'
      const newPos = posMap[i] || null

      // Remove all position classes
      ALL_POS.forEach(cls => slot.classList.remove(cls))
      slot.classList.toggle('dead-char', !alive[i])

      if (newPos) {
        // Entering from off-screen
        if (newPos === 'pos-right' && (oldPos === 'pos-hidden' || oldPos === 'pos-off-left' || oldPos === 'pos-off-right')) {
          slot.style.transition = 'none'
          slot.classList.add('pos-off-right')
          slot.offsetHeight // force reflow
          slot.style.transition = ''
          requestAnimationFrame(() => {
            slot.classList.remove('pos-off-right')
            slot.classList.add(newPos)
          })
        } else {
          slot.classList.add(newPos)
        }
        positionsRef.current[i] = newPos
      } else {
        // Exiting
        if (oldPos === 'pos-left' || oldPos === 'pos-center' || oldPos === 'pos-right') {
          slot.classList.add('pos-off-left')
          positionsRef.current[i] = 'pos-off-left'
        } else {
          slot.classList.add('pos-hidden')
          positionsRef.current[i] = 'pos-hidden'
        }
      }
    })
  }, [currentTurnIndex, centerOverrideIdx, alive, players])

  // Damage animation: apply taking-damage class
  useEffect(() => {
    if (!stageRef.current || damagedIdx === null) return

    const slot = stageRef.current.querySelector(`[data-char-idx="${damagedIdx}"]`) as HTMLElement
    if (!slot) return

    slot.classList.add('taking-damage')
    const timer = setTimeout(() => slot.classList.remove('taking-damage'), 600)
    return () => {
      clearTimeout(timer)
      slot.classList.remove('taking-damage')
    }
  }, [damagedIdx])

  // Blink system
  useEffect(() => {
    function preload() {
      players.forEach((_, i) => {
        const char = getCharacter(getOnChainNameRef.current(i))
        const img = new Image()
        img.src = char.blinkImg
      })
    }

    function scheduleBlink(idx: number) {
      if (blinkTimersRef.current[idx]) clearTimeout(blinkTimersRef.current[idx])
      const delay = 2000 + Math.random() * 4000
      blinkTimersRef.current[idx] = setTimeout(() => doBlink(idx), delay)
    }

    function doBlink(idx: number) {
      if (!alive[idx]) { scheduleBlink(idx); return }
      if (!stageRef.current) { scheduleBlink(idx); return }

      const slot = stageRef.current.querySelector(`[data-char-idx="${idx}"]`)
      const img = slot?.querySelector('img.char-img') as HTMLImageElement | null
      if (!img) { scheduleBlink(idx); return }

      const char = getCharacter(getOnChainNameRef.current(idx))
      img.src = char.blinkImg

      const blinkDuration = 120 + Math.random() * 80
      setTimeout(() => {
        img.src = char.img
        if (Math.random() < 0.3) {
          setTimeout(() => {
            img.src = char.blinkImg
            setTimeout(() => {
              img.src = char.img
              scheduleBlink(idx)
            }, blinkDuration)
          }, 100)
        } else {
          scheduleBlink(idx)
        }
      }, blinkDuration)
    }

    preload()
    players.forEach((_, i) => {
      const initialDelay = 500 + Math.random() * 3000
      blinkTimersRef.current[i] = setTimeout(() => doBlink(i), initialDelay)
    })

    return () => {
      Object.values(blinkTimersRef.current).forEach(t => clearTimeout(t))
    }
  }, [players.length])

  // Shotgun overlay: position + rotation based on who's being shot
  let shotgunLeft = '50%'
  let shotgunTransform = 'translateX(-50%) rotate(-5deg)'
  if (shotAction) {
    if (shotAction.isSelf) {
      // Self-shot: shotgun points upward at the shooter's own body
      shotgunLeft = '50%'
      shotgunTransform = 'translateX(-50%) rotate(85deg)'
    } else {
      // Opponent shot: determine direction to target
      const targetPos = posMap[shotAction.targetIdx]
      const pointsLeft = targetPos === 'pos-left' ||
        (!targetPos && shotAction.targetIdx < shotAction.shooterIdx)

      if (pointsLeft) {
        // Slight offset left, barrel pointing left
        shotgunLeft = '40%'
        shotgunTransform = 'translateX(-50%) translateY(+80%) scaleX(-1) rotate(-15deg)'
      } else {
        // Slight offset right, barrel pointing right
        shotgunLeft = '60%'
        shotgunTransform = 'translateX(-50%) translateY(+80%) rotate(-15deg)'
      }
    }
  }

  return (
    <div className="relative z-[6] h-[33.33vh] shrink-0">
      <div ref={stageRef} className="absolute inset-0 overflow-visible">
        {players.map((_, i) => {
          const char = getCharacter(getOnChainName(i))
          const isCenter = posMap[i] === 'pos-center'
          return (
            <div
              key={i}
              data-char-idx={i}
              className="char-slot pos-hidden"
            >
              {/* Thinking bubble — only on center character, hidden during shot */}
              {isCenter && isThinking && alive[i] && !shotAction && (
                <ThinkingBubble text={char.thought} />
              )}
              <img
                className="char-img"
                src={char.img}
                alt={char.name}
              />
            </div>
          )
        })}

        {/* Shotgun overlay — appears on shooter during shot animation */}
        {shotAction && (
          <div
            className="shotgun-overlay"
            style={{ left: shotgunLeft, transform: shotgunTransform }}
          >
            <img
              src="/characters/shotgun.png"
              alt="shotgun"
              className={shotAction.phase === 'fire' ? 'shotgun-recoil' : ''}
            />
          </div>
        )}
      </div>
    </div>
  )
}
