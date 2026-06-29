---
title: Centralized Version Management
description: Single VERSION file, bump script, and release workflow for consistent versioning across all platforms.
outline: [2, 3]
---

# Centralized Version Management (v2.5.0)

Prior to v2.4.3, version strings were hardcoded in 14+ files across the monorepo and bumped manually. This was error-prone and versions frequently drifted. The bump script was updated in v2.4.7 to replace `apps/prism-setup` references with the Tauri installer.

## VERSION File

A single `VERSION` file at the repository root is the source of truth:

```
3.7.0
```

As of **v3.6.0**, every surface versions in lockstep with this file — including
**prism-mobile**, whose `app.config.js` reads the root `VERSION` directly (with a package-version
fallback for detached EAS builds).

## Bump Script (`scripts/bump-version.py`)

```bash
python scripts/bump-version.py patch           # 2.5.0 -> 2.5.1
python scripts/bump-version.py minor           # 2.5.0 -> 2.6.0
python scripts/bump-version.py major           # 2.5.0 -> 3.0.0
python scripts/bump-version.py --set 2.6.0     # explicit version
```

The script reads the current version from `VERSION`, computes the new version, then updates all production version locations:

### JSON files (update `"version"` field)

| # | File | What is Updated |
|---|------|-----------------|
| 1 | `VERSION` | Root source of truth |
| 2 | `.claude-plugin/plugin.json` | `"version"` JSON field |
| 3 | `.claude-plugin/marketplace.json` | `"version"` JSON field |
| 4 | `apps/prism-vscode/package.json` | `"version"` JSON field |
| 5 | `apps/prism-electron/package.json` | `"version"` JSON field |
| 6 | `apps/prism-installer/package.json` | `"version"` JSON field |
| 7 | `apps/prism-installer/src-tauri/tauri.conf.json` | `"version"` JSON field |

### Text files (find-and-replace of old → new)

| # | File | What is Updated |
|---|------|-----------------|
| 8 | `apps/prism-cli/main.go` | `var version = "X.Y.Z"` |
| 9 | `apps/prism-cli/app/footer.go` | `"vX.Y.Z"` hardcoded TUI footer |
| 10 | `packages/prism-core/src/shared/PrismState.ts` | `DEFAULT_PRISM_STATE.version` |
| 11 | `packages/prism-ui/src/context/PrismStateContext.tsx` | `DEFAULT_STATE.version` |
| 12 | `apps/prism-mobile/packages/app/package.json` | `"version"` fallback (the Expo app reads root `VERSION` first, via `app.config.js`) |
| 13 | `apps/prism-installer/src-tauri/Cargo.toml` | `version = "X.Y.Z"` (Rust crate, non-standard spacing handled) |

> **Mobile (v3.6.0+):** `apps/prism-mobile/packages/app/app.config.js` reads the repo-root
> `VERSION` file at config-eval time, so the Expo app surface always matches. The monorepo-root
> `apps/prism-mobile/package.json` keeps its paseo upstream-lineage version (`0.1.69`) as the
> refresh-tracking marker — that one is intentionally **not** bumped.

> **Deprecated**: `apps/prism-setup/` (Electron-based NSIS installer) entries are commented out in the script but kept for rollback.

## Where Version Appears to Users

| Platform | Location | Source |
|----------|----------|--------|
| **CLI** | TUI footer (bottom-right powerline) | `footer.go:165` hardcoded string |
| **CLI** | `--version` flag | `main.go:19` via Cobra |
| **Electron** | Bottom status bar (24px, bottom-left) | `PrismState.ts` → `usePrismState().version` |
| **VS Code** | Panel status bar (22px, right side) | Controller state via `initialState` message |
| **VS Code** | Extensions panel | `package.json` `"version"` field |
| **Mobile** | App/store version (Expo) | `app.config.js` reads root `VERSION` (fallback `packages/app/package.json`) |
| **Installer** | Title bar and version display | `tauri.conf.json` `"version"` field, read via `@tauri-apps/api/app` |

## Release Workflow Integration

The `/prism-release` skill uses the bump script:

```bash
# Step 1: Bump (one command updates all version files)
python scripts/bump-version.py patch --root .

# Step 2: Build
cd apps/prism-cli && make build-all

# Step 3: Commit + tag
git add -A && git commit -m "vX.Y.Z" && git tag vX.Y.Z
git push && git push origin vX.Y.Z

# Step 4: GitHub release (triggers installer CI)
gh release create vX.Y.Z apps/prism-cli/bin/* ...
```
