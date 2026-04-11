---
name: prism-release
description: Create a versioned release of prism-plugin. Bumps semantic version across all version files, builds CLI binaries + VSIX + Electron + Tauri installer + NSIS installer, commits, tags, pushes, and creates a GitHub release with all assets. Use when the user says "release", "bump version", "new version", "cut a release", "prism-release", or wants to publish a new version.
model: sonnet
---

# Prism Release

Full release pipeline: bump version → build all artifacts → commit → tag → push → GitHub release.

**Repository**: `TheDigitalGriot/prism-plugin`

## Process

### Step 1: Determine bump type

Ask the user which semver component to bump using AskUserQuestion:

- **patch** (Recommended) — bug fixes, small changes
- **minor** — new features, backward-compatible
- **major** — breaking changes

Read the current version from `VERSION` file and show it so the user knows what they're bumping from:

```bash
cat VERSION
```

### Step 1b: Validate plugin manifest

**MANDATORY** — run before proceeding. Catches schema errors that silently prevent plugin loading.

```bash
claude plugin validate .
```

Expected: `✔ Validation passed`. If it fails, fix the errors before continuing.

### Step 2: Bump version across all files

```bash
python scripts/bump-version.py <major|minor|patch> --root .
```

This updates version locations including: VERSION, plugin.json, marketplace.json, main.go, footer.go, package.json files (prism-vscode, prism-electron, prism-installer), PrismState.ts, PrismStateContext.tsx. Verify the output shows all files updated.

**Manual verification** — the bump script may miss these files. Check and update manually if needed:
- `apps/prism-installer/src-tauri/Cargo.toml` — `version = "{NEW_VERSION}"`
- `apps/prism-installer/src-tauri/tauri.conf.json` — `"version": "{NEW_VERSION}"`

### Step 3: Build all artifacts

Run these builds. CLI + VSIX can run in parallel, then Electron, then Tauri, then NSIS.

Load `references/build-commands.md` for the full build command reference.

#### 3a. Cross-compile CLI binaries
`cd apps/prism-cli && make build-all` — produces 5 binaries in `apps/prism-cli/bin/`.

#### 3b. Package VSIX extension
`npx @vscode/vsce package` from `apps/prism-vscode/` — outputs to `apps/prism-setup/resources/extensions/prism.vsix`.

#### 3c. Populate NSIS installer resources
Copy CLI binary and plugin files into `apps/prism-setup/resources/`.

#### 3d. Build Electron desktop app
`cd apps/prism-electron && npm run make` — outputs Squirrel installer to `out/make/squirrel.windows/x64/`.

#### 3e. Build Tauri installer (Prism Setup)
`npm run tauri build -- --bundles nsis` — outputs NSIS installer to `src-tauri/target/release/bundle/nsis/`. Use `--bundles dmg` on macOS.

#### 3f. Compile legacy NSIS installer
`makensis -V4 -DVERSION={NEW_VERSION} installer/prism-setup.nsi` — outputs `installer/Prism-Setup-{NEW_VERSION}.exe`.

### Step 4: Commit and tag

```bash
git add VERSION .claude-plugin/ apps/prism-cli/main.go apps/prism-cli/app/footer.go \
  apps/prism-vscode/package.json apps/prism-electron/package.json \
  apps/prism-installer/package.json apps/prism-installer/src-tauri/Cargo.toml \
  apps/prism-installer/src-tauri/tauri.conf.json apps/prism-installer/src-tauri/src/ \
  apps/prism-installer/src/ \
  apps/prism-setup/resources/extensions/prism.vsix \
  apps/prism-setup/resources/plugin/ \
  packages/prism-core/src/shared/PrismState.ts \
  packages/prism-ui/src/context/PrismStateContext.tsx \
  installer/ scripts/

git commit -m "v{NEW_VERSION}"
git tag v{NEW_VERSION}
```

### Step 5: Push

```bash
git push && git push origin v{NEW_VERSION}
```

### Step 6: Create GitHub release

**IMPORTANT: Upload assets in small chunks (2-3 at a time).** GitHub's upload API returns 404 on bulk uploads with large files. Create the release first with a few small assets, then upload remaining assets separately.

```bash
# Step 6a: Create release with CLI binaries (small files, reliable)
gh release create v{NEW_VERSION} \
  apps/prism-cli/bin/prism-cli-darwin-amd64 \
  apps/prism-cli/bin/prism-cli-darwin-arm64 \
  apps/prism-cli/bin/prism-cli-windows-amd64.exe \
  --title "Prism v{NEW_VERSION}" \
  --notes "Release notes here"

# Step 6b: Upload remaining CLI binaries
gh release upload v{NEW_VERSION} \
  apps/prism-cli/bin/prism-cli-linux-amd64 \
  apps/prism-cli/bin/prism-cli-linux-arm64

# Step 6c: Upload large installers one at a time
gh release upload v{NEW_VERSION} \
  "apps/prism-electron/out/make/squirrel.windows/x64/Prism-{NEW_VERSION} Setup.exe"

gh release upload v{NEW_VERSION} \
  "apps/prism-installer/src-tauri/target/release/bundle/nsis/Prism Setup_{NEW_VERSION}_x64-setup.exe"

gh release upload v{NEW_VERSION} \
  installer/Prism-Setup-{NEW_VERSION}.exe

# Step 6d: Update release notes with full changelog
gh release edit v{NEW_VERSION} --notes "Full release notes here"
```

The release should include 8 assets:
- 5 CLI binaries (all platforms)
- 1 Electron desktop app installer (`Prism-{VERSION} Setup.exe`)
- 1 Tauri installer (`Prism Setup_{VERSION}_x64-setup.exe`)
- 1 Legacy NSIS all-in-one installer (`Prism-Setup-{VERSION}.exe`)

### Step 7: Create eval snapshot

Snapshot the current skills, agents, commands, and scripts for future eval comparisons:

```bash
VERSION=$(cat VERSION)
SNAPSHOT_DIR=".prism/shared/evals/v${VERSION}-snapshot"

mkdir -p "$SNAPSHOT_DIR"
cp -r skills/ "$SNAPSHOT_DIR/skills/"
cp -r agents/ "$SNAPSHOT_DIR/agents/"
cp -r commands/ "$SNAPSHOT_DIR/commands/"
cp -r scripts/ "$SNAPSHOT_DIR/scripts/"
```

Verify the snapshot:
```bash
echo "Snapshot created at $SNAPSHOT_DIR"
ls "$SNAPSHOT_DIR/"
echo "Skills: $(ls "$SNAPSHOT_DIR/skills/" | wc -l)"
echo "Agents: $(ls "$SNAPSHOT_DIR/agents/" | wc -l)"
echo "Commands: $(ls "$SNAPSHOT_DIR/commands/" | wc -l)"
```

### Step 8: Generate eval cases for all skills

For each skill in the new snapshot, create an `evals.json` with eval cases covering the 4 evaluation dimensions. Read each SKILL.md and the previous version's SKILL.md (if a prior snapshot exists) to identify what changed.

```bash
PREV_SNAPSHOT=$(ls -d .prism/shared/evals/v*-snapshot 2>/dev/null | sort -V | tail -2 | head -1)
```

For each skill directory in `$SNAPSHOT_DIR/skills/*/`:

1. Read the current `SKILL.md`
2. If a previous snapshot exists, diff against the previous version's `SKILL.md`
3. Create `.prism/shared/evals/v${VERSION}/skills/<skill-name>/evals.json` with eval cases:

   - **Output quality eval** — tests that outputs meet format/content requirements defined in the skill
   - **Behavioral compliance eval** — tests new workflow steps or behavioral changes vs the previous version
   - **Regression eval** — tests that core behaviors from the previous version are still present

4. If the skill uses test fixtures (like stories.json for prism-spectrum), create them under `fixtures/`

The `evals.json` schema:

```json
{
  "skill": "<skill-name>",
  "version": "v<X.Y.Z>",
  "baseline": "../../../v<PREV>-snapshot/skills/<skill-name>/SKILL.md",
  "current": "skills/<skill-name>/SKILL.md",
  "target_codebase": ".",
  "evals": [
    {
      "id": 1,
      "dimension": "output_quality",
      "prompt": "A realistic task prompt for this skill",
      "expected_output": "Description of expected result",
      "files": [],
      "expectations": [
        "Verifiable assertion about the output"
      ]
    }
  ]
}
```

Write eval cases that are specific to what the skill does — not generic. For example:
- **prism-research**: "Research the [X] system in this codebase" → expects file:line refs, research template, no suggestions
- **prism-spectrum**: "Execute the next story from [fixture]" → expects state loading, quality gates, correct signals
- **prism-plan**: "Create a plan for [feature]" → expects interactive approval, two-category success criteria
- **prism-debug**: "Debug this [error]" → expects parallel investigators spawned

If no changes exist between versions (skill unchanged), still create a minimal regression eval to confirm the skill works correctly at this version.

Add the eval files to the release commit:
```bash
git add .prism/shared/evals/
git commit --amend --no-edit
git tag -f v${VERSION}
```

### Step 9: Report results

Print a summary with the release URL, snapshot path, and eval case counts.

## Error Handling

- If `gh` is not installed or not authenticated: tell the user to run `gh auth login`
- If `make build-all` fails: check that Go 1.22+ is installed
- If `npm run make` fails: check Electron Forge dependencies with `cd apps/prism-electron && npm install`
- If `tauri build` fails: check Rust toolchain with `rustup show`, ensure NSIS is installed for bundling
- If `makensis` fails: check NSIS 3.x is installed (`winget install NSIS.NSIS`)
- If git push fails: report the error, do NOT force-push
- If `gh release create` fails because the tag already exists: ask the user if they want to delete and recreate
