import { Pushable } from 'it-pushable'

import { createClose } from '../messages/create-close'

export const handleTransfer = (writeStream: Pushable<any>, message) => {
  // TODO: create voucher request
  // const request = createVoucher()
  const request = createClose()
  console.log('----->> sending message:', request)

  writeStream.push(request)
}
