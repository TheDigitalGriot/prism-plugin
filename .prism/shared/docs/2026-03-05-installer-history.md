# Prism Installer History: Electron Forge → NSIS

**Date:** 2026-03-05
**Status:** NSIS is the active installer; Electron wizard is deprecated (code still in `cmd/prism-setup/`)

## Timeline

| Version | Commit | Time | Event |
|---------|--------|------|-------|
| v2.4.2 | `4b68f5f` | 03:51 AM | Electron Forge wizard fully built with Squirrel.Windows maker |
| v2.4.3 | `9e6efef` | 05:33 AM | NSIS installer added, Squirrel deps removed from package.json |
| v2.4.4 | `f8bbafb` | 06:07 AM | Documentation update + NSIS research formalized |

Both the Electron wizard and its NSIS replacement were built in a single session on 2026-03-05.

## The Original Installer: Electron Forge + Squirrel.Windows

### Technology Stack

| Component | Version |
|-----------|---------|
| Electron | 40.0.0 |
| React | 19.2.4 |
| Vite | 5.4.21 |
| TypeScript | ~4.5.4 |
| Electron Forge | 7.11.1 |
| Windows maker | `@electron-forge/maker-squirrel` 7.11.1 |
| Runtime dep | `electron-squirrel-startup` ^1.0.1 |

### Architecture

Scaffolded from the `electron-react-vite-ts-starter` template. Located in `cmd/prism-setup/` with 40+ files.

**7-screen React wizard:**

1. `WelcomeScreen.tsx` — Landing page
2. `ComponentSelectScreen.tsx` — Choose which Prism components to install
3. `InstallLocationScreen.tsx` — Pick install directory
4. `SystemCheckScreen.tsx` — Verify prerequisites
5. `ProgressScreen.tsx` — Show install progress
6. `VerificationScreen.tsx` — Confirm installation success
7. `DoneScreen.tsx` — Completion + next steps

**Installer logic (Node.js via IPC):**

- `installer/detect.ts` — System detection
- `installer/download.ts` — Download from GitHub releases
- `installer/orchestrator.ts` — Install coordination
- `installer/install-cli.ts` — CLI binary installation
- `installer/install-vscode.ts` — VS Code extension installation
- `installer/install-electron.ts` — Electron app installation
- `installer/install-plugin.ts` — Plugin installation
- `installer/path-config.ts` / `paths.ts` — PATH manipulation
- `installer/version.ts` — Version management

**Forge config** (`forge.config.ts`) used:
- `MakerSquirrel` for Windows (Squirrel.Windows)
- `MakerZIP` for Linux
- `MakerDeb` and `MakerRpm` for Linux packages
- `build/installer.nsh` — NSIS hook script used by Squirrel's bootstrapper for PATH via EnVar plugin

### CI/CD

`.github/workflows/prism-setup-release.yml` originally built on all three platforms (Windows, macOS, Linux) using `electron-forge make`.

## Why It Was Replaced

Four problems motivated the switch to NSIS:

1. **Excessive size** — ~130 MB installer for a ~37 MB payload. Electron bundles Chromium + Node.js just to show a wizard UI.
2. **npm workspace hoisting** — The `electron` package got hoisted to the repo root, breaking `require('electron')` at runtime.
3. **PATH reliability** — CLI commands (`code`, `cursor`, `claude`) failed because the Electron app spawned `setx` in a restricted shell environment.
4. **Non-standard UX** — Users expect a native Windows installer wizard (like Node.js, Git, VS Code), not a custom Electron window.

## The Replacement: Native NSIS Installer

### Technology

Pure NSIS (Nullsoft Scriptable Install System) with MUI2 (Modern UI 2) wizard pages. No runtime dependencies — compiles to a standalone `.exe`.

### Location

`installer/` directory at repo root:

```
installer/
├── prism-setup.nsi          # Root MUI2 wizard script
├── sections/
│   ├── cli.nsh              # CLI binary install section
│   ├── vscode.nsh           # VS Code extension install
│   ├── plugin.nsh           # Plugin install
│   └── electron.nsh         # Electron app install
├── pages/
│   └── preflight.nsh        # Custom system check page
├── uninstall.nsh            # Uninstaller
└── plugins/x86-unicode/
    ├── EnVar.dll             # Registry-based PATH manipulation
    └── NScurl.dll            # Native download support
```

### Comparison

| Metric | Electron Wizard | NSIS Installer |
|--------|----------------|----------------|
| Installer size | ~130 MB | ~38 MB |
| Technology | Electron + React | Native Windows |
| User experience | Custom UI, non-standard | Standard MUI2 wizard |
| Dependencies | Node.js, npm, Chromium | None (standalone .exe) |
| PATH config | Spawns `setx` (fragile) | EnVar plugin (registry-based) |
| Editor detection | `which`/`where` in shell | Direct file path checks |
| CI build | Multi-platform, ~5 min | Ubuntu `makensis`, ~30 sec |

### CI/CD

`.github/workflows/prism-setup-release.yml` was rewritten to compile NSIS on Ubuntu only, replacing the multi-platform Electron Forge build.

## Current State

- **`installer/`** — Active NSIS installer, producing `Prism-Setup-{version}.exe` (~38 MB)
- **`cmd/prism-setup/`** — Dead Electron wizard code (40+ files, unreferenced, never cleaned up)

The `cmd/prism-setup/` directory could be removed or archived. The `forge.config.ts` still contains TODO comments referencing "Phase 10" for NSIS maker integration through Forge — that approach was abandoned in favor of the standalone `installer/` directory.

## Related Documents

| Document | Path |
|----------|------|
| NSIS research & decision | `.prism/shared/research/2026-03-05-nsis-native-installer.md` |
| Original installer plan (10 phases) | `.prism/shared/plans/2026-03-05-unified-installer-wizard.md` |
| v2.4.4 documentation | `.prism/shared/docs/PRISM-DOCUMENTATION-2.4.4.md` |
