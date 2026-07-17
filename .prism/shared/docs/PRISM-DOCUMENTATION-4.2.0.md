# PRISM Documentation — v4.2.0

> **Release theme: Model B is live.** The always-on agent daemon runs on the DO droplet
> (`digitalgriot-server-tor1`, Coolify-managed), dials the Griot relay from production, and pairs
> to the phone with the laptop off. This document covers the 4.2.0 delta.
>
> **Convention note:** the PRISM-DOCUMENTATION snapshot series lapsed after 3.8.0 (4.0.0's
> prism-plugin→prism rebrand and 4.1.0's semantic layer shipped without one). This file resumes
> the series scoped to its release delta; it does not reconstruct 3.8.0→4.1.0.

---

## 1. What shipped in 4.2.0

| Change | Commit | Effect |
|---|---|---|
| Relay endpoint format fix | `de2bb70` | `PASEO_RELAY_ENDPOINT` must be `host:port[/path]` (`prism.digitalgriot.studio:443/relay`). The daemon's `parseHostPort()` rejects scheme URLs — the previous `wss://…` value threw on every dial. TLS auto-derives from `:443`. |
| `PASEO_PASSWORD` enabled | `de2bb70` | Active in compose via Coolify env. Gates DIRECT `:6767` connections only (bearer subprotocol `paseo.bearer.<secret>` vs bcrypt hash). Relay connections are governed by offer-link possession + E2EE — the password is never consulted on that path. |
| Workspace bind-mount | `ce2b78b` | `/opt/griot-workspace` (host) → `/workspace` (container), so host-cloned repos are visible to agents. Previously a blank named volume. |
| lefthook build fix | `56cfbd4` | `"prepare": "lefthook install --force"` fails in-image (no `.git` dir). Dockerfile drops the script container-only via `npm pkg delete scripts.prepare`; postinstall patches + native builds preserved. |
| Swap prerequisite | `839334f` | RUNBOOK prereq 0: 4 GB swapfile required on droplets ≤ 4 GB RAM. First build without it thrashed the box unresponsive (observed live: load 145, SSH banner timeouts). |
| Git-credential mounts (optional) | `de2bb70` | Commented RO mounts for `~/.gitconfig` + `~/.git-credentials` so in-container agents can clone/push private repos. Host files must exist before uncommenting. |
| VSIX packaging fix | `d204a56` | `engines.vscode ^1.109.0` matches `@types/vscode`. |

## 2. Deployed state (production, 2026-07-17)

- **Resource:** Coolify → project *Prism Daemon* → `prism:main-daemon` (Docker Compose,
  base dir `/apps/prism-mobile`, compose `/deploy/docker-compose.yml`, repo `TheDigitalGriot/prism@main`).
- **Verified in container logs:** `Server listening on http://0.0.0.0:6767` · `authRequired: true`
  · `relay_control_connected` · offer generation via `npm run cli -- daemon pair` producing
  `https://prism.digitalgriot.studio/#offer=…` with `relay.endpoint = prism.digitalgriot.studio:443/relay`
  and the droplet's own `serverId` (`srv_-Xi2lw5SY7Zz`).
- **Speech models** (parakeet STT, kokoro TTS) auto-download to `/data/models/local-speech` on first boot.
- **Acceptance test** (phone pairs over relay, laptop off, agent streams): staged; pending user confirmation.

## 3. Deploy reference (canonical env)

```bash
PASEO_LISTEN=0.0.0.0:6767
PASEO_HOME=/data
PASEO_SOURCE_CHECKOUT_PATH=/workspace
PASEO_RELAY_ENABLED=true
PASEO_RELAY_ENDPOINT=prism.digitalgriot.studio:443/relay   # host:port[/path] — NEVER a scheme URL
# PASEO_RELAY_PUBLIC_ENDPOINT unset — defaults to PASEO_RELAY_ENDPOINT
PASEO_APP_BASE_URL=https://prism.digitalgriot.studio        # a real URL by design (offer links)
PASEO_PASSWORD=<secret via Coolify env>                     # empty/unset = direct-door auth disabled
```

Mounts: `/root/.claude:ro` (Claude Max credentials, minted by `claude login` on the host) ·
named volume → `/data` (daemon identity + state) · `/opt/griot-workspace` → `/workspace` (repos).

## 4. Operational learnings (RUNBOOK-backed)

1. **Swap before first build** — `fallocate -l 4G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile` (+fstab). Non-negotiable on ≤4 GB boxes.
2. **Coolify "Cancel" does not kill BuildKit** — a cancelled build keeps consuming the box. If the UI 504s and SSH times out, the build is still alive underneath; wait or power-cycle.
3. **Preflight builds** — `docker build -f deploy/Dockerfile -t griot-daemon:preflight .` from `apps/prism-mobile` on the droplet proves the image and surfaces errors without Coolify in the loop.
4. **Native modules are not the risk** — node-pty / better-sqlite3 / sherpa-onnx compile clean in `node:22-bookworm` (~3 min). The real first-build failures were lefthook (fixed) and memory (fixed).
5. **New-repo workflow** — laptop and droplet never sync directly; GitHub is the hub. From the phone, tell any agent on the droplet to `git clone` into `/workspace` — the agent is your hands on the server.

## 5. Security model (documented in the 2026-07-15 brainstorm ledger)

Two doors into the daemon:

| Door | Path | Gates |
|---|---|---|
| Direct `/ws` | LAN / loopback / routed | host allowlist → origin check → `paseo.bearer` vs bcrypt (`PASEO_PASSWORD`) |
| Relay | phone, anywhere | offer-link possession → Curve25519/NaCl E2EE (zero-knowledge relay); password not consulted |

The droplet publishes no ports → relay door only → **the offer link is the credential; treat it
like a password** (upstream SECURITY.md's own words). Parked for the future sovereign rename:
`paseo.bearer.` is wire-visible — renaming must keep accepting the old prefix (back-compat rule).

## 6. References

- `apps/prism-mobile/deploy/RUNBOOK.md` — deploy playbook (prereqs 0–3, verify, iteration points)
- `.prism/shared/handoffs/2026-07-15_03-16-02_model-b-droplet-deploy-execution.md`
- `.prism/shared/brainstorms/2026-07-15-paseo-password-auth-map.md`
- Live docs: `prism-docs/docs/daemon/{surface-connectivity,relay,adapters,clients,broker}.md`
