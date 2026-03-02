---
title: Main Process & Window Management
description: Bootstrap flow, window configuration, native menu, CLI argument support, and window lifecycle.
outline: [2, 3]
---

# Main Process & Window Management

## `src/main.ts`

The main process handles Electron app lifecycle, window creation, native menus, and CLI argument handling.

### Bootstrap Flow

1. Check for Squirrel Windows installer events (`electron-squirrel-startup`)
2. Load saved window state from `prism-window-state.json`
3. Create `BrowserWindow` with saved bounds (fallback: 1200×800)
4. Wire `ElectronIPCBridge` to the window
5. Load initial project from CLI argument or last saved project dir
6. Set native application menu
7. Load renderer (Vite dev server URL or packaged HTML)

### Window Configuration

```typescript
const mainWindow = new BrowserWindow({
  width: savedState?.width ?? 1200,
  height: savedState?.height ?? 800,
  x: savedState?.x,
  y: savedState?.y,
  webPreferences: {
    preload: path.join(__dirname, 'preload.js'),
    contextIsolation: true,    // Security: renderer can't access Node.js
    nodeIntegration: false,    // Security: no require() in renderer
  },
});
```

### Native Menu

```
File
├── Open Project…    (CmdOrCtrl+O)  →  bridge.openProject()
├── ─────────────
└── Quit             (CmdOrCtrl+Q)  →  app.quit()

Edit     →  Standard editMenu role (cut/copy/paste/undo/redo)
View     →  Standard viewMenu role (reload/devtools/zoom)
Window   →  Standard windowMenu role (minimize/close)
```

### CLI Argument Support

```bash
# Open project directly
prism-electron /path/to/project

# Packaged: args start at argv[1]
# Dev mode: args start at argv[2] (after electron + entry script)
```

The first valid filesystem path in `argv` is treated as the initial project directory. Falls back to `lastProjectDir` from saved state.

### Window Lifecycle

- `close` event: Save window bounds + current project dir to `prism-window-state.json`
- `closed` event: Dispose `ElectronIPCBridge` (terminates Claude processes)
- `window-all-closed`: Quit on Windows/Linux; stay open on macOS (Darwin convention)
- `activate`: Recreate window on macOS dock click when no windows exist

### DevTools

```typescript
if (!app.isPackaged) {
  mainWindow.webContents.openDevTools();
}
```

DevTools only open in development mode. Production builds suppress them.
