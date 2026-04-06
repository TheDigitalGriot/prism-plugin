import React from "react"
import { PrismStateContextProvider } from "@prism-ui/context/PrismStateContext"
import { LayoutProvider } from "./context/LayoutContext"

/**
 * Root provider hierarchy for the Prism webview.
 *
 * Add new global providers here as the app grows.
 * Order matters — outer providers are available to inner providers.
 */
export const PrismProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <PrismStateContextProvider>
      <LayoutProvider>{children}</LayoutProvider>
    </PrismStateContextProvider>
  )
}
