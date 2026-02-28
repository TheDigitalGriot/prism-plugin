/**
 * Electron transport adapter — drop-in replacement for vscode.ts.
 *
 * Provides the same `postMessage(msg)` interface as the VS Code API singleton,
 * but wires messages through contextBridge-exposed `window.electronAPI`.
 *
 * The re-dispatch pattern: incoming `grpc_response` events from ipcRenderer
 * are re-dispatched as window "message" events so that `grpc-client-base.ts`
 * (which listens to `window.addEventListener("message", ...)`) works unchanged.
 */

export interface ElectronTransportApi {
  postMessage: (message: unknown) => void
}

declare global {
  interface Window {
    electronAPI?: {
      send: (channel: string, data: unknown) => void
      on: (channel: string, cb: (data: unknown) => void) => () => void
      invoke: (channel: string, data?: unknown) => Promise<unknown>
    }
  }
}

function createElectronApi(): ElectronTransportApi {
  if (typeof window !== "undefined" && window.electronAPI) {
    // Subscribe to gRPC responses from the main process and re-dispatch
    // as standard window "message" events so grpc-client-base.ts works unchanged.
    window.electronAPI.on("grpc_response", (data) => {
      window.dispatchEvent(new MessageEvent("message", { data }))
    })

    return {
      postMessage: (message) => {
        const msg = message as {
          type: string
          grpc_request?: unknown
          grpc_request_cancel?: unknown
        }
        if (msg.type === "grpc_request") {
          void window.electronAPI!.invoke("grpc_request", msg.grpc_request)
        } else if (msg.type === "grpc_request_cancel") {
          void window.electronAPI!.invoke("grpc_request_cancel", msg.grpc_request_cancel)
        }
      },
    }
  }

  // Dev fallback (Vite dev server outside Electron)
  console.warn("[Prism] window.electronAPI not available — using dev mock")
  return {
    postMessage: (msg) => {
      console.log("[Prism DEV] electron.postMessage:", JSON.stringify(msg, null, 2))
    },
  }
}

export const electronApi = createElectronApi()
