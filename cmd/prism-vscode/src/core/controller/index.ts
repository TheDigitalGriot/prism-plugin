import * as vscode from "vscode"
import { PrismExtensionState, DEFAULT_PRISM_STATE } from "../../shared/PrismState"
import { WorkflowPhase } from "../../shared/types"
import { registerUnary, registerStream, StreamResponseFn } from "./grpc-handler"
import { WorkflowStateMachine, WorkflowTransition } from "./prism/workflow"
import { StoriesManager } from "./prism/stories"
import { SpectrumEngine, DEFAULT_SPECTRUM_CONFIG, type SpectrumConfig } from "./prism/spectrum"
import { SpectrumRunner, type SpectrumRunnerEventType } from "./prism/spectrum-runner"
import { ProgressFile } from "../../prism/progress"
import { PrismWatcher } from "../../prism/watcher"
import { detectPrismDir, detectStoriesPath } from "../../prism/config"
import { PrismChatMessage } from "../api/types"
import { buildSystemPrompt, SystemPromptContext } from "../prompts/system-prompt"
import { ClaudeRunner, type RunnerOptions } from "../../claude/runner"
import type { ClaudeRunnerEvent, ClaudeStreamEvent } from "../../claude/events"
import { ModeBridge, detectSkillTrigger, type ChatMode } from "./prism/mode-bridge"
import { SKILL_MAP } from "./prism/plugin-bridge"
import { checkClaudeCli } from "../../claude/runner"
import { initPrismDirInWorkspace } from "../../prism/init"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export type PostMessageFn = (message: unknown) => Promise<void>

/**
 * PrismController — central orchestrator for the extension.
 *
 * Manages application state and broadcasts it to all webview subscribers.
 * Integrates the workflow state machine, stories manager, .prism/ watcher,
 * and chat task management.
 */
export class PrismController implements vscode.Disposable {
  private _state: PrismExtensionState
  private _stateSubscribers = new Map<string, StreamResponseFn>()
  private _postMessage: PostMessageFn | null = null
  private _context: vscode.ExtensionContext

  // Prism Core Services
  readonly workflow = new WorkflowStateMachine()
  readonly storiesManager = new StoriesManager()
  private readonly _watcher = new PrismWatcher()
  private readonly _watcherSub: vscode.Disposable

  // Public events for tree providers / status bar
  private readonly _onDidChangeFile = new vscode.EventEmitter<{ type: string }>()
  /** Fires whenever a watched .prism/ file changes (research, plans, stories, etc.). */
  readonly onDidChangePrismFile: vscode.Event<{ type: string }> = this._onDidChangeFile.event

  private readonly _onDidChangeState = new vscode.EventEmitter<void>()
  /** Fires after every state update, letting status bar items re-render. */
  readonly onDidChangeState: vscode.Event<void> = this._onDidChangeState.event

  // Chat / Task management (CLI-based)
  private _chatRunner: ClaudeRunner | null = null
  private _chatMessages: PrismChatMessage[] = []

  // Phase 4: Claude CLI Integration
  private _modeBridge: ModeBridge | undefined

  // Phase 6: Spectrum Execution Engine
  private _spectrumEngine: SpectrumEngine | undefined
  private _spectrumRunner: SpectrumRunner | undefined
  private _spectrumAbort = false

  constructor(context: vscode.ExtensionContext) {
    this._context = context
    this._state = { ...DEFAULT_PRISM_STATE }
    this._watcherSub = this._watcher.onDidChange((event) => {
      void this._onPrismFileChange(event.type)
    })
    this._registerHandlers()

    // Check if Claude CLI exists on startup
    void this._checkClaudeCli()
  }

  dispose(): void {
    this._watcher.dispose()
    this._watcherSub.dispose()
    this._onDidChangeFile.dispose()
    this._onDidChangeState.dispose()
    if (this._modeBridge) {
      this._modeBridge.terminate()
    }
    // Stop Spectrum if running
    this._spectrumAbort = true
    if (this._spectrumRunner) {
      this._spectrumRunner.terminate()
    }
    if (this._spectrumEngine) {
      this._spectrumEngine.dispose()
    }
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

    /** Initialize .prism/ directory from the welcome screen. */
    registerUnary("UiService", "initPrism", async (_message: unknown) => {
      const prismDir = await initPrismDirInWorkspace()
      if (prismDir) {
        await this._detectPrismDir()
      }
      return { ok: !!prismDir }
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

    // -----------------------------------------------------------------------
    // ChatService
    // -----------------------------------------------------------------------

    /** Send a user message and start/continue the AI task. */
    registerUnary(
      "ChatService",
      "sendMessage",
      async (message: unknown) => {
        const { text } = message as { text: string }

        if (!text?.trim()) {
          return { ok: false, error: "Message text is required" }
        }

        const workspaceRoot = this._getWorkspaceRoot()
        if (!workspaceRoot) {
          return { ok: false, error: "No workspace folder open" }
        }

        // ---------------------------------------------------------------
        // Phase 4: Check if message triggers a Prism plugin skill
        // ---------------------------------------------------------------
        const skillTrigger = detectSkillTrigger(text)
        if (skillTrigger) {
          // Route to Plugin Mode via ModeBridge
          if (!this._state.hasClaudeCli) {
            return { ok: false, error: "Claude CLI not found. Install it to use Prism workflow commands." }
          }
          const bridge = this._getOrCreateModeBridge(workspaceRoot)
          void bridge.runPluginSkill(text).catch((err: Error) => {
            console.error("[Prism] Plugin skill error:", err)
          })
          return { ok: true }
        }

        // ---------------------------------------------------------------
        // CLI Mode: interactive chat
        // ---------------------------------------------------------------
        if (!this._state.hasClaudeCli) {
          return { ok: false, error: "Claude CLI not found. Install Claude Code and run 'claude login' to use Prism chat." }
        }

        // Add user message to chat history
        const { v4: uuidv4 } = await import("uuid")
        const userMsg: PrismChatMessage = {
          id: uuidv4(), ts: Date.now(), type: "user", text,
        }
        this._chatMessages = [...this._chatMessages, userMsg]

        // Create streaming assistant message
        const assistantMsg: PrismChatMessage = {
          id: uuidv4(), ts: Date.now(), type: "assistant_text", text: "", isStreaming: true,
        }
        this._chatMessages = [...this._chatMessages, assistantMsg]

        await this.updateState({
          chatMessages: [...this._chatMessages],
          isChatStreaming: true,
          hasActiveTask: true,
        })

        // Build prompt with conversation context
        const systemPrompt = buildSystemPrompt({
          workflowPhase: this._state.workflowPhase,
          workflowContext: this.workflow.context,
          workspaceRoot,
          prismDir: this._state.prismDir,
          hasPrismDir: this._state.hasPrismDir,
          hasStoriesJson: this._state.hasStoriesJson,
        })
        const prompt = this._buildChatPrompt(text, systemPrompt)

        // Run in background via ClaudeRunner
        void this._runChatSession(prompt, workspaceRoot, assistantMsg).catch((err: Error) => {
          console.error("[Prism] Chat session error:", err)
        })

        return { ok: true }
      },
    )

    /** Abort the current streaming task (CLI chat or Plugin mode). */
    registerUnary("ChatService", "abortTask", async () => {
      // Abort Plugin mode if running
      if (this._modeBridge?.isPluginStreaming) {
        this._modeBridge.terminate()
      }
      // Abort CLI chat if running
      if (this._chatRunner) {
        this._chatRunner.terminate()
        this._chatRunner = null
      }
      await this.updateState({
        isChatStreaming: false,
        chatMode: "sdk",
        activePluginSkill: null,
      })
      return { ok: true }
    })

    /** Clear all chat messages (start fresh). */
    registerUnary("ChatService", "clearMessages", async () => {
      // Terminate any running chat session
      if (this._chatRunner) {
        this._chatRunner.terminate()
        this._chatRunner = null
      }
      this._chatMessages = []
      await this.updateState({
        chatMessages: [],
        isChatStreaming: false,
        hasActiveTask: false,
        pendingApprovalToolUseId: undefined,
      })
      return { ok: true }
    })

    /** Approve or deny a pending tool use — no-op with CLI mode (permissions bypassed). */
    registerUnary("ChatService", "approveToolUse", async () => {
      return { ok: true }
    })

    /** Set API key — no-op (using Claude CLI Max subscription now). */
    registerUnary("ChatService", "setApiKey", async () => {
      return { ok: true }
    })

    // -----------------------------------------------------------------------
    // PluginService (Phase 4: Claude CLI Integration)
    // -----------------------------------------------------------------------

    /** Execute a Prism plugin skill via Claude CLI. */
    registerUnary(
      "PluginService",
      "executeSkill",
      async (message: unknown) => {
        const { skillName, args } = message as { skillName: string; args?: string }

        if (!this._state.hasClaudeCli) {
          return { ok: false, error: "Claude CLI not found" }
        }

        const workspaceRoot = this._getWorkspaceRoot()
        if (!workspaceRoot) {
          return { ok: false, error: "No workspace folder open" }
        }

        const bridge = this._getOrCreateModeBridge(workspaceRoot)
        void bridge.runPluginSkill(`/${skillName}${args ? ` ${args}` : ""}`).catch((err: Error) => {
          console.error("[Prism] Plugin skill error:", err)
        })

        return { ok: true }
      },
    )

    /** Terminate the running plugin skill. */
    registerUnary("PluginService", "terminateSkill", async () => {
      if (this._modeBridge) {
        this._modeBridge.terminate()
      }
      return { ok: true }
    })

    /** Check if Claude CLI is available. */
    registerUnary("PluginService", "checkCli", async () => {
      await this._checkClaudeCli()
      return { hasClaudeCli: this._state.hasClaudeCli }
    })

    /** Get the available skill commands. */
    registerUnary("PluginService", "getSkills", async () => {
      return { skills: SKILL_MAP }
    })

    // -----------------------------------------------------------------------
    // SpectrumService (Phase 6: Autonomous Execution)
    // -----------------------------------------------------------------------

    /** Start the Spectrum execution loop. */
    registerUnary("SpectrumService", "start", async (message: unknown) => {
      const msg = (message ?? {}) as { maxIterations?: number; pauseMs?: number }

      if (!this._state.hasClaudeCli) {
        return { ok: false, error: "Claude CLI not found. Install it to use Spectrum." }
      }

      const workspaceRoot = this._getWorkspaceRoot()
      if (!workspaceRoot) {
        return { ok: false, error: "No workspace folder open" }
      }

      if (!this._state.storiesPath) {
        return { ok: false, error: "No stories.json found. Create one with /decompose_plan." }
      }

      if (this._spectrumEngine?.isActive) {
        return { ok: false, error: "Spectrum is already running" }
      }

      const config: Partial<SpectrumConfig> = {
        ...DEFAULT_SPECTRUM_CONFIG,
        ...(msg.maxIterations !== undefined ? { maxIterations: msg.maxIterations } : {}),
        ...(msg.pauseMs !== undefined ? { pauseMs: msg.pauseMs } : {}),
      }

      this._startSpectrumLoop(workspaceRoot, this._state.storiesPath, config)
      return { ok: true }
    })

    /** Pause the Spectrum loop. */
    registerUnary("SpectrumService", "pause", async () => {
      if (!this._spectrumEngine?.isRunning) {
        return { ok: false, error: "Spectrum is not running" }
      }
      this._spectrumEngine.pause()
      await this.updateState({ spectrum: this._spectrumEngine.state })
      return { ok: true }
    })

    /** Resume a paused Spectrum loop. */
    registerUnary("SpectrumService", "resume", async () => {
      if (!this._spectrumEngine?.isPaused) {
        return { ok: false, error: "Spectrum is not paused" }
      }
      const completed = this.storiesManager.completedCount()
      const total = completed + this.storiesManager.remainingCount()
      this._spectrumEngine.resume(completed, total)
      await this.updateState({ spectrum: this._spectrumEngine.state })
      return { ok: true }
    })

    /** Stop the Spectrum loop. */
    registerUnary("SpectrumService", "stop", async () => {
      this._spectrumAbort = true
      if (this._spectrumRunner) {
        this._spectrumRunner.terminate()
      }
      if (this._spectrumEngine) {
        this._spectrumEngine.stop()
        await this.updateState({ spectrum: this._spectrumEngine.state })
      }
      return { ok: true }
    })

    /** Skip the current story and move to the next. */
    registerUnary("SpectrumService", "skipStory", async () => {
      const currentStoryId = this._spectrumEngine?.state.currentStoryId
      if (!currentStoryId || !this._state.storiesPath) {
        return { ok: false, error: "No active story to skip" }
      }
      try {
        await this.storiesManager.markComplete(currentStoryId, "SKIPPED")
        this._spectrumEngine?.addLog("warn", `Skipped story: ${currentStoryId}`)
        if (this._spectrumEngine) {
          await this.updateState({ spectrum: this._spectrumEngine.state })
        }
        return { ok: true }
      } catch (err) {
        return { ok: false, error: String(err) }
      }
    })

    /** Reset Spectrum to idle state. */
    registerUnary("SpectrumService", "reset", async () => {
      this._spectrumAbort = true
      if (this._spectrumRunner) {
        this._spectrumRunner.terminate()
      }
      if (this._spectrumEngine) {
        this._spectrumEngine.reset()
        await this.updateState({ spectrum: this._spectrumEngine.state })
      }
      return { ok: true }
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
    this._onDidChangeFile.fire({ type })
  }

  /** Check if Claude CLI is available on PATH. */
  private async _checkClaudeCli(): Promise<void> {
    const claudePath = await checkClaudeCli()
    await this.updateState({ hasClaudeCli: claudePath !== null })
  }

  /** Lazily create the ModeBridge for hybrid SDK/CLI mode. */
  private _getOrCreateModeBridge(workspaceRoot: string): ModeBridge {
    if (!this._modeBridge) {
      this._modeBridge = new ModeBridge(
        workspaceRoot,
        (messages: PrismChatMessage[], isStreaming: boolean, mode: ChatMode) => {
          void this.updateState({
            chatMessages: messages,
            isChatStreaming: isStreaming,
            chatMode: mode,
            activePluginSkill: this._modeBridge?.activeSkill ?? null,
            hasActiveTask: true,
          })
        },
      )
    } else {
      this._modeBridge.setProjectDir(workspaceRoot)
    }
    return this._modeBridge
  }

  // ---------------------------------------------------------------------------
  // CLI-based interactive chat
  // ---------------------------------------------------------------------------

  /**
   * Run an interactive chat session via ClaudeRunner.
   * Streams clean text from CLI output into the chat UI.
   */
  private async _runChatSession(
    prompt: string,
    workspaceRoot: string,
    assistantMsg: PrismChatMessage,
  ): Promise<void> {
    // Abort any previous chat runner
    if (this._chatRunner) {
      this._chatRunner.terminate()
      this._chatRunner = null
    }

    const runner = new ClaudeRunner()
    this._chatRunner = runner

    runner.on("event", (event: ClaudeRunnerEvent) => {
      // Extract clean text from assistant stream events
      if (event.type === "stream_event") {
        const se = event.event as ClaudeStreamEvent
        if (se.type === "assistant" && se.message) {
          for (const block of se.message.content) {
            if (block.type === "text" && block.text) {
              assistantMsg.text = (assistantMsg.text ?? "") + block.text
            }
          }
          void this.updateState({ chatMessages: [...this._chatMessages] })
        } else if (se.type === "result" && se.result) {
          // Final result — may contain summary text
          if (!assistantMsg.text) {
            assistantMsg.text = se.result
          }
          void this.updateState({ chatMessages: [...this._chatMessages] })
        }
      }

      // Show tool activities in chat (same pattern as ModeBridge)
      if (event.type === "tool_activity") {
        const { v4: uuidv4 } = require("uuid") as typeof import("uuid")
        const toolMsg: PrismChatMessage = {
          id: uuidv4(), ts: Date.now(), type: "tool_use",
          toolName: event.activity.toolName,
          toolInput: { description: event.activity.description },
          toolUseId: uuidv4(),
          needsApproval: false, approved: true,
        }
        // Insert tool message before the streaming assistant message
        const idx = this._chatMessages.indexOf(assistantMsg)
        if (idx >= 0) {
          this._chatMessages.splice(idx, 0, toolMsg)
        } else {
          this._chatMessages.push(toolMsg)
        }
        void this.updateState({ chatMessages: [...this._chatMessages] })
      }
    })

    try {
      const options: RunnerOptions = { projectDir: workspaceRoot }
      await runner.runStreaming(prompt, options)
    } finally {
      assistantMsg.isStreaming = false
      this._chatRunner = null
      await this.updateState({
        chatMessages: [...this._chatMessages],
        isChatStreaming: false,
      })
    }
  }

  /**
   * Build a CLI prompt that includes conversation history as context.
   * Prior messages are encoded as text so the CLI session has context.
   */
  private _buildChatPrompt(currentText: string, systemPrompt: string): string {
    // Collect prior conversation (excluding the just-added user message and assistant placeholder)
    const priorMessages = this._chatMessages.filter(
      m => (m.type === "user" || m.type === "assistant_text") && m.text && !m.isStreaming
    )
    // Exclude the last entry (the current user message we just added)
    const historyMsgs = priorMessages.slice(0, -1)

    if (historyMsgs.length === 0) {
      return `${systemPrompt}\n\n${currentText}`
    }

    const history = historyMsgs.map(m => {
      const role = m.type === "user" ? "User" : "Assistant"
      return `${role}: ${m.text}`
    }).join("\n\n")

    return `${systemPrompt}\n\n## Previous conversation\n${history}\n\n## Current request\n${currentText}`
  }

  // ---------------------------------------------------------------------------
  // Spectrum execution loop
  // ---------------------------------------------------------------------------

  /**
   * Initialize and start the Spectrum autonomous execution loop.
   * Runs in the background — non-blocking.
   */
  private _startSpectrumLoop(
    workspaceRoot: string,
    storiesPath: string,
    config: Partial<SpectrumConfig>,
  ): void {
    // Clean up any previous engine/runner
    if (this._spectrumEngine) {
      this._spectrumEngine.dispose()
    }
    if (this._spectrumRunner) {
      this._spectrumRunner.terminate()
    }

    this._spectrumAbort = false

    // Create fresh engine
    this._spectrumEngine = new SpectrumEngine(config, async (state) => {
      await this.updateState({ spectrum: state })
    })

    // Create fresh runner
    this._spectrumRunner = new SpectrumRunner(workspaceRoot, this.storiesManager)

    // Wire runner events → engine state updates
    this._spectrumRunner.on("event", (event: SpectrumRunnerEventType) => {
      if (!this._spectrumEngine) return
      switch (event.type) {
        case "story_started":
          this._spectrumEngine.setCurrentStory(
            event.storyId,
            this.storiesManager.completedCount(),
            this.storiesManager.completedCount() + this.storiesManager.remainingCount(),
          )
          break
        case "story_complete":
        case "story_blocked":
        case "story_retry":
          this._spectrumEngine.setCurrentStory(
            null,
            this.storiesManager.completedCount(),
            this.storiesManager.completedCount() + this.storiesManager.remainingCount(),
          )
          break
        case "story_error":
          this._spectrumEngine.recordSignal("error", event.error)
          this._spectrumEngine.setCurrentStory(null, 0, 0)
          break
        case "tool_activity":
          this._spectrumEngine.addActivity(event.activity.toolName, event.activity.description)
          break
        case "log":
          this._spectrumEngine.addLog(event.level, event.message)
          break
      }
    })

    // Initialize progress file
    const progressFile = ProgressFile.fromStoriesPath(storiesPath)
    void progressFile.exists().then(async (exists) => {
      if (!exists && this._state.plan) {
        await progressFile.initialize(this._state.plan.name).catch(() => {/* ignore */})
      }
    })
    this._spectrumRunner.setProgressFile(progressFile)

    // Start the engine state
    const completed = this.storiesManager.completedCount()
    const total = completed + this.storiesManager.remainingCount()
    this._spectrumEngine.start(completed, total)

    // Run the loop in background
    void this._runSpectrumLoop(storiesPath).catch((err: Error) => {
      console.error("[Spectrum] Loop error:", err)
      if (this._spectrumEngine) {
        this._spectrumEngine.error(err.message)
        void this.updateState({ spectrum: this._spectrumEngine.state })
      }
    })
  }

  /** The main Spectrum execution loop — runs until done/stopped/error. */
  private async _runSpectrumLoop(storiesPath: string): Promise<void> {
    if (!this._spectrumEngine || !this._spectrumRunner) return

    while (!this._spectrumAbort) {
      const execState = this._spectrumEngine.state.executionState

      // Paused — wait and poll
      if (execState === "paused") {
        await sleep(200)
        continue
      }

      // Not running → exit loop
      if (execState !== "running") break

      // Check iteration cap
      if (!this._spectrumEngine.incrementIteration()) {
        break // engine already set to maxIterations
      }

      // Run one iteration
      const signalType = await this._spectrumRunner.runIteration(storiesPath)
      this._spectrumEngine.recordSignal(signalType, "")

      // Reload stories to reflect updated status
      if (this._state.storiesPath) {
        await this._loadStories(this._state.storiesPath)
      }

      // Check for completion
      if (this.storiesManager.allComplete()) {
        this._spectrumEngine.complete()
        await this.updateState({ spectrum: this._spectrumEngine.state })
        break
      }

      // Check for "no next story" (e.g., all blocked)
      if (signalType === "none") {
        this._spectrumEngine.addLog("warn", "No next story available — all blocked or complete")
        this._spectrumEngine.stop()
        await this.updateState({ spectrum: this._spectrumEngine.state })
        break
      }

      // Check consecutive errors
      if (this._spectrumEngine.hasTooManyErrors()) {
        this._spectrumEngine.error(
          `${this._spectrumEngine.state.consecutiveErrors} consecutive errors exceeded limit`,
        )
        await this.updateState({ spectrum: this._spectrumEngine.state })
        break
      }

      // Pause between iterations
      if (!this._spectrumAbort) {
        await sleep(this._spectrumEngine.config.pauseMs)
      }
    }
  }

  private _getWorkspaceRoot(): string | undefined {
    const folders = vscode.workspace.workspaceFolders
    return folders?.[0]?.uri.fsPath
  }

  /** Remove a state subscriber (called when webview sends grpc_request_cancel). */
  removeSubscriber(requestId: string): void {
    this._stateSubscribers.delete(requestId)
  }

  /** Update partial state and broadcast to all webview subscribers. */
  async updateState(partial: Partial<PrismExtensionState>): Promise<void> {
    this._state = { ...this._state, ...partial }
    await this._broadcastState()
    this._onDidChangeState.fire()
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
