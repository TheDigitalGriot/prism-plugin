# Build Commands Reference

Full bash commands for each build step in the prism-release pipeline.

## 3a. Cross-compile CLI binaries

```bash
cd apps/prism-cli && make build-all VERSION={NEW_VERSION}
```

Verify: `ls -la apps/prism-cli/bin/` shows 5 binaries, and
`./bin/prism-cli-windows-amd64.exe --version` prints `{NEW_VERSION}`.

> **`VERSION=` is mandatory.** `Makefile:3` defaults to
> `VERSION ?= $(shell git describe --tags --always --dirty)` and injects it via `-ldflags` into
> `main.version` — it never reads the `VERSION` file or `main.go`. Since this step runs before the
> release commit+tag, a bare `make build-all` stamps binaries with the **previous** tag plus
> `-dirty` (observed on the v4.15.2 cut: `v4.15.1-4-g814b762-dirty`).

## 3b. Package VSIX extension

```bash
cd apps/prism-vscode && npx @vscode/vsce package \
  --no-dependencies \
  --baseContentUrl https://github.com/TheDigitalGriot/prism/tree/main/apps/prism-vscode \
  --baseImagesUrl https://github.com/TheDigitalGriot/prism/raw/main/apps/prism-vscode \
  --out prism-{VERSION}.vsix

# Bundled resource for the Tauri installer (tauri.conf.json -> bundle.resources).
# Must happen before 3d or the Tauri build fails on the missing resource.
cp prism-{VERSION}.vsix ../prism-installer/src-tauri/resources/extensions/prism.vsix
```

The versioned `prism-{VERSION}.vsix` stays in `apps/prism-vscode/` and ships as a standalone
GitHub release asset in Step 6.

## 3c. Build Electron desktop app

```bash
cd apps/prism-electron && npm run make
```

Verify: `ls apps/prism-electron/out/make/squirrel.windows/x64/` shows `Prism-{VERSION} Setup.exe`.

## 3d. Build Tauri installer (Prism Setup)

```bash
cd apps/prism-installer && npm run tauri build -- --bundles nsis
```

Output: `apps/prism-installer/src-tauri/target/release/bundle/nsis/Prism Setup_{VERSION}_x64-setup.exe`

Verify: `ls "apps/prism-installer/src-tauri/target/release/bundle/nsis/Prism Setup_{NEW_VERSION}_x64-setup.exe"`

> **Note**: On macOS, use `--bundles dmg` instead. CI builds both via `prism-installer-release.yml`.
>
> **The `--bundles` flag is not optional on macOS.** `tauri.conf.json` pins
> `bundle.targets: ["nsis"]`, so a bare `npm run tauri build` on a Mac tries to build a Windows
> NSIS target and fails. CI is unaffected because both jobs pass `--bundles` explicitly
> (`prism-installer-release.yml`), but a local macOS build must pass `--bundles dmg`. The config
> keeps an explicit target rather than `[]` because an empty array bundles **nothing** while still
> exiting 0 — the v4.15.0/v4.15.1 stale-artifact bug.

## 3e. Verify every installer by embedded version

Filenames are not evidence — a stale artifact can carry a correct-looking name.

```powershell
(Get-Item "apps/prism-electron/out/make/squirrel.windows/x64/Prism-{VERSION} Setup.exe").VersionInfo.ProductVersion
(Get-Item "apps/prism-installer/src-tauri/target/release/bundle/nsis/Prism Setup_{VERSION}_x64-setup.exe").VersionInfo.ProductVersion
./apps/prism-cli/bin/prism-cli-windows-amd64.exe --version
```

All three must print `{VERSION}`.

> **Legacy NSIS (`installer/prism-setup.nsi`) is retired as of v4.15.2** along with
> `apps/prism-setup/`. Both trees stay on disk for rollback but are no longer built or shipped.

## Cowork sideload zip (Step 4.5 — runs post-commit)

Unlike 3a–3e, this runs **after** the release commit+tag (Step 4.5), because it archives the
committed ref and verifies the archived `plugin.json` version against `VERSION`.

```bash
python skills/prism-sideload/scripts/build-sideload.py --ref v{NEW_VERSION}
```

Output: `.prism/local/sideload/prism-sideload-{VERSION}.zip` (gitignored; uploaded to the GitHub
release in Step 6).

Verify: exits 0 and prints `OK  prism {VERSION}  ->  ...`. The script self-verifies (no nested
zips, `plugin.json` present, version match) and returns non-zero on any failure — do not upload
an unverified zip.
