/**
 * Preload script — exposes electronAPI to the renderer via contextBridge.
 *
 * Provides the same postMessage/on/invoke interface that the React app uses
 * to communicate with the main process over IPC. The grpc-client-base.ts
 * in webview-ui will use this API as its transport layer.
 */

import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  /** Send a fire-and-forget message to the main process. */
  send: (channel: string, data: unknown) => {
    ipcRenderer.send(channel, data);
  },

  /**
   * Register a listener for messages from the main process.
   * Returns an unsubscribe function.
   */
  on: (channel: string, cb: (data: unknown) => void) => {
    const wrapped = (_: Electron.IpcRendererEvent, data: unknown) => cb(data);
    ipcRenderer.on(channel, wrapped);
    return () => ipcRenderer.removeListener(channel, wrapped);
  },

  /** Invoke a main-process handler and await the result. */
  invoke: (channel: string, data?: unknown) => ipcRenderer.invoke(channel, data),

  // ── Office-specific convenience methods ──────────────────────────────────

  /**
   * Subscribe to office messages pushed from the main process.
   * Returns an unsubscribe function.
   */
  officeMessage: (callback: (msg: unknown) => void) => {
    const wrapped = (_: Electron.IpcRendererEvent, msg: unknown) => callback(msg);
    ipcRenderer.on('office:message', wrapped);
    return () => ipcRenderer.removeListener('office:message', wrapped);
  },

  /**
   * Send an office action to the main process (fire-and-forget).
   */
  officeAction: (msg: unknown) => {
    ipcRenderer.send('office:action', msg);
  },
});

// Extend Window type for TypeScript
declare global {
  interface Window {
    electronAPI: {
      send: (channel: string, data: unknown) => void;
      on: (channel: string, cb: (data: unknown) => void) => () => void;
      invoke: (channel: string, data?: unknown) => Promise<unknown>;
      officeMessage: (callback: (msg: unknown) => void) => () => void;
      officeAction: (msg: unknown) => void;
      // Auth channels (Phase 19) — via invoke('prism:getApiKey') etc.
    };
  }
}
