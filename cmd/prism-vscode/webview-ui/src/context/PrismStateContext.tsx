import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react"
import { StateServiceClient, UiServiceClient } from "../services/grpc-client"

// ---------------------------------------------------------------------------
// State shape (mirrors PrismExtensionState from extension host)
// ---------------------------------------------------------------------------

export type WorkflowPhase = "idle" | "research" | "plan" | "implement" | "validate"

export interface PrismExtensionState {
  version: string
  didHydrateState: boolean
  hasPrismDir: boolean
  hasStoriesJson: boolean
  prismDir: string | undefined
  storiesPath: string | undefined
  workflowPhase: WorkflowPhase
  defaultModel: string
  planningModel: string
}

const DEFAULT_STATE: PrismExtensionState = {
  version: "2.1.8",
  didHydrateState: false,
  hasPrismDir: false,
  hasStoriesJson: false,
  prismDir: undefined,
  storiesPath: undefined,
  workflowPhase: "idle",
  defaultModel: "sonnet",
  planningModel: "opus",
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface PrismStateContextValue extends PrismExtensionState {
  /** Whether we've received the first real state from the extension. */
  isHydrated: boolean
}

const PrismStateContext = createContext<PrismStateContextValue | undefined>(undefined)

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export const PrismStateContextProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [state, setState] = useState<PrismExtensionState>(DEFAULT_STATE)
  const unsubscribeRef = useRef<(() => void) | null>(null)

  const handleStateResponse = useCallback((response: { stateJson: string }) => {
    try {
      const parsed = JSON.parse(response.stateJson) as PrismExtensionState
      setState(parsed)
    } catch (err) {
      console.error("[Prism] Failed to parse state JSON:", err)
    }
  }, [])

  useEffect(() => {
    // 1. Subscribe to streaming state updates
    unsubscribeRef.current = StateServiceClient.subscribeToState({
      onResponse: handleStateResponse,
      onError: (err) => console.error("[Prism] State subscription error:", err),
      onComplete: () => console.log("[Prism] State subscription ended"),
    })

    // 2. Trigger workspace detection on the extension host
    UiServiceClient.initializeWebview().catch((err) => {
      console.error("[Prism] initializeWebview failed:", err)
    })

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current()
        unsubscribeRef.current = null
      }
    }
  }, [handleStateResponse])

  const value: PrismStateContextValue = {
    ...state,
    isHydrated: state.didHydrateState,
  }

  return <PrismStateContext.Provider value={value}>{children}</PrismStateContext.Provider>
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export const usePrismState = (): PrismStateContextValue => {
  const context = useContext(PrismStateContext)
  if (!context) {
    throw new Error("usePrismState must be used inside <PrismStateContextProvider>")
  }
  return context
}
