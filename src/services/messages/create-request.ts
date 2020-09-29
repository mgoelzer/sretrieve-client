import { MessageTypeCodes } from '../../models/message-type-codes'

/**
 * Creates an object with a Request message
 *
 * Response
 * For Ok response:
 * {
 * "type":          "response",
 * "response":      ${ReqRespTransfer:int},
 * "responseCode”:  ${Ok:int},
 * "data":          "L8yHseuD/d9pNzhtf...Hj0Oli6UI+iMUMw=="
 * }
 *
 * For an error response:
 * {
 * "type":          "response",
 * "response":      ${ReqRespTransfer:int},
 * "responseCode”:  ${ResponseCodeGeneralFailure:int},
 * "errorMessage":  "",
 * }
 */
export const createRequest = () => {
  return {
    type: 'request',
    request: MessageTypeCodes.ReqRespTransfer,
    N: 1048576,
    offset: 0,
  }
}
