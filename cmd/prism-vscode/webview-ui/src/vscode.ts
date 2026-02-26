/**
 * VS Code API singleton.
 *
 * `acquireVsCodeApi()` may only be called once per webview lifetime.
 * This module exports a stable reference to the API object.
 *
 * In development mode (Vite dev server outside VS Code), falls back to a
 * mock that logs messages to the console.
 */

interface VsCodeApi {
  postMessage(message: unknown): void
  getState(): unknown
  setState(state: unknown): void
}

declare function acquireVsCodeApi(): VsCodeApi

function createMockApi(): VsCodeApi {
  return {
    postMessage: (msg: unknown) => {
      console.log("[Prism DEV] vscode.postMessage:", JSON.stringify(msg, null, 2))
    },
    getState: () => ({}),
    setState: (_state: unknown) => {},
  }
}

let _api: VsCodeApi | null = null

function getApi(): VsCodeApi {
  if (_api) return _api

  try {
    _api = acquireVsCodeApi()
  } catch {
    console.warn("[Prism] acquireVsCodeApi not available — using dev mock")
    _api = createMockApi()
  }

  return _api
}

export const vscodeApi = getApi()
