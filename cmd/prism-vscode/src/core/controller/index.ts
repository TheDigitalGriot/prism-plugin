import * as vscode from "vscode"
import { PrismExtensionState, DEFAULT_PRISM_STATE } from "../../shared/PrismState"
import { WorkflowPhase } from "../../shared/types"
import { registerUnary, registerStream, StreamResponseFn } from "./grpc-handler"

export type PostMessageFn = (message: unknown) => Promise<void>

/**
 * PrismController — central orchestrator for the extension.
 *
 * Manages application state and broadcasts it to all webview subscribers.
 * Registers gRPC service handlers on construction.
 */
export class PrismController {
  private _state: PrismExtensionState
  private _stateSubscribers = new Map<string, StreamResponseFn>()
  private _postMessage: PostMessageFn | null = null

  constructor() {
    this._state = { ...DEFAULT_PRISM_STATE }
    this._registerHandlers()
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

    /** Initialize webview: webview sends this on mount to kick off state subscription. */
    registerUnary("UiService", "initializeWebview", async (_message: unknown) => {
      // Detect workspace .prism/ on webview init
      await this._detectPrismDir()
      return { ok: true }
    })
  }

  /** Detect .prism/ directory in the current workspace. */
  async _detectPrismDir(): Promise<void> {
    const workspaceFolders = vscode.workspace.workspaceFolders
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return
    }

    const rootUri = workspaceFolders[0].uri
    const prismDirUri = vscode.Uri.joinPath(rootUri, ".prism")
    const storiesUri = vscode.Uri.joinPath(prismDirUri, "stories", "stories.json")

    let hasPrismDir = false
    let hasStoriesJson = false
    let prismDir: string | undefined
    let storiesPath: string | undefined

    try {
      await vscode.workspace.fs.stat(prismDirUri)
      hasPrismDir = true
      prismDir = prismDirUri.fsPath
    } catch {
      // .prism/ does not exist
    }

    if (hasPrismDir) {
      try {
        await vscode.workspace.fs.stat(storiesUri)
        hasStoriesJson = true
        storiesPath = storiesUri.fsPath
      } catch {
        // stories.json does not exist
      }
    }

    await this.updateState({ hasPrismDir, hasStoriesJson, prismDir, storiesPath })

    // Update VS Code context keys
    await vscode.commands.executeCommand("setContext", "prism.hasPrismDir", hasPrismDir)
    await vscode.commands.executeCommand("setContext", "prism.hasStoriesJson", hasStoriesJson)
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

  /** Set workflow phase and broadcast. */
  async setPhase(phase: WorkflowPhase): Promise<void> {
    await this.updateState({ workflowPhase: phase })
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
