import { useRef } from 'react'

interface VolumeControlProps {
  volume: number
  setVolume: (v: number) => void
}

export function VolumeControl({ volume, setVolume }: VolumeControlProps) {
  const pct = Math.round(volume * 100)
  const isMuted = volume === 0
  const prevVolRef = useRef(0.8)

  function toggleMute() {
    if (isMuted) {
      setVolume(prevVolRef.current || 0.8)
    } else {
      prevVolRef.current = volume
      setVolume(0)
    }
  }

  return (
    <div className="flex items-center gap-3 bg-paper/90 backdrop-blur-sm border-[2.5px] border-paper-shadow rounded-[16px] px-4 py-2.5 shadow-[0_3px_10px_rgba(0,0,0,0.12)] select-none">
      {/* Mute / unmute */}
      <button
        onClick={toggleMute}
        className="text-text-dark hover:text-heart-full text-xl leading-none cursor-pointer transition-colors"
        title={isMuted ? 'Unmute' : 'Mute'}
      >
        {isMuted ? '\u{1F507}' : volume < 0.4 ? '\u{1F509}' : '\u{1F50A}'}
      </button>

      {/* Slider */}
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={volume}
        onChange={(e) => setVolume(parseFloat(e.target.value))}
        className="volume-slider w-36 h-2.5 cursor-pointer"
      />

      {/* Percentage */}
      <span className="font-data text-sm font-bold text-text-light w-10 text-center tabular-nums">
        {pct}%
      </span>
    </div>
  )
}
