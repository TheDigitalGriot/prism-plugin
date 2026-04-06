/**
 * PrismTask runtime flags — track the current execution state of a task.
 */

export interface TaskState {
  /** True while Claude is generating a response. */
  isStreaming: boolean
  /** True if the task has been aborted by the user. */
  isAborted: boolean
  /** True if the task reached attempt_completion. */
  isComplete: boolean
  /** Tracks whether we're waiting for user approval on a tool. */
  pendingApprovalToolUseId: string | undefined
  /** Current token usage. */
  totalInputTokens: number
  totalOutputTokens: number
}

export function createInitialTaskState(): TaskState {
  return {
    isStreaming: false,
    isAborted: false,
    isComplete: false,
    pendingApprovalToolUseId: undefined,
    totalInputTokens: 0,
    totalOutputTokens: 0,
  }
}
