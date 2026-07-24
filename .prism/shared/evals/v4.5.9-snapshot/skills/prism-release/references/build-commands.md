# Build Commands Reference

Full bash commands for each build step in the prism-release pipeline.

## 3a. Cross-compile CLI binaries

```bash
cd apps/prism-cli && make build-all
```

Verify: `ls -la apps/prism-cli/bin/` shows 5 binaries.

## 3b. Package VSIX extension

```bash
cd apps/prism-vscode && npx @vscode/vsce package \
  --no-dependencies \
  --baseContentUrl https://github.com/TheDigitalGriot/prism/tree/main/apps/prism-vscode \
  --baseImagesUrl https://github.com/TheDigitalGriot/prism/raw/main/apps/prism-vscode \
  --out ../prism-setup/resources/extensions/prism.vsix
```

## 3c. Populate NSIS installer resources

```bash
# Copy CLI binary for the installer
mkdir -p apps/prism-setup/resources/binaries
cp apps/prism-cli/bin/prism-cli-windows-amd64.exe apps/prism-setup/resources/binaries/

# Copy plugin files for the installer
mkdir -p apps/prism-setup/resources/plugin
cp -r commands agents skills .claude-plugin apps/prism-setup/resources/plugin/
```

## 3d. Build Electron desktop app

```bash
cd apps/prism-electron && npm run make
```

Verify: `ls apps/prism-electron/out/make/squirrel.windows/x64/` shows `Prism-{VERSION} Setup.exe`.

## 3e. Build Tauri installer (Prism Setup)

```bash
cd apps/prism-installer && npm run tauri build -- --bundles nsis
```

Output: `apps/prism-installer/src-tauri/target/release/bundle/nsis/Prism Setup_{VERSION}_x64-setup.exe`

Verify: `ls "apps/prism-installer/src-tauri/target/release/bundle/nsis/Prism Setup_{NEW_VERSION}_x64-setup.exe"`

> **Note**: On macOS, use `--bundles dmg` instead. CI builds both via `prism-installer-release.yml`.

## 3f. Compile legacy NSIS installer

```bash
makensis -V4 -DVERSION={NEW_VERSION} installer/prism-setup.nsi
```

If `makensis` is not in PATH, try: `"/c/Program Files (x86)/NSIS/makensis.exe"`

Verify: `ls installer/Prism-Setup-{NEW_VERSION}.exe`

## Cowork sideload zip (Step 4.5 — runs post-commit)

Unlike 3a–3f, this runs **after** the release commit+tag (Step 4.5), because it archives the
committed ref and verifies the archived `plugin.json` version against `VERSION`.

```bash
python skills/prism-sideload/scripts/build-sideload.py --ref v{NEW_VERSION}
```

Output: `.prism/local/sideload/prism-sideload-{VERSION}.zip` (gitignored; uploaded to the GitHub
release in Step 6).

Verify: exits 0 and prints `OK  prism {VERSION}  ->  ...`. The script self-verifies (no nested
zips, `plugin.json` present, version match) and returns non-zero on any failure — do not upload
an unverified zip.
