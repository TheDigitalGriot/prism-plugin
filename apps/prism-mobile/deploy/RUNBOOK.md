# Always-on Griot daemon — Coolify deploy runbook

Goal: run the existing paseo agent daemon on the DO droplet (`digitalgriot-server-tor1`) via
Coolify so agents keep running with the P16 off. The relay is already live; this is the daemon.

> **Honest expectation:** this is a v1 container. The paseo daemon was designed to run on your
> own machine, so the first build may surface native-dep / system-lib issues (node-pty, sqlite,
> sherpa speech). We iterate on the log output. Nothing here touches the frozen paseo baseline.

## Files (in `apps/prism-mobile/deploy/`)
- `Dockerfile` — node:22, installs + `build:daemon`, runs `supervisor-entrypoint.js`.
- `docker-compose.yml` — service + 3 volumes (Claude auth RO, `/data` state, `/workspace` repos).
- `.env.example` — the env vars, documented.

## Prerequisites — do these ONCE on the droplet (your hands)

1. **Claude Max auth on the box.** SSH to the droplet and run the Claude CLI login so credentials
   land in `~/.claude` (this is what the container mounts read-only):
   ```bash
   npm install -g @anthropic-ai/claude-code     # if not present
   claude login                                  # follow the device/URL flow with your Max account
   ls ~/.claude                                  # confirm credentials exist
   ```
2. **Clone your Griot repos** into a location the workspace volume will hold (agents operate here):
   ```bash
   mkdir -p /opt/griot-workspace && cd /opt/griot-workspace
   git clone https://github.com/TheDigitalGriot/prism-plugin.git
   # …and any other Griot repos you want agents to work on
   ```
   (Or let the workspace volume start empty and clone from inside later.)
3. **Git credentials for private repos (so agents in the container can clone/push).** On the host:
   ```bash
   git config --global credential.helper store
   # store a PAT once (or run any authenticated clone and let git prompt):
   printf "https://<github-user>:<PAT>@github.com\n" > ~/.git-credentials && chmod 600 ~/.git-credentials
   ```
   Then uncomment the two `.gitconfig`/`.git-credentials` mounts in `docker-compose.yml`.
   Skip this for public repos — agents can still clone those with no credentials.

## Deploy in Coolify (your clicks)

1. **New Resource → Docker Compose** (or "Dockerfile") in your project.
2. **Source:** point it at the `prism-plugin` repo, **base directory** `apps/prism-mobile`,
   compose file `docker-compose.yml`. (Coolify builds with context = `apps/prism-mobile`.)
3. **Environment:** paste from `.env.example` (adjust if needed). Set `PASEO_PASSWORD` if you want
   client auth.
4. **Volumes / mounts** — confirm the three:
   - `/root/.claude` → `/root/.claude` **read-only** (the host dir from step 1).
   - named volume → `/data` (persistent state).
   - host `/opt/griot-workspace` (or named volume) → `/workspace`.
5. **Deploy.** Watch the build log — the `npm install` + `build:daemon` step is the long one.

## Verify it's alive

- **Coolify logs** should show the daemon binding `0.0.0.0:6767` and a relay connection to
  `prism.digitalgriot.studio/relay` (look for a relay/welcome line; a pairing offer URL).
- **Pair a client:** from your phone/app, pair via the relay (QR / offer URL). It should connect
  to the droplet daemon — with your P16 off.
- **Sanity from a surface:** point `prism-cli daemon ls` (or the desktop) at the brokered
  `agent-run` once it's pointed at this daemon, and confirm `ready`.

## Known iteration points (flag if the log complains)
- **Relay endpoint format — RESOLVED (2026-07-15).** Must be `host:port[/path]` =
  `prism.digitalgriot.studio:443/relay`. The daemon's `parseHostPort()` rejects scheme URLs
  (`wss://…` throws `Invalid host:port`); TLS is auto-derived from `:443`. This is the same
  form the proven-working local daemon config uses.
- **Native modules.** If `npm install` fails on `node-pty` / `better-sqlite3` / `sherpa-onnx`,
  add the missing system lib to the Dockerfile `apt-get` line (or disable speech/dictation env).
- **Home dir for `~/.claude`.** Container runs as root → `/root/.claude`. If you run as a
  non-root user, mount to that user's home and set `HOME` accordingly.
- **Workspace permissions.** Agents write to `/workspace`; ensure the volume is writable by the
  container user.

## Why this is the keystone
This daemon is `apps/prism-mobile/packages/server` — the same agent substrate every Prism surface
can broker into (`agent-run` → `:6767`). Running it here, fronted by the live relay, is what makes
the suite *infrastructure* instead of a laptop tool. Same container pattern can host future Griot
daemons.
