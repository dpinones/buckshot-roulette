import { useState, useEffect, useRef, useCallback } from 'react'

const LOBBY_TRACK = '/music/Lobby.mp3'
const MUSIC_MAX_VOL = 0.4
const FADE_DURATION = 2000
const FADE_STEP = 50
const VOLUME_KEY = 'buckshot-volume'

function getStoredVolume(): number {
  try {
    const v = localStorage.getItem(VOLUME_KEY)
    if (v !== null) return Math.max(0, Math.min(1, parseFloat(v)))
  } catch {}
  return 0.3
}

/**
 * Plays Lobby.mp3 on loop with fade-in on mount, fade-out on unmount.
 * Returns volume + setVolume so callers can wire up a VolumeControl.
 */
export function useLobbyMusic() {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const fadeRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [volume, setVolumeState] = useState(getStoredVolume)
  const volumeRef = useRef(volume)

  const setVolume = useCallback((v: number) => {
    const clamped = Math.max(0, Math.min(1, Math.round(v * 20) / 20))
    volumeRef.current = clamped
    setVolumeState(clamped)
    try { localStorage.setItem(VOLUME_KEY, String(clamped)) } catch {}
    if (audioRef.current && !audioRef.current.paused) {
      audioRef.current.volume = MUSIC_MAX_VOL * clamped
    }
  }, [])

  useEffect(() => {
    const audio = new Audio(LOBBY_TRACK)
    audio.loop = true
    audio.volume = 0
    audioRef.current = audio

    function fadeIn() {
      const target = MUSIC_MAX_VOL * volumeRef.current
      const step = target / (FADE_DURATION / FADE_STEP)
      fadeRef.current = setInterval(() => {
        if (audio.volume + step >= target) {
          audio.volume = target
          if (fadeRef.current) clearInterval(fadeRef.current)
          fadeRef.current = null
        } else {
          audio.volume = Math.min(audio.volume + step, target)
        }
      }, FADE_STEP)
    }

    audio.play().then(fadeIn).catch(() => {
      function handleClick() {
        audio.play().then(fadeIn).catch(() => {})
        document.removeEventListener('click', handleClick)
      }
      document.addEventListener('click', handleClick)
    })

    return () => {
      if (fadeRef.current) {
        clearInterval(fadeRef.current)
        fadeRef.current = null
      }
      const a = audioRef.current
      if (!a) return
      const step = a.volume / (FADE_DURATION / FADE_STEP)
      const iv = setInterval(() => {
        if (a.volume - step <= 0) {
          a.volume = 0
          a.pause()
          clearInterval(iv)
        } else {
          a.volume = Math.max(a.volume - step, 0)
        }
      }, FADE_STEP)
      audioRef.current = null
    }
  }, [])

  return { volume, setVolume }
}
