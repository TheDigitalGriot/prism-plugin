import * as vscode from "vscode"
import { PrismExtensionState, DEFAULT_PRISM_STATE } from "../../shared/PrismState"
import { WorkflowPhase } from "../../shared/types"
import { registerUnary, registerStream, StreamResponseFn } from "./grpc-handler"
import { WorkflowStateMachine, WorkflowTransition } from "./prism/workflow"
import { StoriesManager } from "./prism/stories"
import { PrismWatcher } from "../../prism/watcher"
import { detectPrismDir, detectStoriesPath } from "../../prism/config"

export type PostMessageFn = (message: unknown) => Promise<void>

/**
 * PrismController — central orchestrator for the extension.
 *
 * Manages application state and broadcasts it to all webview subscribers.
 * Integrates the workflow state machine, stories manager, and .prism/ watcher.
 */
export class PrismController implements vscode.Disposable {
  private _state: PrismExtensionState
  private _stateSubscribers = new Map<string, StreamResponseFn>()
  private _postMessage: PostMessageFn | null = null

  // Prism Core Services
  readonly workflow = new WorkflowStateMachine()
  readonly storiesManager = new StoriesManager()
  private readonly _watcher = new PrismWatcher()
  private readonly _watcherSub: vscode.Disposable

  constructor() {
    this._state = { ...DEFAULT_PRISM_STATE }
    this._watcherSub = this._watcher.onDidChange((event) => {
      void this._onPrismFileChange(event.type)
    })
    this._registerHandlers()
  }

  dispose(): void {
    this._watcher.dispose()
    this._watcherSub.dispose()
  }

  /** Called once by VscodeWebviewProvider after webview resolves. */
  setPostMessageFn(fn: PostMessageFn): void {
    this._postMessage = fn
  }

  get state(): PrismExtensionState {
    return this._state
  }

  /** Register all gRPC service handlers. */
  private _registerHandlers(): void {
    // -----------------------------------------------------------------------
    // StateService
    // -----------------------------------------------------------------------

    /** Streaming subscription: sends state now and on every future update. */
    registerStream(
      "StateService",
      "subscribeToState",
      async (_message: unknown, respond: StreamResponseFn, requestId: string) => {
        // Store subscriber for future pushes
        this._stateSubscribers.set(requestId, respond)

        // Immediately send current state (marks didHydrateState = true)
        const hydratedState: PrismExtensionState = { ...this._state, didHydrateState: true }
        await respond({ stateJson: JSON.stringify(hydratedState) })
      },
    )

    /** Unary: get current state once. */
    registerUnary("StateService", "getState", async (_message: unknown) => {
      const hydratedState: PrismExtensionState = { ...this._state, didHydrateState: true }
      return { stateJson: JSON.stringify(hydratedState) }
    })

    // -----------------------------------------------------------------------
    // UiService
    // -----------------------------------------------------------------------

    /** Initialize webview: sent on mount to kick off state subscription. */
    registerUnary("UiService", "initializeWebview", async (_message: unknown) => {
      await this._detectPrismDir()
      return { ok: true }
    })

    // -----------------------------------------------------------------------
    // WorkflowService
    // -----------------------------------------------------------------------

    /** Attempt a workflow phase transition. */
    registerUnary(
      "WorkflowService",
      "transition",
      async (message: unknown) => {
        const { transition } = message as { transition: WorkflowTransition }
        const result = this.workflow.transition(transition)
        if (result.ok && result.newPhase !== undefined) {
          await this.updateState({
            workflowPhase: result.newPhase,
            workflowContext: this.workflow.context,
          })
        }
        return result
      },
    )

    /** Get available transitions from the current phase. */
    registerUnary("WorkflowService", "getAvailableTransitions", async () => {
      return { transitions: this.workflow.availableTransitions() }
    })
  }

  // ---------------------------------------------------------------------------
  // .prism/ detection + watcher
  // ---------------------------------------------------------------------------

  /** Detect .prism/ directory in the current workspace and start watching. */
  async _detectPrismDir(): Promise<void> {
    const workspaceFolders = vscode.workspace.workspaceFolders
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return
    }

    const prismDir = await detectPrismDir()
    const hasPrismDir = prismDir !== undefined
    let hasStoriesJson = false
    let storiesPath: string | undefined

    if (prismDir) {
      storiesPath = await detectStoriesPath(prismDir)
      hasStoriesJson = storiesPath !== undefined
      this._watcher.start(prismDir)
      if (storiesPath) {
        await this._loadStories(storiesPath)
      }
    }

    await this.updateState({ hasPrismDir, hasStoriesJson, prismDir, storiesPath })
    await vscode.commands.executeCommand("setContext", "prism.hasPrismDir", hasPrismDir)
    await vscode.commands.executeCommand("setContext", "prism.hasStoriesJson", hasStoriesJson)
  }

  private async _loadStories(storiesPath: string): Promise<void> {
    try {
      const sf = await this.storiesManager.load(storiesPath)
      await this.updateState({
        stories: sf.stories,
        plan: sf.plan,
        completedCount: this.storiesManager.completedCount(),
        remainingCount: this.storiesManager.remainingCount(),
      })
    } catch (err) {
      console.error("[Prism] Failed to load stories:", err)
    }
  }

  private async _onPrismFileChange(
    type: "stories" | "research" | "plans" | "validation" | "spectrum" | "other",
  ): Promise<void> {
    if (type === "stories" && this._state.storiesPath) {
      await this._loadStories(this._state.storiesPath)
    }
  }

  /** Remove a state subscriber (called when webview sends grpc_request_cancel). */
  removeSubscriber(requestId: string): void {
    this._stateSubscribers.delete(requestId)
  }

  /** Update partial state and broadcast to all webview subscribers. */
  async updateState(partial: Partial<PrismExtensionState>): Promise<void> {
    this._state = { ...this._state, ...partial }
    await this._broadcastState()
  }

  /** Set workflow phase (force) and broadcast. */
  async setPhase(phase: WorkflowPhase): Promise<void> {
    this.workflow.setPhase(phase)
    await this.updateState({ workflowPhase: phase, workflowContext: this.workflow.context })
  }

  /** Push current state to all subscribed webview clients. */
  private async _broadcastState(): Promise<void> {
    const hydratedState: PrismExtensionState = { ...this._state, didHydrateState: true }
    const stateJson = JSON.stringify(hydratedState)

    const deadSubscribers: string[] = []

    for (const [requestId, respond] of this._stateSubscribers) {
      try {
        await respond({ stateJson })
      } catch (err) {
        console.error(`[Prism] Failed to push state to subscriber ${requestId}:`, err)
        deadSubscribers.push(requestId)
      }
    }

    // Clean up dead subscribers
    for (const id of deadSubscribers) {
      this._stateSubscribers.delete(id)
    }
  }
}
