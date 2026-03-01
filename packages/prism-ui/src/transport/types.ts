/**
 * @prism/ui — Webview transport interface.
 *
 * Platform-agnostic abstraction for webview ↔ host communication.
 * Implemented by:
 *   - VSCode: wraps acquireVsCodeApi()
 *   - Electron: wraps window.electronAPI IPC channels
 */
export interface WebviewTransport {
  /** Send a message to the host (extension / main process) */
  postMessage(msg: unknown): void;

  /** Retrieve persisted webview state */
  getState<T>(): T | undefined;

  /** Persist webview state across reloads */
  setState<T>(state: T): void;
}
