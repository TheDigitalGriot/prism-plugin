import { WorkflowPhase } from "./types"

/**
 * Extension state broadcast to the webview via StateService.subscribeToState.
 * Serialized as JSON in the grpc_response message.
 */
export interface PrismExtensionState {
  version: string
  /** true once the first real state has been sent to webview */
  didHydrateState: boolean

  // Workspace detection
  hasPrismDir: boolean
  hasStoriesJson: boolean
  prismDir: string | undefined
  storiesPath: string | undefined

  // Workflow
  workflowPhase: WorkflowPhase

  // Config
  defaultModel: string
  planningModel: string
}

export const DEFAULT_PRISM_STATE: PrismExtensionState = {
  version: "2.1.8",
  didHydrateState: false,
  hasPrismDir: false,
  hasStoriesJson: false,
  prismDir: undefined,
  storiesPath: undefined,
  workflowPhase: WorkflowPhase.Idle,
  defaultModel: "sonnet",
  planningModel: "opus",
}
