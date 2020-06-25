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

//
// Command line arguments
//
const options = yargs
 .usage("Usage: -m <other peer multiaddr>")
 .option("m", { alias: "multiaddr", describe: "Multiaddr of another peer to dial", type: "string", demandOption: false })
 .option("p", { alias: "port", describe: "Port to listen on", type: "string", demandOption: true })
 .argv

//
// Setup for gossipsub
//
const strTopic = 'fil-retrieve'

//
// Constant strings
//
const strProtocolName = '/fil-retrieve/0.0.1'

//
// Dummy strings for retrieval protocol
//
const strRetrievedCIDBytes = "TB9iLgemJO8aWrnGJNwmT7eeC2cYU1cUAeKmhVBIrKLS24TuL1StGEVRYYyZg3XX5UK6xS8UaQG2LEcxEkBpYWUlZ6UQ=="
const strPaymentVouchers = "<payment voucher>"

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
    },
    peerId: selfNodeId,
    addresses: {
      listen: ['/ip4/0.0.0.0/tcp/'+port]
    },
  })

  // Updated by connect/disconnect notifiers
  var connectedPeers = new Set()
  hookPeerConnectDisconnectEvents(connectedPeers)

  // Log a message when we receive a connection
  selfNode.connectionManager.on('peer:connect', (connection) => {
    console.log('received dial to me from:', connection.remotePeer.toB58String())
  })

  //
  // Handle connections on the protocol /fil-retrieval/0.0.1 
  //
  await selfNode.handle( strProtocolName, ({ stream }) => //pipe(stream.source, stream.sink) 
    function(){
      (async () => {

        function streamToString (stream) {
          const chunks = []
          return new Promise((resolve, reject) => {
            stream.on('data', chunk => chunks.push(chunk))
            stream.on('error', reject)
            stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
          })
        }

        var s = await streamToString(stream.source)
        //want to `console.log(s)` here, but need to use .then() on the async function
      })
      
      // Send the CID data per /fil-retrievel/0.0.1 protocol
      pipe([strRetrievedCIDBytes],stream.sink)
    }()
  )

  // Start listening
  await selfNode.start()

  console.log('Listening on:')
  selfNode.multiaddrs.forEach((ma) => {
    console.log(ma.toString() + '/p2p/' + selfNodeId.toB58String())
  })

  // Dial another peer if a multiaddr was specified
  if (otherMultiaddr!=undefined) {
    console.log('Dialing other peer:', otherMultiaddr)
    const { stream } = await selfNode.dialProtocol(otherMultiaddr, strProtocolName)
    console.log('Dialed with protocol: '+strProtocolName)
    pipe(
      // Source (send payment vouchers, expecting to receive bytes of your Data CID)
      ['<payment voucher 1> ... <payment voucher 2> ...'], 
      stream,
      // Sink
      async function (source) {
        for await (const data of source) {
          console.log('received:', data.toString())
        }
      }
    )
  } else {
    console.log("Not dialing other peer: none specified")
  }

  selfNode.pubsub.subscribe(strTopic, (message) => {
    console.log(chalk.redBright("Pubsub msg recv'd:  "+message.data.toString('utf8', 0, message.data.length)))
  })
  await selfNode.pubsub.publish(strTopic, "Here I send a pubsub")
  let timerId = setInterval(()=>
    {selfNode.pubsub.publish(strTopic, "Message!")}, 5000)

  // Hook connect and disconnect events from connection manager 
  // to keep track of connected peers
  function hookPeerConnectDisconnectEvents(connectedPeers) {
    selfNode.connectionManager.on('peer:connect', (connection) => {
      var remotePeerBase85Id = connection.remotePeer.toB58String()
      if (!connectedPeers.has(remotePeerBase85Id)) {
        connectedPeers.add(remotePeerBase85Id)
        console.log( chalk.green('Howdy! ' + '|' + ` ${remotePeerBase85Id} | ` + ` ${connectedPeers.size} connected`) )
        listPeers(selfNode, '^^^^')
      }
    })
    selfNode.connectionManager.on('peer:disconnect', (connection) => {
      var remotePeerBase85Id = connection.remotePeer.toB58String()
      if (connectedPeers.delete(remotePeerBase85Id)) {
        console.log(chalk.blueBright('Byebye!' + ` | ${remotePeerBase85Id}` + ' | ' + `${connectedPeers.size} connected`))
        listPeers(selfNode, '^^^^')
      }
    })
  }

  // Wait for commands from the user
  process.stdin.on('data', async (message) => {
    // Strip newline and process
    const command = message.slice(0, -1)

    if (command.toLowerCase()=="quit" || command=="q" || command=="Q") {
      // Time to cleanup
      clearInterval(timerId)
      exit()
    }
  })

}

run()

function listPeers(selfNode, strLabel) {
  const peersInPeerStore = selfNode.peerStore.peers.size
  console.log('[' + strLabel + '] Peers in Peerstore:  ' + peersInPeerStore.toString())
  selfNode.peerStore.peers.forEach((peer) => {
    console.log('[' + strLabel + '] Peerbook:            ' + peer.id.toB58String())
    if (selfNode.peerStore.protoBook.data.size!=0) {
      selfNode.peerStore.protoBook.data.forEach((peerSet) => {
        peerSet.forEach((p)=>{
          console.log('[' + strLabel + '] ' + p)
        })
        //const protocolsSetForPeer = selfNode.peerStore.protoBook.data[peerId]
        //for (let proto in protocolsSetForPeer) {
        //  console.log('[' + strLabel + ']     supports:  ' + proto.toString())
      })
    }
  })
}

