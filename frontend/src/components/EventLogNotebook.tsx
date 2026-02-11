import { useEffect, useRef } from 'react'
import { type GameEvent } from '../hooks/useEventLog'

interface EventLogNotebookProps {
  events: GameEvent[]
}

export function EventLogNotebook({ events }: EventLogNotebookProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [events.length])

  return (
    <div className="fixed bottom-4 left-4 w-[400px] h-[280px] bg-[#FFF9C4] border-[2.5px] border-paper-shadow rounded-[4px_14px_14px_4px] shadow-[4px_4px_0_var(--color-paper-shadow),0_4px_12px_rgba(0,0,0,0.15)] overflow-hidden font-data text-sm z-[60] opacity-[0.94]">
      {/* Red margin line */}
      <div className="absolute left-7 top-0 bottom-0 w-0.5 bg-[#E57373] z-[2]" />

      {/* Spiral dots */}
      <div className="absolute left-0 top-2.5 bottom-2.5 w-6 flex flex-col gap-4 items-center z-[3]">
        {Array.from({ length: 12 }, (_, i) => (
          <div key={i} className="w-2.5 h-2.5 bg-[#bbb] rounded-full border border-[#999]" />
        ))}
      </div>

      {/* Title */}
      <div className="font-display text-base py-2.5 px-3 pl-9 text-text-dark border-b border-paper-shadow">
        Event Log
      </div>

      {/* Entries */}
      <div
        ref={scrollRef}
        className="py-2 px-3 pl-9 overflow-y-auto"
        style={{
          height: 'calc(100% - 42px)',
          background: 'repeating-linear-gradient(transparent, transparent 23px, #E8D9A0 23px, #E8D9A0 24px)',
        }}
      >
        {events.length === 0 && (
          <div className="text-sm text-text-light leading-6 py-0.5">
            Waiting for action...
          </div>
        )}
        {events.map((event, i) => (
          <div
            key={event.id}
            className={`text-sm text-text-dark leading-6 py-px ${i === events.length - 1 ? 'animate-[slideUp_0.3s_ease-out]' : ''}`}
          >
            <span className="text-text-light text-xs mr-1.5">
              {new Date(event.timestamp).toLocaleTimeString('en', {
                hour12: false,
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
            {event.message}
          </div>
        ))}
      </div>
    </div>
  )
}
