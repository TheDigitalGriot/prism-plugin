# Prism Ecosystem — NSIS Installer UI Modernization
## Product Requirements Document

| Field | Value |
|---|---|
| **Document** | PRD — NSIS Installer UI Modernization |
| **Product** | Prism Ecosystem — Windows Installer |
| **Status** | Proposed |
| **Date** | 2026-03-05 |
| **Version** | 1.0 |
| **Scope** | Windows only (`installer/`), v2.5.0 target |

---

## 1. Overview

### 1.1 Background

Prism's Windows installer was migrated from a 130 MB Electron wizard to a native NSIS installer in v2.4.3, reducing the installer to ~38 MB and eliminating npm workspace hoisting, PATH reliability issues, and non-standard UX patterns. The NSIS installer is functionally solid and ships all four Prism ecosystem components (CLI, VS Code extension, Claude plugin, Electron app).

However, the current installer uses NSIS MUI2 (Modern UI 2) default styling, which presents two visual problems:

- The MUI2 default skin renders with Windows 2000-era aesthetics — grey dialogs, small bitmap headers, and non-brand typography
- NSIS does not declare DPI awareness by default, causing the installer to render blurry on HiDPI / 4K displays through Windows bitmap scaling

This PRD defines the requirements and implementation plan to modernize the installer's visual layer while preserving all existing functional behavior and keeping NSIS as the underlying technology.

### 1.2 Goals

- Modernize installer visual design to match Prism's spectral brand identity
- Fix HiDPI rendering so the installer is crisp on all display resolutions
- Preserve all existing installation logic — no functional regressions
- Keep the installer fully self-contained with no new runtime dependencies
- Deliver improvements incrementally so each phase ships independently

### 1.3 Non-Goals

- macOS or Linux installer redesign (separate effort)
- Migration away from NSIS to WiX, Inno Setup, or any other installer technology
- Changes to what components are installed or how they are installed
- Auto-update mechanism (tracked separately)
- Code-signing or notarization (tracked separately)

---

## 2. Problem Statement

### 2.1 HiDPI Blurriness

NSIS installers without a DPI-aware manifest are treated by Windows as legacy applications and scaled up using bitmap interpolation. On a 4K or 1440p display at 150%+ scaling, all installer UI elements — text, controls, headers — render blurry. This is a one-line fix (`ManifestDPIAware true`) but must be addressed before any visual design work, as DPI awareness changes the effective pixel canvas.

### 2.2 MUI2 Default Skin

MUI2 provides a functional wizard framework but its default visual language is frozen at circa Windows XP. Specifically:

- **Header area:** 150×57 pixel bitmap with a small logo on grey background
- **Welcome/Finish pages:** white left panel (~40% width) for a sidebar image, grey right content area
- **Typography:** Tahoma 8pt (the Windows 2000 system font default)
- **Color:** entirely system-color-managed — no custom backgrounds, no brand colors
- **Button styling:** standard Win32 push buttons, cannot be customized within MUI2

### 2.3 User Perception

Developer tooling is judged by attention to detail. An installer that looks dated signals that the product inside may also be dated. Prism's target audience — developers who use tools like Warp, Raycast, Linear, and 1Password — has high expectations for software polish. All of those tools ship installers that express their brand identity from the first screen.

---

## 3. Technical Approach

### 3.1 NsDialogs (Recommended)

NsDialogs is a built-in NSIS plugin that allows fully hand-crafted Win32 dialog pages to replace any or all MUI2 wizard pages. It provides:

- Full control over layout, colors, fonts, and control placement
- GDI drawing for custom backgrounds and gradients
- PNG/BMP image loading for branding assets
- No additional dependencies — NsDialogs ships with NSIS
- Zero impact on installer size (the plugin is already compiled in)

The approach is to surgically replace high-visibility MUI2 pages (Welcome, Finish, Components, Progress) with custom NsDialogs pages while leaving functional-only pages (InstallDir, uninstaller) as standard MUI2. This balances visual impact against implementation effort.

### 3.2 Approach Considered and Rejected: Inno Setup Migration

Inno Setup offers better HiDPI support and community themes out of the box. However, migrating the existing `.nsi` script, four section files (`.nsh`), custom preflight page, EnVar plugin integration, and NScurl download logic to Inno Setup's Pascal scripting would be a full rewrite with significant regression risk. Given the NSIS installer is already working well functionally, a visual-layer upgrade within NSIS is the lower-risk path.

### 3.3 Approach Considered and Rejected: WiX Burn

WiX v4 Burn supports a full WPF bootstrapper UI and produces genuinely modern installers. The tradeoff is requiring C#/.NET build tooling in the CI pipeline and a complete rewrite of installation logic in WiX XML. This would be the right choice for a v3.0 full rewrite but is out of scope for a visual upgrade.

### 3.4 Before / After Comparison

| Aspect | Current (MUI2) | Target (NsDialogs) |
|---|---|---|
| DPI Awareness | Blurry on HiDPI (missing manifest) | `ManifestDPIAware true` — crisp on all displays |
| Welcome / Done pages | Default MUI2 layout, grey banner | Custom NsDialogs with spectral gradient header |
| Typography | System default (Tahoma 8pt) | Segoe UI, sized for readability |
| Color palette | Windows grey (`#F0F0F0`) | Prism dark theme (navy + spectral accents) |
| Header graphic | Small 150×57 MUI2 bitmap | Full-width 497×60 spectral gradient PNG |
| Components page | Plain MUI2 checkboxes | Custom NsDialogs with per-component descriptions |
| Progress page | Default MUI2 progress bar | Styled progress + per-component status lines |
| Installer size | ~38 MB (unchanged) | ~38 MB + <100 KB for custom bitmaps |
| Build complexity | Single `.nsi` compile | Same — NsDialogs is built-in, no extra deps |

---

## 4. Requirements

### 4.1 Functional Requirements

All existing functional behavior must be preserved exactly:

- CLI binary install to `%LOCALAPPDATA%\Prism\bin\` with PATH via EnVar plugin
- VS Code / Cursor / Windsurf extension install via direct `.cmd` path detection
- Claude plugin install via `nsExec`, with file-copy fallback
- Optional Electron Desktop App download via NScurl from GitHub releases
- Add/Remove Programs registration and uninstaller
- System check preflight page (NsDialogs — already custom)

### 4.2 Visual Requirements

- Installer must declare DPI awareness (`ManifestDPIAware true`)
- Welcome page must display Prism spectral gradient header bitmap (full installer width, min 60px height)
- Welcome page background: dark navy (`#0F172A`) with white body text
- Welcome page must show version number and brief product tagline
- All body text must use Segoe UI (falls back to Tahoma on pre-Win8 systems)
- Components page must show per-component description text alongside each checkbox
- Progress page must show per-component status lines (Detecting... / Installing... / Done)
- Finish page must match Welcome page visual style with spectral header
- Finish page must offer "Open terminal" checkbox and GitHub link

### 4.3 Constraints

- Installer must remain a single standalone `.exe` with no runtime dependencies
- Build must compile on Ubuntu via `makensis` (existing CI pipeline unchanged)
- No new NSIS plugins beyond EnVar and NScurl (already bundled)
- Total installer size must not exceed 45 MB (current: ~38 MB, budget: +7 MB for assets)
- Must install correctly on Windows 10 and Windows 11

---

## 5. Phased Implementation Plan

| Phase | Description | Pages Affected | Effort |
|---|---|---|---|
| **1 — Quick Win** | Add `ManifestDPIAware true` and custom header bitmap to existing MUI2 | All pages (manifest), Header graphic | ~2 hrs |
| **2 — Welcome & Done** | Replace Welcome + Finish pages with custom NsDialogs. Spectral gradient header, dark background, Segoe UI typography. | WelcomePage, FinishPage | ~6 hrs |
| **3 — Components** | Custom NsDialogs component selector with per-item descriptions, icons, and requirement badges. | ComponentsPage | ~5 hrs |
| **4 — Progress** | Styled progress bar + per-component status lines replacing default MUI2 InstFiles page. | ProgressPage (InstFiles) | ~4 hrs |
| **5 — Polish** | Custom system check page refinement, consistent button styling, HiDPI icon assets. | PreflightPage, global buttons | ~3 hrs |

### Phase 1 — Quick Wins (~2 hours)
> Target: v2.4.5 patch release

These changes have the highest visual-to-effort ratio and zero regression risk.

#### 1.1 ManifestDPIAware

Add to `prism-setup.nsi`, before any page declarations:

```nsis
ManifestDPIAware true
```

This causes Windows to pass logical pixels to the installer rather than scaling up physical pixels, eliminating blur on HiDPI displays.

#### 1.2 Custom Header Bitmap

Replace the default MUI2 header with a custom 497×60 PNG asset (`installer/assets/header.png`):

```nsis
!define MUI_HEADERIMAGE_BITMAP "assets\header.png"
```

The header asset should be a PNG with the four spectral colors (blue `#4A9EFF` → teal `#2DD4BF` → green `#4ADE80` → amber `#FBB040`) as a left-to-right gradient with the Prism wordmark in white on the left side.

---

### Phase 2 — Welcome & Finish Pages (~6 hours)
> Target: v2.5.0 minor release

These are the highest-visibility pages — first and last impressions. The custom Welcome page NsDialogs implementation:

- Full-window dark background (`#0F172A`) painted via GDI `FillRect`
- Header zone (top 80px): spectral gradient painted via GDI or bitmap fill
- Wordmark: "PRISM" in Segoe UI 24pt white + version string below in teal
- Body copy: installer welcome text in Segoe UI 11pt white
- Next button: custom-painted or owner-drawn with teal border (`#2DD4BF`)

The Finish page mirrors the Welcome page structure with:

- "Installation complete" headline
- Per-component success summary (CLI ✓, VSCode ext ✓, etc.)
- Checkbox: "Open a new terminal now" (launches `cmd.exe` if checked)
- Hyperlink to GitHub releases page

---

### Phase 3 — Components Page (~5 hours)
> Target: v2.5.0 minor release

The custom NsDialogs Components page shows four component rows, each containing:

- Checkbox, component name (bold), one-line description
- Badge indicating "Required" or "Optional"
- Size estimate per component (CLI: ~2 MB, Extension: ~8 MB, Plugin: ~1 MB, Desktop App: ~130 MB download)
- Download indicator on the Desktop App row

---

### Phase 4 — Progress Page (~4 hours)
> Target: v2.5.0 minor release

The custom progress page displays four component rows, each cycling through states:

- **Pending** — grey dot, component name in muted color
- **Installing** — amber dot, "Installing..." label
- **Done** — green dot, component name + "Installed" confirmation
- **Skipped** — grey dot, "Skipped" label (for unchecked optional components)
- **Failed** — red dot, component name + error code

Per-component status is updated by calling `NsDialogs SetText` on the status labels from within each section `.nsh` file.

---

### Phase 5 — Polish (~3 hours)
> Target: v2.5.1 patch release

- Refine the existing preflight (system check) NsDialogs page to match the new visual language
- Ensure consistent button sizing and placement across all custom pages
- Create HiDPI-aware icon assets (`.ico` with 16/32/48/256px variants)
- Test on Windows 10 (100%), Windows 10 (150%), Windows 11 (150%), Windows 11 (200%) scale factors

---

## 6. Required Assets

### 6.1 Bitmap Assets

All assets live in `installer/assets/` and are compiled into the `.exe` by NSIS.

| Asset | Dimensions | Format | Purpose |
|---|---|---|---|
| `header.png` | 497 × 60 px | PNG | Spectral gradient header used by MUI2 pages |
| `header-large.png` | 497 × 120 px | PNG | Welcome/Finish page header (taller at 2× DPI) |
| `prism-installer.ico` | 256 px (multi) | .ico | Window titlebar + taskbar icon (16/32/48/256) |
| `component-cli.png` | 32 × 32 px | PNG | CLI component icon in custom Components page |
| `component-vscode.png` | 32 × 32 px | PNG | VSCode extension component icon |
| `component-plugin.png` | 32 × 32 px | PNG | Claude plugin component icon |
| `component-electron.png` | 32 × 32 px | PNG | Desktop app component icon |

### 6.2 Color Tokens

> ⚠️ NSIS GDI calls use `0xBBGGRR` byte order (BGR), not RGB. Define all colors in a shared `colors.nsh` include file to avoid mistakes.

| Token | Hex (RGB) | BGR (NSIS) | Usage |
|---|---|---|---|
| `prism-dark` | `#0F172A` | `0x2A170F` | Page background (Welcome, Finish, Progress) |
| `prism-mid` | `#1E293B` | `0x3B291E` | Panel backgrounds, component row backgrounds |
| `prism-muted` | `#64748B` | `0x8B7464` | Secondary text, pending state labels |
| `prism-light` | `#E2E8F0` | `0xF0E8E2` | Borders, dividers |
| `prism-blue` | `#4A9EFF` | `0xFF9E4A` | Primary accent, hyperlinks |
| `prism-teal` | `#2DD4BF` | `0xBFD42D` | Success states, button borders, header gradient stop 2 |
| `prism-green` | `#4ADE80` | `0x80DE4A` | Installed/Done status indicators |
| `prism-amber` | `#FBB040` | `0x40B0FB` | In-progress/Installing status indicators, header gradient stop 4 |

---

## 7. Proposed File Structure

Changes are additive — existing section files and the core `.nsi` are modified, not replaced.

```
installer/
├── prism-setup.nsi          # + ManifestDPIAware, new page includes
├── sections/                # UNCHANGED — all functional logic preserved
│   ├── cli.nsh
│   ├── vscode.nsh
│   ├── plugin.nsh
│   └── electron.nsh
├── pages/
│   ├── preflight.nsh        # EXISTING (already NsDialogs)
│   ├── welcome.nsh          # NEW — Phase 2
│   ├── finish.nsh           # NEW — Phase 2
│   ├── components.nsh       # NEW — Phase 3
│   └── progress.nsh         # NEW — Phase 4
├── assets/                  # NEW — Phase 1
│   ├── header.png
│   ├── header-large.png
│   ├── prism-installer.ico
│   └── component-*.png
├── uninstall.nsh            # UNCHANGED
└── plugins/x86-unicode/     # UNCHANGED
    ├── EnVar.dll
    └── NScurl.dll
```

---

## 8. Acceptance Criteria

### Phase 1 — Done When
- Installer renders crisp (no blur) on Windows 11 at 150% and 200% display scaling
- Custom header bitmap is visible on all MUI2 pages
- Existing installation smoke test passes: CLI installs, PATH is set, extension installs

### Phase 2 — Done When
- Welcome page shows dark background, spectral header, version string
- Finish page shows component install summary with per-component success indicators
- "Open terminal" checkbox on Finish page launches `cmd.exe` when checked
- Visual regression test: screenshots captured at 100% and 150% scaling

### Phase 3 — Done When
- Components page shows four rows with checkbox, name, description, and size estimate
- "Required" badge on CLI row prevents deselection
- Component selection state correctly drives which sections run during install

### Phase 4 — Done When
- Progress page shows all four component rows with live status updates
- Each row transitions through Pending → Installing → Done (or Skipped/Failed) states
- Failed state displays the NSIS error code for debugging

### Phase 5 — Done When
- Preflight page visual style matches Welcome/Progress/Finish pages
- Installer tested and verified on: Windows 10 100%, Windows 10 150%, Windows 11 150%, Windows 11 200%
- Total installer `.exe` size does not exceed 45 MB

---

## 9. Risks & Mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| GDI color values in NSIS use BGR not RGB — incorrect color rendering | Medium | Define all color constants with correct byte order in a shared `colors.nsh` include file |
| NsDialogs custom pages bypass MUI2 back/next button management | Medium | Each custom page must explicitly call `NsDialogs Show` and handle `MUI2_PageLeaveFunction`. Follow established `preflight.nsh` pattern already in codebase |
| `ManifestDPIAware` breaks layout on some Windows 10 configurations | Low | Widely supported since Windows Vista. Test on Windows 10 1903+ and Windows 11. Add `!define MUI_UNICODE` as a companion flag |
| Phase 4 progress NsDialogs conflicts with MUI2 InstFiles page | Medium | Use NSIS Section callbacks to drive NsDialogs label updates rather than replacing InstFiles entirely |
| Asset PNG files increase CI build time | Low | PNG assets are small (<500 KB total). No impact on the ~30 second `makensis` compile time |

---

## 10. Out of Scope

The following items are explicitly excluded from this PRD and tracked separately:

- macOS installer — DMG wizard or PKG notarization
- Linux installer — shell script improvements or AppImage UI
- Auto-update mechanism for `prism-cli` or Claude plugin
- VSCode Marketplace publishing pipeline
- Cursor extension install exit code 1 bug investigation
- Electron Desktop App white screen rendering bug
- `cmd/prism-setup/` cleanup and removal of deprecated Electron wizard code

---

## 11. Open Questions

1. **Dark theme opt-in vs. always-on** — Should the dark theme detect Windows dark/light mode via registry, or always apply? Always-dark is more brand-consistent but departs from the user's system preference.

2. **Component icons** — Should component icons in Phase 3 be custom-designed or use existing VS Code / Claude logos? Legal review needed for third-party logos in installer UI.

3. **"Open terminal" default state** — Should the Finish page checkbox default to checked or unchecked? Checked is more helpful but adds an unexpected side effect.

---

*Prism Ecosystem · NSIS Installer UI Modernization PRD v1.0 · 2026-03-05*
