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
// Constant strings
//
const strProtocolName = '/fil/simple-retrieve/0.0.1'

//
// Main program
//
async function run() {
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
  // Stream handler for protocol /fil/simple-retrieve
  //
  async function filRetrieveProtocolHandler ({ connection, stream }) {
    try {
      await pipe(
        stream,
        async function (source) {
          for await (const message of source) {
            console.info(strProtocolName + `> ${String(message)}`)
          }
        }
      )
      //await pipe([strRetrievedCIDBytes], stream.sink)
    } catch (err) {
      console.error('protocol handler error: '+err)
    }
  }
  selfNode.handle(strProtocolName, filRetrieveProtocolHandler)

  //
  // Dial Server peer on /fil/simple-retrieve
  //
  console.log('Dialing peer:', otherMultiaddr, ' on ', strProtocolName)
  const { stream } = await selfNode.dialProtocol(otherMultiaddr, [strProtocolName])
  await pipe(
    ['hello there, amigo!'],
    stream
  )

  //////////////////////// -- end of main program -- ////////////////////////

  //
  // Hxelper functions
  //

  // Hook connect and disconnect events from connection manager for debug output
  function hookPeerConnectDisconnectEvents(connectedPeers) {
    selfNode.connectionManager.on('peer:connect', (connection) => {
      var remotePeerBase85Id = connection.remotePeer.toB58String()
      if (!connectedPeers.has(remotePeerBase85Id)) {
        connectedPeers.add(remotePeerBase85Id)
        console.log( chalk.green('Howdy! ' + '|' + ` ${remotePeerBase85Id} | ` + ` ${connectedPeers.size} connected`) )
        listPeersAndProtos('^^^^')
      }
    })
    selfNode.connectionManager.on('peer:disconnect', (connection) => {
      var remotePeerBase85Id = connection.remotePeer.toB58String()
      if (connectedPeers.delete(remotePeerBase85Id)) {
        console.log(chalk.blueBright('Byebye!' + ` | ${remotePeerBase85Id}` + ' | ' + `${connectedPeers.size} connected`))
        listPeersAndProtos('^^^^')
      }
    })
  }

  // Lists connected peers and their supported protocols for debug output
  function listPeersAndProtos(strLabel) {
    const peersInPeerStore = selfNode.peerStore.peers.size
    console.log('[' + strLabel + '] Peers in Peerstore:  ' + peersInPeerStore.toString())

    selfNode.peerStore.peers.forEach((peer) => {
      
      console.log('[' + strLabel + '] ProtoBook for ' + peer.id.toB58String())
      if (selfNode.peerStore.protoBook.data.size!=0) {
        selfNode.peerStore.protoBook.data.forEach((peerSet) => {
          peerSet.forEach((p)=>{
            console.log('[' + strLabel + '] ' + p)
          })
        })
      } else {
        console.log(`[${strLabel}] (none)`)
      }
      console.log(`[${strLabel}] End - ProtoBook`)

    }) // end - for each peer

  } // end - listPeersAndProtos

}

run()



