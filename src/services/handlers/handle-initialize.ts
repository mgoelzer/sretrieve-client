import { Pushable } from 'it-pushable'

import { createRequest } from '../messages/create-request'

export const handleInitialize = (writeStream: Pushable<any>, message) => {
  const request = createRequest()
  console.log('----->> sending message:', request)

  writeStream.push(request)
}
