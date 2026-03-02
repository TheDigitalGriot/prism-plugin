---
title: Preload & Context Bridge
description: The preload script, contextBridge API surface, and type declarations for the Electron renderer.
outline: [2, 3]
---

# Preload & Context Bridge

## `src/preload.ts`

The preload script runs in a privileged context between main and renderer. It exposes a minimal, safe API via `contextBridge`:

```typescript
contextBridge.exposeInMainWorld('electronAPI', {
  send:   (channel: string, data: unknown) => ipcRenderer.send(channel, data),
  on:     (channel: string, cb: (data: unknown) => void) => {
    const wrapped = (_: Electron.IpcRendererEvent, data: unknown) => cb(data);
    ipcRenderer.on(channel, wrapped);
    return () => ipcRenderer.removeListener(channel, wrapped);
  },
  invoke: (channel: string, data?: unknown) => ipcRenderer.invoke(channel, data),
});
```

## API Surface

| Method | Pattern | Usage |
|--------|---------|-------|
| `send(channel, data)` | Fire-and-forget | Rarely used in Prism |
| `on(channel, callback)` | Listen for events | `grpc_response` stream from main |
| `invoke(channel, data)` | Request-response | `grpc_request`, `prism:openProject`, `shell:openExternal`, etc. |
| `officeMessage(callback)` | Listen for events | Subscribe to office messages from main process |
| `officeAction(msg)` | Fire-and-forget | Send office actions to main process |

## Type Declaration

```typescript
declare global {
  interface Window {
    electronAPI: {
      send: (channel: string, data: unknown) => void;
      on: (channel: string, cb: (data: unknown) => void) => () => void;
      invoke: (channel: string, data?: unknown) => Promise<unknown>;
      officeMessage: (callback: (data: unknown) => void) => () => void;
      officeAction: (msg: unknown) => void;
    };
  }
}
```
