import * as vscode from "vscode"
import { BasePrismController } from "@prism-core/core/controller/BasePrismController"
import type { AgentSessionData, UpdatedStoryData } from "@prism-core/core/controller/types"

// ---------------------------------------------------------------------------
// PrismController — VSCode platform shell
// ---------------------------------------------------------------------------

/**
 * PrismController wraps BasePrismController for VSCode.
 *
 * - Implements _getWorkspaceRoot() using vscode.workspace.workspaceFolders
 * - Overrides _onAfterDetectPrismDir() to set vscode context keys
 * - Wraps Node.js EventEmitter events into vscode.EventEmitter for tree/status providers
 */
export class PrismController extends BasePrismController implements vscode.Disposable {
  // Public vscode.EventEmitter wrappers (consumed by tree providers and status bar)
  private readonly _onDidChangeFile = new vscode.EventEmitter<{ type: string }>()
  /** Fires whenever a watched .prism/ file changes. */
  readonly onDidChangePrismFile: vscode.Event<{ type: string }> = this._onDidChangeFile.event

  private readonly _onDidChangeState = new vscode.EventEmitter<void>()
  /** Fires after every state update. */
  readonly onDidChangeState: vscode.Event<void> = this._onDidChangeState.event

  private readonly _onDidStartSession = new vscode.EventEmitter<AgentSessionData>()
  /** Fires when a Prism-managed Claude session starts. */
  readonly onDidStartSession: vscode.Event<AgentSessionData> = this._onDidStartSession.event

  private readonly _onDidUpdateStory = new vscode.EventEmitter<UpdatedStoryData>()
  /** Fires when the active Spectrum story changes. */
  readonly onDidUpdateStory: vscode.Event<UpdatedStoryData> = this._onDidUpdateStory.event

  private readonly _onDidEndSpectrumStory = new vscode.EventEmitter<{ sessionId: string }>()
  /** Fires when a Spectrum story finishes. */
  readonly onDidEndSpectrumStory: vscode.Event<{ sessionId: string }> = this._onDidEndSpectrumStory.event

  constructor(_context: vscode.ExtensionContext) {
    super()

    // Wrap Node.js EventEmitter events → vscode.EventEmitter for consumers
    this.on("fileChange", (data) => this._onDidChangeFile.fire(data))
    this.on("stateChange", () => this._onDidChangeState.fire())
    this.on("sessionStart", (data) => this._onDidStartSession.fire(data))
    this.on("storyUpdate", (data) => this._onDidUpdateStory.fire(data))
    this.on("spectrumStoryEnd", (data) => this._onDidEndSpectrumStory.fire(data))
  }

  dispose(): void {
    super.dispose()
    this._onDidChangeFile.dispose()
    this._onDidChangeState.dispose()
    this._onDidStartSession.dispose()
    this._onDidUpdateStory.dispose()
    this._onDidEndSpectrumStory.dispose()
  }

  // ---------------------------------------------------------------------------
  // BasePrismController abstract implementations
  // ---------------------------------------------------------------------------

  protected _getWorkspaceRoot(): string | undefined {
    const folders = vscode.workspace.workspaceFolders
    return folders?.[0]?.uri.fsPath
  }

  protected override async _onAfterDetectPrismDir(
    hasPrismDir: boolean,
    hasStoriesJson: boolean,
  ): Promise<void> {
    await vscode.commands.executeCommand("setContext", "prism.hasPrismDir", hasPrismDir)
    await vscode.commands.executeCommand("setContext", "prism.hasStoriesJson", hasStoriesJson)
  }
}

// Re-export PostMessageFn for consumers that import from this file
export type { PostMessageFn } from "@prism-core/core/controller/types"
