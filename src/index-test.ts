/**
 * Temporary file to help debug the server lock issue
 */
import { pipe } from 'it-pipe'
import pushable from 'it-pushable'
import multiaddr from 'multiaddr'

import { config } from './config'
import { getOptions } from './get-options'
import * as libp2pNodes from './services/libp2p'
import * as messages from './services/messages'

const options = getOptions()

const start = async () => {
  const selfNodeId = await libp2pNodes.createNodeId()
  const selfNode = await libp2pNodes.createNode(selfNodeId, options.p)

  await selfNode.start()
  console.log('Listening on:')

  console.log('Dialer ready, listening on:')
  selfNode.multiaddrs.forEach((ma) => {
    console.log(ma.toString() + '/p2p/' + selfNodeId.toB58String())
  })

  // Dial
  console.log('Dialing peer:', options.m, ' on ', config.protocolName)
  const listenMa = multiaddr(options.m)
  const { stream } = await selfNode.dialProtocol(listenMa, config.protocolName)

  console.log('connected!')

  const intializeRequestAsJson = messages.createInitialize(
    'bafykbzacebcklmjetdwu2gg5svpqllfs37p3nbcjzj2ciswpszajbnw2ddxzo',
    't2xxxxxxxxxx',
  )

  const writeStream = pushable()

  // send to server
  pipe(writeStream, stream.sink)

  // get from server
  pipe(stream.source, async (source) => {
    console.log('[pipe::source]: reading response from server')

    for await (const message of source) {
      console.log('<<----- received message from the server:', message)
    }
    console.log('stream ended')
  })

  console.log('----->> sending message:', intializeRequestAsJson)
  writeStream.push(JSON.stringify(intializeRequestAsJson))

  console.log('done')
}

start()
