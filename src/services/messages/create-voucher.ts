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
export const createVoucher = (amountInAttoFil, sigBytes) => {
  return {
    type: 'request',
    request: MessageTypeCodes.ReqRespVoucher,
    amountInAttoFil,
    sigType: 1,
    sigBytes,
  }
}
