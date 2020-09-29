import { MessageTypeCodes } from '../../models/message-type-codes'

/**
 * Creates an object with a Initialize message
 *
 * Response
 * For Ok response:
 * {
 * "type":          "response",
 * "response":      ${ReqRespInitialize:int},
 * "responseCode”:  ${Ok:int},
 * "totalBytes":    68157440    // total bytes starting at Offset0
 *                              // (which always equals zero in v0.1.0)
 * }
 * After Server sends an Ok response, both Client and Server should compute the values of all Ni (in bytes), all Offseti (in bytes), all SVi amounts (in attoFil) that will be needed during the entire transfer.
 *
 * For failure response:
 * {
 * "type":          "response",
 * "response":      ${ReqRespInitialize:int},
 * "responseCode”:  ${ResponseCodeGeneralFailure:int} |
 *                  ${ResponseCodeInitializeNoCid:int,
 * "errorMessage":  "Error: cannot whatever........",
 * }
 */
export const createInitialize = (cid, pchAddr) => {
  return {
    type: 'request',
    request: MessageTypeCodes.ReqRespInitialize,
    pchAddr,
    cid,
    offset0: 0,
  }
}
