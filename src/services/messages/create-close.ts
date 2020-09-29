import { MessageTypeCodes } from '../../models/message-type-codes'

export const createClose = () => {
  return {
    type: 'request',
    request: MessageTypeCodes.ReqRespCloseStream,
  }
}
