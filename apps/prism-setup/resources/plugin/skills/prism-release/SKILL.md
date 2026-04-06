---
name: prism-release
description: Create a versioned release of prism-plugin. Bumps semantic version across all version files, builds CLI binaries + VSIX + Electron + Tauri installer + NSIS installer, commits, tags, pushes, and creates a GitHub release with all assets. Use when the user says "release", "bump version", "new version", "cut a release", "prism-release", or wants to publish a new version.
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

### Step 2: Bump version across all files

```bash
python scripts/bump-version.py <major|minor|patch> --root .
```

This updates version locations including: VERSION, plugin.json, marketplace.json, main.go, footer.go, package.json files (prism-vscode, prism-electron, prism-installer), PrismState.ts, PrismStateContext.tsx. Verify the output shows all files updated.

**Manual verification** — the bump script may miss these files. Check and update manually if needed:
- `cmd/prism-installer/src-tauri/Cargo.toml` — `version = "{NEW_VERSION}"`
- `cmd/prism-installer/src-tauri/tauri.conf.json` — `"version": "{NEW_VERSION}"`

### Step 3: Build all artifacts

Run these builds. CLI + VSIX can run in parallel, then Electron, then Tauri, then NSIS.

#### 3a. Cross-compile CLI binaries

```bash
cd cmd/prism-cli && make build-all
```

Verify: `ls -la cmd/prism-cli/bin/` shows 5 binaries.

#### 3b. Package VSIX extension

```bash
cd cmd/prism-vscode && npx @vscode/vsce package \
  --no-dependencies \
  --baseContentUrl https://github.com/TheDigitalGriot/prism-plugin/tree/main/cmd/prism-vscode \
  --baseImagesUrl https://github.com/TheDigitalGriot/prism-plugin/raw/main/cmd/prism-vscode \
  --out ../prism-setup/resources/extensions/prism.vsix
```

#### 3c. Populate NSIS installer resources

```bash
# Copy CLI binary for the installer
mkdir -p cmd/prism-setup/resources/binaries
cp cmd/prism-cli/bin/prism-cli-windows-amd64.exe cmd/prism-setup/resources/binaries/

# Copy plugin files for the installer
mkdir -p cmd/prism-setup/resources/plugin
cp -r commands agents skills .claude-plugin cmd/prism-setup/resources/plugin/
```

#### 3d. Build Electron desktop app

```bash
cd cmd/prism-electron && npm run make
```

Verify: `ls cmd/prism-electron/out/make/squirrel.windows/x64/` shows `Prism-{VERSION} Setup.exe`.

#### 3e. Build Tauri installer (Prism Setup)

```bash
cd cmd/prism-installer && npm run tauri build -- --bundles nsis
```

Output: `cmd/prism-installer/src-tauri/target/release/bundle/nsis/Prism Setup_{VERSION}_x64-setup.exe`

Verify: `ls "cmd/prism-installer/src-tauri/target/release/bundle/nsis/Prism Setup_{NEW_VERSION}_x64-setup.exe"`

> **Note**: On macOS, use `--bundles dmg` instead. CI builds both via `prism-installer-release.yml`.

#### 3f. Compile legacy NSIS installer

```bash
makensis -V4 -DVERSION={NEW_VERSION} installer/prism-setup.nsi
```

If `makensis` is not in PATH, try: `"/c/Program Files (x86)/NSIS/makensis.exe"`

Verify: `ls installer/Prism-Setup-{NEW_VERSION}.exe`

### Step 4: Commit and tag

```bash
git add VERSION .claude-plugin/ cmd/prism-cli/main.go cmd/prism-cli/app/footer.go \
  cmd/prism-vscode/package.json cmd/prism-electron/package.json \
  cmd/prism-installer/package.json cmd/prism-installer/src-tauri/Cargo.toml \
  cmd/prism-installer/src-tauri/tauri.conf.json cmd/prism-installer/src-tauri/src/ \
  cmd/prism-installer/src/ \
  cmd/prism-setup/resources/extensions/prism.vsix \
  cmd/prism-setup/resources/plugin/ \
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

```bash
gh release create v{NEW_VERSION} \
  cmd/prism-cli/bin/prism-cli-darwin-amd64 \
  cmd/prism-cli/bin/prism-cli-darwin-arm64 \
  cmd/prism-cli/bin/prism-cli-linux-amd64 \
  cmd/prism-cli/bin/prism-cli-linux-arm64 \
  cmd/prism-cli/bin/prism-cli-windows-amd64.exe \
  "cmd/prism-electron/out/make/squirrel.windows/x64/Prism-{NEW_VERSION} Setup.exe" \
  "cmd/prism-installer/src-tauri/target/release/bundle/nsis/Prism Setup_{NEW_VERSION}_x64-setup.exe" \
  installer/Prism-Setup-{NEW_VERSION}.exe \
  --title "Prism v{NEW_VERSION}" \
  --notes "Release notes here"
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
- If `npm run make` fails: check Electron Forge dependencies with `cd cmd/prism-electron && npm install`
- If `tauri build` fails: check Rust toolchain with `rustup show`, ensure NSIS is installed for bundling
- If `makensis` fails: check NSIS 3.x is installed (`winget install NSIS.NSIS`)
- If git push fails: report the error, do NOT force-push
- If `gh release create` fails because the tag already exists: ask the user if they want to delete and recreate
