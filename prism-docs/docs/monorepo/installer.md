---
title: Unified Tauri Installer
description: Cross-platform Tauri v2 installer replacing legacy NSIS and Electron setup wizards.
outline: [2, 3]
---

# Unified Tauri Installer (v2.4.7+)

Replaced the native NSIS-only Windows installer (`installer/`, v2.4.3) and the earlier Electron-based setup wizard (`cmd/prism-setup/`) with a unified Tauri v2 cross-platform installer at `cmd/prism-installer/`. The same Rust + React 19 codebase produces native Windows `.exe` (via NSIS bundler) and macOS `.dmg` installers with platform-specific wizard UIs.

## Installer Architecture

```
cmd/prism-installer/
├── src/                              # React 19 frontend
│   ├── App.tsx                       # Platform router → WindowsInstaller | MacInstaller
│   ├── hooks/
│   │   ├── usePlatform.ts            # @tauri-apps/plugin-os platform detection
│   │   └── useInstaller.ts           # Step/component/directory state
│   ├── constants.ts                  # 4 component definitions (CLI, VSCode, Plugin, Desktop)
│   ├── layouts/
│   │   ├── WindowsChrome.tsx         # Custom title bar with min/max/close buttons
│   │   ├── MacWindow.tsx             # macOS traffic light window chrome
│   │   └── Sidebar.tsx               # macOS step sidebar
│   ├── screens/
│   │   ├── windows/                  # 6-step Windows wizard
│   │   │   ├── WelcomeStep.tsx
│   │   │   ├── ComponentsStep.tsx
│   │   │   ├── DirectoryStep.tsx
│   │   │   ├── PreflightStep.tsx     # Multi-strategy detection results
│   │   │   ├── ProgressStep.tsx      # Sequential install with per-component progress
│   │   │   └── FinishStep.tsx
│   │   └── macos/                    # 6-step macOS wizard
│   │       ├── IntroStep.tsx
│   │       ├── LicenseStep.tsx
│   │       ├── DestinationStep.tsx
│   │       ├── TypeStep.tsx
│   │       ├── InstallingStep.tsx
│   │       └── SummaryStep.tsx
│   └── components/
│       └── NavButtons.tsx
├── src-tauri/
│   ├── tauri.conf.json               # 520x600 frameless window, center, NSIS/DMG bundles
│   ├── Cargo.toml                    # Tauri 2, tokio, reqwest, serde, winreg (Windows)
│   └── src/
│       ├── main.rs                   # Entry: --uninstall → headless uninstall, else Tauri UI
│       ├── lib.rs                    # Plugin registration + 14 Tauri command handlers
│       ├── detect.rs                 # Multi-tier detection: Registry → Filesystem → PATH
│       ├── install_cli.rs            # Binary copy + PATH config + ~/.prism/ init
│       ├── install_extension.rs      # VSIX install into all detected editors
│       ├── install_plugin.rs         # claude plugin install or file copy fallback
│       ├── download.rs               # Streaming download from GitHub Releases with progress
│       └── uninstall.rs              # Remove binary, PATH, registry + Add/Remove Programs
└── package.json                      # React 19, Tailwind v4, Vite 6, @tauri-apps/* v2
```

## Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Backend** | Rust + Tauri v2 | System access, IPC, window management |
| **Frontend** | React 19 + Tailwind v4 + Vite 6 | Wizard UI (platform-specific layouts) |
| **HTTP** | reqwest + rustls-tls | Streaming download (no OpenSSL dependency) |
| **Async** | tokio (full features) | Async download, file I/O |
| **Windows** | winreg, winapi | Registry access, PATH broadcast, disk space |
| **Bundler** | Tauri NSIS (Windows), DMG (macOS) | Native installer output |

## Tauri Commands (14 handlers)

```
detect_editors, detect_claude_cli, detect_claude_code, detect_all_tools,
detect_existing_prism, detect_os_info, detect_disk_space, run_preflight,
install_cli, install_all_extensions, install_plugin,
download_desktop_app, run_downloaded_installer,
uninstall, open_terminal
```

## Detection Engine (`detect.rs`)

The detection system uses a **three-tier strategy** per editor (VS Code, Cursor, Windsurf):

| Tier | Strategy | Platform |
|------|----------|----------|
| 1 | **Registry scan** — HKLM/HKCU/WOW6432Node Uninstall keys | Windows |
| 2 | **Filesystem probe** — Known install paths (`Program Files`, `AppData\Local\Programs`, Squirrel `app-X.Y.Z`) | Windows |
| 3 | **PATH lookup** — `where.exe` (Windows) or `which` (macOS) | Both |
| — | **App bundle check** — `/Applications/` and `~/Applications/`, version from `package.json` or `Info.plist` | macOS |

### Data Model

- `InstallMethod` enum: `SystemInstall`, `UserInstall`, `SquirrelInstall`, `NpmGlobal`, `Unknown`
- `DetectedTool`: name, version, path, install location, install method, CLI availability, metadata map
- `DetectionReport`: editors + claude_code + node_available + npm_prefix
- `PreflightResult`: full detection + OS info + disk info

### Claude Code Detection

Checks npm global prefix → `node_modules/@anthropic-ai/claude-code/package.json`, then PATH lookup via `which claude`, then Windows config-dir fallback at `%APPDATA%\Claude\claude-code`.

## Wizard Flows

### Windows (6 steps)

Welcome → Components → Directory → Preflight → Progress → Finish

| Step | Description |
|------|-------------|
| Welcome | Branding, version, PRISM wordmark |
| Components | 4 checkboxes (CLI required + checked, VSCode + Plugin checked, Desktop unchecked ~130MB) |
| Directory | Install path, defaults to `%LOCALAPPDATA%\Prism` |
| Preflight | Sequential detection with animated reveal (OS, disk, editors, Claude Code, existing Prism) |
| Progress | Per-component progress bars with log panel (Consolas font, auto-scroll) |
| Finish | Installed summary, checkbox to open terminal, Close button |

### macOS (6 steps)

Introduction → License → Destination → Installation Type → Installing → Summary

- Two-panel layout: sidebar with step list (numbered circles, blue current, green completed) + content area
- macOS traffic light buttons (red/yellow/green circles with hover symbols)
- Per-component progress bars with colorized log (green checkmark, amber arrow, red x)

## Install Components

| Component | Size | Default | Description |
|-----------|------|---------|-------------|
| **Prism CLI** | ~2 MB | Required | Binary to `<install_dir>/bin/`, PATH config, `~/.prism/` init |
| **VS Code Extension** | ~8 MB | Checked | VSIX installed into ALL detected editors (VS Code, Cursor, Windsurf) |
| **Claude Code Plugin** | ~1 MB | Checked | `claude plugin install` or file copy fallback to `~/.claude/` |
| **Prism Desktop App** | ~130 MB | Unchecked | Streaming download from GitHub Releases, silent installer execution |

## CI/CD Pipeline

`.github/workflows/prism-installer-release.yml`

```
prepare (ubuntu)       → build-windows (windows) + build-macos (macos)  → release
  Cross-compile CLI       Stage resources into src-tauri/resources/          Upload .exe + .dmg
  Package VSIX            npm run tauri build -- --bundles nsis|dmg
  Copy plugin files       (Rust + React frontend compilation)
```

**4 jobs**: `prepare` → `build-windows` + `build-macos` (parallel) → `release`

Triggers: `push tags v*` + `workflow_dispatch`

## Uninstall Support

The installer binary doubles as the uninstaller. On Windows:
- `prism-installer.exe --uninstall` triggers headless uninstall (no UI)
- Removes CLI binary, PATH entry, registry keys (`HKCU\Software\Prism`, Add/Remove Programs)
- Registered as `UninstallString` in Windows Add/Remove Programs

## Legacy Installers

| Installer | Location | Status |
|-----------|----------|--------|
| **NSIS scripts** | `installer/` | Legacy — `.nsi` scripts and built `.exe` files still on disk |
| **Electron setup** | `cmd/prism-setup/` | Deprecated (v2.4.6) — not in npm workspaces, version no longer bumped |
