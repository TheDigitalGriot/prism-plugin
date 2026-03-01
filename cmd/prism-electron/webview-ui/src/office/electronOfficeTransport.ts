import type { OfficeTransport } from "@prism-ui/office/transport"

/**
 * Electron office transport adapter.
 *
 * Wires the shared canvas office to Electron's contextBridge IPC:
 * - outgoing office actions → window.electronAPI.officeAction (fire-and-forget)
 * - incoming office messages ← window.electronAPI.officeMessage (returns unsubscribe fn)
 */
function createElectronOfficeTransport(): OfficeTransport {
  if (typeof window !== "undefined" && window.electronAPI) {
    return {
      postMessage: (msg) => {
        window.electronAPI!.officeAction(msg)
      },
      onMessage: (handler) => {
        return window.electronAPI!.officeMessage(handler)
      },
    }
  }

  // Dev fallback when running outside Electron (Vite dev server)
  console.warn("[OfficeTransport] window.electronAPI not available — using dev mock")
  return {
    postMessage: (msg) => {
      console.log("[Office DEV] officeAction:", JSON.stringify(msg, null, 2))
    },
    onMessage: (_handler) => {
      console.log("[Office DEV] officeMessage listener registered (no-op in dev)")
      return () => {}
    },
  }
}

export const electronOfficeTransport: OfficeTransport = createElectronOfficeTransport()
