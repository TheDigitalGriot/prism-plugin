import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "./index.css"
import { App } from "./App"
import { PrismProviders } from "./Providers"

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
