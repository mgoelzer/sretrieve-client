import { Pushable } from 'it-pushable'

export const handleClose = (writeStream: Pushable<any>, message) => {
  writeStream.end()
}
