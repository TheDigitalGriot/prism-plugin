---
date: 2026-07-17T04:33:12-04:00
researcher: Claude
git_commit: eec0609fe0b62204c4614fc70e31ed39d523136a
branch: main
topic: "v4.2.0 shipped + Claude connector / artifact popout kickoff"
tags: [handoff, release, claude-connector, artifacts, mcp, claude-desktop, model-b, triage]
status: complete
---

# Handoff: v4.2.0 shipped · pairing triage parked · NEW mission: Claude connector + artifact popout

## Task(s)

- ✅ **v4.2.0 released** — https://github.com/TheDigitalGriot/prism/releases/tag/v4.2.0
  (8 assets: 5 CLI binaries, Electron, Tauri, legacy NSIS). Tag `v4.2.0` @ `7aea8b6`.
  Docs (`PRISM-DOCUMENTATION-4.2.0.md`), eval snapshot, and CHANGELOG (4.2.0 + backfilled 4.1.0)
  all committed. Model-B daemon LIVE on the droplet under Coolify (`prism:main-daemon`).
- ⚠️ **PARKED — phone pairing over relay stalls at "connecting"** (see Parked Findings §below —
  context captured for a FUTURE `/prism-debug` run per its "Investigate, Don't Fix" philosophy).
  Do NOT triage unless Gavin asks; it is deliberately deferred.
- ⬜ **PRIORITY 1 — PASEO reference audit (go-sovereign prep; runs in Cowork).** Produce a
  DEFINITIVE inventory doc of every "paseo" reference in the monorepo — the rename itself stays
  deferred ("set up first, then go sovereign"); this is the inventory that makes the greenlight
  possible. See §PASEO Audit Spec below.
- ⬜ **NEW MISSION: Claude connector + artifact popout for Prism.**
  Research-first in/about **Claude Desktop**, then brainstorm → plan → implement. Gavin's intent:
  1. A **Claude connector** so Prism is reachable/usable from Claude Desktop (connector = the
     claude.ai/Desktop connectors system; expect MCP underneath).
  2. An **artifact popout** for Prism built into the plugin (artifact-style rendering surface that
     can pop out, in the spirit of Claude Desktop's artifacts).
  Exact scope is intentionally open — pin it down in brainstorm, don't assume.

## Critical References

1. `skills/cl-plugin-structure/SKILL.md` + `references/` — **the canonical plugin-structure skill**
   (repo copy; newer than the `~/.claude/skills/` original — see Learnings L4).
2. `CHANGELOG.md` — 4.2.0 entry = the release's full technical summary.
3. `.prism/shared/handoffs/2026-07-15_03-16-02_model-b-droplet-deploy-execution.md` — Model-B
   context if daemon work resurfaces.

## Suggested approach (new session)

1. **Research phase** (`/prism-research` + web-search + `claude-code-guide` agent):
   - How Claude Desktop **connectors** register, authenticate, and surface tools (MCP servers,
     manifest, OAuth?); what a local plugin/daemon can expose to them.
   - How Claude Desktop renders **artifacts**; what popout affordances exist; whether MCP apps
     (see `mcp-apps:*` skills — `create-mcp-app`, `add-app-to-server`, `convert-web-app`) are the
     right substrate for an artifact-like surface.
   - Inventory what Prism already has to expose: broker :6780 services (agent-run, code-intel,
     design-gen…), the daemon dialect, existing webview surfaces (VS Code/Electron panels).
2. `/prism-brainstorm` (visual companion auto-starts per Gavin's standing preference) → lock scope.
3. `/prism-plan` → approval → implement. Do NOT write code before an approved plan.

## PASEO Audit Spec (Priority 1)

**Deliverable:** `.prism/shared/research/YYYY-MM-DD-paseo-reference-audit.md` — a definitive,
categorized list of everything to CHANGE and everything to GENERATE. Audit only — zero renames.
Scope = the whole monorepo, primarily `apps/prism-mobile/` (the vendored fork). Categories:

1. **Wire/protocol-sensitive (highest care)** — `paseo.bearer.<secret>` WS subprotocol
   (auth.ts:83 requires the literal `paseo` prefix); daemon dialect strings. Back-compat rule
   (apps/prism-mobile/CLAUDE.md): old apps must keep working against new daemons — renames here
   need dual-accept. The 2026-07-15 brainstorm ledger already parked this seam.
2. **Env vars** — `PASEO_*` (LISTEN, HOME, RELAY_*, PASSWORD, APP_BASE_URL, SOURCE_CHECKOUT_PATH,
   NODE_ENV, LOG_*, HOSTNAMES, CORS…) across code, Dockerfile, compose, .env.example, RUNBOOK,
   Coolify env (deployed!), docs.
3. **Code identifiers** — `PaseoWebSocketAdapter`, `websocket-paseo` adapter id
   (packages/prism-daemon/services.config.json), `paseo` CLI binary name, package names, test
   utils (`test-utils/paseo-daemon.ts`), types (`PaseoDaemonConfig`), defaults
   (`DEFAULT_RELAY_ENDPOINT = "relay.paseo.sh:443"`, `app.paseo.sh` placeholders).
4. **User-visible text** — app strings, input placeholders (`app.paseo.sh/#offer=…`), CLI help,
   public-docs/ (upstream paseo docs tree), README/website copy (packages/website = paseo.sh site).
5. **Visual assets to GENERATE** — icons (`icon.png`, `icon-debug.png`), splash screens, favicon,
   website imagery, QR/landing-page branding — anything carrying paseo marks. List each with its
   dimensions/format so generation is turnkey.
6. **External/hosted** — Coolify env values on the droplet, EAS app config, Apple bundle IDs
   (already `com.thedigitalgriot.prism` — verify no paseo stragglers), upstream security contact.

For each item: file:line (or asset path), category, change-vs-generate, risk note, and whether the
deployed droplet/phone needs a coordinated update. Include counts per category and a proposed
sequencing (what can rename freely vs what needs the dual-accept seam).

## Parked Findings — pairing "connecting" stall (context for a future /prism-debug run)

Symptoms: phone (Prism Debug, dev-client) accepts the offer, shows "connecting", never completes.
Verified healthy on daemon side: `relay_control_connected`, valid offer
(`relay.endpoint=prism.digitalgriot.studio:443/relay`, serverId `srv_-Xi2lw5SY7Zz`), `authRequired:true`.
Starting points when the investigation opens:
- Daemon log: watch `relayExternalSocketAttached` counter (was 0) and any relay data-socket open
  attempts when the phone dials — distinguishes "phone never reaches DO channel" vs "E2EE handshake stalls".
- Relay Worker: `npx wrangler tail` from `apps/prism-mobile/packages/relay` while pairing —
  see role=client connects and DO routing (protocol `v=2`).
- E2EE handshake path: `e2ee_hello` → `e2ee_ready` (packages/prism-relay/src; daemon-e2e tests
  exist: `relay-transport.e2e.test.ts`, `connection-offer.e2e.test.ts`).
- Compare against the local Model-A daemon (laptop), which paired successfully via in-app paste —
  same app build, same relay → isolates the droplet variable (egress? DO channel per serverId?).
- Note: `PASEO_PASSWORD` is NOT on the relay path (attachExternalSocket bypasses bearer check) —
  it is not the suspect.

## Learnings

- **L1 — Release conventions had lapsed and were resumed at 4.2.0**: PRISM-DOCUMENTATION (last
  3.8.0), eval snapshots (last 3.3.1), CHANGELOG (4.1.0 entry missing, backfilled). Keep them alive.
- **L2 — `bump-version.py --set` no-ops if root `VERSION` pre-equals target** (it keys off VERSION).
  Never hand-edit VERSION before running it. Reported "Updated (13)" only after VERSION was reverted.
- **L3 — v4.0.0 repo rename broke all six `@prism/*` workspace symlinks** (absolute paths →
  dead `GriotApps/prism-plugin`). Healed with junctions; a root `npm install` would re-heal
  npm-natively and should happen eventually.
- **L4 — cl-plugin-structure provenance**: `~/.claude/skills/cl-plugin-structure/` is the ORIGINAL
  standalone workshop repo (own `.git`, born ~Apr 9, last touched Jun 3). It was bundled into the
  plugin at v3.3.0 ("cl-plugin-structure v0.7.2 bundled as a skill", CHANGELOG). The repo copy
  `skills/cl-plugin-structure/` then evolved independently (validator fixes in 3.3.1; last change
  Jun 12, commit `103aa2d`) and is **canonical + 9 days newer**. The installed `prism:cl-plugin-structure`
  is just the marketplace-cached 3.9.5 vintage of the repo copy. The user copy is a historical
  archive — safe to retire or clearly mark as archive.
- **L5 — GitHub bulk asset upload 404s** — create release with ONE asset, upload the rest one at a
  time (the release skill's warning is accurate).

## Artifacts

- Release: tag `v4.2.0` @ `7aea8b6`, GH release w/ 8 assets + full notes
- `CHANGELOG.md` — 4.2.0 + backfilled 4.1.0 (this commit)
- `.prism/shared/docs/PRISM-DOCUMENTATION-4.2.0.md` (`66a59dd`)
- `.prism/shared/evals/v4.2.0-snapshot/` (`eec0609`)
- `prism-docs/docs/daemon/surface-connectivity.md` — droplet section = production state
- Prior handoffs: 2026-07-15 (Model-B execution), this file

## Action Items & Next Steps

1. Run the **research phase** for connectors + artifacts (see Suggested approach).
2. Brainstorm scope with Gavin (visual companion on): connector transport, auth, which Prism
   services to expose; artifact popout host surface (VS Code panel? Electron window? both?).
3. Plan → approve → implement per Prism workflow.
4. (Only if Gavin asks) open the pairing investigation using Parked Findings above.

## Other Notes

- Standing decisions hold: paseo rename deferred (wire-compat seam parked in the 2026-07-15
  brainstorm ledger); Node 22 for daemon work; never casually kill a running :6767 daemon.
- Gavin's working tree still carries deliberate local changes (CLAUDE.md line, prism-eval gitlink,
  untracked .claude/skills, AGENTS.md, .superpowers) — do not sweep into commits.
- claude.ai connector MCP servers (Gmail/Calendar/Drive) require interactive auth — headless
  sessions can't OAuth them; plan around that for connector research.
- The skill-guard hook false-positived twice this session (PRISM-DOCUMENTATION Write → init_prism;
  this handoff → prism-debug). Worth a tuning pass on its patterns — propose to Gavin.
