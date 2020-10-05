import BigNumber from 'bignumber.js'
import { pipe } from 'it-pipe'
import pushable from 'it-pushable'
import multiaddr from 'multiaddr'

import { config } from './config'
import { getOptions } from './get-options'
import { MessageTypeCodes } from './models/message-type-codes'
import { BaseResponse, InitializeResponse, RequestResponse, ResponseType } from './models/response'
import * as jsonStream from './services/json-stream'
import * as libp2pNodes from './services/libp2p'
import * as messages from './services/messages'
import { createClose } from './services/messages/create-close'
import { createRequest } from './services/messages/create-request'
import { createVoucher } from './services/messages/create-voucher'
import { voucherGenerator } from './services/protocol/voucher-generator'

const options = getOptions()

const sendVoucher = async (voucherGen, writeStream) => {
  const { value: voucherParams } = await voucherGen.next()

  if (voucherParams) {
    const voucher = createVoucher(voucherParams.sv, voucherParams.signedVoucher)

    writeStream.push(voucher)
  } else {
    writeStream.push(createClose())
  }
}

const start = async () => {
  const selfNodeId = await libp2pNodes.createNodeId()
  const selfNode = await libp2pNodes.createNode(selfNodeId, options.p)

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

  // Dial
  console.log('Dialing peer:', options.m, ' on ', config.protocolName)
  const listenMa = multiaddr(options.m)
  const { stream } = await selfNode.dialProtocol(listenMa, config.protocolName)

  console.log('connected!')

  const intializeRequestAsJson = messages.createInitialize(
    'bafykbzacebcklmjetdwu2gg5svpqllfs37p3nbcjzj2ciswpszajbnw2ddxzo',
    't2xxxxxxxxxx',
  )

  const responses = {
    initialize: {} as InitializeResponse,
    transfer: {} as RequestResponse,
    voucher: {} as BaseResponse,
    closeStream: {},
  }
  let voucherGen: ReturnType<typeof voucherGenerator>

  const writeStream = pushable()

  console.log('----->> sending message:', intializeRequestAsJson)
  writeStream.push(intializeRequestAsJson)

  await pipe(
    writeStream,
    jsonStream.stringify,
    stream,
    jsonStream.parse,
    async (source: AsyncGenerator<ResponseType>) => {
      for await (const message of source) {
        const messageToPrint = Object.keys(message).reduce((a, b) => {
          a[b] = message[b]

          if (a[b] && a[b].length && a[b].length > 50) {
            a[b] = a[b].slice(0, 50) + '...'
          }

          return a
        }, {})
        console.log('<<----- received message from the server:', messageToPrint)

        switch (message.response) {
          case MessageTypeCodes.ReqRespInitialize:
            responses.initialize = message as InitializeResponse

            voucherGen = voucherGenerator(new BigNumber(responses.initialize.totalBytes))

            writeStream.push(createRequest())
            console.log('----->> sending message:', createRequest())

            break

          case MessageTypeCodes.ReqRespTransfer:
            responses.transfer = message as RequestResponse

            sendVoucher(voucherGen, writeStream)

            break

          case MessageTypeCodes.ReqRespVoucher:
            responses.voucher = message

            sendVoucher(voucherGen, writeStream)

            break

          case MessageTypeCodes.ReqRespCloseStream:
            responses.closeStream = message

            writeStream.end()

            break
        }
      }
      console.log('stream ended')
    },
  )

  console.log('disconnected!')
  await selfNode.stop()
}

start()
