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
const Configuraton = require('./configuration.js')
const LocalCids = require('./local-cids.js')
const exit = require('exit')
const { option } = require('yargs')

// TODO:
// 0.  Break the custom protcol out to its own file
// 1.  Make "-r" work: 
//	(a) actually gossip requested cids
//	(b) reply to gossips when you have them by opening a custom
//		protocol stream
// 2.  Provide an interface to the cid store in dataDir
// 3.  Add a class for the custom protocol
// 4.  Implement the custom protocol to do retrieval from an other instance 
// of this app (payment channels, vouchers and on-chain redepemption, etc)
// 5.  How are we handling wallets here?  Both for buying content and for getting paid
// 6.  Get rid of all the console.log() calls
// 7.  Make the js browser friendly by hiding all the parts that rely on disk files


//
// Command line arguments
//
const options = yargs
 .usage("Usage: -m <other peer multiaddr>")
 .option("m", { alias: "multiaddr", describe: "Multiaddr of another peer to dial", type: "string", demandOption: false })
 .option("p", { alias: "port", describe: "Port to listen on", type: "string", demandOption: true })
 .option("d", { alias: "directory", describe: "Data+config directory for this node", type: "string", demandOption: true }) 
 .option("r", { alias: "retrieve_cid", describe: "CID you wish to retrieve", type: "string", demandOption: false }) 
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
const strRetrievedCIDBytes = "...fake data......fake data......fake data......fake data......fake data......fake data......fake data..."
const strPaymentVouchers = "<payment voucher>"

//
// Main program
//
async function run() {
  var config = new Configuraton(options.directory)

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
    // DELETE FIXME:  this is a fake use of the /fil-retrieve/0.0.1/ protocol just to do
    // DELETE the dial to the other peer.  Replace with a normal dial.
    console.log('Dialing peer:', otherMultiaddr)
    // DELETE const { stream } = await selfNode.dialProtocol(otherMultiaddr, strProtocolName)
    await selfNode.dial(otherMultiaddr)
    // DELETE console.log('Dialed with protocol: '+strProtocolName)
    /* DELETE pipe(
    DELETE  // Source (send payment vouchers, expecting to receive bytes of your Data CID)
    DELETE  ['<payment voucher 1> ... <payment voucher 2> ...'], 
    DELETE  stream,
    DELETE  // Sink
    DELETE  async function (source) {
    DELETE    for await (const data of source) {
    DELETE      console.log('received:', data.toString())
    DELETE    }
    DELETE  }
    DELETE )*/
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
      } else if (obj && obj['messageType']) {
        console.log(chalk.redBright('gossip> ')+"Don't understand message type '"+obj['messageType']+"', ignoring")
      }
      

  })

  //
  // Publish on gossipsub any CIDs we want to retrieve ('-r' on CLI)
  //

  // Example pubsub publish:  
  //await selfNode.pubsub.publish(strTopic, "Here is a pubsub message")

  // Publish the retrieval request CID in proper JSON format
  if (options.retrieve_cid != undefined) {
    sendPubsubMessage('request',options.retrieve_cid)
  }

  // some invalid message traffic flow for debugging
  var i = 0, exponent = 1
  let timerId = setInterval(()=> {
      if (i % Math.pow(2,exponent)==0) {
        selfNode.pubsub.publish(strTopic, "This is "+selfNodeId.toB58String()+' saying hello on gossip (i='+i+',exponent='+exponent+')')
        exponent++
      }
      i++
  }, 5000)

  //
  // Wait for commands from the user
  //
  process.stdin.on('data', async (message) => {
    // Strip newline and process
    const command = message.slice(0, -1).toString()

    if (command.toLowerCase()=="quit" || command=="q" || command=="Q") {
      // Time to cleanup
      clearInterval(timerId)
      exit()
    }
  })

  //
  // Helper functions
  //

  // retrieve a CID over the custom protocol
  async function retrieveCidFromPeerAsync(selfNode, cidAvailable, multiAddrsArrrayOfPeerHavingCid) { // TODO:  size, total, paymentInterval, paymentIntervalIncrease, pricePerByte
    console.log(chalk.bgYellowBright("Starting retrieval of '"+cidAvailable+"'"))
    // TODO:  don't just use the 0th mutliaddr in the array
    const { stream } = await selfNode.dialProtocol(multiAddrsArrrayOfPeerHavingCid[0], strProtocolName)
    console.log(chalk.bgYellowBright('Dialed "'+multiAddrsArrrayOfPeerHavingCid[0]+'" with protocol: '+strProtocolName))

    // TODO:  set up a payment channel, allocate a lane
    // TODO:  add a wallet id to the global config to pay for CID retrievals
    // TODO:  implement CreatePayment() - ultimately in pure js, can start with shelling out to a go binary that imports go-fil-markets
    // TODO:  1. send initial payment voucher 
    // TODO:  2. receive initial paymentInterval bytes
    // TODO:  3. send next payment voucher
    // TODO:  4. receive paymentInterval+paymentIntervalIncrease bytes
    // TODO:  5. go to 3 until all data received
    pipe(
      // Source (send payment vouchers, expecting to receive bytes of your Data CID)
      ['<payment voucher 1> ... <payment voucher 2> ...'], 
      stream,
      // Sink
      async function (source) {
        for await (const data of source) {
          console.log(chalk.bgYellowBright('received data:', data.toString()))
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



