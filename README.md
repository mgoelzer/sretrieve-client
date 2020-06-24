## JS Retrieval Client PoC

This is _proof of concept_ code, thrown together quickly to explore ideas.

What works:
* Brings up two or more identical nodes
* Each node listens on a port and prints its multiaddr.
* Any node can connect to any other node by providing a peer's address with `-m <multiaddr to dial>`

What doesn't work:
* Gossipsub - investigating this...
* Not yet gossiping around the CIDs
* The protocol `/fil-retrieve/0.0.1` is not well defined yet.  Needs to use the FIL payment channels flow.
* Not able to run in browser right now due to CLI dependency, but this is an easy fix

### Install

1. Clone this repo, and `cd` into it

2. `npm install`

3.  node rc.js --help     # Informational

4.  node rc.js -p 10333

5.  (follow the instructions in HOWTO_RUN to bring up additional nodes)
