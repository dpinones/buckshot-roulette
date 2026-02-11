import { useState, useEffect, useRef, useCallback } from 'react'

const MUSIC_TRACKS = [
  '/music/Friends.mp3',
  '/music/Trust.mp3',
  '/music/Happy.mp3',
  '/music/Waterfall.mp3',
]

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

function fadeIn(audio: HTMLAudioElement, maxVol: number) {
  audio.volume = 0
  audio.play().catch(() => {})
  const step = maxVol / (FADE_DURATION / FADE_STEP)
  const iv = setInterval(() => {
    if (audio.volume + step >= maxVol) {
      audio.volume = maxVol
      clearInterval(iv)
    } else {
      audio.volume = Math.min(audio.volume + step, maxVol)
    }
  }, FADE_STEP)
}

function fadeOutThen(audio: HTMLAudioElement, callback?: () => void) {
  const step = audio.volume / (FADE_DURATION / FADE_STEP)
  const iv = setInterval(() => {
    if (audio.volume - step <= 0) {
      audio.volume = 0
      audio.pause()
      clearInterval(iv)
      callback?.()
    } else {
      audio.volume = Math.max(audio.volume - step, 0)
    }
  }, FADE_STEP)
}

export function useAudio() {
  const musicRef = useRef<HTMLAudioElement | null>(null)
  const lastTrackRef = useRef(-1)
  const turnSfxRef = useRef<HTMLAudioElement | null>(null)
  const shotConfettiSfxRef = useRef<HTMLAudioElement | null>(null)
  const shotPrepareSfxRef = useRef<HTMLAudioElement | null>(null)
  const shotBlankSfxRef = useRef<HTMLAudioElement | null>(null)
  const shotReloadSfxRef = useRef<HTMLAudioElement | null>(null)
  const startedRef = useRef(false)

  // Master volume: 0–1, persisted in localStorage
  const [volume, setVolumeState] = useState(getStoredVolume)
  const volumeRef = useRef(volume)

  const setVolume = useCallback((v: number) => {
    const clamped = Math.max(0, Math.min(1, Math.round(v * 20) / 20)) // snap to 5% steps
    volumeRef.current = clamped
    setVolumeState(clamped)
    try { localStorage.setItem(VOLUME_KEY, String(clamped)) } catch {}
    // Update currently playing music immediately
    if (musicRef.current && !musicRef.current.paused) {
      musicRef.current.volume = MUSIC_MAX_VOL * clamped
    }
  }, [])

  const effectiveMusicVol = () => MUSIC_MAX_VOL * volumeRef.current

  const playRandomMusic = useCallback(() => {
    let idx: number
    do {
      idx = Math.floor(Math.random() * MUSIC_TRACKS.length)
    } while (idx === lastTrackRef.current && MUSIC_TRACKS.length > 1)
    lastTrackRef.current = idx

    const player = new Audio(MUSIC_TRACKS[idx])
    musicRef.current = player

    player.addEventListener('timeupdate', function handler() {
      if (player.duration && player.currentTime >= player.duration - (FADE_DURATION / 1000)) {
        player.removeEventListener('timeupdate', handler)
        fadeOutThen(player, playRandomMusic)
      }
    })

    fadeIn(player, effectiveMusicVol())
  }, [])

  useEffect(() => {
    turnSfxRef.current = new Audio('/sfx/turn.mp3')
    shotConfettiSfxRef.current = new Audio('/sfx/shotgun_confetti.mp3')
    shotPrepareSfxRef.current = new Audio('/sfx/shotgun_prepare.mp3')
    shotBlankSfxRef.current = new Audio('/sfx/shotgun_blank.mp3')
    shotReloadSfxRef.current = new Audio('/sfx/shotgun_reload.mp3')

    function startMusic() {
      if (startedRef.current) return
      startedRef.current = true
      playRandomMusic()
    }

    const probe = new Audio(MUSIC_TRACKS[0])
    probe.volume = 0
    probe.play().then(() => {
      probe.pause()
      startMusic()
    }).catch(() => {
      function handleClick() {
        startMusic()
        document.removeEventListener('click', handleClick)
      }
      document.addEventListener('click', handleClick)
    })

    return () => {
      if (musicRef.current) {
        musicRef.current.pause()
        musicRef.current = null
      }
    }
  }, [playRandomMusic])

  function playSfx(ref: React.RefObject<HTMLAudioElement | null>) {
    if (ref.current) {
      ref.current.volume = volumeRef.current
      ref.current.currentTime = 0
      ref.current.play().catch(() => {})
    }
  }

  const playTurnSfx = useCallback(() => playSfx(turnSfxRef), [])
  const playShotSfx = useCallback(() => playSfx(shotConfettiSfxRef), [])
  const playPrepareSfx = useCallback(() => playSfx(shotPrepareSfxRef), [])
  const playBlankSfx = useCallback(() => playSfx(shotBlankSfxRef), [])
  const playReloadSfx = useCallback(() => playSfx(shotReloadSfxRef), [])

  return {
    playTurnSfx, playShotSfx, playBlankSfx, playPrepareSfx, playReloadSfx,
    volume, setVolume,
  }
}
