import { MessageTypeCodes } from '../../models/message-type-codes'

/**
 * Creates an object with a Voucher message
 *
 * Response
 * For Ok response:
 * {
 * "type":          "response",
 * "response":      ${ReqRespVoucher:int},
 * "responseCode”:  ${Ok:int},
 * }
 *
 * For an error response:
 * {
 * "type":          "response",
 * "response":      ${ReqRespVoucher:int},
 * "responseCode”:  ${ResponseCodeGeneralFailure:int} |
 *                  ${ResponseCodeVoucherSigInvalid:int}
 * "errorMessage":  "Error: signature invalid blah blah blah...",
 */
export const createVoucher = () => {
  return {
    type: 'request',
    request: MessageTypeCodes.ReqRespVoucher,
    amountInAttoFil: 488281, // TODO: get
    sigType: 1,
    // https://github.com/Zondax/filecoin-signing-tools/blob/master/examples/wasm_node/payment_channel.js#L188
    // https://github.com/Zondax/filecoin-signing-tools/blob/master/examples/wasm_node/payment_channel.js#L236
    sigBytes: 'L8yHseuD/d9pNzhtf...Hj0Oli6UI+iMUMw==', // TODO: sign
  }
}
