---
date: 2026-07-12
planner: Claude
repository: prism
branch: main
status: awaiting-approval
research: .prism/shared/research/2026-07-12-app-icon-brand-replacement.md
---

# Plan: App Icon / Brand Asset Replacement Across All Prism Surfaces

## Overview

Route the new pre-generated brand icons from `.prism/shared/designs/assets/app-icons/<variant>/`
into every product surface, per-variant, without touching unrelated config.

**Decisions locked with user (2026-07-12):**
- **`wave` = future/placeholder channel** — stage assets + wire routing structure so it's build-ready, but stand up NO active build profile/channel this round. Dormant until a future task activates it.
- **Paseo (`apps/prism-mobile`) scope = Expo config only** — `packages/app` icon config + its image assets. Leave `packages/desktop/` (2nd Electron app) and `packages/website/` (paseo.sh) untouched.
- **Installers = update all three generations** — live Tauri (`apps/prism-installer`), deprecated NSIS (`installer/prism-setup.nsi`), deprecated Electron-Forge wizard (`apps/prism-setup`).

## Variant → Surface Matrix

`prod` is the universal release icon. `debug`/`wave` are **Expo-mobile-only** concepts — no other surface has a debug or wave channel, so they receive `prod` only.

| Surface | prod | debug | wave |
|---|---|---|---|
| Expo mobile (iOS/Android) | ✅ production variant | ✅ development variant | ⏸ dormant variant (staged, no eas profile) |
| Electron (`apps/prism-electron`) | ✅ | — | — |
| Tauri installer (`apps/prism-installer`) | ✅ | — | — |
| NSIS installer (`installer/`) | ✅ | — | — |
| Electron-Forge wizard (`apps/prism-setup`) | ✅ | — | — |
| VS Code extension | ✅ | — | — |
| VitePress docs | ✅ | — | — |

## Guiding Rules

- **Copy, don't reference `.prism/`**: `.prism/shared/designs/` is design-source/project-memory, not a build input. Each build tool expects assets inside its own app tree (relative paths). So the mechanism is always: copy the correct pre-generated file into the app's expected icon location, then point config at it. (The `.prism/.../app-icons/wave/` bundle already IS the staging location for non-mobile wave assets — nothing to copy there.)
- **iOS alpha guard**: any file that ends up as an iOS icon must be the opaque `ios/icon-1024.png` (verified RGB, no alpha). Never the RGBA `png/` set.
- **Out of scope (not "app icon", no new asset exists)**: mobile `splash-icon.png`, `notification-icon.png`, the dynamic `favicon-{light,dark}-{,attention,running}.png` status set, the unreferenced Tauri Store-tile/android/ios leftover sets.

---

## Phase 1 — Expo mobile (`apps/prism-mobile/packages/app`)

### 1.1 Stage icon assets into `assets/images/`
Copy from `.prism/shared/designs/assets/app-icons/`:

| Source | Dest | Purpose | Alpha |
|---|---|---|---|
| `prod/ios/icon-1024.png` | `assets/images/icon.png` (overwrite) | prod iOS + top-level fallback | opaque |
| `prod/png/icon_1024.png` | `assets/images/android-icon-foreground.png` (overwrite) | prod Android adaptive fg | alpha |
| `debug/ios/icon-1024.png` | `assets/images/icon-debug.png` (overwrite) | debug iOS + fallback | opaque |
| `debug/png/icon_1024.png` | `assets/images/android-icon-foreground-debug.png` (new) | debug Android adaptive fg | alpha |
| `wave/ios/icon-1024.png` | `assets/images/icon-wave.png` (new) | wave iOS (staged) | opaque |
| `wave/png/icon_1024.png` | `assets/images/android-icon-foreground-wave.png` (new) | wave Android (staged) | alpha |

### 1.2 Edit `app.config.js`
Restructure the `variants` map so **iOS icon and Android adaptive foreground are per-variant** (today only the top-level icon is per-variant; Android fg is shared).

- Add to each variant: `iosIcon` + `androidForeground` keys.
  - `production`: `icon`/`iosIcon` = `./assets/images/icon.png`, `androidForeground` = `./assets/images/android-icon-foreground.png`
  - `development`: `icon`/`iosIcon` = `./assets/images/icon-debug.png`, `androidForeground` = `./assets/images/android-icon-foreground-debug.png`
  - **Add dormant** `wave` entry: `name: "Prism Wave"`, `packageId: "com.thedigitalgriot.prism.wave"`, `icon`/`iosIcon` = `./assets/images/icon-wave.png`, `androidForeground` = `./assets/images/android-icon-foreground-wave.png`, with a comment: `// Placeholder channel — assets staged; not built until an eas.json "wave" profile + APP_VARIANT=wave exists.`
- In `expo`:
  - Keep `icon: variant.icon` (top-level fallback, opaque).
  - **Add** `ios.icon: variant.iosIcon` (explicit opaque iOS icon, per task).
  - Change `android.adaptiveIcon.foregroundImage` → `variant.androidForeground`.
  - Change `android.adaptiveIcon.backgroundColor` `#000000` → **`#001916`** (per task).
- **Do NOT** add a `wave` profile to `eas.json` (keeps it dormant).

### 1.3 Verify (this phase)
- `node -e "process.env.APP_VARIANT='production'; console.log(JSON.stringify(require('./app.config.js').default.expo.ios.icon, require('./app.config.js').default.expo.android.adaptiveIcon))"` resolves to real files (or a small resolve script — see Phase 8).
- Alpha check: `icon.png`/`icon-debug.png`/`icon-wave.png` = RGB (no alpha); `android-icon-foreground*.png` = RGBA.

---

## Phase 2 — Electron desktop (`apps/prism-electron`) — prod

### 2.1 Stage assets
Create `apps/prism-electron/icons/` and copy from `app-icons/prod/`:
- `icon.icns`, `icon.ico`, `tauri/icon.png`→`icon.png` (or `png/icon_512.png`), plus `png/icon_512.png` for Linux makers.

### 2.2 Edit `forge.config.ts`
- `packagerConfig.icon: path.resolve(__dirname, 'icons/icon')` — **extensionless**; electron-packager appends `.icns` (mac) / `.ico` (win) automatically.
- `new MakerSquirrel({ setupIcon: path.resolve(__dirname, 'icons/icon.ico') })` — Windows installer icon.
- `new MakerDeb({ options: { icon: 'icons/icon.png' } })`, `new MakerRpm({ options: { icon: 'icons/icon.png' } })` — Linux.

### 2.3 Edit `src/main.ts` (optional, low-risk)
- Add `icon: path.join(__dirname, ... 'icon.png')` to the `BrowserWindow` options so windowed/dev/Linux taskbar shows the brand icon (packaged mac/win use the bundle icon instead). Include only if it doesn't complicate the existing `__dirname` asset resolution; otherwise skip and note.

---

## Phase 3 — Tauri installer (`apps/prism-installer/src-tauri`) — prod

### 3.1 Stage assets
Copy `app-icons/prod/tauri/*` → `src-tauri/icons/`, overwriting: `32x32.png`, `128x128.png`, `128x128@2x.png`, `icon.icns`, `icon.ico`, `icon.png`.

### 3.2 `tauri.conf.json`
`bundle.icon` already lists exactly the 5 files we overwrite → **no config edit needed** (verify only). Leftover Store-tile/android/ios sets remain untouched (dead, unreferenced).

---

## Phase 4 — Deprecated installers — prod

### 4.1 NSIS (`installer/prism-setup.nsi`)
- Copy `app-icons/prod/icon.ico` → `installer/assets/prism.ico` (new dir).
- Add before `!include "MUI2.nsh"` (line 41):
  ```
  !define MUI_ICON   "assets\prism.ico"
  !define MUI_UNICON "assets\prism.ico"
  ```

### 4.2 Electron-Forge wizard (`apps/prism-setup`)
- Create `apps/prism-setup/icons/`, copy `app-icons/prod/{icon.icns,icon.ico}` + a png.
- Edit `apps/prism-setup/forge.config.ts`: add `packagerConfig.icon` (extensionless) + `MakerSquirrel setupIcon` + Deb/Rpm icons, mirroring Phase 2. (This app also has `electron-forge-maker-nsis` — add its `icon` option if the maker is configured; verify during implementation.)

---

## Phase 5 — VS Code extension (`apps/prism-vscode`) — prod

### 5.1 Marketplace listing icon (raster, required)
- Copy `app-icons/prod/png/icon_128.png` → `apps/prism-vscode/media/prism-icon-128.png`.
- Add top-level `"icon": "media/prism-icon-128.png"` to `package.json` (Marketplace requires PNG, ≥128×128; SVG not allowed here).

### 5.2 Monochrome activity-bar/panel glyph
- Overwrite `apps/prism-vscode/media/prism-icon.svg` with the content of `.prism/shared/designs/assets/prism-glyph.svg` (keeps `fill="currentColor"` → theme-aware, exactly as today). The `viewsContainers` references (`media/prism-icon.svg`) and walkthrough `media` refs stay unchanged.
- Note: new glyph viewBox is `560×493` (non-square) vs current `24×24`. VS Code centers/scales in a square slot — acceptable, will verify visually.

---

## Phase 6 — VitePress docs (`prism-docs`) — prod

### 6.1 Favicon (currently 404 — `docs/public/` doesn't exist)
- Create `prism-docs/docs/public/`, copy `app-icons/prod/favicon.ico` → `prism-docs/docs/public/favicon.ico`. (Existing `head` link `/favicon.ico` then resolves.)

### 6.2 Site logo (currently text-only)
- Copy `prism-glyph-black.svg` + `prism-glyph-white.svg` → `docs/public/`.
- Edit `.vitepress/config.ts` `themeConfig.logo`: `{ text: 'Prism' }` → `{ light: '/prism-glyph-black.svg', dark: '/prism-glyph-white.svg' }` (theme-aware; site title still comes from top-level `title: 'Prism'`).

---

## Phase 7 — (Reserved) no-op

## Phase 8 — Validation

### Automated
- **Path-existence sweep**: a script that parses each config and asserts every referenced icon path resolves to a real file on disk:
  - `app.config.js` (all 3 variants: `icon`, `ios.icon`, `android.adaptiveIcon.foregroundImage`)
  - `forge.config.ts` ×2 (packager + maker icons)
  - `tauri.conf.json` `bundle.icon[]`
  - `prism-setup.nsi` `MUI_ICON`/`MUI_UNICON`
  - `package.json` (vscode) `icon`
  - vitepress `config.ts` favicon + logo paths → `docs/public/`
- **iOS alpha assertion**: python PNG color-type check — every iOS-bound PNG (`icon.png`, `icon-debug.png`, `icon-wave.png`, and each variant's `ios/icon-1024.png`) MUST be color-type 2 (RGB, no alpha). Fail loudly if any has alpha.
- **Android alpha assertion**: `android-icon-foreground*.png` MUST be RGBA (adaptive foregrounds need transparency).
- Typecheck where cheap: `forge.config.ts` / `config.ts` still compile (tsc/vite) — spot check, don't run heavy suites.

### Manual (human)
- iOS: `eas build -p ios --profile production` (or local prebuild) → icon shows, **App Store Connect upload not rejected for alpha**.
- Android: adaptive icon renders with `#001916` background.
- Electron: packaged `.exe`/`.app` shows brand icon in taskbar/dock.
- Tauri installer: `.exe`/window shows brand icon.
- VS Code: activity-bar glyph + Marketplace listing icon render (light & dark theme).
- Docs: favicon appears in browser tab; logo appears in nav (light & dark).

## Success Criteria

**Automated**
- [ ] Path-existence sweep passes: every icon path in every touched config resolves to a real file.
- [ ] iOS alpha assertion passes: zero alpha channels on any iOS-bound PNG.
- [ ] Android foreground assertion passes: adaptive foregrounds are RGBA.
- [ ] `forge.config.ts` (×2) and vitepress `config.ts` compile.

**Manual**
- [ ] Each surface visually shows the new brand icon (see Phase 8 manual list).
- [ ] App Store Connect accepts the iOS build (no alpha rejection).
- [ ] `wave` remains dormant (no eas profile references it; assets staged and ready).

## What We're NOT Doing
- Not creating a `wave` build profile/channel (placeholder only).
- Not touching `apps/prism-mobile/packages/desktop` or `.../website` (Paseo desktop app + paseo.sh).
- Not touching mobile splash/notification/dynamic-favicon assets.
- Not regenerating the unreferenced Tauri Store-tile/android/ios icon sets.
- Not changing any non-icon config.
