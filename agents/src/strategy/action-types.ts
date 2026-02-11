import { type Address } from 'viem'

export type GameAction =
  | { type: 'useItem'; itemIndex: number }
  | { type: 'shootOpponent'; target: Address }
  | { type: 'shootSelf' }

export const ITEM_NAMES: Record<number, string> = {
  0: 'NONE',
  1: 'MAGNIFYING_GLASS',
  2: 'BEER',
  3: 'HANDSAW',
  4: 'CIGARETTES',
}

export const Phase = {
  WAITING: 0,
  ACTIVE: 1,
  FINISHED: 2,
} as const
