import { pipe } from 'it-pipe'

import { config } from './config'

export const filRetrieveProtocolHandler = async ({ connection, stream }) => {
  try {
    await pipe(stream, async function (source) {
      for await (const message of source) {
        console.info(`${config.protocolName} > ${String(message)}`)
      }
    })
    //await pipe([strRetrievedCIDBytes], stream.sink)
  } catch (err) {
    console.error('protocol handler error: ' + err)
  }
}
