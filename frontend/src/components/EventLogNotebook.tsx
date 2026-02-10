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
    <div className="fixed bottom-4 left-4 w-[300px] h-[200px] bg-[#FFF9C4] border-2 border-paper-shadow rounded-[4px_12px_12px_4px] shadow-[4px_4px_0_var(--color-paper-shadow),0_4px_12px_rgba(0,0,0,0.15)] overflow-hidden font-data text-xs z-[60] opacity-[0.94]">
      {/* Red margin line */}
      <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-[#E57373] z-[2]" />

      {/* Spiral dots */}
      <div className="absolute left-0 top-2.5 bottom-2.5 w-5 flex flex-col gap-3.5 items-center z-[3]">
        {Array.from({ length: 10 }, (_, i) => (
          <div key={i} className="w-2 h-2 bg-[#bbb] rounded-full border border-[#999]" />
        ))}
      </div>

      {/* Title */}
      <div className="font-display text-[13px] py-2 px-2 pl-8 text-text-dark border-b border-paper-shadow">
        Event Log
      </div>

      {/* Entries */}
      <div
        ref={scrollRef}
        className="py-1.5 px-2.5 pl-8 overflow-y-auto"
        style={{
          height: 'calc(100% - 34px)',
          background: 'repeating-linear-gradient(transparent, transparent 19px, #E8D9A0 19px, #E8D9A0 20px)',
        }}
      >
        {events.length === 0 && (
          <div className="text-[11px] text-text-light leading-5 py-0.5">
            Waiting for action...
          </div>
        )}
        {events.map((event, i) => (
          <div
            key={event.id}
            className={`text-[11px] text-text-dark leading-5 py-px ${i === events.length - 1 ? 'animate-[slideUp_0.3s_ease-out]' : ''}`}
          >
            <span className="text-text-light text-[10px] mr-1">
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
