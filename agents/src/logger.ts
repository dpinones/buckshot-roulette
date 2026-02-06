const COLORS = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
}

function ts(): string {
  return new Date().toISOString().slice(11, 19)
}

export const log = {
  info(agent: string, msg: string) {
    console.log(`${COLORS.dim}${ts()}${COLORS.reset} ${COLORS.cyan}[${agent}]${COLORS.reset} ${msg}`)
  },
  action(agent: string, msg: string) {
    console.log(`${COLORS.dim}${ts()}${COLORS.reset} ${COLORS.green}[${agent}]${COLORS.reset} ${COLORS.green}${msg}${COLORS.reset}`)
  },
  warn(agent: string, msg: string) {
    console.log(`${COLORS.dim}${ts()}${COLORS.reset} ${COLORS.yellow}[${agent}]${COLORS.reset} ${COLORS.yellow}${msg}${COLORS.reset}`)
  },
  error(agent: string, msg: string) {
    console.log(`${COLORS.dim}${ts()}${COLORS.reset} ${COLORS.red}[${agent}]${COLORS.reset} ${COLORS.red}${msg}${COLORS.reset}`)
  },
  llm(agent: string, msg: string) {
    console.log(`${COLORS.dim}${ts()}${COLORS.reset} ${COLORS.magenta}[${agent}]${COLORS.reset} ${COLORS.magenta}${msg}${COLORS.reset}`)
  },
  game(msg: string) {
    console.log(`${COLORS.dim}${ts()}${COLORS.reset} ${COLORS.blue}[GAME]${COLORS.reset} ${msg}`)
  },
  system(msg: string) {
    console.log(`${COLORS.dim}${ts()}${COLORS.reset} [SYSTEM] ${msg}`)
  },
}
