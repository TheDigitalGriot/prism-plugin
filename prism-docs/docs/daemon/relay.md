---
title: E2EE Relay
description: The sovereign zero-knowledge relay that gives off-LAN clients encrypted access to the broker.
outline: [2, 3]
---

# E2EE Relay

`packages/prism-relay` (`@prism/relay`) — a **sovereign extraction** of paseo's zero-knowledge
relay, giving remote clients (a phone on cellular) encrypted access to a broker behind a home
firewall, with no inbound port opened. The broker dials **out** to the relay; each remote client
is a multiplexed channel the broker treats as a virtual session.

## Crypto

- **Key exchange:** Curve25519 (`nacl.box.before`).
- **Encryption:** XSalsa20-Poly1305 (`nacl.box.after` / `open.after`), via `tweetnacl`.
- **Bundle:** `[nonce (24 bytes)][ciphertext…]`, transmitted as base64 text over WebSocket.

Public API:

```ts
generateKeyPair() / exportPublicKey() / importPublicKey() / deriveSharedKey() / encrypt() / decrypt()
createClientChannel(transport, daemonPubKeyB64, events)   // initiator (remote client)
createDaemonChannel(transport, daemonKeyPair, events)     // responder (the broker)
class EncryptedChannel { send(); close(); isOpen(); … }
```

## Handshake

```
client → { type:"e2ee_hello", key: <client pubkey b64> }
daemon → { type:"e2ee_ready" }
…both sides derive the same shared key via ECDH; all subsequent frames are ciphertext…
```

The client receives the daemon's public key out-of-band (a **QR code**) and derives the shared
key locally — the relay server itself is **zero-knowledge** and only routes encrypted bytes.

## Wiring under `connectRelay()`

The broker's `RelayClient` gained an optional crypto layer. When a `daemonKeyPair` is supplied,
**every channel is end-to-end encrypted**; without it, frames forward in the clear (back-compat).
The bridge seam is unchanged — only the per-channel transport gets encrypted.

```ts
await broker.connectRelay(url, { daemonKeyPair })   // E2EE
broker.pairingInfo(relayUrl)                         // → { relayUrl, token, pubKey }  (pubKey for the QR)
```

A full encrypted relay round-trip is covered by tests: a remote client pairs via the daemon
pubkey → ECDH handshake → exchanges encrypted `hello`/`welcome` and `call`/`response` frames
through the relay.

## Sovereignty

`@prism/relay` is registered in the Sovereign Fork Registry as an extracted fork of paseo's
relay (Curve25519 + NaCl box). The crypto is Prism-owned source, never a runtime dependency.

::: tip Deferred
The QR-pairing **UI** and verification against the live Cloudflare relay server (self-hosted on
DO / Coolify) are follow-ups; the crypto + channel wiring ship in v3.6.0.
:::
