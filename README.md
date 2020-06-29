## JS Retrieval Client PoC

This is _proof of concept_ code, thrown together quickly to explore ideas.

What works:
* Bring up two or more identical nodes to form a libp2p network
* Gossip CIDs that nodes wish to retrieve
* When a node has a CID that has been requested, it opens a custom protocol stream )`/fil-retrieve/0.0.1`) to that node to retrieve the file

What doesn't work:
* The protocol `/fil-retrieve/0.0.1` is not well defined yet.  It needs to do some on-chain operations to create a payment channel, and then follow the go-fil-markets/retrievalmarket protocol to retrieve the CID.
* CLI node app for now, but should be moved into the browser

### Install

0. Install Node, npm, etc

1. Clone this repo

2. `npm install`

3. (_This step is already done for you if you clone the repo._) Create a "miner directory" for each node like this:
```
    miner1/
        config.toml
        data/
            <CID 1>
            <CID 2>
            [...]
    miner2/
        config.toml
        data/
            [...]
```

The files `CID 1` and `CID 2` represent files whose name is the Payload CIDs (no extension) of their contents.

4.  In a terminal:  `node rc.js -d ./miner1 -p 10333`

Copy the multiaddr this node is listening on.

5.  In a second terminal:

```
node rc.js -d ./miner2 -p 10334 \
-m (paste multiaddr from first terminal)
-r bafkki48dk2001mcdqblhp6k6k3lhk0s00saa6d3jk2lkvipqf9dd00dlck
```

This instructs the second miner to connect to the first (-m) and retrieve (-r) the CID `bafkki48dk2001mcdqblhp6k6k3lhk0s00saa6d3jk2lkvipqf9dd00dlck` from the retrieval network.


