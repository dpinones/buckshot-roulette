import { useEffect, useRef } from 'react'
import { type GameEvent } from '../hooks/useEventLog'

interface EventLogProps {
  events: GameEvent[]
}

const TYPE_STYLES: Record<GameEvent['type'], string> = {
  shot: 'text-shell-live',
  item: 'text-neon',
  round: 'text-gold',
  turn: 'text-white/40',
  gameover: 'text-gold font-bold',
  info: 'text-white/60',
}

const TYPE_PREFIX: Record<GameEvent['type'], string> = {
  shot: '\u{1F4A5}',   // explosion
  item: '\u{1F9F0}',   // toolbox
  round: '\u{1F3AF}',  // target
  turn: '\u{25B6}',    // play
  gameover: '\u{1F3C6}', // trophy
  info: '\u{2022}',    // bullet
}

export function EventLog({ events }: EventLogProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [events.length])

  return (
    <div className="border border-white/5 bg-surface">
      <div className="px-4 py-2 border-b border-white/5 flex items-center gap-2">
        <div className="w-1.5 h-1.5 bg-blood rounded-full animate-pulse" />
        <span className="text-[10px] uppercase tracking-[0.3em] text-white/30">
          Live Feed
        </span>
      </div>

      <div
        ref={scrollRef}
        className="h-48 overflow-y-auto p-3 space-y-1.5"
      >
        {events.length === 0 && (
          <div className="text-xs text-white/15 italic text-center py-8">
            Waiting for action...
          </div>
        )}
        {events.map((event) => (
          <div
            key={event.id}
            className={`
              text-xs font-mono flex gap-2 items-start
              ${event.type === 'gameover' ? 'py-2' : ''}
            `}
          >
            <span className="flex-shrink-0 w-4 text-center">
              {TYPE_PREFIX[event.type]}
            </span>
            <span className="text-white/15 flex-shrink-0 tabular-nums">
              {new Date(event.timestamp).toLocaleTimeString('en', {
                hour12: false,
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              })}
            </span>
            <span className={TYPE_STYLES[event.type]}>
              {event.message}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
