import filecoinSigner from '@zondax/filecoin-signing-tools'
import axios from 'axios'
import BigNumber from 'bignumber.js'

import { config } from '../../config'

const paymentIntervalInBytes = new BigNumber(config.mandatoryPaymentIntervalInBytes)
const paymentIntervalIncreaseInBytes = new BigNumber(config.mandatoryPaymentIntervalIncreaseInBytes)

// key for `t3ucc7cbh...` addr
const privateKeyBase64 = 'uGOBUfBGpxu3jVGdJFbUiyPH53GLVAbG6wdBG4/fl9g='
const privateKey = Buffer.from(privateKeyBase64, 'base64')
const TOKEN =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJBbGxvdyI6WyJyZWFkIiwid3JpdGUiLCJzaWduIiwiYWRtaW4iXX0.K7ETGuBkWqCxw-5EOCxJLtpWcL3w1MywGBR1Gg7Uj4c'
const URL = 'http://192.168.1.23:1234/rpc/v0'

const PAYMENT_CHANNEL_ADDRESS = 't01010'

const headers = { Authorization: `Bearer ${TOKEN}` }

const getNonce = async (address: string) => {
  const { data } = await axios.post(
    URL,
    {
      jsonrpc: '2.0',
      method: 'Filecoin.MpoolGetNonce',
      id: 1,
      params: [address],
    },
    { headers },
  )

  const { nonce } = data.result

  return nonce
}

const createPaymentChannel = async (address: string, nonce: string) => {
  const paymentChannel = filecoinSigner.createPymtChan(
    address,
    't1a25ihzpz7jb6wgjkkd7cndnhgo4zbbap6jc5pta',
    '1000',
    nonce,
  )

  const signedMessage = JSON.parse(filecoinSigner.transactionSignLotus(paymentChannel, privateKey))
  const { data: mPoolPushData } = await axios.post(
    URL,
    {
      jsonrpc: '2.0',
      method: 'Filecoin.MpoolPush',
      id: 1,
      params: [signedMessage],
    },
    { headers },
  )

  const { cid } = mPoolPushData.result

  const { data: stateWaitMsgData } = await axios.post(
    URL,
    {
      jsonrpc: '2.0',
      method: 'Filecoin.StateWaitMsg',
      id: 1,
      params: [cid, null],
    },
    { headers },
  )

  return stateWaitMsgData.result.ReturnDec
}

export const voucherGenerator = async function* (totalBytes: BigNumber) {
  let bytesSent = new BigNumber(0)

  for (let i = 0; ; ++i) {
    const offset = bytesSent
    let n = paymentIntervalInBytes.plus(paymentIntervalIncreaseInBytes.times(i))

    bytesSent = bytesSent.plus(n)

    // cap at totalBytes
    if (bytesSent.isGreaterThan(totalBytes)) {
      n = totalBytes.minus(offset)
      bytesSent = totalBytes
    }

    const sv = new BigNumber(bytesSent.times(paymentIntervalInBytes))

    const { address } = filecoinSigner.keyRecover(privateKeyBase64, true)

    const nonce = await getNonce(address)
    await createPaymentChannel(address, nonce)

    const voucher = filecoinSigner.createVoucher(
      PAYMENT_CHANNEL_ADDRESS,
      BigInt(0),
      BigInt(0),
      sv.toString(),
      BigInt(0),
      BigInt(nonce),
      BigInt(0),
    )

    const signedVoucher = filecoinSigner.signVoucher(voucher, privateKeyBase64)

    yield {
      n,
      offset,
      sv,
      signedVoucher,
    }

    if (totalBytes.eq(bytesSent)) {
      break
    }
  }
}
