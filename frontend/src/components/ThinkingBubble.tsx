import { useState, useEffect, useRef } from 'react'
import { getCharacter, getContextualThought, type ThoughtContext } from '../config/characters'

interface ThinkingBubbleProps {
  charName: string
  context: ThoughtContext
  visible: boolean
}

const AGENT_BUBBLE_COLORS: Record<string, { bg: string; border: string; dot: string; glow: string }> = {
  calc: { bg: 'rgba(137,207,240,0.15)', border: '#89CFF0', dot: '#89CFF0', glow: 'rgba(137,207,240,0.3)' },
  agro: { bg: 'rgba(255,107,138,0.12)', border: '#FF6B8A', dot: '#FF6B8A', glow: 'rgba(255,107,138,0.3)' },
  trap: { bg: 'rgba(119,221,119,0.12)', border: '#77DD77', dot: '#77DD77', glow: 'rgba(119,221,119,0.3)' },
  filo: { bg: 'rgba(195,177,225,0.15)', border: '#C3B1E1', dot: '#C3B1E1', glow: 'rgba(195,177,225,0.3)' },
  apre: { bg: 'rgba(255,213,128,0.15)', border: '#FFD580', dot: '#FFD580', glow: 'rgba(255,213,128,0.3)' },
}

function getBubbleStyle(colorKey: string) {
  return AGENT_BUBBLE_COLORS[colorKey] || AGENT_BUBBLE_COLORS.filo
}

export function ThinkingBubble({ charName, context, visible }: ThinkingBubbleProps) {
  const char = getCharacter(charName)
  const colors = getBubbleStyle(char.color)
  const [text, setText] = useState(() => getContextualThought(char, context))
  const [textFading, setTextFading] = useState(false)
  const contextRef = useRef(context)
  const charRef = useRef(char)
  contextRef.current = context
  charRef.current = char

  // Start hidden, enable CSS transitions after first frame so there's no flash on mount
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  // Cycle thoughts every 3.5-5.5s
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    let fadeTimer: ReturnType<typeof setTimeout>

    function cycle() {
      const delay = 3500 + Math.random() * 2000
      timer = setTimeout(() => {
        setTextFading(true)
        fadeTimer = setTimeout(() => {
          setText(getContextualThought(charRef.current, contextRef.current))
          setTextFading(false)
          cycle()
        }, 300)
      }, delay)
    }

    cycle()
    return () => { clearTimeout(timer); clearTimeout(fadeTimer) }
  }, [])

  // React to significant context changes
  const prevHpRef = useRef(context.hp)
  const prevAliveRef = useRef(context.aliveCount)
  const prevItemsRef = useRef(context.items.length)
  useEffect(() => {
    const hpChanged = context.hp !== prevHpRef.current
    const aliveChanged = context.aliveCount !== prevAliveRef.current
    const itemsChanged = context.items.length !== prevItemsRef.current
    prevHpRef.current = context.hp
    prevAliveRef.current = context.aliveCount
    prevItemsRef.current = context.items.length

    if (hpChanged || aliveChanged || itemsChanged) {
      setText(getContextualThought(char, context))
      setTextFading(false)
    }
  }, [context.hp, context.aliveCount, context.items.length, char])

  const show = mounted && visible

  return (
    <div
      className="thinking-bubble-container"
      style={{
        opacity: show ? 1 : 0,
        transform: show ? 'translateX(-50%) scale(1)' : 'translateX(-50%) scale(0.85)',
        transition: mounted ? 'opacity 0.4s ease, transform 0.4s ease' : 'none',
        animation: 'bubbleFloat 2.5s ease-in-out infinite',
      }}
    >
      <div
        className="thinking-bubble-box"
        style={{
          background: `linear-gradient(135deg, rgba(255,255,255,0.95), rgba(255,253,245,0.95))`,
          borderColor: colors.border,
          boxShadow: `4px 4px 0 var(--color-paper-shadow), 0 0 16px ${colors.glow}`,
        }}
      >
        <span
          className="thinking-bubble-text"
          style={{ opacity: textFading ? 0 : 1 }}
        >
          {text}
        </span>
      </div>
      <div className="thinking-bubble-dots">
        <span style={{ background: colors.dot, borderColor: colors.border }} />
        <span style={{ background: colors.dot, borderColor: colors.border, opacity: 0.7 }} />
        <span style={{ background: colors.dot, borderColor: colors.border, opacity: 0.4 }} />
      </div>
    </div>
  )
}
