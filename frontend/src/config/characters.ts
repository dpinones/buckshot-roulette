export interface CharacterDef {
  name: string
  role: string
  img: string
  blinkImg: string
  color: string
  thought: string
  thoughts: ThoughtPools
}

export interface ThoughtPools {
  idle: string[]
  lowHp: string[]
  confident: string[]
  hasGlass: string[]
  hasSaw: string[]
  hasBeer: string[]
  hasCigs: string[]
  manyLive: string[]
  lastStand: string[]
}

export interface ThoughtContext {
  hp: number
  maxHp: number
  items: readonly number[]
  liveShells: number
  blankShells: number
  aliveCount: number
  round: number
}

// Items: 1=MAGNIFYING_GLASS, 2=BEER, 3=HANDSAW, 4=CIGARETTES

export const AGENT_CHARACTERS: Record<string, CharacterDef> = {
  'El Calculador': {
    name: 'Counting Sheep',
    role: 'Probability Nerd',
    img: '/characters/sheep.png',
    blinkImg: '/characters/sheep_blink.png',
    color: 'calc',
    thought: 'P(live)=0.67 ... E[dmg]=1.34',
    thoughts: {
      idle: [
        'Calculating odds...',
        'Running simulations...',
        'Bayesian update...',
        'P(survival) = acceptable',
        'Expected value: positive',
        'Monte Carlo says: go',
        'Optimizing strategy...',
        'Processing variables...',
        'Confidence interval: 72%',
        'Hmm, the numbers...',
      ],
      lowHp: [
        'Survival P dropping fast...',
        'Need optimal play NOW',
        'Error margin: critical!',
        'One bad move = game over',
        'All-in on expected value...',
      ],
      confident: [
        'Numbers favor me!',
        'Statistically dominant',
        'Data looks promising',
        'High win probability',
        'Playing optimal lines',
      ],
      hasGlass: [
        'Must verify shell data',
        'Observation reduces entropy',
        'Peek = info advantage',
      ],
      hasSaw: [
        'Damage multiplier: x2',
        '+100% dmg potential!',
        'Saw + live = 2 dmg',
      ],
      hasBeer: [
        'Eliminate a variable...',
        'Reduce the sample space',
        'Remove one unknown...',
      ],
      hasCigs: [
        '+1 survival coefficient',
        'HP restoration efficient',
        'Heal for more EV turns',
      ],
      manyLive: [
        'High live shell density!',
        'Danger level: elevated',
        'Variance NOT in our favor',
        'P(live) too high...',
      ],
      lastStand: [
        '1v1... final calculation',
        'Binary outcome ahead',
        'Last probability check...',
        '50/50... or is it?',
      ],
    },
  },
  'El Agresivo': {
    name: 'Angry Ducky',
    role: 'Brute Force',
    img: '/characters/pio.png',
    blinkImg: '/characters/pio_blink.png',
    color: 'agro',
    thought: 'DESTROY!! \u{1F4A2}\u{1F525}\u{1F480}',
    thoughts: {
      idle: [
        "LET'S GOOO!!",
        'FIRE FIRE FIRE!!',
        "CAN'T WAIT TO SHOOT!",
        'BRING IT ON!!',
        'Choose VIOLENCE!!',
        'NO MERCY TODAY!!',
        'READY TO RUMBLE!!',
        'QUACK QUACK BOOM!!',
        'Time to DESTROY!!',
        '*angry quacking*',
      ],
      lowHp: [
        'STILL STANDING!!',
        'Pain makes me STRONGER!',
        "YOU CAN'T STOP ME!!",
        'RAGE MODE: ON!!',
        'I WILL NOT FALL!!',
      ],
      confident: [
        'UNSTOPPABLE!!',
        "I'M THE BOSS HERE!!",
        'TOO EASY!!',
        'FEAR THE DUCK!!',
        'DOMINATION!!',
      ],
      hasGlass: [
        "Who cares? JUST SHOOT!",
        "Peeking is for COWARDS!",
        "Fine... I'll look!",
      ],
      hasSaw: [
        'DOUBLE DAMAGE!! YES!!',
        'SAW + BLAST = PAIN!!',
        'MAXIMUM DESTRUCTION!!',
      ],
      hasBeer: [
        'Skip the beer, SHOOT!',
        'Ugh fine, eject the dud',
        'BORING but ok...',
      ],
      hasCigs: [
        'No time for breaks!',
        'ONE PUFF AND BACK TO WAR!',
        'Healing is for the weak!',
      ],
      manyLive: [
        'LIVE SHELLS = FUN!!',
        'PERFECT for BLASTING!!',
        'THE MORE DAMAGE THE BETTER!',
        'FULLY LOADED!! LETS GO!!',
      ],
      lastStand: [
        'FINAL BATTLE!!',
        'ONE OF US GOES DOWN!!',
        'THIS ENDS NOW!!',
        'MANO A MANO!!',
      ],
    },
  },
  'La Tramposa': {
    name: 'Sly Fox',
    role: 'Trickster',
    img: '/characters/foxy.png',
    blinkImg: '/characters/foxy_blink.png',
    color: 'trap',
    thought: '\u265F\u{1F4A1} "...checkmate"',
    thoughts: {
      idle: [
        'All according to plan...',
        'Interesting move...',
        'I see through you...',
        'Setting the trap...',
        'Patience pays off...',
        'Reading the room...',
        'Three moves ahead...',
        '...predictable',
        'The fox waits...',
        'Hmm, curious...',
      ],
      lowHp: [
        'Just as I planned...',
        'They think I\'m done...',
        'Cornered fox bites hardest',
        'Right where I want to be',
        'Desperation is a weapon...',
      ],
      confident: [
        'Everything falls in place',
        'Too predictable...',
        'Checkmate soon...',
        'They suspect nothing...',
        'The web tightens...',
      ],
      hasGlass: [
        'Knowledge is power...',
        'Let me see the truth...',
        'Information advantage...',
      ],
      hasSaw: [
        'A devastating surprise...',
        "They won't see it coming",
        'Double damage... perfect',
      ],
      hasBeer: [
        'Manipulate the deck...',
        'Remove the unwanted...',
        'Reshuffling the odds...',
      ],
      hasCigs: [
        'Recover, then strike...',
        'Heal now, betray later',
        'Patience rewards health...',
      ],
      manyLive: [
        'Dangerous... but useful',
        'High risk, high reward...',
        'A loaded game indeed...',
        'Perfect for my plan...',
      ],
      lastStand: [
        'The final deception...',
        'Only one survives...',
        'My best trick yet...',
        'Endgame... showtime',
      ],
    },
  },
  'El Filosofo': {
    name: 'Zen Bunny',
    role: 'Balance Seeker',
    img: '/characters/bunny.png',
    blinkImg: '/characters/bunny_blink.png',
    color: 'filo',
    thought: '\u262F balance in all...',
    thoughts: {
      idle: [
        'Balance in all things...',
        'The universe provides...',
        'Om...',
        'Sound of one shell...',
        'All paths lead to truth',
        'Be like water...',
        'The present moment...',
        'Breathe in... breathe out...',
        'Harmony...',
        'Nature finds a way...',
      ],
      lowHp: [
        'Pain is temporary...',
        'Even stars must fade...',
        'This too shall pass...',
        'Embrace the impermanent',
        'Suffering teaches...',
      ],
      confident: [
        'Harmony achieved',
        'Energy flows freely',
        'The path is clear',
        'Centered and whole',
        'Inner peace radiates...',
      ],
      hasGlass: [
        'Seek the inner truth...',
        'To see is to know...',
        'The third eye opens...',
      ],
      hasSaw: [
        'Balance requires force...',
        'The blade of karma...',
        'Necessary energy...',
      ],
      hasBeer: [
        'Release attachment...',
        'Let go, flow on...',
        'Cleanse the path...',
      ],
      hasCigs: [
        'Breath restores the soul',
        'Healing from within...',
        'Inhale peace...',
      ],
      manyLive: [
        'The universe tests us...',
        'Danger is an illusion...',
        'Accept what comes...',
        'Life and death dance...',
      ],
      lastStand: [
        'Two souls remain...',
        'The final balance...',
        'Destiny calls us...',
        'Yin meets yang...',
      ],
    },
  },
  'El Aprendiz': {
    name: 'Curious Kitty',
    role: 'Adaptive Learner',
    img: '/characters/kitty.png',
    blinkImg: '/characters/kitty_blink.png',
    color: 'apre',
    thought: 'Hmm... \u2699\uFE0F\u2753',
    thoughts: {
      idle: [
        'Hmm, what if I...',
        'Learning patterns!',
        'Ooh interesting!!',
        'Taking mental notes...',
        'So THAT\'S how it works!',
        'Let me think...',
        'New strategy forming!',
        '*scribbles notes*',
        'Analyzing moves...',
        'Ok ok I got this!',
      ],
      lowHp: [
        'Uh oh... this is bad!',
        'Maybe I miscalculated?',
        'Need a new strategy!',
        'No wait... THINK!',
        'Learning from mistakes!',
      ],
      confident: [
        "I'm getting good!!",
        'Figured it out!!',
        'Look at me go!!',
        'Strategy: WORKING!',
        'Big brain time!!',
      ],
      hasGlass: [
        'Ooh let me peek!!',
        'Knowledge = power!',
        'I wanna see!!',
      ],
      hasSaw: [
        'Whoa, x2 damage?!',
        'This looks powerful...',
        'Big brain moment!!',
      ],
      hasBeer: [
        'Should I use this...?',
        'Eject a shell... got it!',
        'What does this do again?',
      ],
      hasCigs: [
        'Free health? Yes please!',
        'Healing up!',
        'Smart move... I think!',
      ],
      manyLive: [
        'So many live shells!!',
        'This is scary...',
        'Need to be careful here!',
        'High danger zone!!',
      ],
      lastStand: [
        'Final showdown!!',
        "Just us two now!!",
        'Everything I learned...',
        'THIS IS IT!!',
      ],
    },
  },
}

const DEFAULT_THOUGHTS: ThoughtPools = {
  idle: ['...', 'Thinking...', 'Hmm...'],
  lowHp: ['Not looking good...'],
  confident: ['Feeling strong!'],
  hasGlass: ['Should I peek?'],
  hasSaw: ['Double damage...'],
  hasBeer: ['Eject a shell?'],
  hasCigs: ['Could use a heal'],
  manyLive: ['Many live shells...'],
  lastStand: ['Final round...'],
}

export const DEFAULT_CHARACTER: CharacterDef = {
  name: 'Unknown',
  role: 'Player',
  img: '/characters/bunny.png',
  blinkImg: '/characters/bunny_blink.png',
  color: 'filo',
  thought: '...',
  thoughts: DEFAULT_THOUGHTS,
}

export function getCharacter(name: string): CharacterDef {
  if (AGENT_CHARACTERS[name]) return AGENT_CHARACTERS[name]
  if (!name) return DEFAULT_CHARACTER
  return { ...DEFAULT_CHARACTER, name }
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

/**
 * Picks a contextual thought based on game state.
 * Weighted pool: builds candidates from relevant categories, then picks randomly.
 */
export function getContextualThought(char: CharacterDef, ctx: ThoughtContext): string {
  const t = char.thoughts
  const pool: string[] = []

  // Always include some idle thoughts
  pool.push(pick(t.idle), pick(t.idle))

  // HP-based
  if (ctx.hp <= 1 && ctx.hp < ctx.maxHp) {
    pool.push(pick(t.lowHp), pick(t.lowHp), pick(t.lowHp))
  } else if (ctx.hp >= ctx.maxHp) {
    pool.push(pick(t.confident), pick(t.confident))
  }

  // Item-based
  const items = ctx.items
  if (items.includes(1)) pool.push(pick(t.hasGlass))
  if (items.includes(2)) pool.push(pick(t.hasBeer))
  if (items.includes(3)) pool.push(pick(t.hasSaw), pick(t.hasSaw)) // saw is exciting
  if (items.includes(4)) pool.push(pick(t.hasCigs))

  // Shell composition
  const total = ctx.liveShells + ctx.blankShells
  if (total > 0 && ctx.liveShells / total >= 0.6) {
    pool.push(pick(t.manyLive), pick(t.manyLive))
  }

  // Last stand (1v1)
  if (ctx.aliveCount === 2) {
    pool.push(pick(t.lastStand), pick(t.lastStand))
  }

  return pick(pool)
}
