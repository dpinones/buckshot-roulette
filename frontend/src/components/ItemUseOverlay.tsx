import { useEffect, useRef } from 'react'

const ITEM_ASSETS: Record<number, { img: string; sfx: string }> = {
  1: { img: '/characters/MAGNIFYING_GLASS.png', sfx: '/sfx/MAGNIFYING_GLASS.mp3' },
  2: { img: '/characters/beer.png', sfx: '/sfx/BEER.mp3' },
  3: { img: '/characters/handsaw.png', sfx: '/sfx/handsaw.mp3' },
  4: { img: '/characters/cigarette.png', sfx: '/sfx/cigarette.mp3' },
}

interface ItemUseOverlayProps {
  itemType: number
  onDone: () => void
}

export function ItemUseOverlay({ itemType, onDone }: ItemUseOverlayProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  const assets = ITEM_ASSETS[itemType]

  useEffect(() => {
    if (!assets) {
      onDoneRef.current()
      return
    }

    audioRef.current = new Audio(assets.sfx)
    audioRef.current.volume = 0.6
    audioRef.current.play().catch(() => {})

    const timer = setTimeout(() => onDoneRef.current(), 1200)

    return () => {
      clearTimeout(timer)
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
    }
  }, [])

  if (!assets) return null

  return (
    <div className="fixed inset-0 z-[190] flex items-center justify-center pointer-events-none">
      <img
        src={assets.img}
        alt="item"
        className="item-use-img"
      />
    </div>
  )
}
