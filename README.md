## JS Retrieval Client PoC

This is _proof of concept_ code, thrown together quickly to explore ideas.

What works:
* Bring up two or more identical nodes
* Each has a multiaddr and a port it's listening on
* Any other node can join the network by connecting to you at your multiaddr

What doesn't work:
* Not yet gossiping around the CIDs
* The protocol `/fil-retrieve/0.0.1` is not well defined yet.  Needs to use the FIL payment channels flow.
* CLI node app for now, but this could be browserified in the future

### Install

0. Install Node

1. Clone this repo

2. `$ npm install`

3.  `node rc.js -p 10333` to start the first instance of the app

4.  `$ node rc.js --help` for help

5.  (see instructions in HOWTO_RUN to bring up additional nodes and connect them together)

