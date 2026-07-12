---
date: 2026-07-12
researcher: Claude
repository: prism
branch: main
status: complete
---

# Research: App Icon / Brand Asset Replacement Across All Prism Surfaces

## Task

Replace the app icon across every surface of Prism with the new brand assets in
`.prism/shared/designs/assets/`, routing each surface to the correct pre-generated
per-variant bundle under `.prism/shared/designs/assets/app-icons/<variant>/`
(variants: `prod`, `debug`, `wave`).

## 1. New Brand Assets — Ground Truth

### 1a. Source glyph & flat renders — `.prism/shared/designs/assets/`

```
prism-icon-{green,blue}-1024.png       — full-color source renders (not consumed directly by any config)
prism-icon-{prod,debug,wave}.png       — flat per-variant renders (opaque)
prism-icon-{prod,debug,wave}-transparent.png
prism-glyph.svg                        — fill="currentColor" (monochrome, theme-color-ready)
prism-glyph-{black,white}.svg
prism-glyph-{black,white}.png / -16.png / -32.png / -128.png
```

### 1b. Per-variant platform bundles — `.prism/shared/designs/assets/app-icons/<variant>/`

Each of `prod/`, `debug/`, `wave/` (identical structure, 23 files each = 69 total):

```
<variant>/
├── icon.ico              — Windows (multi-res)
├── icon.icns             — macOS
├── favicon.ico           — web favicon
├── png/
│   ├── icon_16.png ... icon_1024.png   (9 sizes: 16/24/32/48/64/128/256/512/1024)
├── tauri/
│   ├── 32x32.png, 128x128.png, 128x128@2x.png
│   ├── icon.png, icon.ico, icon.icns
└── ios/
    └── icon-1024.png
```

**Verified technically (PNG color-type inspection, not just filename trust):**

| File | Color type | Alpha |
|---|---|---|
| `<variant>/ios/icon-1024.png` | truecolor (RGB) | **No alpha** ✅ — safe for App Store Connect |
| `<variant>/png/icon_1024.png` | truecolor+alpha (RGBA) | **Has alpha** ✅ — correct for Android adaptive foreground |
| `<variant>/tauri/icon.png` | truecolor+alpha (RGBA) | Has alpha |

Confirmed identical across all 3 variants. The task's alpha-channel warning is already satisfied by the asset generation — no image processing needed, only correct wiring.

## 2. Surface-by-Surface Findings

### 2a. iOS + Android — Expo (`apps/prism-mobile/packages/app`)

**Important context**: `apps/prism-mobile` is a fork of a separate product called **Paseo** (its own `CLAUDE.md` describes it as "a mobile app for monitoring and controlling your local AI coding agents"). It has been *partially* rebranded to Prism — `app.config.js` sets `name: "Prism"`, `packageId: "com.thedigitalgriot.prism"`, and `associatedDomains: ["applinks:prism.digitalgriot.studio"]` — but internal docs, the daemon, and a bundled website package still say "Paseo." This is the same shallow-rebrand pattern already documented for `prism-design-studio` (cosmetic only, functional identifiers left intact).

**Config**: `apps/prism-mobile/packages/app/app.config.js`

Current variant map (only **two** variants — `production` and `development` — not three):
```js
production:  { name: "Prism",       icon: "./assets/images/icon.png",       packageId: "com.thedigitalgriot.prism" }
development: { name: "Prism Debug", icon: "./assets/images/icon-debug.png", packageId: "com.thedigitalgriot.prism.debug" }
```

- `expo.icon` = `variant.icon` (top-level, used as fallback for both platforms)
- **No `expo.ios.icon` override currently set** — task wants one added explicitly
- `expo.android.adaptiveIcon` = `{ backgroundColor: "#000000", foregroundImage: "./assets/images/android-icon-foreground.png" }` — task wants backgroundColor changed to `#001916`
- `expo.web.favicon` = `"./assets/images/favicon.png"`
- `expo-splash-screen` plugin: `image: "./assets/images/splash-icon.png"`
- `expo-notifications` plugin: `icon: "./assets/images/notification-icon.png"`, `color: "#20744A"`

**EAS build profiles** (`apps/prism-mobile/packages/app/eas.json`): `development`, `preview`, `production`, `production-apk`. **No `wave` profile exists.** `preview` has no explicit `channel` (defaults to matching the profile name) and is the closest thing to a third "internal testers" distribution tier.

### 2b. Electron — `apps/prism-electron` (the flagship desktop app documented in VitePress "Part IV — Electron Desktop App")

**Correction to the task's assumption**: this app uses **Electron Forge** (`@electron-forge/cli`), not electron-builder. There is no `build.icon` field to set.

- `forge.config.ts` — `packagerConfig` currently has **no `icon` field at all** (app currently ships with the default Electron icon when packaged).
- Makers in use: `MakerSquirrel` (Windows — takes a `setupIcon` option, currently unset), `MakerZIP` (macOS/no icon option), `MakerRpm`/`MakerDeb` (Linux — take an `options.icon`, currently unset).
- `src/main.ts` `BrowserWindow` constructor has no `icon` option (affects windowed/dev-mode taskbar icon on Linux/Windows; packaged builds are governed by `packagerConfig.icon` instead).

Correct wiring: `packagerConfig.icon` → path *without* extension (electron-packager appends `.icns`/`.ico` per platform automatically) pointing at `app-icons/<variant>/icon`; `MakerSquirrel({ setupIcon: ... })` → `app-icons/<variant>/icon.ico`; Deb/Rpm makers → a PNG from `app-icons/<variant>/png/`.

### 2c. Tauri — `apps/prism-installer/src-tauri` (the *current*, non-deprecated installer)

`tauri.conf.json` → `bundle.icon` array references exactly 5 files:
```json
["icons/32x32.png", "icons/128x128.png", "icons/128x128@2x.png", "icons/icon.icns", "icons/icon.ico"]
```
This matches the pre-generated `app-icons/<variant>/tauri/` bundle's core set (that bundle also ships an `icon.png` not referenced in conf — harmless to copy in for completeness).

**Note**: the actual `src-tauri/icons/` directory on disk has far more files than `tauri.conf.json` references — Windows Store tiles (`Square*Logo.png`, `StoreLogo.png`) and full Android/iOS icon sets (`android/mipmap-*/`, `ios/AppIcon-*.png`). None of these are referenced by `bundle.icon`, `bundle.targets` is currently `[]` (no bundle targets configured), and the pre-generated `app-icons/<variant>/tauri/` bundle has no equivalents for them. These look like leftovers from an initial `tauri icon` full-scaffold run for platforms this installer doesn't currently target. Recommend leaving them alone (dead, unreferenced) rather than trying to regenerate a full mobile/Store icon set that's out of scope here.

### 2d. NSIS installer — `installer/prism-setup.nsi` — **DEPRECATED**

Line 1-3 of the file itself:
```
; DEPRECATED — This NSIS installer is superseded by the Tauri installer
; at apps/prism-installer/. Kept for reference and rollback purposes.
```

Confirmed by `.prism/shared/plans/2026-03-05-unified-tauri-installer.md`: "The existing `installer/` directory will be preserved but deprecated."

Currently the installer has **no icon configured at all** (`!define MUI_ICON` / `MUI_UNICON` are absent — the `.exe` ships with the default NSIS icon). Wiring one in is cheap (2 defines before `!include "MUI2.nsh"`) and low-risk since this is a static reference/rollback artifact, not something rebuilt regularly.

**Related but not named in the task**: `apps/prism-setup/` is a *third*, separate installer generation — an Electron Forge app (own `forge.config.ts`, own `electron-forge-maker-nsis` dependency) that can independently produce a Windows NSIS-based installer. Its `package.json` version is frozen at `2.4.6` (vs. the monorepo's current `4.0.0`), consistent with also being legacy/frozen alongside the raw NSIS script. It has no icon files under it currently and wasn't named as a surface in the task.

### 2e. VS Code extension — `apps/prism-vscode`

- `package.json` has **no top-level `"icon"` field** (this is what VS Code Marketplace shows as the extension's listing icon — a 128×128 PNG is the convention). Needs to be added.
- `contributes.viewsContainers.activitybar[0].icon` and `.panel[0].icon` both = `"media/prism-icon.svg"` — the activity-bar/panel icon, currently a hand-drawn placeholder triangle glyph that **already uses `fill="currentColor"`** (theme-color-aware, exactly like the new `prism-glyph.svg`). This is the "monochrome UI" surface — swapping its content for the new `prism-glyph.svg` path is a direct, low-risk fit (same technique, same use site).
- Command icons (`$(trash)`, `$(refresh)`, `$(play)`, etc.) are VS Code's **built-in codicons**, not custom brand assets — nothing to change there.

### 2f. VitePress docs — `prism-docs/docs/.vitepress/config.ts`

- `head` → `['link', { rel: 'icon', href: '/favicon.ico' }]` — **currently broken**: `prism-docs/docs/public/` doesn't exist yet, so this favicon reference 404s today. Needs `docs/public/favicon.ico` created (VitePress serves `public/` at site root).
- `themeConfig.logo` = `{ text: 'Prism' }` — **text-only, no image today**. VitePress supports `logo: '/logo.svg'` or `{ light: '...', dark: '...' }` for theme-aware logos — a natural fit for `prism-glyph-black.svg` (light mode) / `prism-glyph-white.svg` (dark mode).

### 2g. CLI Dashboard (`apps/prism-cli`) — confirmed out of scope

Logo is rendered procedurally at runtime (ASCII art in `plugin_home.go`/`view.go`, a live 3D FauxGL prism render in `prism/prism.go`) — no static icon file to replace. Task didn't name this surface; no action needed.

## 3. Open Questions (blocking — need your call before I plan)

1. **What does the `wave` variant map to?** No existing "wave" channel, build profile, or distribution tier exists anywhere in the codebase (EAS profiles are `development`/`preview`/`production`/`production-apk`; Electron/Tauri/VS Code have no third channel concept). The only similarly-named thing, "Griotwave," is an unrelated design-system/color-theme name used exclusively by `prism-design-studio` — a coincidental substring match, not the same concept.
2. **Is `apps/prism-mobile` (the Paseo fork) in scope at all**, and if so, how far? The task's "iOS/Android (Expo)" bullets technically target this app (it's the only Expo app in the repo) — but the agent sweep also found a **second, separate Electron app** at `apps/prism-mobile/packages/desktop/` (own icon.icns/ico/png set) and a **separate marketing website** at `apps/prism-mobile/packages/website/` (paseo.sh — its own favicon/logo/og-image), neither of which the task named.
3. **Should the deprecated installer generations be touched at all?** `installer/prism-setup.nsi` is explicitly marked deprecated (rollback-only) — the task named it explicitly, so I lean toward wiring it in anyway since it's cheap. `apps/prism-setup/` (the separate Electron-Forge NSIS-capable wizard, frozen at v2.4.6) was *not* named in the task and looks like the same legacy generation — I lean toward leaving it alone.

## 4. Corrections to the Task's Stated Assumptions

- Electron packaging uses **Electron Forge**, not electron-builder — the task said `electron-builder build.icon`; correct target is `forge.config.ts` → `packagerConfig.icon` + per-maker icon options (`MakerSquirrel.setupIcon`, Deb/Rpm `options.icon`).
