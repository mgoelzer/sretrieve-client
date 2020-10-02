import { BigNumber } from 'bignumber.js'

const multiplier = new BigNumber('0.000000000000000001')

export const convertToFil = (attoFil: BigNumber | string) => {
  return multiplier.times(attoFil instanceof BigNumber ? attoFil : new BigNumber(attoFil))
}
