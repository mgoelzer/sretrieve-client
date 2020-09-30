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
const { option, exit } = require('yargs')
const Bootstrap = require('libp2p-bootstrap')
const util = require("util");
const BigNumber = require('bignumber.js');

//
// Command line arguments (run `node sretrieve-client.js --help` to see example usage)
//
const options = yargs
  .usage(chalk.blueBright("Usage: -m <other peer multiaddr> -p <number>") + chalk.green("\n\nExample: node sretrieve-client.js -m /ip4/192.168.1.23/tcp/5556/p2p/12D3KooWSEXpjM3CePSAfmjYDo4dfFUgcNW55pFK3wfukhT1FMtB -p 10333"))
  .option("m", { alias: "multiaddr", describe: "Multiaddr of Server peer to dial", type: "string", demandOption: true })
  .option("p", { alias: "port", describe: "Port to listen on", type: "string", demandOption: true })
  .argv

//
// Protocol constants for v0.1.0 and below
//
const strProtocolName = '/fil/simple-retrieve/0.0.1'
const mandatoryPaymentIntervalInBytes = 1048576  // 1 mb
const mandatoryPaymentIntervalIncreaseInBytes = 10485760 // 10 mb
const mandatoryOffset0 = 0
const ReqRespInitialize = 1
const ReqRespConfirmTransferParams = 2
const ReqRespTransfer = 3
const ReqRespVoucher = 4
const ReqRespCloseStream = 5
const ResponseCodeOk = 0
const ResponseCodeGeneralFailure = 1
const ResponseCodeInitializeNoCid = 101
const ResponseCodeConfirmTransferParamsWrongParams = 201
const ResponseCodeVoucherSigInvalid = 301
const bnPricePerGibInFil = new BigNumber("0.0000000005")


//
// Program constants
//
const bnFilToAttoFil = new BigNumber("1000000000000000000")  // Multiply Fil by this => attoFil
const bnAttoFilToFil = new BigNumber("0.000000000000000001") // Multiply attoFil by this => Fil

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
      listen: ['/ip4/0.0.0.0/tcp/' + port]
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
  // Start listening
  //
  await selfNode.start()
  console.log('Listening on:')
  var selfNodeMultiAddrStrs = []
  selfNode.multiaddrs.forEach((ma) => {
    var multiAddrStr = ma.toString() + '/p2p/' + selfNodeId.toB58String()
    selfNodeMultiAddrStrs.push(multiAddrStr)
    console.log(`  ${multiAddrStr}`)
  })
  console.log('\n')

  let ProtocolMain = async (otherMultiaddr) => {
    //
    // Shared data within each protocol instance
    //
    var bnN = []
    var bnSV = []
    var bnOffset = []

    //
    // Dial Server peer on /fil/simple-retrieve
    //
    console.log(`Dialing peer: ${otherMultiaddr} on ${strProtocolName}`)
    const { stream } = await selfNode.dialProtocol(otherMultiaddr, [strProtocolName])

    //
    // Sequenced Request/Response pairs
    // 
    var intializeRequestAsJson = buildInitializeJson("bafykbzacebcklmjetdwu2gg5svpqllfs37p3nbcjzj2ciswpszajbnw2ddxzo", "t2xxxxxxxxxx")
    await MakeRequestGetResponse(intializeRequestAsJson,stream).then((response) => {
      console.log("(initialize) Before GeneralResponseHandler")
      let ok = GeneralResponseHandler(response, ReqRespInitialize)
      console.log("(initialize) After GeneralResponseHandler, ok="+ok)
      if (ok) {
        console.log("(initialize) Before InitializeResponseProcess")
        InitializeResponseProcess(response)
        console.log("(initialize) After InitializeResponseProcess")
      } else {
        errorAbort("bad response received (intialize)")
      }
    }).then( async () => {
      let i = 0
      while (i < bnN.length) {
        // Transfer Request/Response
        var transferRequestAsJson = buildTransferJson(bnN[i],bnOffset[i])
        console.log(chalk.blueBright(`transferRequestAsJson = ${transferRequestAsJson}`));
        await MakeRequestGetResponse(transferRequestAsJson,stream).then((response) => {
          console.log("(transfer) Before GeneralResponseHandler")
          let ok = GeneralResponseHandler(response, ReqRespTransfer)
          console.log("(transfer) After GeneralResponseHandler, ok="+ok)
          if (ok) {
            console.log("(transfer) Before TransferResponseProcess")
            TransferResponseProcess(response)
            console.log("(transfer) After TransferResponseProcess")
          } else {
            errorAbort("bad response received (transfer)")
          }
        })
/*
        // Voucher Request/Response
        var voucherRequestAsJson = buildVoucherJson(bnN[i],bnOffset[i])
        var response = MakeRequestGetResponse(voucherRequestAsJson).then((response) => {
          let ok = GeneralResponseHandler(response, ReqRespVoucher)
          if (ok) {
            VoucherResponseProcess(response)
          } else {
            errorAbort("bad response received (voucher)")
          }
        })
*/
        i = i + 1
      }
    })

    //
    // Process Responses
    //
    function GeneralResponseHandler(response, expectingReqRespType) {
      // Check for generic response errors
      if (response["type"] != "response") {
        errorAbort("Error: aborting: response json was not a response object")
      } else if (!IsOk(response["responseCode"])) {
        errorAbort(`Error: aborting: response code was ${response["responseCode"]} reading response on req/resp type ${response["response"]}`)
      }

      // Verify that the request/response type was one that we recognize
      switch (response["response"]) {
        case ReqRespInitialize:
        case ReqRespConfirmTransferParams:
        case ReqRespTransfer:
        case ReqRespVoucher:
          break;
        default:
          console.log("WARN: switch not handling all possible cases")
          break;
      } // end - switch
      
      // Verify that the request/response type was the expected one
      if (response["response"]!=expectingReqRespType) {
        return false
      }
      return true
    } // end - GeneralResponseHandler

    function InitializeResponseProcess(response) {
      //console.log(">> response[totalBytes] = "+response["totalBytes"])
      let { bnTotalBytes, bnPricePerByteInAttoFil, bnTotalCostInAttoFil } = ComputeCosts(response["totalBytes"])
      ComputeTransferParams(response["totalBytes"], bnN, bnOffset, bnSV)

      // Debugging output
      for (const el in bnN) {
        console.log(chalk.redBright(`bnN[${el}]: ${bnN[el].toFixed()}`))
        console.log(chalk.magentaBright(`bnOffset[${el}]: ${bnOffset[el].toFixed()}`))
        console.log(chalk.greenBright(`bnSV[${el}]: ${bnSV[el].toFixed()}`))
      }
      console.log(`Highest voucher (attof)  = ${bnSV[bnSV.length - 1].toFixed()}`)
      console.log(`Total cost in attofil    = ${bnTotalCostInAttoFil.toFixed()}`)
    }

    ////////////////////// -- Request Json Generators -- ///////////////////////

    function buildInitializeJson(cid, pchAddr) {
      // TODO:  check args

      var obj = {
        "type": "request",
        "request": ReqRespInitialize,
        "pchAddr": pchAddr,
        "cid": cid,
        "offset0": 0,
      }

      var serializedObj = JSON.stringify(obj)
      return serializedObj
    }

    function buildTransferJson(bnNi, bnOffseti) {
      var obj = {
        "type": "request",
        "request": ReqRespTransfer,
        "N": bnNi.toFixed(),
        "Offset": bnOffseti.toFixed(),
      }
      var serializedObj = JSON.stringify(obj)
      return serializedObj
    }

    function buildVoucherJson(bnSVi) {
      var obj = {
        "type": "request",
        "request": ReqRespVoucher,
        "amountInAttoFil": bnSVi.toFixed(),
        "sigType": 0,                                        // TODO
        "sigBytes": "L8yHseuD/d9pNzhtf...Hj0Oli6UI+iMUMw==", // TODO
      }
      var serializedObj = JSON.stringify(obj)
      return serializedObj
    }

    ////////////////////// -- Senders and Response Deserializers -- ///////////////////////

    //
    // Sends request and deserializes response
    //
    async function MakeRequestGetResponse(requestJsonStr, stream) {
      var ret = []
      console.log("(MakeRequestGetResponse) Entering, will send:  ")
      console.log("    "+requestJsonStr)
      await pipe(
        [requestJsonStr],
        stream,
        async function getResponseJson(source) {
          console.log("[getResponseJson] entered function\n")
          for await (const message of source) {
            console.log(chalk.whiteBright(strProtocolName + `> ${String(message)}\n`))
            try {
              ret = JSON.parse(message);
              break
            } catch (ex) {
              console.error(ex);
            }
          }
          console.log("[getResponseJson] leavingfunction\n")
        },
      ) // end - pipe

      const retAsStr = util.inspect(ret)
      console.log(chalk.magentaBright("> MakeRequestGetResponse ret:\n" + retAsStr))

      console.log("(MakeRequestGetResponse) Leaving function")
      return ret
    } // end - MakeRequestGetResponse
  } // end - ProtocolMain

  ProtocolMain(otherMultiaddr)

  //////////////////////// -- end of main program -- ////////////////////////

  //
  // Helper functions
  //

  // Hook connect and disconnect events from connection manager for debug output
  function hookPeerConnectDisconnectEvents(connectedPeers) {
    selfNode.connectionManager.on('peer:connect', (connection) => {
      var remotePeerBase85Id = connection.remotePeer.toB58String()
      if (!connectedPeers.has(remotePeerBase85Id)) {
        connectedPeers.add(remotePeerBase85Id)
        console.log(chalk.green('Howdy! ' + '|' + ` ${remotePeerBase85Id} | ` + ` ${connectedPeers.size} connected`))
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
      if (selfNode.peerStore.protoBook.data.size != 0) {
        selfNode.peerStore.protoBook.data.forEach((peerSet) => {
          peerSet.forEach((p) => {
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

//
// Global helpers
//

// Sums every element in a BigNumber array, returning a BigNumber total
function bnSumArray(a) {
  var bnTotal = new BigNumber("0")
  for (let i = 0; i < a.length; i++) {
    bnTotal = bnTotal.plus(a[i])
  }
  return bnTotal
}

// Returns true if responseCode is Ok
function IsOk(responseCode) {
  return (responseCode == ResponseCodeOk)
}

// Compute Ni's, SVi's (amounts only), and Offset_i's
function ComputeTransferParams(totalBytesAsStr, bnN, bnOffset, bnSV) {
  // Get total cost in attoFil
  let { bnTotalBytes, bnPricePerByteInAttoFil, bnTotalCostInAttoFil } = ComputeCosts(totalBytesAsStr)
  //console.log(`pricePerByteInAttoFil:  ${bnPricePerByteInAttoFil.toFixed()} attoFil`)

  const bnPayInt = BigNumber(mandatoryPaymentIntervalInBytes)
  const bnIncr = BigNumber(mandatoryPaymentIntervalIncreaseInBytes)
  let i = 0
  for (; ; i++) {
    bnN[i] = new BigNumber(bnPayInt.plus(bnIncr.times(i)))

    if (i == 0) {
      bnOffset[i] = BigNumber(mandatoryOffset0)
    } else {
      let bnSumNUptoNMinus1 = bnSumArray(bnN).minus(bnN[bnN.length - 1])
      bnOffset[i] = new BigNumber(bnOffset[0].plus(bnSumNUptoNMinus1))
    }

    // Have to do this here before SV[i] is calculated
    if (bnOffset[i].plus(bnN[i]).comparedTo(bnTotalBytes) == 1) {
      let bnLastN = new BigNumber(bnTotalBytes.minus(bnOffset[i]))
      bnN[i] = bnLastN
    }

    let bnPrevAndCurrBytesSum = bnSumArray(bnN)
    bnSV[i] = new BigNumber(bnPrevAndCurrBytesSum.times(bnPricePerByteInAttoFil))

    // Debugging
    //console.log(chalk.redBright(    `    bnN[${i}] = ${bnN[i].toFixed()}`))
    //console.log(chalk.magentaBright(`    bnOffset[${i}] = ${bnOffset[i].toFixed()}`))
    //console.log(chalk.greenBright(  `    bnSV[${i}] = ${bnSV[i].toFixed()}`))

    let bnTotalBytesAccountedFor = bnSumArray(bnN)
    if (bnTotalBytesAccountedFor.comparedTo(bnTotalBytes) != -1) {
      //console.log(`>> Finished iteration i=${i}, and bnTotalBytesAccountedFor==${bnTotalBytesAccountedFor}\n   equals totalBytes==${bnTotalBytes}`)
      break
    } else {
      //console.log(`>> Finished iteration i=${i}, but bnTotalBytesAccountedFor==${bnTotalBytesAccountedFor}\n   is less than totalBytes==${bnTotalBytes}`)
    }
  }
}

function ComputeCosts(totalBytesAsStr) {
  let bnTotalBytes = new BigNumber(totalBytesAsStr)
  let bnTotalGib = bnTotalBytes.dividedBy(1024 * 1024 * 1024)
  let bnTotalCostInAttoFil = bnTotalGib.times(bnPricePerGibInFil).times(bnFilToAttoFil)
  //console.log(`totalCostInAttoFil:  ${bnTotalCostInAttoFil.toFixed()} =? 31738281.25`)
  let bnPricePerByteInAttoFil = bnTotalCostInAttoFil.dividedBy(bnTotalBytes)
  return { bnTotalBytes, bnPricePerByteInAttoFil, bnTotalCostInAttoFil }
}

function errorAbort(errStr) {
  console.log(chalk.redBright(errStr))
  exit(-1, errStr)
}


