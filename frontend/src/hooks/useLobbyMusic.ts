import { useEffect, useRef } from 'react'

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
 * Reads master volume from the same localStorage key as useAudio.
 */
export function useLobbyMusic() {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const fadeRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const vol = getStoredVolume()
    const maxVol = MUSIC_MAX_VOL * vol

    const audio = new Audio(LOBBY_TRACK)
    audio.loop = true
    audio.volume = 0
    audioRef.current = audio

    // Fade in
    audio.play().then(() => {
      const step = maxVol / (FADE_DURATION / FADE_STEP)
      fadeRef.current = setInterval(() => {
        if (audio.volume + step >= maxVol) {
          audio.volume = maxVol
          if (fadeRef.current) clearInterval(fadeRef.current)
          fadeRef.current = null
        } else {
          audio.volume = Math.min(audio.volume + step, maxVol)
        }
      }, FADE_STEP)
    }).catch(() => {
      // Autoplay blocked — start on first click
      function handleClick() {
        audio.play().then(() => {
          const step = maxVol / (FADE_DURATION / FADE_STEP)
          fadeRef.current = setInterval(() => {
            if (audio.volume + step >= maxVol) {
              audio.volume = maxVol
              if (fadeRef.current) clearInterval(fadeRef.current)
              fadeRef.current = null
            } else {
              audio.volume = Math.min(audio.volume + step, maxVol)
            }
          }, FADE_STEP)
        }).catch(() => {})
        document.removeEventListener('click', handleClick)
      }
      document.addEventListener('click', handleClick)
    })

    // Cleanup: fade out then stop
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
}
