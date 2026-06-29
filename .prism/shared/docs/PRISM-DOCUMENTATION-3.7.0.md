# Prism - Complete Documentation v3.7.0

> A multi-platform development workflow suite for autonomous AI-driven development.
> Includes a Charmbracelet TUI dashboard (Go), a VS Code extension (TypeScript/React),
> an Electron desktop app (TypeScript/React), a vendored Expo mobile surface, and a
> sovereign multi-service daemon-broker that every surface speaks to.

---

## What's New in 3.7.0 — The Explorer Arc

3.7.0 does two things: it **closes the deferred work from the Daemon Arc** (3.6.0) and it
ships the **interactive Architecture Explorer** — a navigable map of the whole system that
turns the codebase graph into something you can actually walk. It also includes a full
repair + hardening of the **VS Code extension surface**, which had stopped loading on newer
editor engines.

> **Continuity:** every item the 3.6.0 doc listed as "Deferred" — the VS Code-side broker
> forwarder, QR-pairing UI, `/prism-wiki`, knowledge→Graphify wiring, and the first
> full-managed agent client — lands here.

### Added — Architecture Explorer

- **Interactive Prism Architecture explorer** with **three views**:
  - **Runtime** — the live surface ↔ seam ↔ broker ↔ services topology.
  - **Workflows** — the Research → Plan → Implement → Validate phases and their agents.
  - **Plugin** — every **skill / command / agent / hook / script** rendered as its own node.
- **Node expansion** for drill-down into any component, and **GitHub Pages deploy** so the
  explorer ships as a browsable site alongside the VitePress docs.

### Added — Daemon substrate completion

- **`AgentRunClient`** (`packages/prism-daemon-client`) — brokered agent substrate
  (full-managed, **step 1**): agent runs route through the daemon broker rather than a
  direct connection, the seam-bridge "transport flip" the Daemon Arc was built for.
- **Knowledge service → `graphify-mcp`** — the broker's `knowledge` service is wired to
  Graphify over **stdio-MCP**.
- **Relay pairing** — relay pairing endpoint + **desktop QR-pairing UI**, completing the
  E2EE relay's off-LAN device handoff (`pairingInfo` daemon public key → QR).

### Added — Code intelligence

- **`/prism-wiki` command** — turns the code-intelligence graph into an **architecture wiki**,
  plus a generated repository overview. The graph→docs capability deferred in 3.6.0.

### Added — VS Code seam bridge

- **VS Code broker forwarder** (`VscodeWebviewProvider`) — the VS Code webview's existing gRPC
  client now reaches brokered services (code-intel / design-gen / etc.) via `POST :6780/call`
  when the daemon broker is running (adopt-only; mirror of the Electron side shipped in 3.6.0).

### Fixed — VS Code extension surface

- **Extension would not load on Cursor / newer-engine editors** — `apps/prism-vscode` declared
  `engines.vscode` `^1.109.0` (set at v3.0.0), newer than the editor's VS Code base
  (e.g. Cursor 2.4.31), so the editor **silently excluded** it — Prism was absent from **both**
  the activity-bar sidebar and the bottom panel. Restored to `^1.84.0` (the last known-good
  "working ecosystem" value). The version-bump script does not manage this field, so it will
  not regress.
- **Blank sidebar / bottom-panel webviews** — providers selected Vite HMR mode from the mere
  existence of a `.vite-port` / `.vite-panel-port` / `.vite-office-port` file, so a stale file
  from a dead dev server routed the webview at a dead `localhost`. Removed stale port files and
  built the sidebar production bundle. (Tree views are native and were unaffected.)
- **Release version-string drift** — bump script now syncs all version strings (incl.
  `prism-mobile`) and tracks previously-missed files.

### Changed — Webview robustness

- **Live dev-server detection** — new shared helper `viteDevServer.ts` (`resolveLiveViteServer`)
  performs a fast **TCP liveness probe** of the advertised port before choosing HMR; a stale or
  dead port falls back to the production build. Wired into all three webview providers
  (`VscodeWebviewProvider`, `PrismPanelProvider`, `OfficeViewProvider`); base
  `WebviewProvider.getHtmlContent` widened to `string | Promise<string>`. Preserves HMR and adds
  zero latency when no port file exists.
- `apps/prism-vscode/.gitignore` now ignores the panel/office dev-server port files so stale
  pointers can't be committed.

### Verified (no code change)

- **prism-electron** tested end-to-end: `build:daemon` ✓, single window with a Vite-served
  renderer ✓, broker **adopts** the running daemon on `:6780` (`/health` → 7 services, ready) ✓,
  no crash. Electron is **immune** to the VS Code stale-port class — it binds
  `MAIN_WINDOW_VITE_DEV_SERVER_URL` at build time, not via a runtime port file. A background/
  non-TTY launch makes `electron-forge start` exit cleanly (forge's stdin readline hits EOF); in
  a real terminal the window persists.

---

## Architecture (v3.7.0)

```
Surfaces:  CLI (Go/Bubble Tea) · VS Code (TS/React) · Electron (TS/React, reuses VS Code src) · Mobile (vendored Expo)
                                  │
              in-process gRPC seam (grpc-handler, postMessage/IPC)  ─┐
                                  │                                  ├─ same {service,method,payload} envelope
              over-the-wire broker (WebSocket :6780 + HTTP /call)  ─┘   (VS Code + Electron both forward here)
                                  │
   ┌──────────────┬──────────────┼───────────────┬───────────────┐
 agent-run     code-intel     design-gen      knowledge        3d-gen / cinopsis / notebooks
 (paseo WS,    (stdio MCP)    (REST relay)    (Graphify,        (Flask HTTP, try-local→cloud)
  AgentRunClient)                              stdio-MCP)
                                  │
                          relay (E2EE, @prism/relay) → off-LAN clients via QR pairing
                                  │
                    Architecture Explorer (Runtime / Workflows / Plugin views) → GitHub Pages
```

The Electron desktop supervises the broker (spawn / health / restart / version-sync / quit);
the VS Code extension adopts it (adopt-only, fixed port).

---

## Prior Releases

See `PRISM-DOCUMENTATION-3.6.0.md` (the Daemon Arc) and `PRISM-DOCUMENTATION-3.5.2.md` and
earlier for the full cumulative history (Spectrum hardening, brainstorm visual companion,
prism-subagent, and the Research → Plan → Implement → Validate core).
