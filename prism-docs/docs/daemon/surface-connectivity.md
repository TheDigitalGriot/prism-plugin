---
title: Surface Connectivity & Pairing
description: How each Prism surface reaches the agent daemon, and how a phone pairs from anywhere via the relay pairing link.
outline: [2, 3]
---

# Surface Connectivity & Pairing

> Introduced in **v3.9.0** — the relay pairing landing page closes the "pair from anywhere" loop.

How each Prism surface (CLI · VS Code · Electron · Mobile) reaches the agent substrate, and how a
phone pairs to the daemon by opening a single link — the keystone for the **always-on droplet**.

## The substrate: daemon, broker, relay

Two long-running processes make up the substrate: the **agent daemon** on `:6767` (the vendored
paseo fork, `apps/prism-mobile/packages/server`) and the **broker** on `:6780`
(`packages/prism-daemon`).

```
                       ┌───────────────────────── the machine ─────────────────────────┐
  desktop surfaces ───▶│  Broker :6780  (packages/prism-daemon)                          │
  (CLI/VSCode/Electron)│    WS + HTTP /call · registry/router/session                     │
                       │        ├─ agent-run  ──(websocket adapter)──▶  Agent daemon :6767 │──┐
                       │        ├─ code-intel · design-gen · knowledge · 3d-gen · …        │  │
  mobile app ─────────────────────────────────────────────────────▶  Agent daemon :6767 ◀─┘  │
   (LAN or relay)      │                          (packages/server · /ws · agent lifecycle)   │
                       └──────────────────────────────────────────────────────────────────────┘
                                        │ dials OUT
                                        ▼
                         Griot relay  wss://prism.digitalgriot.studio/relay
                         (Cloudflare Worker + Durable Object, E2EE)
                                        ▲
                                        │ pairs via offer (serverId + daemon pubkey + relay endpoint)
                                   mobile app (off-LAN)
```

- **Desktop/CLI surfaces** talk to the **broker** (`:6780`). See [Surface Clients](/daemon/clients).
- The **mobile app** talks to the **agent daemon** (`:6767`) — directly on the LAN, or via the
  **Griot relay** from anywhere.
- The relay is **ours**: `prism.digitalgriot.studio/relay` (a Cloudflare Worker + Durable Object).
  Pairing offers encode *that* relay + the daemon's public key — never a third party's.

## The three ways a client reaches the daemon

`:6767` is the join point. How a client dials it depends on where the client is:

| Client location | Address | Requirement |
|---|---|---|
| **iOS Simulator** (same machine) | `127.0.0.1:6767` | daemon on loopback (default) |
| **Physical device, same Wi-Fi** | `<machine-LAN-IP>:6767` | daemon bound `0.0.0.0` + firewall allows inbound |
| **Physical device, anywhere** | Griot **relay** (paired by offer) | daemon relay-connected; phone paired |

> **Why a phone can't use `127.0.0.1`:** on the phone, `127.0.0.1` is the *phone itself*. A real
> device needs the machine's LAN IP (daemon bound `0.0.0.0`, not loopback-only) or the relay.

Bind for LAN/relay: start the daemon with `PASEO_LISTEN=0.0.0.0:6767`.

## The relay + pairing flow

```
Daemon ──(role=server)──▶  wss://prism.digitalgriot.studio/relay/ws?serverId=…&role=server
                                        │  Durable Object holds the channel
Phone  ──(offer: serverId+pubkey+relay)─▶  same DO channel ──▶  E2EE session to the daemon
```

- **Offer** (`daemon pair` / `generateLocalPairingOffer`): a base64url fragment
  `https://prism.digitalgriot.studio/#offer=<b64>` where `<b64>` decodes to
  `{ v, serverId, daemonPublicKeyB64, relay: { endpoint } }`.
- **E2EE:** Curve25519 + NaCl box between the phone and the daemon (see [E2EE Relay](/daemon/relay));
  the relay only shuttles ciphertext.
- **Same daemon = same identity:** `serverId`/keypair live in `~/.thedigitalgriot/`, so re-pairing a
  device is stable across restarts.

## Pairing landing page + universal links (v3.9.0)

The offer payload lives in a **URL fragment** (`#offer=`), which never reaches a server — so a
client-side page has to read it and bridge into the app. Before v3.9.0 the offer host (the apex
`prism.digitalgriot.studio/`) had no origin (only `/relay/*` was routed), so opening the link
returned Cloudflare **522**. v3.9.0 ships the missing piece:

- **Landing page** served by the relay Worker at the apex (`/` and `/pair`). It reads `#offer=`
  client-side, shows the offer's server + relay, and bridges into the app via the `prism://`
  custom scheme (with an "app not installed" fallback). Source:
  `apps/prism-mobile/packages/relay/src/pairing-page.ts`.
- **iOS universal links** — an Apple App Site Association at
  `/.well-known/apple-app-site-association` lets the `https://…/#offer=` link open the app
  **directly**, no browser hop. `ios.associatedDomains` is declared in the app config.
- **Route widened** `prism.digitalgriot.studio/relay/*` → `/*`, so the apex hits the Worker instead
  of a missing origin (relay traffic is unchanged).

**Acceptance:** open `https://prism.digitalgriot.studio/#offer=…` on the phone → land on the page
(or straight into the app via a universal link) → the app pairs over `/relay` → the agent runs.

::: tip Interim without the landing page
If you're on an older client or a Metro dev-client build, pair **inside the app** (scan the QR /
paste the offer link) — the app decodes the `#offer=` fragment locally. A standalone build gets the
browser "Open in Prism" button and universal links.
:::

## Always-on: the droplet (Model B) — LIVE

The same daemon runs laptop-independently on the DO droplet via Coolify
(`apps/prism-mobile/deploy/`, resource `prism:main-daemon`): `node:22-bookworm`,
`PASEO_LISTEN=0.0.0.0:6767`, `PASEO_HOME=/data`, dialing the **same** Griot relay with
`PASEO_RELAY_ENDPOINT=prism.digitalgriot.studio:443/relay`, and
`PASEO_APP_BASE_URL=https://prism.digitalgriot.studio` so its offers point at the landing page. The
phone pairs to the droplet daemon identically — the offer just carries the droplet's `serverId`.

::: warning Endpoint format (fixed in v4.2.0)
`PASEO_RELAY_ENDPOINT` is **`host:port[/path]`** — never a scheme URL. The daemon's
`parseHostPort()` throws on `wss://…`; TLS is auto-derived from `:443`.
:::

::: tip Deployed in v4.2.0
Verified in production: `relay_control_connected` from the droplet, `authRequired: true`
(`PASEO_PASSWORD` via Coolify env — gates the direct door only; the relay door's credential is the
offer link itself). Hard-won prerequisites: **4 GB swap** before the first image build
(≤4 GB droplets thrash without it), host repos bind-mounted `/opt/griot-workspace → /workspace`,
and lefthook's `prepare` script dropped inside the image (no `.git` in the build context).
Full playbook: `apps/prism-mobile/deploy/RUNBOOK.md`.
:::
