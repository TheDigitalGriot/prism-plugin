# Continue: Prism Always-On Daemon (Model B) — Claude Code IDE prompt

> Paste the block below into Claude Code running in `C:\Users\digit\GriotApps\Prism`.
> It carries the full workstream state so a fresh session resumes with zero re-discovery.

---

## The paste-ready prompt

We're resuming the **Prism Always-On Daemon** workstream (end-to-end, every surface). Repo root
is the source of truth. **Do not re-derive state — read these first, in order:**

1. `.prism/shared/handoffs/2026-07-07_03-21-33_always-on-droplet-model-b.md` — the terminal handoff (the mission + exactly what's left).
2. `.prism/shared/docs/SURFACE-CONNECTIVITY-AND-TESTING.md` — how CLI / VS Code / Electron / Mobile each reach the daemon; §7 droplet, §4 device testing.
3. `.prism/shared/validation/2026-06-30-prism-mobile-daemon-bringup.md` — Model-A bring-up, the two bugs already fixed, reproducible sequence.
4. `apps/prism-mobile/deploy/RUNBOOK.md` — the Coolify droplet deploy playbook.
5. Live docs: `prism-docs/docs/daemon/{surface-connectivity,relay,adapters,clients,broker,seam-bridge,desktop-manager}.md`.

### Where the workstream stands (confirmed 2026-07-12, v4.0.0)

**The substrate (two long-running processes):**
- **Agent daemon** `:6767` = `apps/prism-mobile/packages/server` (vendored paseo fork). Manages agent
  processes, streams over `/ws`, dials OUT to the Griot relay. `PASEO_HOME` = `~/.thedigitalgriot/`.
- **Broker** `:6780` = `packages/prism-daemon`. Desktop surfaces (CLI/VSCode/Electron) speak to the
  broker; it brokers `agent-run` → the daemon via the `websocket-paseo` adapter.
- **Relay** = ours: `wss://prism.digitalgriot.studio/relay` (Cloudflare Worker + Durable Object,
  Curve25519 + NaCl E2EE). **LIVE and deployed.** Mobile pairs to the daemon over it from anywhere.

**DONE (do not redo):**
- ✅ Model-A local bring-up: daemon `:6767` + broker `:6780`, `prism-cli daemon ls` renders,
  `agent-run` = **ready**. Two bugs fixed: (A) `paseo-websocket.ts` path→`/ws` + `server_info`
  handshake; (B) `prism-cli/daemon/client.go` `SetReadLimit(1<<20)`. Both carry into the droplet verify.
- ✅ Relay pairing landing page + iOS universal links — deployed. `https://prism.digitalgriot.studio/#offer=…`
  returns 200 and bridges to the app. AASA served, Apple Team `M6K8N36JN8`.
- ✅ Offer/pairing works today via in-app paste/scan on the existing dev-client build.

**OPEN — the last mile (this is the work):**
- ⬜ **Deploy the droplet daemon (Model B)** on DO droplet `digitalgriot-server-tor1` (159.203.62.10)
  via Coolify, per `apps/prism-mobile/deploy/RUNBOOK.md`. Container: `node:22-bookworm`,
  `PASEO_LISTEN=0.0.0.0:6767`, `PASEO_HOME=/data`, `PASEO_RELAY_ENDPOINT=wss://prism.digitalgriot.studio/relay`,
  `PASEO_APP_BASE_URL=https://prism.digitalgriot.studio`. Three mounts: `~/.claude` RO, `/data` state,
  `/workspace` repos. Expect first-deploy native-dep friction (node-pty / better-sqlite3 / sherpa-onnx)
  — iterate on Coolify build logs, add apt libs to the Dockerfile as needed.
- ⬜ **Model-B acceptance test:** generate an offer on the **droplet** daemon → open its `#offer=` link
  on the phone → pairs over the relay **with the P16 laptop off** → drive an agent and watch it stream.
- ⚠️ **Optional (not blocking):** rebuild the iOS `preview` standalone **interactively** so browser
  tap-to-open + universal links work on-device — the prior non-interactive build `bd59deb7` errored
  because EAS reused the pre-entitlement provisioning profile (see handoff §L5):
  `cd apps/prism-mobile/packages/app && npx eas-cli build -p ios --profile preview` (NO `--non-interactive`).

### Standing decisions (honor these)
- **"Set up first, then go sovereign."** The cosmetic rename (`PaseoWebSocketAdapter → AgentDaemonAdapter`,
  `websocket-paseo → websocket-agent`, `PASEO_* → PRISM_*`, 5 files / 41 tests) stays **deferred** and
  untouched until explicitly greenlit. The wire is already 100% Griot — verify any offer's
  `relay.endpoint` reads `prism.digitalgriot.studio`.
- **Node 22 only** for the daemon (native ABI; machine default is 24 → `nvm use 22.20.0`). The droplet
  Dockerfile pins `node:22-bookworm`, so the container is correct by construction.
- Don't casually `kill` a running `:6767` daemon — it supervises live agent processes.

### Local rehearsal (to re-prove the daemon before/without the droplet), from `apps/prism-mobile`:
```
nvm use 22.20.0
npm run build:daemon                          # highlight → relay → server → cli (MANDATORY)
PASEO_LISTEN=0.0.0.0:6767 npm run start        # binds 0.0.0.0:6767, dials the relay
npm run cli -- daemon pair                      # prints QR + https://prism.digitalgriot.studio/#offer=…
# broker, from repo root:
npx tsx packages/prism-daemon/src/index.ts      # ws://127.0.0.1:6780
apps/prism-cli/bin/prism-cli.exe daemon ls      # expect agent-run = ready
```

**Start by** reading the 5 references above, then propose the Model-B deploy plan (droplet prep →
Coolify config → first-deploy log iteration → acceptance test) and wait for my nod before executing.
Housekeeping note: the working tree has a batch of doc files showing as modified (rename/EOL churn from
the v4.0.0 `prism-plugin → prism` rebrand) — check `git status`/`git diff` and confirm before committing
anything alongside daemon work.

---

*Generated 2026-07-12 from chat-log-access review + GriotApps/Prism source of truth (v4.0.0, commit `f1671b6`).*
