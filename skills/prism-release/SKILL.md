---
name: prism-release
description: Create a versioned release of prism-plugin. Bumps semantic version (major/minor/patch) across all version files — plugin.json, marketplace.json, main.go, both package.json files, changelogs, and documentation. Cross-compiles prism-cli binaries, commits, and tags. Use when the user says "release", "bump version", "new version", "cut a release", "prism-release", or wants to update version numbers across the project.
---

# Prism Release

Bump version numbers across the entire prism-plugin monorepo, update changelogs, rebuild CLI binaries, and create a tagged commit.

## Workflow

### 1. Gather Release Info

Ask the user:
- **Bump type**: patch / minor / major
- **Release summary**: Short description of what changed (used in commit message and changelogs)
- **Include packages?**: Whether to also bump `packages/prism-core` and `packages/prism-ui`

### 2. Read Current Version

Source of truth: `.claude-plugin/plugin.json` field `"version"`.

```bash
# Verify all Tier 1 files are in sync before proceeding
```

Read all 8 Tier 1 files and confirm they share the same version. If mismatched, warn the user and ask how to proceed. Known drift-prone files:
- `cmd/prism-cli/app/footer.go` — hardcoded `"vX.Y.Z"` string in TUI powerline footer
- `packages/prism-core/src/shared/PrismState.ts` — `DEFAULT_PRISM_STATE.version`
- `packages/prism-ui/src/context/PrismStateContext.tsx` — `DEFAULT_STATE.version`

### 3. Calculate New Version

Parse `MAJOR.MINOR.PATCH` from current version. Apply bump type:
- **patch**: `MAJOR.MINOR.(PATCH+1)`
- **minor**: `MAJOR.(MINOR+1).0`
- **major**: `(MAJOR+1).0.0`

### 4. Update Tier 1 — Core Version Files

Use the **Edit tool** for each file. Match the exact old version string and replace with new.

| # | File | What to Edit |
|---|------|-------------|
| 1 | `.claude-plugin/plugin.json` | `"version": "OLD"` → `"version": "NEW"` |
| 2 | `.claude-plugin/marketplace.json` | `"version": "OLD"` → `"version": "NEW"` |
| 3 | `cmd/prism-cli/main.go:19` | `var version = "OLD"` → `var version = "NEW"` |
| 4 | `cmd/prism-vscode/package.json` | `"version": "OLD"` → `"version": "NEW"` |
| 5 | `cmd/prism-electron/package.json` | `"version": "OLD"` → `"version": "NEW"` |
| 6 | `cmd/prism-cli/app/footer.go:165` | `"vOLD"` → `"vNEW"` (hardcoded TUI footer powerline segment) |
| 7 | `packages/prism-core/src/shared/PrismState.ts:85` | `version: "OLD"` → `version: "NEW"` (in `DEFAULT_PRISM_STATE`) |
| 8 | `packages/prism-ui/src/context/PrismStateContext.tsx:152` | `version: "OLD"` → `version: "NEW"` (in `DEFAULT_STATE`) |

All 8 edits can run in parallel since they are independent files.

**Important**: Files 6-8 have historically drifted. Always verify their current values before editing — they may not match the expected OLD version. Use the actual string found in each file.

### Where Version Is Displayed to Users

| App | Location | Source |
|-----|----------|--------|
| **CLI** | TUI powerline footer (bottom-right) | `footer.go:165` hardcoded string |
| **CLI** | `--version` flag output | `main.go:19` via Cobra |
| **Electron** | BottomStatusBar (24px strip, bottom-left) | `PrismState.ts:85` → `usePrismState().version` |
| **VSCode** | Panel StatusBar (22px strip, right side) | Controller state `version` field via `initialState` message |
| **VSCode** | Extensions panel (managed by VS Code) | `package.json` `"version"` field |

### 5. Update Tier 2 — Changelogs

Prepend a new section after the header in each changelog. Use the Edit tool to insert after the existing header content.

**Root `CHANGELOG.md`** — prepend after the "Keep a Changelog" header line:

```markdown
## [NEW] - YYYY-MM-DD

### Changed
- {user's release summary}
```

**`cmd/prism-vscode/CHANGELOG.md`** — prepend after existing header:

```markdown
## [NEW] — YYYY-MM-DD

### Changed
- {user's release summary}
```

Note the em-dash (—) in the VSCode changelog vs hyphen (-) in the root changelog.

### 6. Update Tier 3 — Documentation

Find the current documentation file:

```bash
ls .prism/shared/docs/PRISM-DOCUMENTATION-*.md
```

Then:

1. **Read** the documentation file
2. **Rename** using `git mv`:
   ```bash
   git mv ".prism/shared/docs/PRISM-DOCUMENTATION-{OLD}.md" ".prism/shared/docs/PRISM-DOCUMENTATION-{NEW}.md"
   ```
3. **Update internal version references** using Edit tool with `replace_all: true`:
   - Replace all occurrences of the old version string with the new version inside the renamed file
   - The documentation contains ~20 version references in titles, headers, JSON examples, CLI output examples, and version tables

### 7. Update Tier 4 — Packages (Optional)

Only if user opted in during Step 1:

| File | Edit |
|------|------|
| `packages/prism-core/package.json` | `"version": "OLD"` → `"version": "NEW"` |
| `packages/prism-ui/package.json` | `"version": "OLD"` → `"version": "NEW"` |

These packages may use independent versioning (currently `0.1.0`). Ask the user whether to set them to the main version or bump independently.

### 8. Build CLI Binaries

```bash
cd cmd/prism-cli && make build-all
```

This cross-compiles for: windows/amd64, darwin/amd64, darwin/arm64, linux/amd64, linux/arm64.

Verify build succeeds. If it fails, stop and report the error.

### 9. Summary and Review

Display a table of all changes made:

```
Release: vOLD → vNEW

Tier 1 — Core versions:
  ✓ .claude-plugin/plugin.json
  ✓ .claude-plugin/marketplace.json
  ✓ cmd/prism-cli/main.go
  ✓ cmd/prism-vscode/package.json
  ✓ cmd/prism-electron/package.json
  ✓ cmd/prism-cli/app/footer.go (TUI footer)
  ✓ packages/prism-core/src/shared/PrismState.ts (DEFAULT_PRISM_STATE)
  ✓ packages/prism-ui/src/context/PrismStateContext.tsx (DEFAULT_STATE)

Tier 2 — Changelogs:
  ✓ CHANGELOG.md
  ✓ cmd/prism-vscode/CHANGELOG.md

Tier 3 — Documentation:
  ✓ .prism/shared/docs/PRISM-DOCUMENTATION-{NEW}.md (renamed + updated)

Build:
  ✓ CLI binaries built (5 platforms)
```

Ask user to confirm before committing.

### 10. Commit and Tag

```bash
git add -A
git commit -m "vNEW - {release summary}"
git tag "vNEW"
```

### 11. Push (Optional)

Ask user if they want to push:

```bash
git push origin main --tags
```

Only push if explicitly confirmed.
