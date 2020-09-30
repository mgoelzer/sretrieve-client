import chalk from 'chalk'

const listPeersAndProtos = (node, label) => {
  const peersInPeerStore = node.peerStore.peers.size
  console.log('[' + label + '] Peers in Peerstore:  ' + peersInPeerStore.toString())

  node.peerStore.peers.forEach((peer) => {
    console.log('[' + label + '] ProtoBook for ' + peer.id.toB58String())
    if (node.peerStore.protoBook.data.size != 0) {
      node.peerStore.protoBook.data.forEach((peerSet) => {
        peerSet.forEach((p) => {
          console.log('[' + label + '] ' + p)
        })
      })
    } else {
      console.log(`[${label}] (none)`)
    }
    console.log(`[${label}] End - ProtoBook`)
  })
}

export const hookPeerConnectDisconnectEvents = (selfNode, connectedPeers) => {
  selfNode.connectionManager.on('peer:connect', (connection) => {
    const remotePeerBase85Id = connection.remotePeer.toB58String()

    if (!connectedPeers.has(remotePeerBase85Id)) {
      connectedPeers.add(remotePeerBase85Id)
      console.log(chalk.green('Howdy! ' + '|' + ` ${remotePeerBase85Id} | ` + ` ${connectedPeers.size} connected`))
      listPeersAndProtos(selfNode, '^^^^')
    }
  })
  selfNode.connectionManager.on('peer:disconnect', (connection) => {
    const remotePeerBase85Id = connection.remotePeer.toB58String()

    if (connectedPeers.delete(remotePeerBase85Id)) {
      console.log(chalk.blueBright('Byebye!' + ` | ${remotePeerBase85Id}` + ' | ' + `${connectedPeers.size} connected`))
      listPeersAndProtos(selfNode, '^^^^')
    }
  })
}
