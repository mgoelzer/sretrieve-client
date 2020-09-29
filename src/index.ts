import { pipe } from 'it-pipe'
import pushable from 'it-pushable'
import multiaddr from 'multiaddr'

import { config } from './config'
import { filRetrieveProtocolHandler } from './fil-retrieve-protocol-handler'
import { getOptions } from './get-options'
import * as jsonStream from './services/json-stream'
import * as libp2pNodes from './services/libp2p'
import * as messages from './services/messages'
import { createRequest } from './services/messages/create-request'

const options = getOptions()

const start = async () => {
  const selfNodeId = await libp2pNodes.createNodeId()

  const selfNode = await libp2pNodes.createNode(selfNodeId, options.p)
  selfNode.handle(config.protocolName, filRetrieveProtocolHandler)

  const connectedPeers = new Set()
  libp2pNodes.hookPeerConnectDisconnectEvents(selfNode, connectedPeers)

  await selfNode.start()
  console.log('Listening on:')

  const selfNodeMultiAddrStrs = []
  selfNode.multiaddrs.forEach((ma) => {
    const multiAddrStr = `${ma.toString()}/p2p/${selfNodeId.toB58String()}`
    selfNodeMultiAddrStrs.push(multiAddrStr)
    console.log(`  ${multiAddrStr}`)
  })
  console.log('\n')

  //
  console.log('Dialing peer:', options.m, ' on ', config.protocolName)
  const listenMa = multiaddr(options.m)
  const { stream } = await selfNode.dialProtocol(listenMa, config.protocolName)

  console.log('connected!')

  const intializeRequestAsJson = messages.createInitialize(
    // 'bafykbzacebcklmjetdwu2gg5svpqllfs37p3nbcjzj2ciswpszajbnw2ddxzo',
    'test.jpg',
    't2xxxxxxxxxx',
  )

  const writeStream = pushable()

  writeStream.push(intializeRequestAsJson)

  await pipe(writeStream, jsonStream.stringify, stream, jsonStream.parse, async (source) => {
    for await (const message of source) {
      console.log('message', message)

      if (message.responseCode === 0) {
        const request = createRequest()
        writeStream.push(request)
      }
    }
  })

  // await pipe([intializeRequestAsJson], stream)
}

start()
