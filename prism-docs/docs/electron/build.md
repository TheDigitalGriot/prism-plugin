---
title: Build & Packaging
description: Scripts, Vite build targets, Forge config, build output, and renderer Vite config.
outline: [2, 3]
---

# Build & Packaging

## Scripts

```bash
cd apps/prism-electron

npm start           # Dev mode: Electron Forge + Vite HMR
npm run package     # Build production app (no installer)
npm run make        # Build distributable installers
npm run lint        # ESLint check
```

## Vite Build Targets

Electron Forge's Vite plugin builds three separate targets:

| Target | Config | Input | Output |
|--------|--------|-------|--------|
| Main process | `vite.main.config.mts` | `src/main.ts` | `.vite/build/main.js` |
| Preload script | `vite.preload.config.mts` | `src/preload.ts` | `.vite/build/preload.js` |
| Renderer (SPA) | `vite.renderer.config.mts` | `webview-ui/` | `.vite/renderer/` |

## Forge Config (`forge.config.ts`)

```typescript
// Plugins
plugins: [
  new VitePlugin({
    build: [
      { entry: 'src/main.ts', config: 'vite.main.config.mts', target: 'main' },
      { entry: 'src/preload.ts', config: 'vite.preload.config.mts', target: 'preload' },
    ],
    renderer: [
      { name: 'main_window', config: 'vite.renderer.config.mts' },
    ],
  }),
  new FusesPlugin({ /* security hardening */ }),
],

// Makers (installers)
makers: [
  MakerSquirrel,    // Windows: .exe + .nupkg + RELEASES
  MakerZIP,         // macOS: .zip
  MakerDeb,         // Linux: .deb
  MakerRPM,         // Linux: .rpm
]
```

## Build Output

```
out/
├── Prism-win32-x64/          # Packaged app (npm run package)
│   ├── Prism.exe
│   ├── resources/
│   │   └── app.asar          # Bundled source
│   └── ...
└── make/
    └── squirrel.windows/x64/  # Installer (npm run make)
        ├── Prism-1.0.0 Setup.exe
        ├── Prism-1.0.0-full.nupkg
        └── RELEASES
```

## Renderer Vite Config

The renderer has its own Vite configuration with the SPA root set to `webview-ui/`:

```typescript
// vite.renderer.config.mts
export default defineConfig({
  root: './webview-ui',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'webview-ui/src') },
  },
});
```
