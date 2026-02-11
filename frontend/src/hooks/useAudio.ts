import { useEffect, useRef, useCallback } from 'react'

const MUSIC_TRACKS = [
  '/music/Friends.mp3',
  '/music/Trust.mp3',
  '/music/Happy.mp3',
  '/music/Waterfall.mp3',
]

const MUSIC_MAX_VOL = 0.4
const FADE_DURATION = 2000
const FADE_STEP = 50

function fadeIn(audio: HTMLAudioElement) {
  audio.volume = 0
  audio.play().catch(() => {})
  const step = MUSIC_MAX_VOL / (FADE_DURATION / FADE_STEP)
  const iv = setInterval(() => {
    if (audio.volume + step >= MUSIC_MAX_VOL) {
      audio.volume = MUSIC_MAX_VOL
      clearInterval(iv)
    } else {
      audio.volume = Math.min(audio.volume + step, MUSIC_MAX_VOL)
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

    fadeIn(player)
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

    // Try to play immediately — if browser allows it, great
    const probe = new Audio(MUSIC_TRACKS[0])
    probe.volume = 0
    probe.play().then(() => {
      probe.pause()
      startMusic()
    }).catch(() => {
      // Autoplay blocked — fall back to click listener
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

  const playTurnSfx = useCallback(() => {
    if (turnSfxRef.current) {
      turnSfxRef.current.currentTime = 0
      turnSfxRef.current.play().catch(() => {})
    }
  }, [])

  const playShotSfx = useCallback(() => {
    if (shotConfettiSfxRef.current) {
      shotConfettiSfxRef.current.currentTime = 0
      shotConfettiSfxRef.current.play().catch(() => {})
    }
  }, [])

  const playPrepareSfx = useCallback(() => {
    if (shotPrepareSfxRef.current) {
      shotPrepareSfxRef.current.currentTime = 0
      shotPrepareSfxRef.current.play().catch(() => {})
    }
  }, [])

  const playBlankSfx = useCallback(() => {
    if (shotBlankSfxRef.current) {
      shotBlankSfxRef.current.currentTime = 0
      shotBlankSfxRef.current.play().catch(() => {})
    }
  }, [])

  const playReloadSfx = useCallback(() => {
    if (shotReloadSfxRef.current) {
      shotReloadSfxRef.current.currentTime = 0
      shotReloadSfxRef.current.play().catch(() => {})
    }
  }, [])

  return { playTurnSfx, playShotSfx, playBlankSfx, playPrepareSfx, playReloadSfx }
}
