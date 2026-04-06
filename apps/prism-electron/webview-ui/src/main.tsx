import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "@prism-ui/styles/bridge.css"
import "./index.css"
import { App } from "./App"
import { PrismProviders } from "./Providers"
import { setTransport } from "@prism-ui/services/grpc-client-base"
import { setOfficeTransport } from "@prism-ui/office/transport"
import { electronApi } from "./electron"
import { electronOfficeTransport } from "./office/electronOfficeTransport"

// Register Electron gRPC transport before any gRPC clients initialize.
// electronApi only exposes postMessage; getState/setState are no-ops in Electron.
setTransport({
  postMessage: (msg) => electronApi.postMessage(msg),
  getState: () => undefined,
  setState: () => {},
})

// Register Electron office transport before OfficeApp renders.
// Routes canvas office ↔ IPC through contextBridge office channels.
setOfficeTransport(electronOfficeTransport)

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
