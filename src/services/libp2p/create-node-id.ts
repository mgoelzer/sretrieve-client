import * as PeerId from 'peer-id'

export const createNodeId = () => {
  return PeerId.create()
}
