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

export type PrismMessageType =
  | "user"
  | "assistant_text"
  | "tool_use"
  | "tool_result"
  | "completion"
  | "error"

export interface PrismChatMessage {
  id: string
  ts: number
  type: PrismMessageType
  text?: string
  isStreaming?: boolean
  toolName?: string
  toolInput?: Record<string, unknown>
  toolUseId?: string
  needsApproval?: boolean
  approved?: boolean
  toolResult?: string
  isToolError?: boolean
  completionText?: string
  errorText?: string
}

// ---------------------------------------------------------------------------
// Spectrum types (mirrors src/core/controller/prism/spectrum.ts)
// ---------------------------------------------------------------------------

export type SpectrumExecutionState =
  | "idle"
  | "running"
  | "paused"
  | "complete"
  | "maxIterations"
  | "error"

export interface SpectrumLogEntry {
  ts: number
  level: "info" | "warn" | "error"
  message: string
}

export interface SpectrumActivity {
  toolName: string
  description: string
  ts: number
}

export interface PrismSpectrumState {
  executionState: SpectrumExecutionState
  currentIteration: number
  maxIterations: number
  currentStoryId: string | null
  progress: number
  elapsedMs: number
  startedAt: number | null
  consecutiveErrors: number
  lastSignalType: string
  lastSignalContent: string
  recentActivities: SpectrumActivity[]
  logs: SpectrumLogEntry[]
}

// ---------------------------------------------------------------------------
// Story types (mirrors src/prism/stories.ts)
// ---------------------------------------------------------------------------

export interface PrismStory {
  id: string
  title: string
  description: string
  priority: number
  status: string
  blockedBy: string | null
  files: Array<{ path: string; action: string }>
  steps: Array<{ description: string; done: boolean }>
  completedAt?: string
  commitHash?: string
}

export interface PrismPlan {
  name: string
  source: string
  qualityGates: string[]
}

// ---------------------------------------------------------------------------
// Extension state
// ---------------------------------------------------------------------------

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
  // Stories
  stories: PrismStory[]
  plan: PrismPlan | undefined
  completedCount: number
  remainingCount: number
  // Chat
  chatMessages: PrismChatMessage[]
  isChatStreaming: boolean
  pendingApprovalToolUseId: string | undefined
  hasActiveTask: boolean
  // CLI
  chatMode: "sdk" | "plugin"
  activePluginSkill: string | null
  hasClaudeCli: boolean
  // Spectrum
  spectrum: PrismSpectrumState
}

const DEFAULT_SPECTRUM_STATE: PrismSpectrumState = {
  executionState: "idle",
  currentIteration: 0,
  maxIterations: 50,
  currentStoryId: null,
  progress: 0,
  elapsedMs: 0,
  startedAt: null,
  consecutiveErrors: 0,
  lastSignalType: "none",
  lastSignalContent: "",
  recentActivities: [],
  logs: [],
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
  stories: [],
  plan: undefined,
  completedCount: 0,
  remainingCount: 0,
  chatMessages: [],
  isChatStreaming: false,
  pendingApprovalToolUseId: undefined,
  hasActiveTask: false,
  chatMode: "sdk",
  activePluginSkill: null,
  hasClaudeCli: false,
  spectrum: DEFAULT_SPECTRUM_STATE,
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
