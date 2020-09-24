'use strict'

const multiaddr = require('multiaddr')
const PeerId = require('peer-id')
const Libp2p = require('libp2p')
const Gossipsub = require('libp2p-gossipsub')
const TCP = require('libp2p-tcp')
const WS = require('libp2p-websockets')
const { NOISE } = require('libp2p-noise')
const MPLEX = require('libp2p-mplex')
const pipe = require('it-pipe')
const yargs = require("yargs")
const console = require('console')
const chalk = require('chalk');
const { Math, clearInterval } = require('ipfs-utils/src/globalthis')
const { option } = require('yargs')
const Bootstrap = require('libp2p-bootstrap')

//
// Command line arguments
// Invocation example:  node rc.js -p 10333 \ 
//    -m /ip4/192.168.1.23/tcp/5555/p2p/12D3KooWC7koLiCZRxtEtKCQLnjf8Rw1gUGHqE45Ts7BCFdmJNis
//
const options = yargs
 .usage("Usage: -m <other peer multiaddr> -p <number>")
 .option("m", { alias: "multiaddr", describe: "Multiaddr of Server peer to dial", type: "string", demandOption: false })
 .option("p", { alias: "port", describe: "Port to listen on", type: "string", demandOption: true })
 .argv

//
// Setup for gossipsub
//
const strTopic = '/fil/blocks/testnetnet'

//
// Constant strings
//
const strProtocolName = '/fil-retrieve/0.1.0'

//
// Dummy strings for retrieval protocol
//
const strRetrievedCIDBytes = "...fake data......fake data......fake data......fake data......fake data......fake data......fake data..."

//
// Main program
//
async function run() {
  //
  // bootstrapping - manual approach
  //
  let bootstrapList = [
    '/dns4/bootstrap-0.testnet.fildev.network/tcp/1347/ws',
    '/dns4/bootstrap-1.testnet.fildev.network/tcp/1347/ws',
    '/dns4/bootstrap-2.testnet.fildev.network/tcp/1347/ws',
    '/dns4/bootstrap-4.testnet.fildev.network/tcp/1347/ws',
    '/dns4/bootstrap-3.testnet.fildev.network/tcp/1347/ws',
    '/dns4/bootstrap-5.testnet.fildev.network/tcp/1347/ws',
  ]
  const bootstrapOptions = {
    list: bootstrapList,
    interval: 5000 // ms, default is 10s
  }
  var b = new Bootstrap(bootstrapOptions)
  b.on('peer', function (peerInfo) {
    console.log("Bootstrap peer:" + peerInfo.toString())
  })
  b.start()
  // -------------------------------------------------------

  const port = options.port
  const otherMultiaddr = options.multiaddr

  const selfNodeId = await PeerId.create()

  const selfNode = await Libp2p.create({
    modules: {
      transport: [TCP, WS],
      connEncryption: [NOISE],
      streamMuxer: [MPLEX],
      pubsub: Gossipsub,
      peerDiscovery: [Bootstrap],
    },
    peerId: selfNodeId,
    addresses: {
      listen: ['/ip4/0.0.0.0/tcp/'+port]
    },
    config: {
      peerDiscovery: {
        bootstrap: {
          list: [
            '/dns4/bootstrap-0.testnet.fildev.network/tcp/1347/ws',
            '/dns4/bootstrap-1.testnet.fildev.network/tcp/1347/ws',
            '/dns4/bootstrap-2.testnet.fildev.network/tcp/1347/ws',
            '/dns4/bootstrap-4.testnet.fildev.network/tcp/1347/ws',
            '/dns4/bootstrap-3.testnet.fildev.network/tcp/1347/ws',
            '/dns4/bootstrap-5.testnet.fildev.network/tcp/1347/ws'
          ]
        }
      }
    }
  })

  //
  // Updated by connect/disconnect notifiers
  //
  var connectedPeers = new Set()
  hookPeerConnectDisconnectEvents(connectedPeers)

  //
  // Log a message when we receive a connection
  //
  selfNode.connectionManager.on('peer:connect', (connection) => {
    console.log('Now connected to peer:', connection.remotePeer.toB58String())
  })

  //
  // Stream handler for protocol /fil-retrieval/0.1.0
  //
  async function filRetrieveProtocolHandler ({ connection, stream }) {
    // TODO:  implement custom protocol per https://docs.google.com/document/d/1ye0C7_kdnDCfcV8KsQCRafCDvrjRkiilqW9NlXF3M7Q/edit#
    try {
      await pipe(
        stream,
        async function (source) {
          for await (const message of source) {
            console.info(strProtocolName + `> ${String(message)}`)
          }
        }
      )
      await pipe([strRetrievedCIDBytes], stream.sink)
    } catch (err) {
      console.error('handler error: '+err)
    }
  }
  selfNode.handle(strProtocolName, filRetrieveProtocolHandler)

  //
  // Start listening
  //
  await selfNode.start()
  console.log('Listening on:')
  var selfNodeMultiAddrStrs = []
  selfNode.multiaddrs.forEach((ma) => {
    var multiAddrStr = ma.toString() + '/p2p/' + selfNodeId.toB58String()
    selfNodeMultiAddrStrs.push(multiAddrStr)
    console.log(multiAddrStr)
  })

  //
  // Dial another peer if a multiaddr was specified
  //
  if (otherMultiaddr!=undefined) {
    console.log('Dialing peer:', otherMultiaddr)
    await selfNode.dial(otherMultiaddr)
  } else {
    console.log("Not dialing other peer: none specified")
  }

  //
  // Pubsub channel subscribe + message handling 
  //
  selfNode.pubsub.subscribe(strTopic,
    // Handle incoming pubsub messages 
    (message) => {
      const pubsubMsgStr = message.data.toString('utf8', 0, message.data.length)
      console.log(chalk.redBright('gossip> ')+pubsubMsgStr)
      
      // Try to parse message as JSON; ignore if invalid
      var obj = undefined
      try {
        obj = JSON.parse(pubsubMsgStr)
      } catch(err) {
        // silently ignore messages we cannot parse as JSON
      }

/*
      //
      // Handle 'request' messages
      //
      if (obj && obj['messageType'] && obj['messageType']=='request') {
        console.log(chalk.redBright('gossip> ')+"received valid JSON:" + pubsubMsgStr)
        const cidStr = obj.cid

        // Check if this node has cidStr in local cache
        var localCids = new LocalCids(config)
        var localCid = localCids.get(cidStr)
        if (localCid != undefined) {
          console.log(chalk.redBright('gossip> ')+'I have localCid[cid]='+localCid['cidStr'])

          // publish an 'available' message
          var otherFields = new Object()
          otherFields['multiAddrs'] = selfNodeMultiAddrStrs
          otherFields['pricePerByte'] = localCid['pricePerByte']
          // TODO
          // otherFields['Size']
          // otherFields['Total']
          // otherFields['paymentInterval']
          // otherFields['Miner']
          // otherFields['MinerPeerId']
          sendPubsubMessage('available', localCid['cidStr'], otherFields)
        } else {
          console.log(chalk.redBright('gossip> ') + "not replying b/c don't have CID '"+cidStr+"'")
        }

      //
      // Handle 'available' messages
      //
      } else if (obj && obj['messageType'] && obj['messageType']=='available') {
        const cidAvailable = obj['cid']
        const multiAddrsArrrayOfPeersHavingCid = obj['multiAddrs']
        console.log(chalk.redBright('gossip> ')+"cid available announcement:  "+cidAvailable)

        // is the 'available' message announcing a CID we are trying to retrieve?
        if (options.retrieve_cid == cidAvailable) {
          console.log(chalk.redBright('gossip> ')+"peer '" + multiAddrsArrrayOfPeersHavingCid[0] + "' has announced availability of a cid I want '"+cidAvailable+"'")
          retrieveCidFromPeerAsync(selfNode, cidAvailable, multiAddrsArrrayOfPeersHavingCid) // TODO:  size, total, paymentInterval, paymentIntervalIncrease, pricePerByte
        }
        // TODO:  don't just accept the first 'available' message for a CID you want;
        // rather, build an array of offers that come in through 'available' messages
        // and then pick the lowest to initiate a retrieval from
        // TODO:  in addition to querying peers, query the Lotus instance at 
        // config.configMap['lotus_url'] to see if any storage miners have this CID.
        // If they do, have the Lotus do a QueryMinerAsk to get their price for the CID
        // and add that offer to the array so it can be considered along with peer offers.
        // TODO:  create a parallel function to retrieveCidFromPeer() called 
        // retrieveCidFromStorageMiner() which takes a storage miner Id instead of a
        // peerId

      //
      // Handle all other messages
      //
      } else if (obj && obj['messageType']) {
        console.log(chalk.redBright('gossip> ')+"Don't understand message type '"+obj['messageType']+"', ignoring")
      }
*/

  })

/*
  //
  // Publish on gossipsub any CIDs we want to retrieve ('-r' on CLI)
  //
  if (options.retrieve_cid != undefined) {
    sendPubsubMessage('request',options.retrieve_cid)
  }
*/

  //////////////////////// -- end of main program -- ////////////////////////

  //
  // Helper functions
  //

  // retrieve a CID over the custom protocol
  async function retrieveCidFromPeerAsync(selfNode, cidAvailable, multiAddrsArrrayOfPeerHavingCid) { // TODO:  size, total, paymentInterval, paymentIntervalIncrease, pricePerByte
    console.log(chalk.bgYellowBright("Starting retrieval of '"+cidAvailable+"'"))
    // TODO:  don't just use the 0th mutliaddr in the array, try them individually
    // until a connection is established
    const { stream } = await selfNode.dialProtocol(multiAddrsArrrayOfPeerHavingCid[0], strProtocolName)
    console.log(chalk.bgYellowBright('Dialed "'+multiAddrsArrrayOfPeerHavingCid[0]+'" with protocol: '+strProtocolName))

    // TODO:  implement custom protocol per https://docs.google.com/document/d/1ye0C7_kdnDCfcV8KsQCRafCDvrjRkiilqW9NlXF3M7Q/edit#
    pipe(
      // Source (send payment vouchers, expecting to receive bytes of your data CID)
      ['payment voucher 1... payment voucher 2...'], 
      stream,
      // Sink
      async function (source) {
        for await (const data of source) {
          console.log(chalk.bgYellowBright(strProtocolName + '> received data:', data.toString()))
        }
      }
    )
  }

  // send a JSON pubsub message
  function sendPubsubMessage(msgTypeStr, cidStr, otherArgumentsObj) {
    setTimeout(() => {
      var o
      if (otherArgumentsObj!=undefined) {
        o = Object.assign(otherArgumentsObj)
      } else {
        o = new Object()
      }
      o['messageType'] = msgTypeStr
      o['cid'] = cidStr
      const jsonCidRequest = JSON.stringify(o)
      selfNode.pubsub.publish(strTopic, jsonCidRequest)
    }, 1000)
  }

  // Hook connect and disconnect events from connection manager 
  // to keep track of connected peers (just for debug output)
  function hookPeerConnectDisconnectEvents(connectedPeers) {
    selfNode.connectionManager.on('peer:connect', (connection) => {
      var remotePeerBase85Id = connection.remotePeer.toB58String()
      if (!connectedPeers.has(remotePeerBase85Id)) {
        connectedPeers.add(remotePeerBase85Id)
        console.log( chalk.green('Howdy! ' + '|' + ` ${remotePeerBase85Id} | ` + ` ${connectedPeers.size} connected`) )
        listPeers('^^^^')
      }
    })
    selfNode.connectionManager.on('peer:disconnect', (connection) => {
      var remotePeerBase85Id = connection.remotePeer.toB58String()
      if (connectedPeers.delete(remotePeerBase85Id)) {
        console.log(chalk.blueBright('Byebye!' + ` | ${remotePeerBase85Id}` + ' | ' + `${connectedPeers.size} connected`))
        listPeers('^^^^')
      }
    })
  }

  function listPeers(strLabel) {
    const peersInPeerStore = selfNode.peerStore.peers.size
    console.log('[' + strLabel + '] Peers in Peerstore:  ' + peersInPeerStore.toString())
    selfNode.peerStore.peers.forEach((peer) => {
      console.log('[' + strLabel + '] Peerbook:            ' + peer.id.toB58String())
      if (selfNode.peerStore.protoBook.data.size!=0) {
        selfNode.peerStore.protoBook.data.forEach((peerSet) => {
          peerSet.forEach((p)=>{
            console.log('[' + strLabel + '] ' + p)
          })
        })
      }
    })
  }

}

run()



