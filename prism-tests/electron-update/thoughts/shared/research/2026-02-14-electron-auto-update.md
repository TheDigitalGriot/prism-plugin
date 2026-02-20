# Research: Electron Auto-Update Mechanisms

**Date**: 2026-02-14
**Topic**: Auto-update system options for Electron applications

## Current State

The application is a standard Electron + React + TypeScript starter built with Electron Forge and Vite. No auto-update mechanism is currently in place.

### Stack Details
- **Electron**: v40.0.0
- **Build Tool**: Electron Forge v7.11.1
- **Bundler**: Vite v5.4.21
- **Framework**: React 19 with TypeScript

## Findings

### electron-updater (via electron-builder)
- Most widely used auto-update solution
- Supports GitHub Releases, S3, and generic HTTP servers
- Built-in differential updates (delta updates) for faster downloads
- Handles code signing verification automatically
- Can be used standalone without electron-builder for packaging

### Electron's Built-in autoUpdater
- Wraps Squirrel framework (Windows) and Sparkle (macOS)
- Requires a dedicated update server (Hazel, Nuts, etc.)
- No Linux support built-in
- Simpler API but less flexible than electron-updater

### Update Server Options
- **GitHub Releases**: Free for open source, requires public repo
- **Hazel**: Minimal update server by Vercel, deploys to Now
- **Nuts**: More features, supports private repos, self-hosted
- **update.electronjs.org**: Free service for open source Electron apps

## IPC Patterns Observed

The main process (`src/main.ts`) uses a standard BrowserWindow setup with preload script. The preload (`src/preload.ts`) would need to expose update-related APIs through contextBridge for secure renderer access.

### Current File Structure
```
src/
├── App.tsx          # Root React component
├── index.css        # Global styles
├── main.ts          # Main process entry
├── preload.ts       # Preload script
└── renderer.tsx     # Renderer entry
```

## Platform Considerations

- **Windows**: Squirrel.Windows handles install/update lifecycle. `electron-squirrel-startup` is already a dependency.
- **macOS**: Requires code signing for auto-update to work. Sparkle framework handles UI natively.
- **Linux**: AppImage supports auto-update via electron-updater. Snap/Flatpak have their own update mechanisms.
