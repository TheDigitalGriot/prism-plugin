---
date: 2026-06-12
author: Claude (prism-plan)
status: awaiting-approval
type: migration
feature: "prism-mobile one-time refresh onto upstream paseo v0.1.95"
research: .prism/shared/research/2026-06-12-paseo-daemon-architecture-surface-impact.md
target_repo: C:/Users/digit/Developer/prism-mobile
source_repo: C:/Users/digit/Developer/paseo-upstream    # getpaseo/paseo @ v0.1.95
reference_recipe: C:/Users/digit/Developer/paseo         # FROZEN baseline — read-only, commit 06875d3 is the canonical rebrand transform
---

# Plan: Refresh prism-mobile onto upstream paseo v0.1.95 (shallow-rebrand recipe)

## Context & Goal

Rebuild the product repo at `C:/Users/digit/Developer/prism-mobile` from **fresh upstream paseo v0.1.95**, carrying only the thin, proven Prism layer, so the first Prism mobile app ships on a modern base (+584 commits / +26 versions: i18n, PWA, RPC refactor, Windows fixes, e2e suite) instead of the stale v0.1.65 scratch.

**Root-cause established (see research §post-mortem):** the prior `prism-mobile` breakage was **not** the folder rename. Daemon resolution in `runtime-paths.ts` is `require.resolve` + `package.json` name based (folder-agnostic), and prism-mobile's package rename was internally consistent. The actual blockers were **install/CI/toolchain**: (1) `lefthook` `prepare` → `exit 128` with no `.git`; (2) EAS `npm ci` lockfile mismatch (npm 11/Node 24 local vs npm 10/Node 22 on EAS); (3) zod peer-deps. This plan neutralizes all three.

**Strategy chosen (user):** one-time refresh, standalone repo, no upstream tracking. Reuse the `prism-mobile` folder (de-risked).

**The proven recipe (mirror the `paseo` fork, commit `06875d3`):**
- Shallow scope swap `@getpaseo/* → @thedigitalgriot/*`. **Keep** every package directory name and the **root package name `paseo`**.
- Prism identity lives **only** in `packages/app/app.config.js`.
- `~/.paseo → ~/.thedigitalgriot` home-dir string swap.

## What We're NOT Doing

- **NOT** modifying the frozen baseline `C:/Users/digit/Developer/paseo` (read-only reference for the canonical diff).
- **NOT** doing a deep rename (no `@thedigitalgriot/prism-*` package scope; no renaming package dirs; no root package rename to `prism`). This is the exact shape that the post-mortem cleared as unnecessary and risk-adding.
- **NOT** folding prism-mobile into the `prism-plugin` monorepo. Deferred as a separate architectural decision (would merge paseo's RN/Expo/Metro/EAS/zod-3 toolchain into the plugin repo and bloat plugin release snapshots). Noted for future; out of scope here.
- **NOT** adding the parked parallel Claude Agent SDK feature.
- **NOT** setting up upstream-tracking remotes/rebase automation (standalone).
- **NOT** touching the Prism CLI / VSCode / Electron surfaces — that daemon-client alignment is a separate downstream effort already mapped in the research doc.
- **NOT** submitting to the App Store; all builds are internal-distribution dev clients.

## Structural Impact

Structural (graph) analysis skipped: this is an infra/packaging/toolchain migration across two external repos, not a code-symbol change in the indexed `prism-plugin` graph. Blast-radius tracing does not apply.

## Success Criteria

#### Automated Verification
- [ ] `npm install` completes clean under Node 22.20.0 / npm 10 at `prism-mobile` root (no peer-dep abort, no `prepare` failure).
- [ ] `npm ci --dry-run` is green (lockfile consistent with the EAS toolchain).
- [ ] `npm run typecheck` passes across all workspaces.
- [ ] `npm run lint` passes (oxlint).
- [ ] `npm run build:daemon` succeeds (highlight → relay → server → cli).
- [ ] Grep proves zero `@getpaseo/<pkg>` package-resolution references remain in code (docs/test-emails excluded): `@getpaseo/(server|cli|app|relay|desktop|highlight)`.
- [ ] `eas build --profile development --platform ios` passes the **npm ci install phase** on EAS Build.

#### Manual Verification
- [ ] Daemon boots on `127.0.0.1:6767` via `npm run dev` (or `dev:win`) and prints the QR.
- [ ] A client (CLI `paseo daemon pair` or the web app) connects and lists agents.
- [ ] iOS dev-client build completes on EAS and installs on `dg-iphone` + `dg-ipad`.
- [ ] Installed dev client connects to the local daemon via `npx expo start --dev-client` (cleartext LAN).
- [ ] App identity shows "Prism" / "Prism Debug" (not "Paseo") on device.

## Phases

### Phase 1 — Pre-flight & safety
**Goal:** Guarantee the frozen fork is untouched and capture a clean starting point.
1. Confirm `git -C C:/Users/digit/Developer/paseo status` is clean and last commit is `06875d3` (no accidental writes).
2. Confirm `C:/Users/digit/Developer/paseo-upstream` is at v0.1.95 (`04a985bf`) and clean.
3. Record the canonical transform: `git -C C:/Users/digit/Developer/paseo show 06875d3 > <scratch>/rebrand-06875d3.patch` (read-only export for reference during Phase 3).
4. Record the relay commits: `git -C C:/Users/digit/Developer/paseo show aeb64a63 676922d6 > <scratch>/relay-pathmount.patch`.

**Verification:** fork HEAD unchanged (`06875d3`), working tree clean; both patch files exported.

### Phase 2 — Seed base from upstream v0.1.95
**Goal:** Replace the scratch `prism-mobile` contents with a clean v0.1.95 tree as a standalone repo.
1. The old `prism-mobile` is an uncommitted scratch (no commits, no remote); everything useful (handoff facts) is already captured in the research doc. Remove its contents (delete the directory tree, including its `.git` and `node_modules`).
2. Copy the upstream v0.1.95 working tree into `prism-mobile` (exclude `.git`, `node_modules`, `paseo-upstream/dist`).
3. `git init` at `prism-mobile`; create an initial commit "chore: seed from paseo v0.1.95 (04a985bf)". No remotes added (standalone). Optionally add `origin` → `github.com/TheDigitalGriot/prism-mobile` (empty; push deferred).

**Verification:** `prism-mobile/package.json` version reads `0.1.95`; `git -C prism-mobile log --oneline` shows the seed commit; no `upstream` remote.

### Phase 3 — Shallow rebrand (mirror commit 06875d3)
**Goal:** Apply only the proven Prism layer; structure untouched.
1. **Scope swap** `@getpaseo/ → @thedigitalgriot/` across all tracked files (package.json `name`/deps, vitest aliases, `runtime-paths.ts` constants, bin scripts, tsconfig refs, imports). Keep package directory names and root package name `paseo`.
2. **Home-dir swap** string `~/.paseo` / `.paseo` → `~/.thedigitalgriot` / `.thedigitalgriot` where the fork's `06875d3` changed it (scripts/dev-home.sh, dev.ps1, runtime path helpers).
3. **Prism app identity** — set `packages/app/app.config.js` to the fork's values: production `name: "Prism"` / `com.thedigitalgriot.prism`; development `name: "Prism Debug"` / `com.thedigitalgriot.prism.debug`; `slug: "prism-mobile"`, `scheme: "prism"`, `owner: "digitalgriot"`, `extra.eas.projectId: "4e6ac688-b550-4441-b19a-bbb4459ad05b"`, `updates.url` for that projectId. Reconcile against any upstream app.config.js shape changes since v0.1.69.
4. **Fix the latent packaged-path bug**: in `packages/desktop/src/daemon/runtime-paths.ts`, change the hardcoded packaged-mode literals `node_modules/@getpaseo/server/...` and `node_modules/@getpaseo/cli/...` to `@thedigitalgriot` (the fork left these as `@getpaseo`, which would break a packaged desktop build — only dev was ever tested).

**Verification:** `@getpaseo/(server|cli|app|relay|desktop|highlight)` returns zero matches in code (docs/test git-emails allowed); `packages/app/app.config.js` shows Prism identity; root `package.json` name still `paseo`.

### Phase 4 — Install-hardening (the three documented kill-shots)
**Goal:** Make `npm install` and EAS `npm ci` deterministic.
1. **`.npmrc`** at repo root: add `legacy-peer-deps=true` (zod 4 via `@anthropic-ai/claude-agent-sdk` vs paseo zod 3). Confirm whether v0.1.95 already added it; keep a single source.
2. **`prepare` script guard** in root `package.json`: replace `"prepare": "lefthook install --force"` with a git-guarded form so it no-ops without `.git`:
   `"prepare": "node -e \"const fs=require('node:fs');if(fs.existsSync('.git')){require('node:child_process').execSync('lefthook install --force',{stdio:'inherit'})}\""`
3. **Toolchain-matched lockfile** (ordered, stop at first green):
   a. Switch local toolchain to **Node 22.20.0 / npm 10** (nvm-windows: `nvm install 22.20.0 && nvm use 22.20.0`). Delete `node_modules` + `package-lock.json`. Run `npm install`. Then `npm ci --dry-run`.
   b. If (a) still reports `Missing: react@19.2.5 …`: remove the `"react": "19.1.0"` and `"react-dom": "19.1.0"` entries from root `overrides`, delete `node_modules` + lock, regenerate under Node 22.20.0, re-run `npm ci --dry-run`.
4. **EAS profile parity**: confirm `packages/app/eas.json` `development`/`production` pin `node: "22.20.0"` and `env.NPM_CONFIG_LEGACY_PEER_DEPS: "true"`; add if upstream v0.1.95 lacks them.

**Verification:** `npm ci --dry-run` green under Node 22.20.0/npm 10; `npm install` runs `prepare` without `exit 128`; `eas.json` profiles carry the node pin + legacy-peer-deps env.

### Phase 5 — Relay path-mount re-apply
**Goal:** Restore Prism's `prism.digitalgriot.studio/relay/*` path-mounted relay onto the v0.1.95 relay.
1. Apply the **functional** change from `aeb64a63`: port the path-mount URL logic in `packages/server/src/shared/daemon-endpoints.ts` (30-line change) and `packages/relay/wrangler.toml` onto their v0.1.95 equivalents.
2. Apply `676922d6`: reconcile `packages/relay/src/cloudflare-adapter.ts` (the bulk of that commit is reformat churn; isolate the logical path-handling delta) and `packages/relay/wrangler.toml` routes for `prism.digitalgriot.studio/relay/*`.
3. Resolve content drift against v0.1.95 by hand where the upstream files moved (relay src file set is unchanged, so drift is content-only, not structural).

**Verification:** `npm run build --workspace=@thedigitalgriot/relay` succeeds; `npm run typecheck --workspace=@thedigitalgriot/server` passes; `wrangler.toml` references the `prism.digitalgriot.studio/relay` route; relay unit tests pass for the touched files (`npx vitest run packages/relay/src/cloudflare-adapter.test.ts --bail=1`).

### Phase 6 — Local verification
**Goal:** Prove the daemon + a client work end-to-end locally before cloud builds.
1. `npm run typecheck`, `npm run lint`, `npm run build:daemon` — all green.
2. `npm run dev:win` (Windows) → daemon on `127.0.0.1:6767` + Metro; QR prints.
3. Pair a client: `npm run cli -- daemon status` and `npm run cli -- daemon pair` (or open the web app) → connects, `npm run cli -- ls -a -g` lists agents.

**Verification:** daemon boots on 6767; CLI/web client connects and lists agents; no `Unable to resolve … package root` errors.

### Phase 7 — EAS iOS dev-client smoke test
**Goal:** Prove the EAS install phase is fixed and the app runs on the registered devices.
1. `cd packages/app && eas build --profile development --platform ios` → passes the **npm ci install phase** (the prior blocker) → builds to completion (reuses cached iOS dist cert + provisioning profile under Team `M6K8N36JN8`).
2. Install on `dg-iphone` (`00008140-0004488A0206801C`) and `dg-ipad` (`00008103-000A45361AA0801E`).
3. `npx expo start --dev-client` from `packages/app`; connect the device to the local daemon over LAN (cleartext enabled).

**Verification:** EAS build succeeds past install → completion; dev client installs on both devices; app shows "Prism Debug" and connects to the daemon.

## Risks & Mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| Lockfile still rejected by EAS after Node-22 regen | Med | Ordered fallback in Phase 4.3b (drop the react/react-dom overrides); EAS `prebuildCommand` running `npm install` as last resort |
| App reorg since v0.1.69 (src/components → src/agent-stream) moves the files commit 06875d3 touched, so the rebrand sites differ | Med | Drive Phase 3 by **transform rule** (scope/string swap globally) not by file list; use `06875d3` only as the intent reference |
| Relay `cloudflare-adapter.ts` drift makes `676922d6` hard to replay | Low | Functional change is small + isolated to daemon-endpoints.ts + wrangler.toml (Phase 5.1); reformat churn ignored |
| Latent packaged `@getpaseo` literals resurface in a packaged build | Low | Fixed explicitly in Phase 3.4; covered by the zero-match grep criterion |
| Accidental write to frozen fork | Low | All fork access is `git show`/`status` (read-only); Phase 1 verifies HEAD unchanged |

## Edge Cases
- **No `.git` in EAS upload archive** → `prepare` guard (Phase 4.2) makes lefthook a no-op.
- **Release build reaching a `http://` LAN daemon** → `usesCleartextTraffic: true` already set in app.config.js.
- **`version: 0.1.95` App Store format** → warning only; does not block internal dev-client builds; leave as-is.
- **Apple author/Team name mismatch** (package author "Gavin Bilodeau" vs Apple "GAVIN ANDRE BENNETT") → out of scope; separate task.

## Open Decisions — RESOLVED
- Folder: reuse `prism-mobile` (folder name proven irrelevant). ✅
- Recipe depth: shallow (scope-only), root name stays `paseo`. ✅
- Fold into prism-plugin: deferred (out of scope, noted). ✅
- Tracking: standalone, no upstream remote. ✅
