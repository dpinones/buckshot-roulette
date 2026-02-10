import { useEffect, useRef } from 'react'
import { type GameEvent } from '../hooks/useEventLog'

interface EventLogProps {
  events: GameEvent[]
}

const TYPE_COLORS: Record<GameEvent['type'], string> = {
  shot: 'text-shell-live',
  item: 'text-neon',
  round: 'text-gold',
  turn: 'text-white/30',
  gameover: 'text-gold font-bold',
  info: 'text-white/40',
}

const TYPE_PREFIX: Record<GameEvent['type'], string> = {
  shot: 'BANG',
  item: 'ITEM',
  round: 'ROUND',
  turn: 'TURN',
  gameover: 'WIN',
  info: 'INFO',
}

const PREFIX_COLORS: Record<GameEvent['type'], string> = {
  shot: 'text-blood',
  item: 'text-neon/70',
  round: 'text-gold/70',
  turn: 'text-white/15',
  gameover: 'text-gold',
  info: 'text-white/20',
}

export function EventLog({ events }: EventLogProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [events.length])

  return (
    <div className="border border-white/[0.04] bg-panel rounded-sm overflow-hidden">
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-white/[0.04] flex items-center gap-2.5 bg-white/[0.01]">
        <div className="w-1.5 h-1.5 bg-blood rounded-full animate-pulse" />
        <span className="text-[9px] uppercase tracking-[0.3em] text-white/25 font-display">
          Live Feed
        </span>
        <div className="flex-1" />
        <span className="text-[9px] text-white/10 font-mono tabular-nums">
          {events.length} events
        </span>
      </div>

      {/* Events */}
      <div
        ref={scrollRef}
        className="h-56 overflow-y-auto px-4 py-2"
      >
        {events.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <div className="text-[10px] text-white/10 flex items-center gap-2">
              <span className="inline-block w-1.5 h-3 bg-white/20" style={{ animation: 'terminalBlink 1s step-end infinite' }} />
              Waiting for action...
            </div>
          </div>
        )}
        {events.map((event, i) => (
          <div
            key={event.id}
            className={`
              flex items-start gap-3 py-1.5 font-mono text-[11px] leading-relaxed
              ${i === events.length - 1 ? 'animate-[slideUp_0.3s_ease-out]' : ''}
            `}
          >
            {/* Timestamp */}
            <span className="text-white/10 flex-shrink-0 tabular-nums text-[10px] pt-[1px]">
              {new Date(event.timestamp).toLocaleTimeString('en', {
                hour12: false,
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              })}
            </span>

            {/* Type badge */}
            <span className={`flex-shrink-0 text-[8px] uppercase tracking-[0.15em] w-10 text-right pt-[2px] ${PREFIX_COLORS[event.type]}`}>
              {TYPE_PREFIX[event.type]}
            </span>

            {/* Message */}
            <span className={TYPE_COLORS[event.type]}>
              {event.message}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
