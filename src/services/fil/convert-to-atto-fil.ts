import { BigNumber } from 'bignumber.js'

const multiplier = new BigNumber('1000000000000000000')

export const convertToAttoFil = (fil: BigNumber | string) => {
  return multiplier.times(fil instanceof BigNumber ? fil : new BigNumber(fil))
}
