---
name: prism-release
description: Create a versioned release of prism-plugin. Bumps semantic version across all 14 version files, builds CLI binaries + VSIX + Electron + NSIS installer, commits, tags, pushes, and creates a GitHub release with all assets. Use when the user says "release", "bump version", "new version", "cut a release", "prism-release", or wants to publish a new version.
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

This updates all 14 version locations (VERSION, plugin.json, marketplace.json, main.go, footer.go, 4 package.json files, PrismState.ts, PrismStateContext.tsx, and 3 setup files). Verify the output shows all files updated.

### Step 3: Build all artifacts

Run these builds. CLI + VSIX can run in parallel, then Electron, then NSIS.

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

#### 3e. Compile NSIS installer

```bash
makensis -V4 -DVERSION={NEW_VERSION} installer/prism-setup.nsi
```

If `makensis` is not in PATH, try: `"/c/Program Files (x86)/NSIS/makensis.exe"`

Verify: `ls installer/Prism-Setup-{NEW_VERSION}.exe`

### Step 4: Commit and tag

```bash
git add VERSION .claude-plugin/ cmd/prism-cli/main.go cmd/prism-cli/app/footer.go \
  cmd/prism-vscode/package.json cmd/prism-electron/package.json \
  cmd/prism-setup/package.json cmd/prism-setup/src/ \
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
  installer/Prism-Setup-{NEW_VERSION}.exe \
  --title "Prism v{NEW_VERSION}" \
  --notes "Release notes here"
```

The release should include 7 assets:
- 5 CLI binaries (all platforms)
- 1 Electron desktop app installer (`Prism-{VERSION}.Setup.exe`)
- 1 NSIS all-in-one installer (`Prism-Setup-{VERSION}.exe`)

### Step 7: Report results

Print a summary with the release URL.

## Error Handling

- If `gh` is not installed or not authenticated: tell the user to run `gh auth login`
- If `make build-all` fails: check that Go 1.22+ is installed
- If `npm run make` fails: check Electron Forge dependencies with `cd cmd/prism-electron && npm install`
- If `makensis` fails: check NSIS 3.x is installed (`winget install NSIS.NSIS`)
- If git push fails: report the error, do NOT force-push
- If `gh release create` fails because the tag already exists: ask the user if they want to delete and recreate
