---
title: Prism Installer UI Modernization — Technical Research
date: 2026-03-05
last_updated: 2026-03-05
topic: installer-ui-modernization
status: complete
scope:
  - Unified Tauri v2 installer (Windows + macOS)
  - Replaces NSIS Windows installer
  - New macOS installer
related_docs:
  - .prism/shared/docs/prism-installer-ui-prd.md
  - .prism/shared/docs/installer-ui/prism-installer-windows.jsx
  - .prism/shared/docs/installer-ui/prism-installer-mac.jsx
  - .prism/shared/research/2026-03-05-nsis-native-installer.md
  - .prism/shared/plans/2026-03-05-unified-tauri-installer.md
---

# Research: Prism Installer UI Modernization

## Research Question

What is the current state of the NSIS installer UI, what NSIS/NsDialogs capabilities are available to implement the dark-themed visual mockups, and what technology should be used for the macOS installer that doesn't yet exist?

## Decision: Unified Tauri v2 Installer

After researching both NSIS NsDialogs (Windows) and macOS PKG limitations, the decision was made to build a **unified Tauri v2 installer** for both platforms. Key reasons:

1. **macOS PKG cannot achieve the mockup** — native Installer.app has a fixed white sidebar and no custom styling
2. **Single codebase** — React/TypeScript frontend shared between Windows and macOS, Rust backend for system operations
3. **Smaller installer** — ~6-10 MB Tauri vs 38 MB NSIS
4. **Better DX** — React components directly port from the JSX mockups; NSIS NsDialogs would require rewriting everything in Win32 GDI calls
5. **Platform-conditional UI** — Same React app renders Windows chrome (dark title bar, min/max/close) or macOS chrome (traffic lights, sidebar) based on OS detection

The Tauri installer will live at `cmd/prism-installer/`. The existing `installer/` NSIS code is preserved but deprecated.

See: `.prism/shared/plans/2026-03-05-unified-tauri-installer.md` for the implementation plan.

## Summary (Original Research)

The Windows NSIS installer has a fully working functional layer (`installer/`) but uses stock MUI2 styling — grey dialogs, Tahoma 8pt font, Windows 2000 aesthetics, and no DPI awareness. The target UI (from `prism-installer-windows.jsx`) is achievable within NSIS using NsDialogs custom pages with `SetCtlColors`, `NSD_SetBitmap`, `PBM_SETBARCOLOR`, and `DwmSetWindowAttribute`. The macOS installer described in `prism-installer-mac.jsx` (dark frosted glass, traffic lights, sidebar nav) is **not achievable with native PKG**; it requires a separate GUI application — the logical choice is a Tauri app (small binary, Rust backend, web frontend) or a Swift/SwiftUI app, both of which can be cross-compiled or built on macOS CI runners.

---

## Files Discovered

### Active Installer (Windows NSIS)

| Path | Purpose |
|------|---------|
| `installer/prism-setup.nsi` | Root MUI2 wizard: pages, sections, callbacks, language |
| `installer/pages/preflight.nsh` | Only existing custom NsDialogs page (system check) |
| `installer/sections/cli.nsh` | CLI binary install + EnVar PATH + workspaces.json |
| `installer/sections/vscode.nsh` | VSIX install into VS Code, Cursor, Windsurf |
| `installer/sections/plugin.nsh` | Claude plugin install (CLI or file copy fallback) |
| `installer/sections/electron.nsh` | Desktop app download via NScurl + silent install |
| `installer/uninstall.nsh` | Uninstaller + Add/Remove Programs registration |
| `installer/plugins/x86-unicode/EnVar.dll` | Registry-based PATH manipulation |
| `installer/plugins/x86-unicode/NScurl.dll` | HTTPS download from GitHub Releases |

### UI Mockups (Target Design)

| Path | Purpose |
|------|---------|
| `.prism/shared/docs/installer-ui/prism-installer-windows.jsx` | React mockup of 6-screen Windows installer |
| `.prism/shared/docs/installer-ui/prism-installer-mac.jsx` | React mockup of 6-screen macOS installer |

### CI/CD

| Path | Purpose |
|------|---------|
| `.github/workflows/prism-setup-release.yml` | Three-job pipeline: prepare → build-nsis → release (Ubuntu only) |

---

## Current NSIS Installer Architecture

### Page Flow

```
MUI_PAGE_WELCOME
  → MUI_PAGE_COMPONENTS  (4 checkboxes: CLI required, VSCode ✓, Plugin ✓, Desktop App ○)
  → MUI_PAGE_DIRECTORY   (defaults to %LOCALAPPDATA%\Prism)
  → Page custom PreflightPageCreate PreflightPageLeave  ← ONLY NsDialogs page
  → MUI_PAGE_INSTFILES   (stock progress with DetailPrint log)
  → MUI_PAGE_FINISH      (open terminal + GitHub link)
```

### Existing NsDialogs Implementation (`pages/preflight.nsh`)

The preflight page is the only existing custom NsDialogs page. It:
- Calls `nsDialogs::Create 1018` (dialog style)
- Uses `${NSD_CreateLabel}` for three rows: Editor status, Claude CLI status, Prism CLI status
- Uses `IfFileExists` to check known install paths (no `where.exe` — unreliable in nsExec)
- Calls `nsDialogs::Show` — no custom coloring applied (default grey)
- Has a leave function `PreflightPageLeave` (informational only, no validation)

### MUI2 Configuration

- `!define MUI_ABORTWARNING` — exit confirmation
- `!define MUI_COMPONENTSPAGE_SMALLDESC` — small description tooltips
- `!define MUI_FINISHPAGE_RUN` — "Open terminal" checkbox launches `cmd.exe`
- `!define MUI_FINISHPAGE_LINK` — link to GitHub
- No `ManifestDPIAware` → blurry on HiDPI/4K displays
- No header bitmap → uses NSIS default header (grey, logo-less)
- Font: system default (Tahoma 8pt on older Windows)

### Section Mechanics

- `SectionIn RO` on CLI section = permanently checked, cannot be deselected
- `Section /o "..."` on Electron section = unchecked by default
- `.onSelChange` callback re-selects CLI if deselected

### CI/CD Pipeline

Three jobs in `.github/workflows/prism-setup-release.yml`:
1. **prepare** (Ubuntu): Build `prism-cli-windows-amd64.exe`, package VSIX, copy plugin files → upload as `nsis-resources` artifact
2. **build-nsis** (Ubuntu): Install NSIS + plugins via apt + curl, download EnVar.dll + NScurl.dll, compile with `makensis -V4 -DVERSION=x.y.z`
3. **release** (Ubuntu): Upload `Prism-Setup-{version}.exe` to GitHub Release

Build time: ~30 seconds for makensis compile. Triggered on `push tags v*` or `workflow_dispatch`.

---

## Windows NsDialogs UI Capabilities

### SetCtlColors — Text and Background Color

`SetCtlColors $hwnd "text-color-or-empty" "bg-color-or-empty"` sets Win32 `WM_CTLCOLORSTATIC` handler on a control. Colors in NSIS are hex strings `"0xRRGGBB"` (RGB, NOT BGR — NSIS handles conversion internally for SetCtlColors). Pass empty string `""` to leave color unchanged.

```nsis
; Set label text to white, background to dark navy
SetCtlColors $myLabel "0xF1F5F9" "0x0F172A"

; Transparent background (inherits parent)
SetCtlColors $myLabel "0xF1F5F9" "transparent"
```

**Limitation**: Buttons do not respond to `SetCtlColors` for background. Checkboxes with colored backgrounds may show black fill instead of intended color in some Windows themes.

### NsDialogs Bitmap Loading — `NSD_SetBitmap`

Bitmap assets must be extracted to `$PLUGINSDIR` in `.onInit`. Only BMP format natively supported (PNG requires `NsDialogs_SetImageOLE` or similar).

```nsis
; In .onInit
Function .onInit
  InitPluginsDir
  File /oname=$PLUGINSDIR\header.bmp "assets\header.bmp"
FunctionEnd

; In page create function
${NSD_CreateBitmap} 0 0 100% 40u ""
Pop $BitmapCtrl
${NSD_SetBitmap} $BitmapCtrl "$PLUGINSDIR\header.bmp" $BmpHandle
; ... call nsDialogs::Show
; After show:
${NSD_FreeBitmap} $BmpHandle
```

**Format**: BMP only without plugins. For PNG, `NsDialogs_SetImageOLE` (separate plugin) handles PNG via OLE.

### Progress Bar Styling — `PBM_SETBARCOLOR`

To style a progress bar in a custom NsDialogs page:

```nsis
; Create progress bar with PBS_SMOOTH style
${NSD_CreateProgressBar} 0 50u 100% 8u ""
Pop $PbCtrl

; Must disable visual themes first (otherwise color ignored on Win10/11)
System::Call "UxTheme::SetWindowTheme(p $PbCtrl, w ' ', w ' ')"

; Set colors (BGR format for Win32 SendMessage!)
; teal = #2DD4BF → BGR = 0xBFD42D
SendMessage $PbCtrl ${PBM_SETBARCOLOR} 0 0xBFD42D
; dark = #1E293B → BGR = 0x3B291E
SendMessage $PbCtrl ${PBM_SETBKCOLOR} 0 0x3B291E
```

**Key**: `PBM_SETBARCOLOR` = 0x409, `PBM_SETBKCOLOR` = 0x2001. Colors are in BGR byte order for SendMessage.

### Fonts — Segoe UI via CreateFont

```nsis
; Create Segoe UI 11pt font
System::Call "gdi32::CreateFont(i -15, i 0, i 0, i 0, i 400, i 0, i 0, i 0, i 0, i 0, i 0, i 0, i 0, t 'Segoe UI') i.s"
Pop $SegoeFont

; Apply to label
SendMessage $myLabel ${WM_SETFONT} $SegoeFont 1
```

**Pattern**: `CreateFont` i -15 = ~11pt at 96 DPI; i 700 = bold. Font should be `DeleteObject`-ed when dialog is destroyed.

### DPI Awareness — ManifestDPIAware

```nsis
ManifestDPIAware true
```

Placed in the `.nsi` script before page declarations. Causes Windows to pass logical pixels directly instead of scaling bitmap interpolation. Essential for crisp rendering on HiDPI displays. Zero functional impact.

### Dark Title Bar — DwmSetWindowAttribute

```nsis
; Make title bar dark (Windows 10 20H1+)
Function SetDarkTitleBar
  System::Call "dwmapi::DwmSetWindowAttribute(p $HWNDPARENT, i 20, *i 1, i 4)"
FunctionEnd
```

`DWMWA_USE_IMMERSIVE_DARK_MODE = 20`. Call in `.onGUIInit` or early page pre-function.

### Replacing MUI_PAGE_INSTFILES

The MUI2 InstFiles page cannot be fully replaced with a NsDialogs page — sections still need to run in NSIS's install loop. The pattern to update a custom NsDialogs progress page from within section code:

- Create a custom progress page that calls `nsDialogs::Show`
- From within sections, use `GetDlgItem` + `SetWindowText` to update status labels on the NsDialogs controls while install runs
- Or: Keep MUI2 InstFiles but style the `DetailPrint` output area using `SetCtlColors` on the list box control

**Practical approach** (from PRD §4 risk table): "Use NSIS Section callbacks to drive NsDialogs label updates rather than replacing InstFiles entirely."

### Color Convention

NSIS GDI calls (`SendMessage`, Win32 API via `System::Call`) use **BGR** byte order.
`SetCtlColors` uses **RGB** order (NSIS handles the swap internally).

Shared `colors.nsh` include prevents mistakes:

```nsis
; From PRD §6.2
; Token               | Hex RGB   | BGR for GDI  | RGB for SetCtlColors
!define PRISM_DARK    "0x2A170F"  ; #0F172A bg
!define PRISM_MID     "0x3B291E"  ; #1E293B panels
!define PRISM_BLUE    "0xFF9E4A"  ; #4A9EFF accent
!define PRISM_TEAL    "0xBFD42D"  ; #2DD4BF teal
!define PRISM_GREEN   "0x80DE4A"  ; #4ADE80 success
!define PRISM_AMBER   "0x40B0FB"  ; #FBB040 progress
```

---

## macOS Installer Strategy — Key Finding

### What the Mockup Shows

`prism-installer-mac.jsx` depicts:
- Dark frosted glass window (`backdrop-filter: blur(40px) saturate(180%)`)
- macOS traffic light buttons (native red/yellow/green)
- Left sidebar with step indicators (blue highlight, green checkmarks)
- Right content area with full component/license/destination/progress views
- SF Pro Display typography (`-apple-system`)
- Labeled as "macOS Installer Simulation — Prism v2.5.0 · PKG Wizard"

### What Native macOS PKG Cannot Do

The native macOS Installer.app (`installer.app`) handles PKG file execution. Its UI:
- Has a fixed sidebar showing steps (cannot be branded/colored)
- Shows a fixed white background
- Only supports customizing: background image via Distribution XML, welcome/conclusion pages via HTML, and license RTF
- **Cannot** show dark theme, custom sidebar colors, frosted glass, or traffic light controls as drawn
- `InstallerPane` plugins (Objective-C bundles that add custom panes) existed but have been unreliable since macOS Sierra and are essentially deprecated

### Viable macOS Installer Technologies

| Option | Appearance | CLI Execution | Cross-Compile on Linux | Size |
|--------|-----------|--------------|----------------------|------|
| **Native PKG** (productbuild) | Cannot match mockup | postinstall scripts work | Possible with xar+bomutils | ~2 MB |
| **Shell script + DMG** | No UI | Full shell access | Yes | ~40 MB |
| **Tauri app** | Matches mockup exactly | Rust tauri::Command | Build requires macOS runner | ~6 MB |
| **Electron app** | Matches mockup | Node.js child_process | Build requires macOS runner | ~150 MB |
| **Swift/SwiftUI app** | Native, modern | Process API | macOS runner only | ~3 MB |

### Recommended Approach: Tauri

Tauri v2 produces ~6 MB macOS .app with a web frontend. The mockup is already React — same design can be ported to Tauri's webview. Tauri builds must run on `macos-latest` GitHub Actions runner (not cross-compilable from Linux). It outputs `.dmg` and `.app` natively.

Benefits for this use case:
- React/TypeScript frontend matches existing prism-electron/prism-vscode skills
- Can run shell commands via `@tauri-apps/plugin-shell` (for `code --install-extension`, etc.)
- Small binary (~6 MB vs 150 MB Electron)
- `.dmg` output for distribution

**Alternative**: A simple shell script installer with a short, branded banner in the terminal, plus a PKG for users who prefer GUI. This avoids any new framework dependency.

### macOS PKG Build on Linux (if PKG is chosen)

```bash
# Install cross-compilation tools on Ubuntu
sudo apt-get install -y xar cpio libplist-utils
# bomutils must be compiled from source:
git clone https://github.com/hogliux/bomutils.git
cd bomutils && make && sudo make install

# Then: pkgbuild/productbuild won't work on Linux
# Use mkbom + pax + xar to hand-assemble a component package
```

**Signing**: `rcodesign` (by indygreg) can sign and notarize PKG files from Linux using App Store Connect API key. GitHub Action: `indygreg/apple-code-sign-action`.

### Shell Script Installer (Simplest Option)

`scripts/prism-mac-install.sh` already partially exists (the `prism-cli-install.sh` script installs the CLI binary on macOS/Linux). This could be extended to:
1. Install CLI binary to `~/.prism/bin/`
2. Run `code/cursor/windsurf --install-extension`
3. Copy Claude plugin files
4. Download Prism.app from GitHub

This matches 100% of what the macOS mockup does functionally, just without a custom GUI window.

---

## Target Windows UI — Mapping Mockup to NSIS

The `prism-installer-windows.jsx` defines 6 screens:

| Screen | Current NSIS | Target Implementation |
|--------|-------------|----------------------|
| Welcome | `MUI_PAGE_WELCOME` | Custom NsDialogs page: dark bg, spectral gradient header BMP, PRISM wordmark, component list panel |
| Components | `MUI_PAGE_COMPONENTS` | Custom NsDialogs page: 4 component rows with icon, checkbox, description, size, badge |
| Directory | `MUI_PAGE_DIRECTORY` | Custom NsDialogs page: path input + file table + PATH note |
| Preflight | Custom NsDialogs ✓ | Upgrade existing: add `SetCtlColors` for dark theme, add per-item icon indicators |
| Progress | `MUI_PAGE_INSTFILES` | Custom NsDialogs page with per-component status labels + DetailPrint log; OR keep MUI_PAGE_INSTFILES with styled log area |
| Finish | `MUI_PAGE_FINISH` | Custom NsDialogs page: dark bg, component success summary, "Open terminal" checkbox, GitHub link |

### Assets Required

From PRD §6.1:

| Asset | Size | Format | Note |
|-------|------|--------|------|
| `installer/assets/header.bmp` | 497 × 60 px | BMP | Spectral gradient (blue→teal→green→amber) + PRISM wordmark |
| `installer/assets/header-large.bmp` | 497 × 120 px | BMP | Taller version for Welcome/Finish pages |
| `installer/assets/prism-installer.ico` | Multi-size | .ico | 16/32/48/256 px variants |

No new NSIS plugins needed beyond EnVar + NScurl (already bundled).

---

## Open Questions

1. **macOS installer technology**: Shell script (no GUI) vs Tauri app (full GUI matching mockup) vs PKG with postinstall scripts — which does the user want to pursue?

2. **Progress page strategy**: Custom NsDialogs page driving status labels from section callbacks, or keep MUI_PAGE_INSTFILES with styled detail window? The PRD recommends section callbacks but notes medium complexity risk.

3. **Always-dark vs system-preference**: PRD Open Question #1 — should the installer always apply dark theme, or detect Windows dark/light mode via registry? Always-dark is simpler and more brand-consistent.

4. **BMP vs PNG for header**: NsDialogs natively handles BMP. PNG requires additional plugin (`NsDialogs_SetImageOLE`). BMP is simpler but slightly larger. The spectral gradient header can be created as BMP without quality loss (it's geometric, not photographic).

5. **macOS CI runner**: If Tauri is chosen for macOS, the GitHub Actions workflow needs a `macos-latest` runner job added alongside the existing Ubuntu NSIS job.

---

## Patterns Found

### Existing NsDialogs Pattern to Model (`preflight.nsh:11-82`)

```nsis
Function PreflightPageCreate
  !insertmacro MUI_HEADER_TEXT "System Check" "Detecting installed tools..."
  nsDialogs::Create 1018
  Pop $hPreflightDlg
  ${If} $hPreflightDlg == error
    Abort
  ${EndIf}
  ; ... ${NSD_CreateLabel} calls for layout ...
  nsDialogs::Show
FunctionEnd

Function PreflightPageLeave
  ; validation or just empty
FunctionEnd
```

All new custom pages follow this exact create/show/leave pattern.

### Bitmap Extraction Pattern (`.onInit`)

```nsis
Function .onInit
  InitPluginsDir
  File /oname=$PLUGINSDIR\header.bmp "assets\header.bmp"
FunctionEnd
```

### Color Definitions for New `colors.nsh`

```nsis
; NSIS SetCtlColors uses RGB strings:
!define CLR_DARK    "0x0F172A"   ; page background
!define CLR_MID     "0x1E293B"   ; panel background
!define CLR_SURFACE "0x263348"   ; component row bg
!define CLR_BORDER  "0x334155"   ; border lines
!define CLR_MUTED   "0x64748B"   ; secondary text
!define CLR_LIGHT   "0x94A3B8"   ; primary text
!define CLR_WHITE   "0xF1F5F9"   ; brightest text
!define CLR_BLUE    "0x4A9EFF"   ; primary accent
!define CLR_TEAL    "0x2DD4BF"   ; secondary accent / success
!define CLR_GREEN   "0x4ADE80"   ; installed / done
!define CLR_AMBER   "0xFBB040"   ; in-progress / warning
!define CLR_RED     "0xF87171"   ; error

; GDI BGR equivalents (for SendMessage / System::Call):
!define BGR_DARK    0x2A170F
!define BGR_MID     0x3B291E
!define BGR_TEAL    0xBFD42D
!define BGR_GREEN   0x80DE4A
!define BGR_AMBER   0x40B0FB
```

---

## Relevant Existing Research

| Document | What it covers |
|----------|---------------|
| `.prism/shared/research/2026-03-05-nsis-native-installer.md` | Full NSIS architecture, gotchas (where.exe, cmd.exe quoting, local plugins dir) |
| `.prism/shared/research/2026-03-05-unified-installer-analysis.md` | Original installer analysis before NSIS switch |
| `.prism/shared/docs/prism-installer-ui-prd.md` | Full PRD with 5-phase plan, color tokens, asset specs, risks |
