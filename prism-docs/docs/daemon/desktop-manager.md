---
title: Desktop Daemon-Manager
description: How the Electron desktop spawns, supervises, and tears down the broker process.
outline: [2, 3]
---

# Desktop Daemon-Manager

`apps/prism-electron/src/daemon` — the desktop is the **host** of the shared broker. It spawns
and supervises the broker as a child process so all surfaces can share one running daemon, while
the in-process agent loop stays untouched (the "hybrid + bridge" model).

## Spawn: `utilityProcess.fork` on a bundle

Electron ships its own Node, so the broker is run via **`utilityProcess.fork`** on an esbuilt
single-file bundle — no external Node, no `runtime-paths` hunt:

- `scripts/build-daemon.mjs` esbuilds `packages/prism-daemon/src/index.ts` →
  `daemon-dist/prism-daemon.cjs` (+ `services.config.json` + `meta.json`), shipped **outside the
  asar** via forge `extraResource` so it can be forked at runtime.
- `ws`'s optional native deps (`bufferutil`, `utf-8-validate`) are left external; ws falls back
  to pure JS.

## Supervisor state machine

`DaemonManager` is **electron-free** (injected `fork` / `fetch`) so it unit-tests headless:

| Behavior | Detail |
|---|---|
| **adopt** | If `:6780/health` already answers before we spawn, adopt the running broker (and don't kill it on quit — "stop only what we started"). |
| **spawn + probe** | Fork the bundle, then poll `/health` until `running` (or `error` on timeout). |
| **crash-restart** | On unexpected child exit, restart with backoff (1→2→4→8→16 s, max 5). |
| **version-sync** | Compare `/health` version against `meta.json`; restart once on mismatch. |
| **stop** | Kill only a broker we spawned, on `before-quit`. |

Restart is **race-free**: `_proc` is detached *before* the kill, and each exit handler is bound
to its own child (`if (child !== this._proc) return`), so a stale child's late async exit
self-ignores.

## App wiring

- Started **eagerly** on `app.ready`; killed on `before-quit` (adopt-aware).
- IPC: `daemon:status | start | stop | restart`; status forwarded to the renderer via
  `daemon:statusChange`.
- Renderer: a **daemon status dot** in the `BottomStatusBar` (running = green, starting = amber
  pulse, error = red, stopped = dim) with version + port on hover.

## Status shape

```ts
interface DaemonStatus {
  status: "stopped" | "starting" | "running" | "error"
  port: number
  pid: number | null
  version: string | null
  adopted: boolean
  versionMismatch: boolean
  message?: string
}
```
