# Research: Electron IPC Patterns for Update Communication

**Date**: 2026-02-14
**Topic**: IPC architecture for communicating update events between main and renderer

## Current IPC Setup

The project uses a basic preload script with no existing IPC channels. The preload file is configured in `main.ts` at line 16 via `webPreferences.preload`.

### Existing Preload
The preload script is minimal — no contextBridge usage yet.

## IPC Channel Patterns

### Pattern 1: Direct ipcMain/ipcRenderer
```typescript
// Main process
ipcMain.handle('check-for-update', async () => { ... });

// Renderer (via preload)
const result = await window.electronAPI.checkForUpdate();
```

### Pattern 2: Event-Driven with ipcMain.on
```typescript
// Main → Renderer (push events)
mainWindow.webContents.send('update-available', info);
mainWindow.webContents.send('download-progress', progress);
mainWindow.webContents.send('update-downloaded', info);

// Renderer → Main (user actions)
ipcRenderer.send('install-update');
ipcRenderer.send('skip-version', version);
```

### Pattern 3: Invoke/Handle for Request-Response
Best for user-initiated actions (check for update, install, skip).

### Pattern 4: Send/On for Push Notifications
Best for main-to-renderer events (update available, progress, errors).

## Recommended Approach

Combine patterns 3 and 4:
- Use `ipcMain.handle` + `ipcRenderer.invoke` for user actions
- Use `webContents.send` + `ipcRenderer.on` for update lifecycle events
- Define all channels as typed constants for safety

## Security Considerations

- Never expose `ipcRenderer` directly to the renderer
- Use `contextBridge.exposeInMainWorld` exclusively
- Validate all data crossing the IPC boundary
- Keep preload script minimal — only expose necessary APIs
