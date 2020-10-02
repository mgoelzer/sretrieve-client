import BigNumber from 'bignumber.js'

import { convertToAttoFil } from '../fil'

const pricePerGibInFil = new BigNumber('0.0000000005')

export const computeCosts = (totalBytesParam: BigNumber | string | number) => {
  const totalBytes = totalBytesParam instanceof BigNumber ? totalBytesParam : new BigNumber(totalBytesParam)
  const totalGib = totalBytes.dividedBy(1024 * 1024 * 1024)
  const totalCostInAttoFil = convertToAttoFil(totalGib.times(pricePerGibInFil))
  const pricePerByteInAttoFil = totalCostInAttoFil.dividedBy(totalBytes)

  return { totalBytes, pricePerByteInAttoFil, totalCostInAttoFil }
}
