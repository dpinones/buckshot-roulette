import { useState, useEffect, useRef } from 'react'

interface TurnFlashProps {
  currentTurnIndex: number
}

export function TurnFlash({ currentTurnIndex }: TurnFlashProps) {
  const [active, setActive] = useState(false)
  const prevTurnRef = useRef(currentTurnIndex)

  useEffect(() => {
    if (currentTurnIndex !== prevTurnRef.current) {
      prevTurnRef.current = currentTurnIndex
      setActive(true)
      const timer = setTimeout(() => setActive(false), 200)
      return () => clearTimeout(timer)
    }
  }, [currentTurnIndex])

  return (
    <div
      className={`fixed inset-0 z-[100] pointer-events-none transition-opacity duration-150
        ${active ? 'opacity-100' : 'opacity-0'}
      `}
      style={{ background: 'rgba(255, 215, 0, 0.15)' }}
    />
  )
}
