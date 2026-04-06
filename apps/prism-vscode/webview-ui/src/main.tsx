import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "@prism-ui/styles/bridge.css"
import "./index.css"
import { App } from "./App"
import { PrismProviders } from "./Providers"
import { setTransport } from "@prism-ui/services/grpc-client-base"
import { vscodeApi } from "./vscode"
import type { WebviewTransport } from "@prism-ui/transport/types"

// Register VS Code transport before any gRPC clients initialize.
// Cast is safe: vscodeApi's postMessage/getState/setState match the interface shape.
setTransport(vscodeApi as unknown as WebviewTransport)

const rootElement = document.getElementById("root")
if (!rootElement) {
  throw new Error("[Prism] #root element not found")
}

createRoot(rootElement).render(
  <StrictMode>
    <PrismProviders>
      <App />
    </PrismProviders>
  </StrictMode>,
)
