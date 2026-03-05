---
date: 2026-03-05
author: Claude
repository: prism-plugin
branch: feat/tauri-installer
ticket: N/A
status: draft
research: .prism/shared/research/2026-03-05-installer-ui-modernization.md
---

# Plan: Unified Tauri v2 Installer (Windows + macOS)

## Overview

**Goal**: Replace the NSIS Windows installer with a unified Tauri v2 installer that produces native installers for both Windows and macOS, using a React/TypeScript frontend (ported from existing JSX mockups) and Rust backend for system operations.

**Research**: `.prism/shared/research/2026-03-05-installer-ui-modernization.md`

**Complexity**: High

**Estimated Phases**: 12

## Context

The current NSIS installer (`installer/`) is Windows-only and uses stock MUI2 styling. The user has JSX mockups for both Windows (520px, dark chrome, 6 screens) and macOS (620px, traffic lights + sidebar, 6 screens). A unified Tauri app produces ~6-10 MB installers vs the current 38 MB NSIS. The existing `installer/` directory will be preserved but deprecated.

**Key design reference files**:
- `.prism/shared/docs/installer-ui/prism-installer-windows.jsx` — 6 Windows screens
- `.prism/shared/docs/installer-ui/prism-installer-mac.jsx` — 6 macOS screens
- `.prism/shared/docs/prism-installer-ui-prd.md` — color tokens, assets, visual requirements

## Success Criteria

### Automated (CI/Scripts)
- [ ] `cd cmd/prism-installer && npm run build` — Frontend builds successfully
- [ ] `cd cmd/prism-installer/src-tauri && cargo check` — Rust compiles on Windows and macOS
- [ ] `npm run tauri build` — Produces Windows `.exe` on `windows-latest`
- [ ] `npm run tauri build` — Produces macOS `.dmg` on `macos-latest`
- [ ] `cargo test` — Rust unit tests pass (system detection, PATH logic)
- [ ] `cargo clippy -- -D warnings` — No Rust lint warnings

### Manual Verification
- [ ] Windows installer: All 6 screens render matching mockup (Welcome, Components, Directory, Preflight, Progress, Finish)
- [ ] macOS installer: All 6 screens render matching mockup (Intro, License, Destination, Type, Installing, Summary)
- [ ] CLI binary installs to correct location and is on PATH (Windows: `%LOCALAPPDATA%\Prism\bin`, macOS: `~/.prism/bin`)
- [ ] VSIX installs into all detected editors (VS Code, Cursor, Windsurf)
- [ ] Claude plugin installs via CLI or file-copy fallback
- [ ] Desktop App downloads from GitHub with progress
- [ ] Windows: appears in Add/Remove Programs with working uninstaller
- [ ] macOS: PATH entry added to `~/.zshrc` and `~/.bash_profile`
- [ ] Installer `.exe` is ≤15 MB, `.dmg` is ≤15 MB

## What We're NOT Doing

- Linux installer (future effort)
- Auto-update mechanism
- Code signing or notarization (separate effort)
- Modifying the installed components themselves (CLI, VSIX, plugin, Electron app)
- Removing `installer/` NSIS code (preserved, deprecated)
- Removing `cmd/prism-setup/` Electron wizard code

---

## Phases

### Phase 1: Scaffold Tauri v2 Project

**Goal**: Create the `cmd/prism-installer/` project with Tauri v2 + React + Vite + TypeScript, integrated into the monorepo.

**Files to create**:
| File | Purpose |
|------|---------|
| `cmd/prism-installer/package.json` | Frontend dependencies (React 19, Vite 6, TypeScript 5, Tailwind 4) |
| `cmd/prism-installer/vite.config.ts` | Vite config with React plugin |
| `cmd/prism-installer/tsconfig.json` | TypeScript config |
| `cmd/prism-installer/index.html` | Frontend entry point |
| `cmd/prism-installer/src/main.tsx` | React root mount |
| `cmd/prism-installer/src/App.tsx` | Root component with platform detection |
| `cmd/prism-installer/src-tauri/Cargo.toml` | Rust dependencies |
| `cmd/prism-installer/src-tauri/build.rs` | Tauri build script |
| `cmd/prism-installer/src-tauri/tauri.conf.json` | Tauri config (window size, bundle targets) |
| `cmd/prism-installer/src-tauri/capabilities/default.json` | Permission grants |
| `cmd/prism-installer/src-tauri/src/main.rs` | Desktop entry point |
| `cmd/prism-installer/src-tauri/src/lib.rs` | App logic + command registration |

**Files to modify**:
| File | Change |
|------|--------|
| `package.json` (root) | Add `cmd/prism-installer` to workspaces array |

**Steps**:
1. [ ] Create `cmd/prism-installer/` directory structure
2. [ ] Create `package.json` with React 19, Vite 6, TypeScript 5, `@tauri-apps/api`, `@tauri-apps/plugin-os`
3. [ ] Create `vite.config.ts` with `@vitejs/plugin-react` and `@tailwindcss/vite`
4. [ ] Create `tsconfig.json` matching existing `cmd/prism-electron/tsconfig.json` patterns
5. [ ] Create `index.html` with root div
6. [ ] Create `src/main.tsx` mounting React app
7. [ ] Create `src/App.tsx` with platform detection placeholder
8. [ ] Create `src-tauri/Cargo.toml` with dependencies:
   - `tauri = "2"`, `serde = "1"`, `serde_json = "1"`, `tokio = "1"`
   - `reqwest = "0.12"` (for downloads), `futures-util = "0.3"` (for streams)
   - `tauri-plugin-os = "2"`, `tauri-plugin-shell = "2"`
   - `[target.'cfg(windows)'.dependencies]`: `winreg = "0.52"`, `winapi = "0.3"` (for `WM_SETTINGCHANGE`)
   - `tauri-plugin-decorum = "1"` (for custom title bar + macOS traffic lights)
9. [ ] Create `src-tauri/build.rs` (standard Tauri build script)
10. [ ] Create `src-tauri/tauri.conf.json`:
    - `productName`: `"Prism Setup"`
    - `identifier`: `"com.thedigitalgriot.prism-setup"`
    - Window: 520×600 (Windows), 620×450 (macOS) — use platform config overrides
    - `titleBarStyle`: `"Overlay"`, `hiddenTitle`: true, `decorations`: false
    - Bundle: NSIS target for Windows, DMG/app for macOS
    - `bundle.windows.nsis.installMode`: `"perUser"`
11. [ ] Create `src-tauri/capabilities/default.json` with permissions for shell, OS, window operations
12. [ ] Create `src-tauri/src/main.rs` and `src-tauri/src/lib.rs` with skeleton `run()` function
13. [ ] Add `cmd/prism-installer` to root `package.json` workspaces
14. [ ] Verify `npm install` and `cargo check` succeed

**Verification**:
```bash
cd cmd/prism-installer && npm install
cd src-tauri && cargo check
npm run tauri dev  # Should open empty window
```

**Checkpoint**: ⬜ Phase 1 complete

---

### Phase 2: Platform Detection Backend

**Goal**: Implement Rust commands to detect installed editors, Claude CLI, existing Prism installation, OS info, and disk space.

**Files to create**:
| File | Purpose |
|------|---------|
| `cmd/prism-installer/src-tauri/src/detect.rs` | All system detection logic |

**Files to modify**:
| File | Change |
|------|--------|
| `cmd/prism-installer/src-tauri/src/lib.rs` | Register detection commands |

**Steps**:
1. [ ] Create `detect.rs` module
2. [ ] Implement `detect_editors()` → `Vec<EditorInfo>`:
   - **Windows**: Check known paths via `std::path::Path::exists()`:
     - VS Code: `%LOCALAPPDATA%\Programs\Microsoft VS Code\bin\code.cmd`
     - Cursor: `%LOCALAPPDATA%\Programs\cursor\resources\app\bin\cursor.cmd`
     - Windsurf: `%LOCALAPPDATA%\Programs\windsurf\resources\app\bin\windsurf.cmd`
   - **macOS**: Check paths:
     - VS Code: `/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code`
     - Cursor: `/Applications/Cursor.app/Contents/Resources/app/bin/cursor`
     - Windsurf: `/Applications/Windsurf.app/Contents/Resources/app/bin/windsurf`
   - Return struct: `{ id, name, path, version_hint }`
3. [ ] Implement `detect_claude_cli()` → `Option<String>`:
   - **Windows**: Check `%LOCALAPPDATA%\Programs\claude\resources\app\bin\claude.cmd`
   - **macOS**: Check `/usr/local/bin/claude`, `~/.claude/bin/claude`
4. [ ] Implement `detect_existing_prism()` → `Option<PrismInstallInfo>`:
   - **Windows**: Check registry `HKCU\Software\Prism` for InstallDir and Version
   - **macOS**: Check `~/.prism/bin/prism-cli`
5. [ ] Implement `detect_os_info()` → `OsInfo { name, version, arch }`
6. [ ] Implement `detect_disk_space(path: String)` → `DiskInfo { available_bytes }`
7. [ ] Register all commands in `lib.rs` via `tauri::generate_handler!`
8. [ ] Write Rust unit tests for path construction logic

**Verification**:
```bash
cd cmd/prism-installer/src-tauri && cargo test
cargo clippy -- -D warnings
```

**Checkpoint**: ⬜ Phase 2 complete

---

### Phase 3: CLI Install Backend

**Goal**: Implement Rust commands for CLI binary installation, PATH configuration, and `.prism/` directory initialization.

**Files to create**:
| File | Purpose |
|------|---------|
| `cmd/prism-installer/src-tauri/src/install_cli.rs` | CLI install + PATH logic |

**Files to modify**:
| File | Change |
|------|--------|
| `cmd/prism-installer/src-tauri/src/lib.rs` | Register CLI install commands |

**Steps**:
1. [ ] Create `install_cli.rs` module
2. [ ] Implement `install_cli(source_path, install_dir)`:
   - Copy bundled `prism-cli` binary to `{install_dir}/bin/prism-cli{.exe}`
   - Create `~/.prism/` and `~/.prism/workspaces.json` if missing
3. [ ] Implement `configure_path_windows(bin_dir)`:
   - Read `HKCU\Environment\Path` via `winreg`
   - Append `bin_dir` if not already present (idempotent)
   - Write back to registry
   - Broadcast `WM_SETTINGCHANGE` via `winapi::um::winuser::SendMessageTimeoutW`
4. [ ] Implement `configure_path_macos(bin_dir)`:
   - Append `export PATH="$PATH:{bin_dir}"` to `~/.zshrc` if not present
   - Append to `~/.bash_profile` if not present
   - Idempotent: check for existing line before appending
5. [ ] Implement `register_install_windows(install_dir, version)`:
   - Write `HKCU\Software\Prism\InstallDir` and `Version`
6. [ ] Expose `install_cli` Tauri command that orchestrates the above based on OS
7. [ ] Write unit tests for PATH manipulation logic (mock registry reads)

**Key reference**: `installer/sections/cli.nsh` lines 6-42 for exact NSIS behavior to replicate.

**Verification**:
```bash
cargo test -- install_cli
cargo clippy -- -D warnings
```

**Checkpoint**: ⬜ Phase 3 complete

---

### Phase 4: Extension & Plugin Install Backend

**Goal**: Implement Rust commands for VSIX extension install and Claude plugin install with file-copy fallback.

**Files to create**:
| File | Purpose |
|------|---------|
| `cmd/prism-installer/src-tauri/src/install_extension.rs` | VSIX install logic |
| `cmd/prism-installer/src-tauri/src/install_plugin.rs` | Claude plugin install logic |

**Files to modify**:
| File | Change |
|------|--------|
| `cmd/prism-installer/src-tauri/src/lib.rs` | Register extension/plugin commands |

**Steps**:
1. [ ] Create `install_extension.rs`:
   - `install_vsix(editor_path, vsix_path)` → runs `{editor_path} --install-extension {vsix_path} --force`
   - Uses `std::process::Command` with `cmd.exe /c` wrapper on Windows
   - Returns `InstallResult { editor, success, exit_code, stderr }`
   - `install_all_extensions(editors, vsix_path)` → installs into ALL detected editors
2. [ ] Create `install_plugin.rs`:
   - `install_plugin_via_cli(claude_path)` → runs `claude plugin install prism@prism-marketplace`
   - `install_plugin_file_copy(source_dir)` → copies commands + agents to `~/.claude/`
   - `install_plugin(claude_path, source_dir)` → tries CLI first, falls back to file copy

**Key reference**: `installer/sections/vscode.nsh` lines 1-77, `installer/sections/plugin.nsh` lines 1-50.

**Verification**:
```bash
cargo test -- install_extension install_plugin
```

**Checkpoint**: ⬜ Phase 4 complete

---

### Phase 5: Desktop App Download Backend

**Goal**: Implement GitHub release download with progress streaming via Tauri Channels.

**Files to create**:
| File | Purpose |
|------|---------|
| `cmd/prism-installer/src-tauri/src/download.rs` | HTTP download with progress events |

**Files to modify**:
| File | Change |
|------|--------|
| `cmd/prism-installer/src-tauri/src/lib.rs` | Register download command |

**Steps**:
1. [ ] Create `download.rs` module
2. [ ] Define `DownloadEvent` enum: `Started { total }`, `Progress { downloaded, total, percent }`, `Finished { path }`, `Error { message }`
3. [ ] Implement `download_desktop_app(version, on_progress: Channel<DownloadEvent>)`:
   - Construct GitHub URL: `https://github.com/TheDigitalGriot/prism-plugin/releases/download/v{version}/Prism-{version}.Setup.exe` (Windows) or `Prism-{version}.dmg` (macOS)
   - Use `reqwest` with streaming response
   - Stream chunks to temp file, emit progress events via Channel
   - On completion, run the downloaded installer:
     - Windows: `nsExec` equivalent via `std::process::Command` with `/S` flag
     - macOS: Mount DMG, copy `.app` to `/Applications`
4. [ ] Write tests for URL construction and event emission

**Key reference**: `installer/sections/electron.nsh` lines 1-49.

**Verification**:
```bash
cargo test -- download
```

**Checkpoint**: ⬜ Phase 5 complete

---

### Phase 6: Shared UI Foundation

**Goal**: Create the React component library with color tokens, typography, platform detection hooks, and layout shells for both Windows and macOS.

**Files to create**:
| File | Purpose |
|------|---------|
| `cmd/prism-installer/src/theme/colors.ts` | Color token constants (matching mockups) |
| `cmd/prism-installer/src/theme/index.css` | Global Tailwind + custom CSS variables |
| `cmd/prism-installer/src/hooks/usePlatform.ts` | OS detection hook wrapping `@tauri-apps/plugin-os` |
| `cmd/prism-installer/src/hooks/useInstaller.ts` | Installer state machine hook |
| `cmd/prism-installer/src/components/SpectralBar.tsx` | Shared spectral gradient bar |
| `cmd/prism-installer/src/components/NavButtons.tsx` | Navigation button row (Back/Next) |
| `cmd/prism-installer/src/layouts/WindowsChrome.tsx` | Windows dark title bar shell (520px) |
| `cmd/prism-installer/src/layouts/MacWindow.tsx` | macOS frosted glass shell with traffic lights (620px) |
| `cmd/prism-installer/src/layouts/Sidebar.tsx` | macOS sidebar with step indicators |

**Steps**:
1. [ ] Create `colors.ts` with color tokens from both mockups:
   - Windows: `dark=#0F172A, mid=#1E293B, surface=#263348, border=#334155, muted=#64748B, light=#94A3B8, white=#F1F5F9, blue=#4A9EFF, teal=#2DD4BF, green=#4ADE80, amber=#FBB040, red=#F87171`
   - macOS: `bg=rgba(28,28,30,0.96), panel=rgba(44,44,46,0.9), surface=rgba(58,58,60,0.8)` + same spectral colors
2. [ ] Create `index.css` with CSS custom properties, font imports (Segoe UI for Windows, SF Pro for macOS), scrollbar styling
3. [ ] Create `usePlatform()` hook: returns `"windows" | "macos"`, caches result
4. [ ] Create `useInstaller()` hook: state machine managing step navigation, component selection state, install progress, and Tauri command invocation
5. [ ] Port `SpectralBar` component from Windows mockup (line 72-81)
6. [ ] Port `NavButtons` from Windows mockup (line 162-198) and `NavRow` from macOS (line 157-188) — create unified component with platform-conditional styling
7. [ ] Port `WindowChrome` from Windows mockup (line 83-128) — dark title bar with P icon, min/max/close buttons, `data-tauri-drag-region`
8. [ ] Port `MacWindow` from macOS mockup (line 75-112) — frosted glass, traffic lights via `tauri-plugin-decorum`
9. [ ] Port `Sidebar` from macOS mockup (line 114-155) — step indicators with numbered circles

**Verification**:
```bash
cd cmd/prism-installer && npm run build  # TypeScript compiles
npm run tauri dev  # Visual check: correct platform shell renders
```

**Checkpoint**: ⬜ Phase 6 complete

---

### Phase 7: Windows UI Screens

**Goal**: Port all 6 Windows mockup screens to React components.

**Files to create**:
| File | Purpose |
|------|---------|
| `cmd/prism-installer/src/screens/windows/WelcomeStep.tsx` | Welcome screen (mockup lines 201-252) |
| `cmd/prism-installer/src/screens/windows/ComponentsStep.tsx` | Component selection (mockup lines 256-328) |
| `cmd/prism-installer/src/screens/windows/DirectoryStep.tsx` | Install location (mockup lines 331-383) |
| `cmd/prism-installer/src/screens/windows/PreflightStep.tsx` | System check (mockup lines 386-444) |
| `cmd/prism-installer/src/screens/windows/ProgressStep.tsx` | Install progress (mockup lines 448-586) |
| `cmd/prism-installer/src/screens/windows/FinishStep.tsx` | Completion (mockup lines 589-650) |
| `cmd/prism-installer/src/screens/windows/index.tsx` | Windows installer root with step routing |

**Steps**:
1. [ ] Port `WelcomeStep`: PRISM wordmark with gradient text, version badge, "THIS INSTALLER WILL SET UP" component list, info callout about install location
2. [ ] Port `ComponentsStep`: 4 component rows with checkboxes, icons (`>_`, `{}`, `◈`, `⬡`), color-coded borders, REQUIRED/OPTIONAL/DOWNLOAD badges, size estimates, total calculation
3. [ ] Port `DirectoryStep`: Path input with Browse button (Tauri file dialog), file preview table, PATH info callout
4. [ ] Port `PreflightStep`: Animated sequential reveal of system checks (250ms intervals), status icons (✓ pass / ⚠ warn / ℹ info), warning summary at bottom — connects to Phase 2 detection commands
5. [ ] Port `ProgressStep`: Overall progress bar with spectral gradient, per-component status rows (○ pending / ◌ installing / ● done / ✕ failed), scrolling monospace log — connects to install commands from Phases 3-5
6. [ ] Port `FinishStep`: Success checkmark, "Installation Complete" gradient text, per-component summary, "Open a new terminal" checkbox, `prism-cli --help` hint, GitHub link
7. [ ] Create `index.tsx` with step state machine and step indicator dots (mockup lines 697-707)

**Verification**:
```bash
npm run tauri dev  # On Windows: visually verify each screen matches mockup
```

**Checkpoint**: ⬜ Phase 7 complete

---

### Phase 8: macOS UI Screens

**Goal**: Port all 6 macOS mockup screens to React components.

**Files to create**:
| File | Purpose |
|------|---------|
| `cmd/prism-installer/src/screens/macos/IntroStep.tsx` | Intro screen (mockup lines 191-249) |
| `cmd/prism-installer/src/screens/macos/LicenseStep.tsx` | License screen (mockup lines 253-278) |
| `cmd/prism-installer/src/screens/macos/DestinationStep.tsx` | Destination screen (mockup lines 282-327) |
| `cmd/prism-installer/src/screens/macos/TypeStep.tsx` | Installation type screen (mockup lines 331-398) |
| `cmd/prism-installer/src/screens/macos/InstallingStep.tsx` | Installing screen (mockup lines 402-521) |
| `cmd/prism-installer/src/screens/macos/SummaryStep.tsx` | Summary screen (mockup lines 525-581) |
| `cmd/prism-installer/src/screens/macos/index.tsx` | macOS installer root with sidebar + content layout |

**Steps**:
1. [ ] Port `IntroStep`: Prism logo + wordmark, "PRISM 2.5.0" gradient text, description paragraph, "Package Contents" table with component icons
2. [ ] Port `LicenseStep`: MIT license text in monospace scrollable area, "Agree"/"Disagree" prompt
3. [ ] Port `DestinationStep`: Radio selection between "Install for me only" (`~/.prism/bin/`) and "Install for all users" (`/usr/local/bin/`, disabled), shell PATH info callout mentioning `~/.zshrc` and `~/.bash_profile`
4. [ ] Port `TypeStep`: "Standard Install" / "Custom Install" toggle, custom mode shows component checkboxes (same 4 components), total size display
5. [ ] Port `InstallingStep`: Overall progress bar, per-component progress bars with individual percentages, monospace log with color-coded lines — connects to install commands
6. [ ] Port `SummaryStep`: Large checkmark, "Prism Installed Successfully" gradient text, per-component success list, "Getting Started" section with terminal command
7. [ ] Create `index.tsx` with sidebar + content area layout (mockup lines 639-650), `minHeight: 380`

**Verification**:
```bash
npm run tauri dev  # On macOS: visually verify each screen matches mockup
```

**Checkpoint**: ⬜ Phase 8 complete

---

### Phase 9: Wizard State Machine & Install Orchestration

**Goal**: Wire the UI screens to the Rust backend commands, creating the full install flow from component selection through installation to completion.

**Files to create**:
| File | Purpose |
|------|---------|
| `cmd/prism-installer/src/state/installerState.ts` | TypeScript types for installer state |
| `cmd/prism-installer/src/state/useInstallerFlow.ts` | Hook orchestrating the full install sequence |

**Files to modify**:
| File | Change |
|------|--------|
| `cmd/prism-installer/src/App.tsx` | Wire platform router to installer flow |
| `cmd/prism-installer/src/screens/windows/PreflightStep.tsx` | Call `detect_*` commands |
| `cmd/prism-installer/src/screens/windows/ProgressStep.tsx` | Call `install_*` commands |
| `cmd/prism-installer/src/screens/macos/InstallingStep.tsx` | Call `install_*` commands |

**Steps**:
1. [ ] Define TypeScript types: `InstallerState`, `ComponentSelection`, `InstallProgress`, `PreflightResult`
2. [ ] Create `useInstallerFlow()` hook that:
   - Manages component selection state (CLI always checked)
   - Manages install directory (Windows default: `%LOCALAPPDATA%\Prism`, macOS: `~/.prism`)
   - Runs preflight checks by calling `detect_editors`, `detect_claude_cli`, `detect_existing_prism`, `detect_disk_space` via `invoke()`
   - Orchestrates install sequence: CLI → Extension → Plugin → Desktop App (in order)
   - Tracks per-component progress and log messages
   - Handles errors gracefully (show in UI, don't abort remaining components)
3. [ ] Wire PreflightStep to call detection commands and display results
4. [ ] Wire ProgressStep/InstallingStep to execute install commands sequentially:
   - `invoke('install_cli', { installDir })`
   - `invoke('install_all_extensions', { editors, vsixPath })`
   - `invoke('install_plugin', { claudePath, sourceDir })`
   - `invoke('download_desktop_app', { version, onProgress })` (if selected)
5. [ ] Wire FinishStep "Open terminal" checkbox to `invoke('open_terminal')`
6. [ ] Handle the "Browse..." button on DirectoryStep via Tauri file dialog API

**Verification**:
```bash
npm run tauri dev  # Full flow: Welcome → Components → Directory → Preflight → Progress → Finish
```

**Checkpoint**: ⬜ Phase 9 complete

---

### Phase 10: Windows Uninstaller

**Goal**: Implement Windows Add/Remove Programs registration and uninstall logic.

**Files to create**:
| File | Purpose |
|------|---------|
| `cmd/prism-installer/src-tauri/src/uninstall.rs` | Uninstall logic + registry cleanup |

**Files to modify**:
| File | Change |
|------|--------|
| `cmd/prism-installer/src-tauri/src/lib.rs` | Register uninstall commands |
| `cmd/prism-installer/src-tauri/src/install_cli.rs` | Call `register_uninstaller()` after CLI install |

**Steps**:
1. [ ] Implement `register_uninstaller(install_dir, version)`:
   - Write to `HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\Prism`:
     - `DisplayName`, `DisplayVersion`, `Publisher`, `UninstallString`, `QuietUninstallString`
     - `InstallLocation`, `URLInfoAbout`, `NoModify=1`, `NoRepair=1`
   - `UninstallString` points to the Tauri app with `--uninstall` flag
2. [ ] Implement `uninstall()` command:
   - Remove CLI binary from install dir
   - Remove `$INSTDIR\bin` from PATH (winreg)
   - Broadcast `WM_SETTINGCHANGE`
   - Attempt VSIX uninstall from all known editors
   - Attempt Claude plugin uninstall
   - Remove installed files (extensions/, plugin/)
   - Remove registry keys
3. [ ] Handle `--uninstall` CLI argument in `main.rs` to trigger headless uninstall
4. [ ] Alternatively, leverage Tauri's built-in NSIS bundler uninstall support (investigate if `bundle.windows.nsis` handles this automatically)

**Key reference**: `installer/uninstall.nsh` lines 1-97.

**Verification**:
```bash
# Install, verify Add/Remove Programs entry exists, uninstall, verify cleanup
```

**Checkpoint**: ⬜ Phase 10 complete

---

### Phase 11: CI/CD Pipeline

**Goal**: Create GitHub Actions workflow that builds the Tauri installer on both Windows and macOS, uploads artifacts to GitHub Releases.

**Files to create**:
| File | Purpose |
|------|---------|
| `.github/workflows/prism-installer-release.yml` | New CI pipeline for Tauri installer |

**Files to modify**:
| File | Change |
|------|--------|
| `.github/workflows/prism-setup-release.yml` | Add deprecation comment header |

**Steps**:
1. [ ] Create `.github/workflows/prism-installer-release.yml`:
   - **Triggers**: `push tags v*` + `workflow_dispatch`
   - **Job 1: prepare** (ubuntu-latest):
     - Build `prism-cli` for Windows (amd64) and macOS (amd64 + arm64)
     - Package VSIX extension
     - Copy plugin files (commands + agents)
     - Upload as artifact
   - **Job 2: build-windows** (windows-latest):
     - Download artifacts
     - Install Rust toolchain
     - Install Node.js 20
     - Bundle CLI binary + VSIX + plugin into `src-tauri/resources/`
     - Run `npm run tauri build -- --bundles nsis`
     - Upload `Prism-Setup-{version}.exe`
   - **Job 3: build-macos** (macos-latest):
     - Download artifacts
     - Install Rust toolchain (both x86_64 and aarch64 targets)
     - Run `npm run tauri build -- --bundles dmg`
     - Upload `Prism-Setup-{version}.dmg`
   - **Job 4: release**:
     - Download both platform artifacts
     - Upload to GitHub Release via `softprops/action-gh-release`
2. [ ] Configure `tauri.conf.json` to use `bundle.externalBin` for the CLI binary sidecar
3. [ ] Add `cmd/prism-installer/src-tauri/resources/` to `.gitignore` (populated at CI time)
4. [ ] Add deprecation comment to existing `prism-setup-release.yml`

**Reference**: `.github/workflows/prism-setup-release.yml` for existing pipeline patterns, and the official `tauri-apps/tauri-action` GitHub Action.

**Verification**:
```bash
# Trigger workflow_dispatch, verify both Windows and macOS artifacts are produced
```

**Checkpoint**: ⬜ Phase 11 complete

---

### Phase 12: Version Management & Deprecation

**Goal**: Integrate `cmd/prism-installer/` into the version bump pipeline and release skill, deprecate old NSIS installer.

**Files to modify**:
| File | Change |
|------|--------|
| `scripts/bump-version.py` | Add `cmd/prism-installer/package.json` and `cmd/prism-installer/src-tauri/tauri.conf.json` to version locations; remove deprecated `cmd/prism-setup/` references |
| `skills/prism-release/SKILL.md` | Add Tauri installer build step, update asset list |
| `installer/prism-setup.nsi` | Add `; DEPRECATED — see cmd/prism-installer/` header comment |

**Steps**:
1. [ ] Update `scripts/bump-version.py`:
   - Add `cmd/prism-installer/package.json` to `json_files` list
   - Add `cmd/prism-installer/src-tauri/tauri.conf.json` to `json_files` list (has `"version"` field)
   - Comment out deprecated `cmd/prism-setup/` entries (keep but skip)
2. [ ] Update `skills/prism-release/SKILL.md`:
   - Add `cmd/prism-installer/` build steps
   - Update release asset list to include both `.exe` and `.dmg`
   - Add note about legacy NSIS installer being deprecated
3. [ ] Add deprecation header to `installer/prism-setup.nsi`:
   ```nsis
   ; ==========================================================================
   ; DEPRECATED — This NSIS installer is superseded by the Tauri installer
   ; at cmd/prism-installer/. Kept for reference and rollback purposes.
   ; See: .prism/shared/plans/2026-03-05-unified-tauri-installer.md
   ; ==========================================================================
   ```
4. [ ] Verify `python scripts/bump-version.py patch` updates the new files correctly

**Verification**:
```bash
python scripts/bump-version.py --set 2.5.0 --root .
grep -r "2.5.0" cmd/prism-installer/package.json cmd/prism-installer/src-tauri/tauri.conf.json
```

**Checkpoint**: ⬜ Phase 12 complete

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Tauri WebView2 not installed on target Windows machine | Medium | High | Use `webviewInstallMode: "embedBootstrapper"` in `tauri.conf.json` to auto-install WebView2 |
| macOS Gatekeeper blocks unsigned installer | High | Medium | For dev/testing, use `spctl --master-disable` or ad-hoc signing. Code signing is separate effort |
| Custom title bar breaks window dragging | Low | Medium | Use `data-tauri-drag-region` attribute + `tauri-plugin-decorum` for native-feeling chrome |
| Registry PATH manipulation corrupts existing PATH | Medium | High | Read current PATH, parse entries, append only if absent (idempotent). Never overwrite — always append |
| `cmd.exe /c` quoting issues for VSIX install | Medium | Medium | Known from NSIS experience — use proper escaping. Test with paths containing spaces |
| Tauri NSIS bundler conflicts with custom uninstaller logic | Low | Medium | Test Tauri's built-in NSIS uninstaller first; only add custom registry logic if needed |
| Cross-platform CSS differences in WebView | Medium | Low | Use platform detection hook to apply platform-specific styles; test on both OS |

## Edge Cases

| Case | Handling |
|------|----------|
| No editors detected | Show all checks as "Not found" on preflight; skip extension install silently |
| Claude CLI not found | Show warning on preflight; fall back to file copy for plugin |
| Existing Prism install found | Show info on preflight; overwrite binary (same as current NSIS behavior) |
| GitHub download fails (no internet) | Show error with manual download link; skip Desktop App; don't block other installs |
| Install directory has spaces in path | Ensure all `std::process::Command` calls properly quote paths |
| User cancels mid-install | Tauri window close should warn; partial installs are OK (idempotent re-run) |
| macOS user selects "Install for all users" | Disabled in mockup; if enabled later, would need `osascript` privilege escalation |

## Out of Scope

- [ ] Linux installer support
- [ ] Auto-update mechanism for `prism-cli`
- [ ] Code signing and notarization (macOS/Windows)
- [ ] Universal binary (macOS arm64+x86_64 fat binary)
- [ ] Deletion of `installer/` NSIS code or `cmd/prism-setup/` Electron code
- [ ] Animated transitions between screens (CSS transitions from mockups are nice-to-have)
- [ ] Dark/light mode toggle (always dark per PRD decision)

## Rollback Plan

If critical issues arise:
1. The NSIS installer at `installer/` remains fully functional and unchanged
2. CI workflow `prism-setup-release.yml` still produces Windows `.exe` via NSIS
3. Simply don't merge the Tauri installer until it passes all manual verification
4. If Tauri is merged but breaks: revert the CI workflow change and point release assets back to NSIS

## Dependencies

**Must complete first**:
- [ ] None — this is a new project alongside existing installer

**Can parallelize with**:
- [ ] Three-package split (packages/prism-core, prism-ui) — Tauri installer is self-contained
- [ ] Agent chat redesign — unrelated feature work

## Progress Log

| Phase | Status | Started | Completed | Notes |
|-------|--------|---------|-----------|-------|
| Phase 1: Scaffold | ⬜ Not started | | | |
| Phase 2: Detection | ⬜ Not started | | | |
| Phase 3: CLI Install | ⬜ Not started | | | |
| Phase 4: Extension/Plugin | ⬜ Not started | | | |
| Phase 5: Download | ⬜ Not started | | | |
| Phase 6: UI Foundation | ⬜ Not started | | | |
| Phase 7: Windows Screens | ⬜ Not started | | | |
| Phase 8: macOS Screens | ⬜ Not started | | | |
| Phase 9: State Machine | ⬜ Not started | | | |
| Phase 10: Uninstaller | ⬜ Not started | | | |
| Phase 11: CI/CD | ⬜ Not started | | | |
| Phase 12: Version Mgmt | ⬜ Not started | | | |
