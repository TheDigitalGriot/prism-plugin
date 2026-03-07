import { WorkflowPhase } from "./types"
import type { Story, Epic } from "../prism/types"
import type { WorkflowContext } from "../core/controller/prism/workflow"
import type { SpectrumState } from "../core/controller/prism/spectrum"
import type { PrismChatMessage } from "../core/api/types"

/**
 * Extension state broadcast to the webview via StateService.subscribeToState.
 * Serialized as JSON in the grpc_response message.
 */
export interface PrismExtensionState {
  version: string
  /** true once the first real state has been sent to webview */
  didHydrateState: boolean

  // -------------------------------------------------------------------------
  // Workspace detection
  // -------------------------------------------------------------------------
  hasPrismDir: boolean
  hasStoriesJson: boolean
  prismDir: string | undefined
  storiesPath: string | undefined

  // -------------------------------------------------------------------------
  // Workflow phase + context
  // -------------------------------------------------------------------------
  workflowPhase: WorkflowPhase
  workflowContext: WorkflowContext

  // -------------------------------------------------------------------------
  // Stories (loaded from stories.json)
  // -------------------------------------------------------------------------
  stories: Story[]
  epic: Epic | undefined
  completedCount: number
  remainingCount: number

  // -------------------------------------------------------------------------
  // Chat (Phase 3)
  // -------------------------------------------------------------------------
  chatMessages: PrismChatMessage[]
  isChatStreaming: boolean
  /** ID of tool use waiting for approval (if any) */
  pendingApprovalToolUseId: string | undefined
  /** Whether a task is currently active (has chat history) */
  hasActiveTask: boolean

  // -------------------------------------------------------------------------
  // Claude CLI Integration (Phase 4)
  // -------------------------------------------------------------------------
  /** Current chat mode: "sdk" for Agent SDK, "plugin" for CLI-based skills */
  chatMode: "sdk" | "plugin"
  /** The skill currently running in plugin mode (null if SDK mode) */
  activePluginSkill: string | null
  /** Whether the CLI is available on PATH */
  hasClaudeCli: boolean

  // -------------------------------------------------------------------------
  // Spectrum (Phase 6: full execution dashboard)
  // -------------------------------------------------------------------------
  spectrum: SpectrumState

  // -------------------------------------------------------------------------
  // Office (Phase 7: pixel-art office visualization)
  // -------------------------------------------------------------------------
  office: {
    enabled: boolean;
    agentCount: number;
    activeAgents: Array<{
      id: number;
      sessionId?: string;
      storyId?: string;
      storyTitle?: string;
    }>;
  }

  // -------------------------------------------------------------------------
  // Config
  // -------------------------------------------------------------------------
  defaultModel: string
  planningModel: string
}

export const DEFAULT_PRISM_STATE: PrismExtensionState = {
  version: "2.5.0",
  didHydrateState: false,
  hasPrismDir: false,
  hasStoriesJson: false,
  prismDir: undefined,
  storiesPath: undefined,
  workflowPhase: WorkflowPhase.Idle,
  workflowContext: {},
  stories: [],
  epic: undefined,
  completedCount: 0,
  remainingCount: 0,
  chatMessages: [],
  isChatStreaming: false,
  pendingApprovalToolUseId: undefined,
  hasActiveTask: false,
  chatMode: "sdk",
  activePluginSkill: null,
  hasClaudeCli: false,
  spectrum: {
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
  },
  office: { enabled: false, agentCount: 0, activeAgents: [] },
  defaultModel: "sonnet",
  planningModel: "opus",
}
