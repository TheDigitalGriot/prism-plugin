# Electron IPC Security Best Practices

## Context Isolation

Always enable context isolation (default in Electron 12+):
```typescript
webPreferences: {
  contextIsolation: true,
  nodeIntegration: false,
  preload: path.join(__dirname, 'preload.js')
}
```

## contextBridge Pattern

```typescript
// preload.ts
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // Invoke pattern (request/response)
  checkForUpdate: () => ipcRenderer.invoke('check-for-update'),

  // Send pattern (fire-and-forget)
  installUpdate: () => ipcRenderer.send('install-update'),

  // Receive pattern (main → renderer)
  onUpdateAvailable: (callback: (info: UpdateInfo) => void) => {
    ipcRenderer.on('update-available', (_event, info) => callback(info));
  }
});
```

## Channel Validation

Always validate IPC channels in the main process:
```typescript
const ALLOWED_CHANNELS = ['check-for-update', 'install-update', 'skip-version'];

ipcMain.handle('check-for-update', async (event) => {
  // Validate sender
  if (event.senderFrame.url !== expectedURL) return;
  // ... handle
});
```

## Never Do
- Never expose `ipcRenderer` directly
- Never use `remote` module
- Never disable `contextIsolation`
- Never enable `nodeIntegration` in renderer
