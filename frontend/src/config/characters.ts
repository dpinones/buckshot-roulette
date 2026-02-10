export interface CharacterDef {
  name: string
  role: string
  img: string
  blinkImg: string
  color: string
  thought: string
}

export const AGENT_CHARACTERS: Record<string, CharacterDef> = {
  'El Calculador': {
    name: 'Counting Sheep',
    role: 'Probability Nerd',
    img: '/characters/sheep.png',
    blinkImg: '/characters/sheep_blink.png',
    color: 'calc',
    thought: 'P(live)=0.67 ... E[dmg]=1.34',
  },
  'El Agresivo': {
    name: 'Angry Ducky',
    role: 'Brute Force',
    img: '/characters/pio.png',
    blinkImg: '/characters/pio_blink.png',
    color: 'agro',
    thought: 'DESTROY!! \u{1F4A2}\u{1F525}\u{1F480}',
  },
  'La Tramposa': {
    name: 'Sly Fox',
    role: 'Trickster',
    img: '/characters/foxy.png',
    blinkImg: '/characters/foxy_blink.png',
    color: 'trap',
    thought: '\u265F\u{1F4A1} "...checkmate"',
  },
  'El Filosofo': {
    name: 'Zen Bunny',
    role: 'Balance Seeker',
    img: '/characters/bunny.png',
    blinkImg: '/characters/bunny_blink.png',
    color: 'filo',
    thought: '\u262F balance in all...',
  },
  'El Aprendiz': {
    name: 'Curious Kitty',
    role: 'Adaptive Learner',
    img: '/characters/kitty.png',
    blinkImg: '/characters/kitty_blink.png',
    color: 'apre',
    thought: 'Hmm... \u2699\uFE0F\u2753',
  },
}

export const DEFAULT_CHARACTER: CharacterDef = {
  name: 'Unknown',
  role: 'Player',
  img: '/characters/bunny.png',
  blinkImg: '/characters/bunny_blink.png',
  color: 'filo',
  thought: '...',
}

export function getCharacter(name: string): CharacterDef {
  return AGENT_CHARACTERS[name] ?? DEFAULT_CHARACTER
}
