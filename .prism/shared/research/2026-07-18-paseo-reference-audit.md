---
date: 2026-07-18
researcher: Claude
git_commit: 27693716ba78f6856265f5d93b1029bed3faa992
branch: main
topic: "PASEO reference audit — definitive rename inventory (go-sovereign prep)"
tags: [research, audit, paseo, rename, sovereign, wire-compat, branding, deploy]
status: complete
---

# PASEO Reference Audit — the definitive rename inventory

**Research question:** Every "paseo" reference in the Prism monorepo — text, code identifiers,
env vars, images/icons/splash, website assets, deployed/hosted values — categorized per the
v4.2.0 handoff §PASEO Audit Spec, so the sovereign rename can be greenlit with full knowledge
of what renames freely and what needs a dual-accept seam.

**Rule honored:** AUDIT ONLY. Zero renames performed. "Set up first, then go sovereign" holds.

## Summary

The monorepo carries **7,410 case-insensitive "paseo" matches across 716 files** (gitignored
`node_modules/`, `dist/`, `package-lock.json` excluded; hidden files included). ~91% sit inside
the vendored fork `apps/prism-mobile/` (6,746 in 622 files). Prism's own surfaces
(`apps/prism-vscode`, `apps/prism-cli`, `apps/prism-electron`, `apps/prism-setup` source) are
**already clean** — the only Prism-side references are the deliberately-named paseo-dialect
adapter in `packages/prism-daemon` (61 in 9 files), 8 prism-docs pages (21 in source), and
living state docs at the root.

Three findings shape the whole rename:

1. **The fork's signature is "paseo names, sovereign values."** Every *deployed value* is
   already Prism/digitalgriot (droplet relay `prism.digitalgriot.studio`, bundle id
   `com.thedigitalgriot.prism`, scheme `prism://`, default home `~/.thedigitalgriot`, npm scope
   `@thedigitalgriot/*`) — but the *names/keys* around them (`PASEO_*` env keys, `paseo.bearer`,
   `paseo.json`, CLI `paseo`, `@paseo:` storage keys) are still upstream.
2. **The wire seam is wider than the parked `paseo.bearer` item** — 10 contract surfaces need
   dual-accept or grandfathering (§1), including WS message-type literals, a wire-visible field
   name, the `paseo.json` user-repo config contract, and 13 persisted `@paseo:*` device-storage
   keys (one of which, `daemon-registry`, holds the phone's paired-daemon list).
3. **Zero visual assets have been replaced.** The 2026-07-12 app-icon plan is `awaiting-approval`
   and unexecuted; commit `16b6eac` only *recolored* the Paseo glyph. All **40** assets still
   carry Paseo marks (§5).

Counts per category: §8. Proposed sequencing: §9.

**Method:** ripgrep sweeps (`--hidden`, gitignore-respected) by token class
(`PASEO_[A-Z0-9_]+`, `\bPaseo[A-Za-z]+`, `@paseo:`, `@getpaseo/`, `paseo\.(sh|dev)`,
`paseo\.bearer`, filenames via glob) + full reads of deploy/EAS/electron-builder/fastlane/nix
configs + three parallel Explore agents (deployed surfaces · visual assets · user-visible text).
Line numbers are as of commit `2769371`. **Verification pass (2026-07-18):** the Category-1
wire seams and the highest-stakes Category-6 config claims — electron-builder publish feed,
`eas.json` ascAppId, fastlane `app_identifier`, and app.config.js sovereignty — were
eyeball-verified against source (not agent summaries); all held. Corrections from that pass are
folded in below and flagged `[v]`.

Flags used below: **CHANGE** = rename/edit text · **GENERATE** = produce a new branded asset ·
**SEAM** = needs dual-accept/migration · **HOLD** = grandfather or leave as historical record.

---

## §1 · Category 1 — Wire/protocol-sensitive (highest care)

Governing rule (`apps/prism-mobile/CLAUDE.md:65-70`): **never break old clients against new
daemons** — old phones keep running against updated daemons for months. Every item here is a
contract with something that does not update atomically with the repo.

### 1-A · WS bearer subprotocol `paseo.bearer.<secret>` — SEAM (the parked item)

| Ref | Role |
|---|---|
| `apps/prism-mobile/packages/server/src/server/auth.ts:70` | daemon extract: requires literal segments `paseo`,`bearer` |
| `apps/prism-mobile/packages/server/src/server/auth.ts:83` | daemon validate: rejects unless `paseo.bearer.*` |
| `apps/prism-mobile/packages/server/src/client/daemon-client.ts:911` | client sends `` `paseo.bearer.${password}` `` |
| Tests | `auth.test.ts:49-51`, `bootstrap-auth.test.ts:118-127`, `daemon-client-transport.test.ts:90,95`, `daemon-client.test.ts:226` |

Risk: **CRITICAL wire literal.** Travels as the WS `Sec-WebSocket-Protocol` header on direct
`/ws` connections. Deployed impact: droplet daemon (Coolify) + every installed app/CLI.
Seam: daemon accepts `prism.bearer.` **and** `paseo.bearer.` first; clients flip senders one
release later (or offer both subprotocols in the `protocols` array — WS negotiation picks one).
Note: relay path bypasses this entirely (`attachExternalSocket`, websocket-server.ts:697), so
the droplet's *relay* pairing is unaffected mid-transition.

### 1-B · WS message-type literals — SEAM or HOLD (recommend HOLD/grandfather)

`apps/prism-mobile/packages/server/src/shared/messages.ts`:

| Line | Literal |
|---|---|
| 1371 | `paseo_worktree_list_request` |
| 1378 | `paseo_worktree_archive_request` |
| 1391 | `create_paseo_worktree_request` |
| 2986 | `paseo_worktree_list_response` |
| 2995 | `paseo_worktree_archive_response` |
| 3005 | `create_paseo_worktree_response` |

Locked by `src/shared/wire-compat.test.ts:264-307` (which pins the legacy shape against
upstream issue `getpaseo/paseo#55`) and `messages.attachments.test.ts:231-291`. Risk:
**CRITICAL** — old apps send/expect these exact strings. Renaming means daemon accepts both
request types and emits the type the client's protocol version expects — permanent complexity
for zero user-visible gain (these strings are never displayed). Deployed impact: droplet + all
installed apps.

### 1-C · Wire-visible field name `isPaseoOwnedWorktree` — HOLD (grandfather)

`messages.ts:2069, 2084, 2099, 2138, 2604, 2618, 2633` (+ `messages.test.ts:63,84,108`,
consumers in app e.g. `git-actions-policy.ts`). JSON field names travel on the wire like type
literals; the schema rules (CLAUDE.md: "never remove a field — deprecate") permit only
dual-write (`isPrismOwnedWorktree` + keep old) — recommend grandfathering instead. Risk: CRITICAL
if renamed naively; zero if left.

### 1-D · Script id `paseo_worktree_setup` — SEAM or HOLD

`apps/prism-mobile/packages/server/src/server/worktree-bootstrap.ts:355, 366, 376` (asserted in
`messages.stream-parsing.test.ts:73`). Travels in script-status frames; old apps display/track
this id. Same calculus as 1-B. Deployed impact: droplet + apps.

### 1-E · Offer-link format & default endpoints — CHANGE (defaults are free; format is a contract)

| Ref | Value |
|---|---|
| `packages/server/src/shared/connection-offer.ts:48` | parses `https://app.paseo.sh/#offer=<base64url>` (any base host accepted; `#offer=` fragment is the contract) |
| `packages/server/src/server/pairing-offer.ts:32,34` | fallback defaults `relay.paseo.sh:443`, `https://app.paseo.sh` |
| `packages/server/src/server/config.ts:24-25` | `DEFAULT_RELAY_ENDPOINT = "relay.paseo.sh:443"`, `DEFAULT_APP_BASE_URL = "https://app.paseo.sh"` |
| `packages/server/src/shared/daemon-endpoints.ts:21` | `DEFAULT_RELAY_ENDPOINT = "relay.paseo.sh:443"` |

Risk: **LOW-MED.** The droplet already overrides both via env (`PASEO_APP_BASE_URL=
https://prism.digitalgriot.studio`, relay `prism.digitalgriot.studio:443/relay` — proven live
per CHANGELOG.md:141 and the working phone pairing flow). Defaults only bite fresh installs
with no env set — changing them to sovereign endpoints is a free rename. The `#offer=` fragment
name itself is app↔daemon contract: keep it. Deployed impact: none (env overrides win).

### 1-F · MCP meta key `paseo.parent-agent-id` — CHANGE (low)

`packages/server/src/server/agent/mcp-server.ts:805`. Daemon↔local-agent metadata; both ends
live on the daemon host and update together. Risk: LOW. Deployed impact: droplet redeploy only.

### 1-G · `paseo.json` user-repo config contract — SEAM (dual-read)

| Ref | Role |
|---|---|
| `packages/server/src/utils/paseo-config-file.ts:17` | `PASEO_CONFIG_FILE_NAME = "paseo.json"` |
| `packages/server/src/utils/worktree.ts:1220-1221` | reads `paseo.json` from repo root + worktree |
| `apps/prism-mobile/paseo.json` | the fork's own instance (worktree setup + service scripts) |
| `packages/website/public/schemas/paseo.config.v1.json` | published JSON schema (`$schema` URL `paseo.sh/schemas/paseo.config.v1.json`, referenced README + public-docs/configuration.md) |

Risk: **MED.** `paseo.json` lives in *users'* repos (and in this monorepo's own root for the
fork). Rename = dual-read `prism.json ?? paseo.json` + publish a new schema URL. Deployed
impact: daemon redeploy; user repos migrate at leisure.

### 1-H · Script/agent env contract — SEAM (dual-inject)

Env injected into **user-authored** lifecycle scripts and agent processes:
`PASEO_WORKTREE_PATH`, `PASEO_BRANCH_NAME`, `PASEO_WORKTREE_PORT`
(`packages/server/src/utils/worktree.ts:48-50, 673-675, 703-705`; documented
`public-docs/worktrees.md:146-148`), plus `PASEO_PORT`, `PASEO_SERVICE_{API,WEB,DAEMON,WORKER,
APP_SERVER}_{PORT,URL}` (script supervisor), and `PASEO_AGENT_ID` (injected into agent env;
23 occurrences). Users' `paseo.json` scripts reference these (`apps/prism-mobile/paseo.json`
itself uses `$PASEO_SOURCE_CHECKOUT_PATH`, `$PASEO_WORKTREE_PATH`, `$PASEO_PORT`,
`$PASEO_SERVICE_DAEMON_PORT`). Risk: **MED.** Seam: export both `PRISM_*` and `PASEO_*` names
during transition. Deployed impact: daemon redeploy; user scripts migrate at leisure.

### 1-I · Persisted device-storage keys `@paseo:*` — SEAM (migration)

13 distinct keys in `packages/app/src` (non-test):
`@paseo:app-settings` · `@paseo:settings` · `@paseo:daemon-registry` ·
`@paseo:client-id-v1` · `@paseo:expo-push-token` · `@paseo:preferred-editor` ·
`@paseo:changes-preferences` · `@paseo:changes-ship-default` ·
`@paseo:create-agent-preferences` · `@paseo:keyboard-shortcut-overrides` ·
`@paseo:review-draft-store` · `@paseo:sidebar-callout-dismissals` · `@paseo:e2e`
(declaring files include `runtime/host-runtime.ts`, `utils/client-id.ts`, `hooks/use-settings.ts`,
`review/store.ts`, `contexts/sidebar-callout-context.tsx`, `stores/draft-store.ts`).

Risk: **HIGH if renamed blind** — these live in AsyncStorage/localStorage on installed devices.
`daemon-registry` holds the paired-daemon list (rename → phone forgets every daemon);
`client-id-v1` churn re-registers push tokens. Seam: one-time key migration (read old → write
new → delete old) shipped in the app before/with the rename. Deployed impact: every installed
app instance.

### 1-J · `PASEO_HOME` as state-path pointer — SEAM (env dual-read; dir already sovereign)

`packages/server/src/server/paseo-home.ts:16` — default is **already `~/.thedigitalgriot`**
(sovereign; upstream was `~/.paseo`). Only the env *key* renames (dual-read
`PRISM_HOME ?? PASEO_HOME`). Stale doc: `packages/server/.env.example:12` still says
`PASEO_HOME=~/.paseo` — CHANGE (free, doc-only). Deployed impact: Coolify env key + laptop env.

---

## §2 · Category 2 — Env vars (`PASEO_*`)

**131 distinct `PASEO_`-prefixed tokens, 1,239 occurrences** repo-wide (a handful are TS
constants/test sentinels that share the prefix, noted below). Central definition sites:
`packages/server/src/server/config.ts:63-243`, `paseo-env.ts`, `paseo-home.ts`;
CLI: `packages/cli/src/utils/client.ts`, `commands/daemon/*`; app/Metro:
`packages/app/metro.config.cjs` (`PASEO_WEB_PLATFORM`, also `apps/prism-mobile/CLAUDE.md:106`).

Buckets (var → risk/impact; full per-var counts in §Appendix A):

| Bucket | Vars | Flag / risk | Deployed impact |
|---|---|---|---|
| **Deploy-critical (LIVE on droplet Coolify + laptop daemon)** | `HOME, LISTEN, NODE_ENV, SOURCE_CHECKOUT_PATH, PASSWORD, RELAY_ENABLED, RELAY_ENDPOINT, RELAY_PUBLIC_ENDPOINT, APP_BASE_URL, LOG_FORMAT, LOG_LEVEL, LOG_FILE_*, LOG_CONSOLE_LEVEL, HOSTNAMES, ALLOWED_HOSTS, CORS_ORIGINS, SUPERVISED, SERVER_ID, PAIRING_QR, PRIMARY_LAN_IP, ROOT_PATH, GIT_CONCURRENCY, STASH_PREFIX, LINUX_WATCH_READDIR_CONCURRENCY` | **SEAM** — code dual-reads `PRISM_* ?? PASEO_*`, then Coolify/laptop keys flip | **YES** — droplet Coolify env keys (`deploy/docker-compose.yml:9-25`, `deploy/Dockerfile:32-39`, `deploy/.env.example:3-20`, `deploy/RUNBOOK.md:54`) + laptop Model-A env |
| **Client/CLI targeting** | `HOST (100×), URL, DAEMON_URL, APP_URL` | SEAM (dual-read) — users' shells/scripts export these | user machines |
| **User-script/agent contract** | `WORKTREE_PATH, BRANCH_NAME, WORKTREE_PORT, PORT, SERVICE_*, AGENT_ID, CUSTOM_PROMPT, WORKTREE_PATH_PATTERN` | **SEAM** (dual-inject — §1-H) | daemon redeploy; user repos |
| **Voice/speech/dictation** | `VOICE_* (9 vars), DICTATION_* (7), LOCAL_SPEECH_AUTO_DOWNLOAD, LOCAL_MODELS_DIR, LOCAL_STT_MODEL, LOCAL_TTS_MODEL, STT_BATCH_COMMIT_EVERY_SECONDS` | CHANGE (dual-read cheap); CI sets 3 of them (`.github/workflows/ci.yml:281-283`) | droplet/laptop env if set |
| **Desktop/build-time** | `WEB_PLATFORM (Metro .electron resolution), DESKTOP_MANAGED, DESKTOP_CLI, ELECTRON_FLAGS, ELECTRON_USER_DATA_DIR, NODE_INSPECT, SHORTCUT_KEYS, DESKTOP_SMOKE` | CHANGE — build scripts + desktop main only | none (ships with build) |
| **Shell integration (zsh)** | `ZSH_ZDOTDIR, ZSH_COMMAND_ACTIVE (_PASEO_… globals), ZSH_INTEGRATION_LOADED, SHELL_INTEGRATION_DIR` + `zsh/.zshenv:1-17`, `paseo-integration.zsh` (`_paseo_*` functions) | CHANGE — injected into terminal sessions the daemon spawns; ships with daemon | droplet/laptop redeploy |
| **Dev-only** | `DEV_SEED_HOME, DEV_RESET_HOME, HOME_FROM, CLAUDE_DEBUG, NODE_ENTRYPOINT_RUNNER_FIXTURE__` | CHANGE (free) | none |
| **Test/CI-only (~45 tokens)** | `MAESTRO_* (6), TEST_* (7), E2E_* / *_E2E (8), PROVE_*, CLI_TEST_* (4), SENTINEL secrets (4), STARTUP_WIRE_METRICS_*, SPEECH_E2E_*, GIT_DIFF_BOTTLENECK_*, DESKTOP_SMOKE, WORKER_TERMINAL_TEST, TERMINAL_PERF_E2E, EXPECTED_ARGV_JSON, MEMORY_56, OK / SKILL_OK / MCP_FOUND / MCP_NOT_FOUND, DAEMON_PUBLIC_KEY_B64, RUNTIME_SENTINEL_SECRET, TEST_OUTPUT_CAPTURE_BYTES, TEST_SHOULD_NOT_LEAK, TEST_FLAG` | CHANGE (free batch; CI yml refs `ci.yml:284-285`, `desktop-release.yml:160,250,337`) | none |
| **TS constants sharing the prefix** | `PASEO_CONFIG_FILE_NAME` (paseo-config-file.ts:17), `PASEO_SERVICE_` prefix fragment | CHANGE with §1-G | — |

---

## §3 · Category 3 — Code identifiers (free renames, internal only)

### 3-a · CamelCase types/classes — 39 distinct, 287 occurrences — CHANGE (free)

Declared in: `paseo-websocket.ts` (Prism-side `PaseoWebSocketAdapter`, 34×),
`utils/paseo-config-schema.ts` (`PaseoConfigRaw` 28×, `PaseoConfigRawSchema`,
`PaseoScriptEntryRaw*`, `PaseoLifecycleCommandRawSchema`, `PaseoWorktreeConfigRawSchema`,
`PaseoConfigRevision*`), `server/bootstrap.ts` (`PaseoDaemonConfig` 24×),
speech config (`PaseoSpeechConfig` 21×, `PaseoOpenAIConfig`, `PaseoLocalSpeechConfig`),
`utils/worktree-metadata.ts` (`PaseoWorktreeMetadata*` family, 30+ combined),
`shared/messages.ts:56-74` (schema re-exports), `icons/paseo-logo.tsx` (`PaseoLogo`,
`PaseoLogoProps`), `server/paseo-env.ts` (`PaseoNodeEnv`), e2e helper
(`PaseoHomeMetadataForkResult`), test-utils (`PaseoDaemon`). Full list in §Appendix B.
Risk: LOW — typecheck + tests gate. Deployed impact: none (redeploy picks it up).

### 3-b · Source files/dirs named `paseo-*` — 22 rename targets — CHANGE (free)

`packages/server/src/server/`: `paseo-env.ts`, `paseo-env.test.ts`, `paseo-home.ts`,
`paseo-worktree-service.ts` (+`.test.ts`), `paseo-worktree-archive-service.ts`,
`test-utils/paseo-daemon.ts` · `packages/server/src/utils/`: `paseo-config-file.ts`
(+`.test.ts`), `paseo-config-schema.ts` · `packages/server/src/terminal/shell-integration/zsh/paseo-integration.zsh`
· `packages/app/src/components/icons/paseo-logo.tsx` · `packages/app/e2e/helpers/paseo-home-fork.ts`
· `packages/website/public/schemas/paseo.config.v1.json` · `apps/prism-mobile/paseo.json` (§1-G)
· bins: `packages/cli/bin/paseo`, `packages/desktop/bin/paseo`, `packages/desktop/bin/paseo.cmd`
· Prism-side: `packages/prism-daemon/src/adapters/paseo-websocket.ts` (+`.test.ts`)
· skills dirs (§3-f). Risk: LOW (import-path updates; git mv preserves history).

### 3-c · Package/binary identity

| Ref | Value | Flag · risk |
|---|---|---|
| `apps/prism-mobile/package.json:2` | root `"name": "paseo"` | CHANGE — was *deliberately kept* by the 2026-06-12 shallow-fork plan to ease upstream merges; renaming deepens divergence (see §9 note) |
| `packages/cli/package.json:2-6` | `@thedigitalgriot/cli` (already sovereign) but `"bin": {"paseo": "bin/paseo"}` + description "Paseo CLI" | **SEAM-lite** — `paseo` is the user-facing command in shells/scripts/docs (~90 usage strings, §4). Ship `prism` bin + keep `paseo` alias one cycle |
| `packages/desktop/bin/paseo(.cmd)` + `electron-builder.yml:32-33,44-45,55-56` | bundled CLI name | CHANGE with bin rename |
| `apps/prism-mobile/vitest.config.ts:34,38` | `@getpaseo/relay` alias regexes | CHANGE (free) |
| `nix/package.nix:90-92` | `@getpaseo/*` package detection loop | CHANGE (free, self-host path) |
| `apps/prism-mobile/.gitattributes:1-5` | `merge=ours` armor for `@getpaseo/*` re-introduction | KEEP + extend for new renames |

### 3-d · Prism-side adapter identity (the "paseo dialect") — CHANGE (free)

`packages/prism-daemon/src/protocol.ts:13` (`AdapterType "websocket-paseo"`),
`adapters/index.ts:8,17-18`, `adapters/paseo-websocket.ts` (class + comments, 20×; `.test.ts`
27×), `services.config.json:4-5` (`"paseo-derived"`, `"adapterType": "websocket-paseo"`),
`packages/prism-daemon-client/src/agent-run.ts:15,81`, `packages/prism-relay/src/types.ts:5`,
`packages/prism-relay/package.json:5` (description). This is Prism's own config vocabulary —
`CONTINUE-ALWAYS-ON-DAEMON.md:52-53` already scopes it: "5 files / 41 tests". Risk: LOW.
Deployed impact: prism-electron/broker restart only.

### 3-e · Electron IPC channels `paseo:*` — CHANGE (free)

13+ channels (`paseo:invoke`, `paseo:dialog:open`, `paseo:menu:show`, `paseo:notification:*`,
`paseo:event:{quitting,open-project,browser-shortcut,browser-forwarded-key}`,
`paseo:browser:*`, `paseo:opener:open`) across `packages/desktop/src/preload.ts`, `main.ts`,
features, and `packages/app/src/desktop/**`. Main+preload+renderer ship as one artifact →
atomic rename, no seam. Risk: LOW.

### 3-f · Skills (agent-facing names) — 7 — CHANGE

`apps/prism-mobile/skills/{paseo, paseo-advisor, paseo-committee, paseo-epic, paseo-handoff,
paseo-loop, paseo-orchestrate}/SKILL.md` — dir name + frontmatter `name:` (line 2 each) +
cross-refs in `README.md:104-107` and desktop `skill-sync`. Risk: LOW (users' muscle memory
for `/paseo-handoff` etc. — alias period optional).

---

## §4 · Category 4 — User-visible text (CHANGE; free but wide)

Full line-level detail collected; highlights + counts here (per-file counts §Appendix C).

| Surface | Count | Notable items (file:line) |
|---|---|---|
| **App UI strings** | 27 | `welcome-screen.tsx:267` "Welcome to Paseo" (+`:271` paseo.sh link) · `pair-link-modal.tsx:186` placeholder `https://app.paseo.sh/#offer=...` · `add-host-modal.tsx:440` · `quitting-overlay.tsx:40` "Quitting Paseo…" · `settings-screen.tsx:196,472` · `settings/host-page.tsx:531,554,616-624` ("Inject Paseo tools") · `project-settings-screen.tsx:324-947` (paseo.json errors, "$PASEO_PORT" copy) · `desktop-updates-section.tsx:73,308,320,357` · `use-desktop-permissions.ts:127` (OS notification title) · `git-actions-policy.ts:159` |
| **CLI help/output** | ~30 distinct + `paseo` as program name in ~90 usage/error lines | `cli.ts:47` `.name("paseo")` · `cli.ts:48` "Paseo CLI…" · `cli.ts:105` "default: ~/.paseo" (STALE — real default `~/.thedigitalgriot`) · onboard flow `onboard.ts:287-298,442-514` (links app.paseo.sh, paseo.sh/docs) · `open.ts:81` install link `github.com/getpaseo/paseo/releases` (UPSTREAM link in an error message) · command descriptions across `commands/**` |
| **Desktop app strings** | 4 | `main.ts:109` **`app.setName("Paseo")`** — dock/menu identity, visibly inconsistent with mobile "Prism" · `main.ts:296` window title · `integrations-manager.ts:174,192` (writes "# Added by Paseo" into users' shell rc + .cmd shim error) |
| **Website copy** (`packages/website`) | ~45 across 14 files | meta titles/OG (`__root.tsx:46` site_name "Paseo"; route titles index/claude-code/codex/opencode/changelog/blog/docs/download/privacy) · `downloads.tsx:28` App Store URL `apps.apple.com/app/paseo-pocket-engineer/id6758887924` · `download.tsx:125` `brew install --cask paseo` · landing-page FAQ/body (~20) · `posts/hello-world.md:3,7` |
| **Prose docs** | 286 across 23 files | `public-docs/` 177 in 10 files (cli.md 56, configuration.md 32, worktrees.md 29…) · `docs/` 109 in 13 files. Zero paseo-branded H1/titles — all headings generic |
| **Root identity files** | ~155 across 7 files | `README.md:5` `<h1>Paseo</h1>` (40 lines) · `CONTRIBUTING.md:1` "Contributing to Paseo" (8) · `SECURITY.md:66` **security contact `hello@moboudra.com`** (upstream author) (5) · `LICENSE:1,5` copyright "Mohamed Boudra" / "Paseo Software" — **HOLD: license text is a legal record of provenance, not a rename target** · `SELF-HOSTING.md` (14; `relay.paseo.sh`, baseUrl app.paseo.sh) · `INSTALL-DEVICE.md` (~20; documents the fork's own partial-rebrand state) · mobile `CHANGELOG.md` (67 — upstream history, HOLD) |

Deployed impact: app strings ship via EAS update/store build; website only if the site is ever
deployed under a sovereign domain; CLI/desktop with next release.

---

## §5 · Category 5 — Visual assets to GENERATE (40 items, 0 already replaced)

**Prior-work correction:** `.prism/shared/plans/2026-07-12-app-icon-brand-replacement.md` is
`awaiting-approval` and **was never executed** for prism-mobile. Commit `16b6eac` only
*recolored* icon.png/icon-debug.png — the SVG path data is byte-identical to the Paseo
butterfly/wing glyph (single path, viewBox 0 0 700 700). The prepared Prism-glyph sources live
in `.prism/shared/designs/assets/app-icons/<variant>/` — generation is turnkey via that plan.

### App (`packages/app/assets/images/`) — 20 files

| Asset | Format · dims | Role · wired at |
|---|---|---|
| `icon.png` | PNG 1024×1024 | prod app icon — `app.config.js:36,71` |
| `icon-debug.png` | PNG 1024×1024 | debug app icon — `app.config.js:49` |
| `android-icon-foreground.png` | PNG 1024×1024 | adaptive-icon fg — `app.config.js:98` |
| `splash-icon.png` | PNG 200×200 | splash — `app.config.js:133` |
| `notification-icon.png` | PNG 96×96 | notifications — `app.config.js:145`, `os-notifications.ts:111` |
| `favicon.png` | PNG 48×48 | web favicon — `app.config.js:117` |
| `favicon-{dark,light}{,-running,-attention}.png` ×6 | PNG 48×48 | dynamic status favicons — `use-favicon-status.ts:15-22` |
| `favicon-*.svg` ×6 | SVG vB 700×700 | unreferenced SVG sources of the above |
| `butterfly-green.svg`, `butterfly-white.svg` | SVG vB 700×700 | orphaned glyph sources |

### In-code (2)

- `packages/app/src/components/icons/paseo-logo.tsx` — `PaseoLogo` RN-SVG glyph (vB 700×700,
  default 64); rendered `startup-splash-screen.tsx:153,163,411`, `open-project-screen.tsx:51`,
  `welcome-screen.tsx:265`, `tool-call-icon.ts:63`. **GENERATE** replacement component.
- `packages/website/src/components/butterfly.tsx` — animated decorative butterfly motif
  (vB 0 0 50 40) on the landing page. GENERATE or remove with new site design.

### Desktop (`packages/desktop/assets/`) — 7 files

`icon.icns` (macOS, electron-builder.yml:26) · `icon.ico` (Windows, :53 + main.ts:254,262) ·
`icon.png` 512×512 (Linux/dock/notifications — yml:39, main.ts:255-279, notifications.ts:33) ·
`128x128.png`, `128x128@2x.png` (256²), `64x64.png`, `32x32.png` (Linux icon set).

### Website (`packages/website/public/`) — 11 files

`favicon.ico` · `favicon.svg` (vB 700×700; `__root.tsx:53-55`) · `logo.svg` (700×700 glyph
`#20744A`; site-header/docs/download) · `og-image.png` **1200×630** (`__root.tsx:48,50`) ·
`hero-mockup.png` 2048×1233 · `mobile-mockup.png` 2048×1239 · `iphone-mockup-left.png`
1857×3096 · `phone-1..3.png` ×3 1206×2622 (Paseo-UI screenshots — regenerate from the Prism
app once UI strings flip) · `hero-bg.jpg` 5504×3072 (photographic, likely unbranded — verify).

**Confirmed clean:** pairing QR (`pairing-qr.ts` renders a terminal QR — no logo/landing asset).

**`[v]` Brand-color carryover (found in the verification pass — bigger than the SVG assets).**
The Paseo brand green `#20744A` is a live theme token, not just an asset fill. `rg '#20744A'`
(excl. node_modules/dist) returns **5 files**: `packages/app/src/styles/theme.ts` (the app's
accent color) · `packages/app/app.config.js:146` (`expo-notifications` tint) ·
`packages/app/public/index.html` · `packages/website/src/styles.css` ·
`packages/app/assets/images/butterfly-green.svg`. (Note: the earlier visual-asset agent
attributed `#20744A` to `website/public/logo.svg`; the verification grep did **not** confirm it
there — treat that one line of the §5 website table as unverified.) The GENERATE phase must pick
the Prism green and reset this token across all 5 files alongside the raster icons.

---

## §6 · Category 6 — External / hosted / deployed values (46 line items)

### LIVE — droplet Coolify (`prism:main-daemon`) — SEAM via §1-J/§2

`deploy/docker-compose.yml:9-25`, `deploy/Dockerfile:32-39`, `deploy/.env.example:3-20`,
`deploy/RUNBOOK.md:3-65` — env **keys** are `PASEO_*`; every **value** already sovereign
(`PASEO_RELAY_ENDPOINT=prism.digitalgriot.studio:443/relay`,
`PASEO_APP_BASE_URL=https://prism.digitalgriot.studio`, `PASEO_PASSWORD` set per 4.2.0).
Coordinated update: deploy dual-read daemon → rename Coolify env keys in the UI → later drop
old names. RUNBOOK prose ("the existing paseo agent daemon", :3,6,8) — CHANGE with it.

### LIVE — Cloudflare relay Worker — already sovereign (no action)

`packages/relay/wrangler.toml`: name `prism-relay`, route `prism.digitalgriot.studio/*`,
zone `digitalgriot.studio`. Zero paseo literals. (Listed as verification, not a finding.)

### NOT ours — website Worker — CHANGE (retarget) or HOLD (never deploy)

`packages/website/wrangler.toml:1,8-9`: name `paseo-website`, routes `paseo.sh` +
`www.paseo.sh` (upstream's domain + upstream's Cloudflare account id). Deploying this config is
impossible/undesirable from our side; the file is inert until the site gets a sovereign domain.

### Desktop distribution — CHANGE (highest cat-6 risk if ever shipped)

`packages/desktop/electron-builder.yml`: `appId: sh.paseo.desktop` (:2), `productName/
executableName: Paseo` (:3-4), `vendor: "Paseo"` (:42), artifacts `Paseo-*` (:24,40,52), and
**`publish: github getpaseo/paseo` (:21-22) — any distributed build's auto-updater would poll
UPSTREAM's releases and could "update" users onto upstream Paseo.** Also
`.github/workflows/desktop-release.yml:87` release title "Paseo $RELEASE_TAG";
`android-apk-release.yml:53,120` (title + `paseo-${TAG}-android.apk` asset name).

### Mobile/EAS — already sovereign (three stragglers)

Clean: `app.config.js` — name Prism/Prism Debug, slug `prism-mobile`, owner `digitalgriot`,
projectId `4e6ac688-…`, scheme `prism://`, applinks `prism.digitalgriot.studio`,
bundle/package `com.thedigitalgriot.prism(.debug)`, OTA `u.expo.dev/4e6ac688-…`.
Stragglers: **fastlane** `Appfile:1` + `Fastfile:3` (`APP_IDENTIFIER = "sh.paseo"`, actively
consumed at `:16,25,50` — `latest_testflight_build_number` / `Spaceship…App.find` / `deliver`)
still `sh.paseo` (stale upstream Apple id — conflicts with the live bundle id; the `submit_review`
lane would target the WRONG app on App Store Connect) `[v]` ·
**maestro** `sh.paseo` appId in 12 yaml files (+ `PASEO_MAESTRO_APP_ID` env in 9) — targets an
app id we don't ship · **eas.json:45** `ascAppId: "6758887924"` — this **equals the upstream
paseo-pocket-engineer App Store id** in `downloads.tsx:28`; verify ASC ownership before any
`eas submit` lane is ever run.

### Self-host path (nix) — CHANGE (free, unused by our deploys)

`nix/package.nix:13-139` (`pname paseo`, `$out/lib/paseo`, wrappers `paseo`/`paseo-server`,
homepage `github.com/getpaseo/paseo`) · `nix/module.nix:9-149` (`services.paseo`, user/group
`paseo`, `/var/lib/paseo`, `relay.paseo.sh` example) · `flake.nix:1-33`.

### Upstream identity records — HOLD (provenance) or CHANGE (contact routing)

`SECURITY.md:66` contact `hello@moboudra.com` — CHANGE if we want reports routed to us; HOLD if
the file is treated as upstream provenance. `[v]` **Second live occurrence found in the
verification pass:** `electron-builder.yml:41` `maintainer: "Mohamed Boudra <hello@moboudra.com>"`
— ships in `.deb`/`.rpm` package metadata (Linux maintainer field), so any distributed Linux
build carries the upstream author's email · `LICENSE:1,5` (Mohamed Boudra / "Paseo Software")
— **HOLD (legal)** · `package.json:17` + `desktop/package.json:9` author "Mohamed Boudra" —
HOLD (provenance) · GitHub org refs `getpaseo/paseo` in CHANGELOG PR links (historical, HOLD)
vs. in **runtime strings** (`cli/src/commands/open.ts:81` install-link error — CHANGE) and
release scripts (`scripts/sync-release-notes-from-changelog.mjs` defaults — CHANGE).

---

## §7 · Historical / derived — NO ACTION

| Zone | Matches | Why no action |
|---|---|---|
| `.prism/shared/` archives (research, plans, handoffs, brainstorms, docs, evals) | 500 in 55 files | historical records; rewriting them falsifies history |
| `apps/prism-mobile/CHANGELOG.md` | 67 | upstream release history |
| Repo-root `CHANGELOG.md` (6), `PRISM-STATE-2026-06-18.md` (15) | 21 | dated records. (`CONTINUE-ALWAYS-ON-DAEMON.md` (12) is a *living* doc — CHANGE at rename time) |
| `apps/prism-setup/resources/plugin/**` generated skills + bump-version copy | 25 in 15 | generated — regenerate after rename |
| `prism-docs/docs/.vitepress/dist/**` | ~79 in 17 | build output — regenerate. Source pages (8 md, 21 matches: adapters 4, surface-connectivity 7, clients 3, daemon/index 2, relay 2, broker 1, workspaces 1, version-management 1) + `.vitepress/theme/data/architecture-views.ts` — CHANGE with §3-d |
| `apps/prism-mobile/{dist,node_modules}`, `package-lock.json` | n/a (gitignored/derived) | regenerate on build/install |
| Frozen baseline `C:\Users\digit\Developer\paseo` (outside repo) | — | DO NOT MODIFY (canonical rebrand recipe, PRISM-STATE §2) |
| `scripts/bump-version.py:115,177,180` (+ prism-docs monorepo pages) | 3 | comments *describing* the paseo lineage — accurate as written; CHANGE only for taste |

---

## §8 · Counts per category

| # | Category | Distinct items | Occurrences / files |
|---|---|---|---|
| 1 | Wire/protocol-sensitive | **10 contract surfaces** (1-A…1-J): bearer prefix · 6 msg-type literals · 1 wire field · 1 script id · offer defaults · MCP meta key · paseo.json contract · script-env contract · 13 storage keys · PASEO_HOME pointer | ~55 precise file:line refs (tables above) |
| 2 | Env vars | **131 distinct `PASEO_*` tokens** | 1,239 occurrences |
| 3 | Code identifiers | 39 CamelCase types (287 occ.) + 22 file renames + 7 skills + root pkg name + `paseo` bin + `websocket-paseo` adapter id + 13 IPC channels + `@getpaseo` aliases (2 files) | ~350 occurrences |
| 4 | User-visible text | 27 app + ~30 CLI (+~90 program-name usages) + 4 desktop + ~45 website distinct strings | + 286 prose-doc + ~155 root-file occurrences |
| 5 | Visual assets to GENERATE | **40** (38 files + 2 in-code SVG); 0 already replaced | app 20 · desktop 7 · website 11 · in-code 2 |
| 6 | External/hosted | **46 line items**; live-and-paseo-named: Coolify env keys only. Live-and-clean: relay Worker, EAS identity. Dormant-but-dangerous: electron-builder publish feed, fastlane sh.paseo, eas ascAppId | — |
| — | Historical/derived (no action) | ~625 occurrences | .prism 500 · setup 25 · docs dist ~79 · root records 21 |
| — | **Grand total** | — | **7,410 matches / 716 files** |

---

## §9 · Proposed rename sequencing

Principle (from `apps/prism-mobile/CLAUDE.md`): daemons update first; old apps must keep
working against new daemons indefinitely ("does a 6-month-old client still parse this?").
Everything below is staged so no step can strand the droplet, a paired phone, or a user script.

### Phase 0 — free renames (any time, no coordination, no wire impact)

- **0a Internal code batch:** 39 `Paseo*` types + 22 file renames + `websocket-paseo` adapter id
  & `services.config.json` + `@getpaseo` vitest/nix aliases + IPC channels + zsh function names.
  Gate: typecheck + unit tests (the "5 files / 41 tests" Prism-side scope + fork-side suites).
- **0b Identity & text batch:** desktop `app.setName("Prism")` + window title + electron-builder
  identity (`appId com.thedigitalgriot.prism.desktop`, productName/executable/vendor `Prism`,
  artifacts `Prism-*`, **publish → TheDigitalGriot/prism**) + fastlane `sh.paseo` fix + workflow
  release titles/asset names + app UI strings + website copy + prose docs + README/CONTRIBUTING
  + SECURITY contact decision + 7 skill renames + CLI help text. (CLI *command name*: ship
  `prism` bin alongside `paseo` alias; retire alias later.)
- **0c GENERATE batch (assets):** execute the parked 2026-07-12 icon plan (sources ready in
  `.prism/shared/designs/assets/app-icons/`) + desktop icns/ico/png set + website favicon/logo/
  og-image/mockups + `PaseoLogo` → `PrismLogo` component + butterfly motif decision.
- **0d Test-only env vars (~45)** + dev-only vars: single mechanical PR.
- **0e Offer defaults:** `DEFAULT_APP_BASE_URL`/`DEFAULT_RELAY_ENDPOINT` → sovereign endpoints
  (droplet already overrides; affects only fresh installs).

### Phase 1 — dual-accept seams (daemon first)

- **1a Daemon release N:** accept `prism.bearer.` **and** `paseo.bearer.` (auth.ts) · dual-read
  `PRISM_* ?? PASEO_*` for every runtime var (config.ts, paseo-env, worktree, speech, CLI) ·
  dual-read `prism.json ?? paseo.json` (+ publish new schema URL) · dual-inject script env
  (`PRISM_WORKTREE_PATH` + `PASEO_WORKTREE_PATH`, etc.) · MCP meta key flip.
- **1b App release N:** `@paseo:*` → `@prism:*` storage-key migration (read-old→write-new;
  `daemon-registry` and `client-id-v1` are the ones that must not be lost) · client sends
  `prism.bearer.` (or offers both subprotocols) — only after 1a daemons are deployed.
- **1c Ops flip:** Coolify env keys `PASEO_*` → `PRISM_*` in the dashboard (values unchanged) ·
  laptop Model-A env · RUNBOOK/compose/Dockerfile/.env.example text.
- **1d Retirement (≥ one 6-month client cycle later, optional):** drop `paseo.bearer.`
  acceptance, `PASEO_*` fallbacks, `paseo.json` fallback, `paseo` bin alias.

### Grandfather permanently (recommended HOLD — cost of keeping ≈ zero)

WS message-type literals (1-B) · `isPaseoOwnedWorktree` (1-C) · `paseo_worktree_setup` (1-D) ·
LICENSE/author/changelog provenance. These are invisible to users; dual-accepting them forever
is one comment each, while renaming them is permanent protocol branching.

### Standing tension to accept at greenlight

Every Phase-0 rename deepens divergence from `getpaseo/paseo` upstream merges. The existing
`.gitattributes merge=ours` armor extends naturally to renamed files, but "go sovereign" is
also the decision to stop chasing upstream — the 2026-06-12 plan's "keep root name `paseo`"
rationale expires the moment this doc is greenlit.

---

## Open questions (for the greenlight conversation)

1. **CLI command name** — is `prism` the target (collides with nothing?) and how long does the
   `paseo` alias live?
2. **Website** — retarget `packages/website` to a sovereign domain (needs new wrangler
   name/account/routes + full §5-D asset generation) or park it dormant?
3. **SECURITY.md contact** — route to a Griot address, or keep upstream provenance intact?
4. **eas.json `ascAppId 6758887924`** — verify App Store Connect ownership before any submit
   lane ever runs (it matches upstream's paseo-pocket-engineer listing id).
5. **Grandfather list** — confirm 1-B/1-C/1-D stay paseo forever (recommended) or get seams.

---

## Appendix A — 131 distinct `PASEO_*` tokens (occurrence counts)

HOME 258 · HOST 100 · LISTEN 44 · VOICE_MODE_ENABLED 40 · DICTATION_ENABLED 40 ·
LOCAL_SPEECH_AUTO_DOWNLOAD 37 · NODE_ENV 36 · MAESTRO_PROJECT_PATH 28 ·
SOURCE_CHECKOUT_PATH 27 · PASSWORD 24 · PORT 23 · MAESTRO_APP_ID 23 · LOCAL_MODELS_DIR 23 ·
AGENT_ID 23 · WORKTREE_PORT 21 · RELAY_ENDPOINT 21 · SUPERVISED 20 · WORKTREE_PATH 17 ·
MAESTRO_PROJECT_NAME 14 · DESKTOP_MANAGED 14 · APP_BASE_URL 14 · MAESTRO_DIRECT_ENDPOINT 13 ·
SERVER_ID 12 · DICTATION_DEBUG 12 · URL 11 · RELAY_ENABLED 11 · TEST_FLAG 10 ·
CORS_ORIGINS 10 · WEB_PLATFORM 9 · MAESTRO_DAEMON_WS_URL 9 · LOG_FORMAT 9 ·
SERVICE_API_PORT 8 · E2E_WEB_PARTIAL_VIRTUALIZATION_THRESHOLD 8 ·
E2E_WEB_MOUNTED_RECENT_STREAM_ITEMS 8 · SERVICE_WEB_PORT 7 · SERVICE_API_URL 7 ·
SERVICE_ (prefix) 7 · OK 7 · HOSTNAMES 7 · DESKTOP_SMOKE 7 · SKILL_OK 6 · PRIMARY_LAN_IP 6 ·
NODE_ENTRYPOINT_RUNNER_FIXTURE__ 6 · BRANCH_NAME 6 · VOICE_LOCAL_TTS_SPEED 5 ·
VOICE_LOCAL_TTS_MODEL 5 · VOICE_LOCAL_STT_MODEL 5 · STT_BATCH_COMMIT_EVERY_SECONDS 5 ·
SERVICE_WEB_URL 5 · ROOT_PATH 5 · MAESTRO_ (prefix) 5 · LOG_LEVEL 5 ·
DICTATION_LOCAL_STT_MODEL 5 · DESKTOP_CLI 5 · ZSH_ZDOTDIR 4 · ZSH_COMMAND_ACTIVE 4 ·
VOICE_TTS_PROVIDER 4 · VOICE_STT_PROVIDER 4 · VOICE_LOCAL_TTS_SPEAKER_ID 4 ·
TEST_SENTINEL_SECRET 4 · SERVICE_DAEMON_PORT 4 · RELAY_PUBLIC_ENDPOINT 4 · NODE_INSPECT 4 ·
LOCAL_STT_MODEL 4 · EXPECTED_ARGV_JSON 4 · DICTATION_STT_PROVIDER 4 · VOICE_LLM_PROVIDER 3 ·
TEST_SHOULD_NOT_LEAK 3 · STASH_PREFIX 3 · ELECTRON_FLAGS 3 · CONFIG_FILE_NAME (TS const) 3 ·
CLI_TEST_SHARD 3 · ALLOWED_HOSTS 3 · ZSH_INTEGRATION_LOADED 2 · WORKTREE_PATH_PATTERN 2 ·
WORKER_TERMINAL_TEST 2 · TEST_REAL_ZDOTDIR 2 · TERMINAL_PERF_E2E 2 · SPEECH_E2E_MODEL_SET 2 ·
SHORTCUT_KEYS 2 · SHELL_INTEGRATION_DIR 2 · SERVICE_WORKER_PORT 2 · SERVICE_DAEMON_URL 2 ·
SERVICE_APP_SERVER_PORT 2 · RUNTIME_SENTINEL_SECRET 2 · PAIRING_QR 2 · MCP_FOUND 2 ·
LOCAL_TTS_MODEL 2 · GIT_CONCURRENCY 2 · ELECTRON_USER_DATA_DIR 2 · DEV_SEED_HOME 2 ·
DEV_RESET_HOME 2 · DAEMON_PUBLIC_KEY_B64 2 · CUSTOM_PROMPT 2 · CLI_TEST_SHARD_TOTAL 2 ·
CLAUDE_DEBUG 2 · VOICE_TURN_DETECTION_PROVIDER 1 · VOICE_ROUNDTRIP_E2E 1 ·
VOICE_LOCAL_AGENT_E2E 1 · VOICE_E2E_TIMEOUT_MS 1 · TEST_OUTPUT_CAPTURE_BYTES 1 ·
SYSTEM_PROMPT_SENTINEL_SECRET 1 · STARTUP_WIRE_METRICS_END 1 · STARTUP_WIRE_METRICS_BEGIN 1 ·
SPEECH_E2E_DOWNLOAD 1 · SERVICE_APP_SERVER_URL 1 · PROVE_TIMEOUT_MS 1 · PROVE_STABILITY_MS 1 ·
MEMORY_56 1 · MCP_NOT_FOUND 1 · LOG_FILE_ROTATE_SIZE 1 · LOG_FILE_ROTATE_COUNT 1 ·
LOG_FILE_PATH 1 · LOG_FILE_LEVEL 1 · LOG_CONSOLE_LEVEL 1 · LOG 1 ·
LINUX_WATCH_READDIR_CONCURRENCY 1 · HOME_FROM 1 · GIT_DIFF_BOTTLENECK_FILE_COUNT 1 ·
GIT_DIFF_BOTTLENECK_E2E 1 · ENV_SENTINEL_SECRET 1 · DICTATION_TRANSCRIPTION_PROMPT 1 ·
DICTATION_SILENCE_PEAK_THRESHOLD 1 · DICTATION_AUTO_COMMIT_SECONDS 1 · DAEMON_URL 1 ·
CLI_TEST_CONCURRENCY 1 · APP_URL 1

## Appendix B — 39 distinct `Paseo*` identifiers (occurrence counts)

PaseoWebSocketAdapter 34 · PaseoConfigRaw 28 · PaseoDaemonConfig 24 · PaseoSpeechConfig 21 ·
PaseoConfigRevision 19 · PaseoConfigRawSchema 18 · PaseoConfig 14 · PaseoLogo 11 ·
PaseoConfigV1 10 · PaseoOpenAIConfig 8 · PaseoConfigRevisionSchema 8 · PaseoWorktreeMetadata 7 ·
PaseoScriptEntryRawSchema 7 · PaseoScriptEntryRaw 7 · PaseoWorktreeConfigRawSchema 6 ·
PaseoLifecycleCommandRawSchema 6 · PaseoWorktreeInfo 5 · PaseoConfigSchema 5 ·
PaseoWorktreeMetadataSchema 3 · PaseoWorktreeListResponseSchema 3 · PaseoWorktreeListResponse 3 ·
PaseoWorktreeListRequestSchema 3 · PaseoWorktreeForCwd 3 · PaseoWorktreeArchiveResponseSchema 3 ·
PaseoWorktreeArchiveResponse 3 · PaseoWorktreeArchiveRequestSchema 3 · PaseoDaemon 3 ·
PaseoWorktreeSchema 2 · PaseoWorktreeOwnership 2 · PaseoWorktreeMetadataV2Schema 2 ·
PaseoWorktreeMetadataV1Schema 2 · PaseoWorktreeListPayload 2 · PaseoWorktreeArchivePayload 2 ·
PaseoNodeEnv 2 · PaseoLogoProps 2 · PaseoLocalSpeechConfig 2 · PaseoHomeMetadataForkResult 2 ·
PaseoWorktreeListRequest 1 · PaseoWorktreeArchiveRequest 1

## Appendix C — prose-doc per-file counts

`public-docs/`: cli.md 56 · configuration.md 32 · worktrees.md 29 · skills.md 19 · voice.md 10 ·
security.md 9 · index.md 8 · providers.md 7 · updates.md 4 · best-practices.md 3 (= 177).
`docs/`: development.md 21 · ad-hoc-daemon-testing.md 17 · architecture.md 14 · data-model.md 13 ·
custom-providers.md 8 · release.md 7 · product.md 6 · providers.md 5 · glossary.md 5 ·
unistyles.md 5 · mobile-testing.md 4 · design-system.md 2 · android.md 2 (= 109).
Root: README.md ~40 · CHANGELOG.md 67 · SELF-HOSTING.md 14 · INSTALL-DEVICE.md ~20 ·
CONTRIBUTING.md 8 · SECURITY.md 5 · LICENSE 1.
`prism-docs/docs/` (source): surface-connectivity.md 7 · adapters.md 4 · clients.md 3 ·
daemon/index.md 2 · relay.md 2 · broker.md 1 · workspaces.md 1 · version-management.md 1 (= 21).
