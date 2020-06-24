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

const strProtocolName = '/echo/1.0.0'
const strRetrievedCIDBytes = "TB9iLgemJO8aWrnGJNwmT7eeC2cYU1cUAeKmhVBIrKLS24TuL1StGEVRYYyZg3XX5UK6xS8UaQG2LEcxEkBpYWUlZ6UQ=="
const strPaymentVouchers = "<payment voucher>"
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
const gsubRegistrar = {
  handle: (multicodecs, handle) => {
    // register multicodec to libp2p
    // handle function is called everytime a remote peer opens a stream to the peer.
  },
  register: (multicodecs, handlers) => {
    // handlers will be used to notify pubsub of peer connection establishment or closing
  },
  unregister: (id) => {
  }
}

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
//      peerDiscovery: [Bootstrap]
    },
    peerId: selfNodeId,
    addresses: {
      listen: ['/ip4/0.0.0.0/tcp/'+port]
    },
/*
    config: {
      peerDiscovery: {
        autoDial: true, // Auto connect to discovered peers (limited by ConnectionManager minPeers)
        // The `tag` property will be searched when creating the instance of your Peer Discovery service.
        // The associated object, will be passed to the service when it is instantiated.
        [Bootstrap.tag]: {
          enabled: true,
          list: bootstrapMultiaddrs // provide array of multiaddrs
        }
      }
    }
*/
  })

  // Log a message when we receive a connection
  selfNode.connectionManager.on('peer:connect', (connection) => {
    console.log('received dial to me from:', connection.remotePeer.toB58String())
  })

  // Handle connections to the protocol
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
        //return s
      })//.then(data => {
        //console.log(data)
        //console.log("Received payment vouchers:  "+data)
      //})
      
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

  // Gossipsub initialization
  const gsubOptions = { fallbackToFloodsub:false }
  const gsub = new Gossipsub(selfNodeId, gsubRegistrar, gsubOptions)
  await gsub.start()

  // Dial another peer if a multiaddr was specified
  if (otherMultiaddr!=undefined) {
    console.log('Dialing other peer:', otherMultiaddr)
    const { stream } = await selfNode.dialProtocol(otherMultiaddr, strProtocolName)
    console.log('Dialed with protocol: '+strProtocolName)
    pipe(
      // Source
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

  // Publish to gossip channel
  gsub.on(strTopic, (data) => {
    console.log('gossip message: ' + data)
  })
  gsub.subscribe(strTopic)
  gsub.publish(strTopic, new Buffer.from('hello'))

}

run()

