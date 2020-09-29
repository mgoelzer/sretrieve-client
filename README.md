## JS Client for /fil/simple-retrieve Protocol in Lotus

This is a simple client for use with Lotus versions that support `/fil/simple-retrieve`. The client receives data and sends payment vouchers. The server component, inside Lotus, receives vouchers and sends data back.

The protocol is described in [`lotus/simpleretr/doc.go`](https://github.com/mgoelzer/lotus/blob/simple-retrieve/simpleretr/doc.go).

### Install and Run

1. Clone this repo
1. `npm ci`
1. Make sure you have lotus-miner node that is running on the >= v0.7.1 testnet and contains the patch from `github.com/mgoelzer/lotus#simple-retrieve`
1. Get your miner's multiaddr. Start with the Public Address of `lotus-miner net reachability`. Append `/p2p/`. Append your peer id from `lotus-miner net id`.

Here's an example of a complete multiaddr with peer id::

```
/ip4/192.168.1.23/tcp/5556/p2p/12D3KooWSEXpjM3CePSAfmjYDo4dfFUgcNW55pFK3wfukhT1FMtB
```

5. Run the client like this:

```
npm start -- -- -m (paste multiaddr from step 4) -p 10334
```

---

License: MIT
