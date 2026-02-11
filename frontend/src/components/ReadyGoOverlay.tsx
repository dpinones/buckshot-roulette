import { useState, useEffect, useRef } from 'react'

const READY_SFXS = ['/sfx/ready_1.mp3', '/sfx/ready_2.mp3']

type Phase = 'ready' | 'go' | 'done'

interface ReadyGoOverlayProps {
  onDone?: () => void
}

export function ReadyGoOverlay({ onDone }: ReadyGoOverlayProps) {
  const [phase, setPhase] = useState<Phase>('ready')
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  useEffect(() => {
    const sfx = READY_SFXS[Math.floor(Math.random() * READY_SFXS.length)]
    audioRef.current = new Audio(sfx)
    audioRef.current.volume = 0.1
    audioRef.current.play().catch(() => {})

    const t1 = setTimeout(() => setPhase('go'), 1200)
    const t2 = setTimeout(() => {
      setPhase('done')
      onDoneRef.current?.()
    }, 2200)

    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
    }
  }, [])

  if (phase === 'done') return null

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center pointer-events-none">
      <div
        className="absolute inset-0 transition-opacity duration-300"
        style={{
          background: 'radial-gradient(circle, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.5) 100%)',
          opacity: phase === 'go' ? 0 : 1,
        }}
      />

      {phase === 'ready' && (
        <img
          src="/characters/ready.png"
          alt="Ready?"
          className="ready-go-img ready-in"
        />
      )}

      {phase === 'go' && (
        <img
          src="/characters/go.png"
          alt="Go!"
          className="ready-go-img go-in"
        />
      )}
    </div>
  )
}
