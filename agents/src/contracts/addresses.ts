import { type Address } from 'viem'
import { config } from '../config.js'

export const addresses = {
  buckshotGame: config.buckshotGameAddress as Address,
  gameFactory: config.gameFactoryAddress as Address,
}
