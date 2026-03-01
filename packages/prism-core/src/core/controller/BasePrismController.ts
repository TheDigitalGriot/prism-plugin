/**
 * BasePrismController — shared orchestration logic for VSCode and Electron.
 *
 * Extends Node.js EventEmitter so platform subclasses can wrap events into
 * their own event systems (vscode.EventEmitter, IPC, etc.).
 *
 * Abstract methods:
 *   _getWorkspaceRoot() — platform provides the project directory
 *
 * Protected hook:
 *   _onAfterDetectPrismDir() — override to run platform-specific logic
 *     (e.g. VSCode setContext calls) after .prism/ is detected.
 */

import * as path from "path"
import { EventEmitter } from "events"
import { v4 as uuidv4 } from "uuid"

import { PrismExtensionState, DEFAULT_PRISM_STATE } from "../../shared/PrismState"
import { WorkflowPhase } from "../../shared/types"
import { registerUnary, registerStream, StreamResponseFn } from "./grpc-handler"
import { WorkflowStateMachine, WorkflowTransition } from "./prism/workflow"
import { StoriesManager } from "./prism/stories"
import { SpectrumEngine, DEFAULT_SPECTRUM_CONFIG, type SpectrumConfig } from "./prism/spectrum"
import { SpectrumRunner, type SpectrumRunnerEventType } from "./prism/spectrum-runner"
import { ProgressFile } from "../../prism/progress"
import { PrismWatcher, type PrismFileChangeEvent } from "../../prism/watcher"
import { detectPrismDir, detectStoriesPath } from "../../prism/config"
import { initPrismDir } from "../../prism/init"
import { PrismChatMessage } from "../api/types"
import { buildSystemPrompt } from "../prompts/system-prompt"
import { ClaudeRunner, checkClaudeCli, type RunnerOptions } from "../../claude/runner"
import type { ClaudeRunnerEvent, ClaudeStreamEvent } from "../../claude/events"
import { ModeBridge, detectSkillTrigger, type ChatMode } from "./prism/mode-bridge"
import { SKILL_MAP } from "./prism/plugin-bridge"
import { AgentBridge } from "../../office/agentBridge"

import type { PostMessageFn, AgentSessionData, UpdatedStoryData } from "./types"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ---------------------------------------------------------------------------
// BasePrismController
// ---------------------------------------------------------------------------

/**
 * Abstract base class for platform-specific Prism controllers.
 *
 * Handles all gRPC handler registration, state management, chat/spectrum
 * execution, and file watching. Platform subclasses only implement:
 *   - _getWorkspaceRoot() — how to find the project directory
 *   - _onAfterDetectPrismDir() — post-detection side effects (optional)
 */
export abstract class BasePrismController extends EventEmitter {
  protected _state: PrismExtensionState
  protected _stateSubscribers = new Map<string, StreamResponseFn>()
  protected _postMessage: PostMessageFn | null = null

  // Prism Core Services
  readonly workflow = new WorkflowStateMachine()
  readonly storiesManager = new StoriesManager()
  protected readonly _watcher = new PrismWatcher()

  // Chat / Task management
  protected _chatRunner: ClaudeRunner | null = null
  protected _chatMessages: PrismChatMessage[] = []

  // Mode bridge for hybrid CLI/plugin mode
  protected _modeBridge: ModeBridge | undefined

  // Spectrum execution engine
  protected _spectrumEngine: SpectrumEngine | undefined
  protected _spectrumRunner: SpectrumRunner | undefined
  protected _spectrumAbort = false

  // Agent Bridge — connects Prism sessions to Office agents
  readonly agentBridge = new AgentBridge()

  // ---------------------------------------------------------------------------
  // Typed EventEmitter overloads
  // ---------------------------------------------------------------------------

  emit(event: "fileChange", data: { type: string }): boolean
  emit(event: "stateChange"): boolean
  emit(event: "sessionStart", data: AgentSessionData): boolean
  emit(event: "storyUpdate", data: UpdatedStoryData): boolean
  emit(event: "spectrumStoryEnd", data: { sessionId: string }): boolean
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  emit(event: string | symbol, ...args: any[]): boolean {
    return super.emit(event, ...args)
  }

  on(event: "fileChange", listener: (data: { type: string }) => void): this
  on(event: "stateChange", listener: () => void): this
  on(event: "sessionStart", listener: (data: AgentSessionData) => void): this
  on(event: "storyUpdate", listener: (data: UpdatedStoryData) => void): this
  on(event: "spectrumStoryEnd", listener: (data: { sessionId: string }) => void): this
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  on(event: string | symbol, listener: (...args: any[]) => void): this {
    return super.on(event, listener)
  }

  // ---------------------------------------------------------------------------
  // Constructor
  // ---------------------------------------------------------------------------

  constructor() {
    super()
    this._state = { ...DEFAULT_PRISM_STATE }

    // Wire the shared chokidar watcher → _onPrismFileChange
    this._watcher.on("change", (event: PrismFileChangeEvent) => {
      void this._onPrismFileChange(event.type)
    })

    this._registerHandlers()
    void this._checkClaudeCli()
  }

  // ---------------------------------------------------------------------------
  // Abstract / overrideable methods
  // ---------------------------------------------------------------------------

  /** Returns the active project directory, or undefined if none is open. */
  protected abstract _getWorkspaceRoot(): string | undefined

  /**
   * Called after .prism/ detection completes.
   * Override to run platform-specific side effects (e.g. vscode setContext).
   */
  protected async _onAfterDetectPrismDir(
    _hasPrismDir: boolean,
    _hasStoriesJson: boolean,
  ): Promise<void> {
    // Default: no-op
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  dispose(): void {
    this._watcher.dispose()
    if (this._chatRunner) {
      this._chatRunner.terminate()
      this._chatRunner = null
    }
    if (this._modeBridge) {
      this._modeBridge.terminate()
    }
    this._spectrumAbort = true
    if (this._spectrumRunner) {
      this._spectrumRunner.terminate()
    }
    if (this._spectrumEngine) {
      this._spectrumEngine.dispose()
    }
  }

  /** Called once by the platform host after webview/window resolves. */
  setPostMessageFn(fn: PostMessageFn): void {
    this._postMessage = fn
  }

  get state(): PrismExtensionState {
    return this._state
  }

  /** Remove a state subscriber (called on grpc_request_cancel). */
  removeSubscriber(requestId: string): void {
    this._stateSubscribers.delete(requestId)
  }

  /** Update partial state, broadcast to all subscribers, and emit 'stateChange'. */
  async updateState(partial: Partial<PrismExtensionState>): Promise<void> {
    this._state = { ...this._state, ...partial }
    await this._broadcastState()
    this.emit("stateChange")
  }

  /** Set workflow phase (force) and broadcast. */
  async setPhase(phase: WorkflowPhase): Promise<void> {
    this.workflow.setPhase(phase)
    await this.updateState({ workflowPhase: phase, workflowContext: this.workflow.context })
  }

  // ---------------------------------------------------------------------------
  // .prism/ detection + watching (template method)
  // ---------------------------------------------------------------------------

  /**
   * Detect .prism/ directory under the current workspace root and start watching.
   * After detection, calls _onAfterDetectPrismDir() for platform-specific hooks.
   */
  async _detectPrismDir(): Promise<void> {
    const workspaceRoot = this._getWorkspaceRoot()
    if (!workspaceRoot) return

    const prismDir = await detectPrismDir(workspaceRoot)
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

    await this.updateState({
      hasPrismDir,
      hasStoriesJson,
      prismDir: prismDir ?? "",
      storiesPath: storiesPath ?? "",
    })

    await this._onAfterDetectPrismDir(hasPrismDir, hasStoriesJson)
  }

  // ---------------------------------------------------------------------------
  // gRPC Handler registration
  // ---------------------------------------------------------------------------

  /** Register all gRPC service handlers. Called once in constructor. */
  private _registerHandlers(): void {
    // -----------------------------------------------------------------------
    // StateService
    // -----------------------------------------------------------------------

    registerStream(
      "StateService",
      "subscribeToState",
      async (_message: unknown, respond: StreamResponseFn, requestId: string) => {
        this._stateSubscribers.set(requestId, respond)
        const hydratedState: PrismExtensionState = { ...this._state, didHydrateState: true }
        await respond({ stateJson: JSON.stringify(hydratedState) })
      },
    )

    registerUnary("StateService", "getState", async () => {
      const hydratedState: PrismExtensionState = { ...this._state, didHydrateState: true }
      return { stateJson: JSON.stringify(hydratedState) }
    })

    // -----------------------------------------------------------------------
    // UiService
    // -----------------------------------------------------------------------

    registerUnary("UiService", "initializeWebview", async () => {
      await this._detectPrismDir()
      return { ok: true }
    })

    registerUnary("UiService", "initPrism", async () => {
      const workspaceRoot = this._getWorkspaceRoot()
      if (!workspaceRoot) {
        return { ok: false, error: "No workspace folder open" }
      }
      const prismDirPath = path.join(workspaceRoot, ".prism")
      try {
        await initPrismDir(prismDirPath)
        await this._detectPrismDir()
        return { ok: true }
      } catch (err) {
        return { ok: false, error: String(err) }
      }
    })

    // -----------------------------------------------------------------------
    // WorkflowService
    // -----------------------------------------------------------------------

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

    registerUnary("WorkflowService", "getAvailableTransitions", async () => {
      return { transitions: this.workflow.availableTransitions() }
    })

    // -----------------------------------------------------------------------
    // ChatService
    // -----------------------------------------------------------------------

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

        // Check if message triggers a Prism plugin skill
        const skillTrigger = detectSkillTrigger(text)
        if (skillTrigger) {
          if (!this._state.hasClaudeCli) {
            return { ok: false, error: "Claude CLI not found. Install it to use Prism workflow commands." }
          }
          const bridge = this._getOrCreateModeBridge(workspaceRoot)

          // Register session in agent bridge for Office integration
          const skillSessionId = uuidv4()
          this.agentBridge.registerSession(skillSessionId, {})
          this.emit("sessionStart", { sessionId: skillSessionId })

          void bridge.runPluginSkill(text).catch((err: Error) => {
            console.error("[Prism] Plugin skill error:", err)
          })
          return { ok: true }
        }

        // CLI Mode: interactive chat
        if (!this._state.hasClaudeCli) {
          return { ok: false, error: "Claude CLI not found. Install Claude Code and run 'claude login' to use Prism chat." }
        }

        const userMsg: PrismChatMessage = {
          id: uuidv4(), ts: Date.now(), type: "user", text,
        }
        this._chatMessages = [...this._chatMessages, userMsg]

        const assistantMsg: PrismChatMessage = {
          id: uuidv4(), ts: Date.now(), type: "assistant_text", text: "", isStreaming: true,
        }
        this._chatMessages = [...this._chatMessages, assistantMsg]

        await this.updateState({
          chatMessages: [...this._chatMessages],
          isChatStreaming: true,
          hasActiveTask: true,
        })

        const systemPrompt = buildSystemPrompt({
          workflowPhase: this._state.workflowPhase,
          workflowContext: this.workflow.context,
          workspaceRoot,
          prismDir: this._state.prismDir,
          hasPrismDir: this._state.hasPrismDir,
          hasStoriesJson: this._state.hasStoriesJson,
        })
        const prompt = this._buildChatPrompt(text, systemPrompt)

        // Register session in agent bridge for Office integration
        const chatSessionId = uuidv4()
        this.agentBridge.registerSession(chatSessionId, {})
        this.emit("sessionStart", { sessionId: chatSessionId })

        void this._runChatSession(prompt, workspaceRoot, assistantMsg).catch((err: Error) => {
          console.error("[Prism] Chat session error:", err)
        })

        return { ok: true }
      },
    )

    registerUnary("ChatService", "abortTask", async () => {
      if (this._modeBridge?.isPluginStreaming) {
        this._modeBridge.terminate()
      }
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

    registerUnary("ChatService", "clearMessages", async () => {
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

    registerUnary("ChatService", "approveToolUse", async () => {
      return { ok: true }
    })

    registerUnary("ChatService", "setApiKey", async () => {
      return { ok: true }
    })

    // -----------------------------------------------------------------------
    // PluginService
    // -----------------------------------------------------------------------

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

        // Register session in agent bridge for Office integration
        const skillSessionId = uuidv4()
        this.agentBridge.registerSession(skillSessionId, {})
        this.emit("sessionStart", { sessionId: skillSessionId })

        void bridge.runPluginSkill(`/${skillName}${args ? ` ${args}` : ""}`).catch((err: Error) => {
          console.error("[Prism] Plugin skill error:", err)
        })

        return { ok: true }
      },
    )

    registerUnary("PluginService", "terminateSkill", async () => {
      if (this._modeBridge) {
        this._modeBridge.terminate()
      }
      return { ok: true }
    })

    registerUnary("PluginService", "checkCli", async () => {
      await this._checkClaudeCli()
      return { hasClaudeCli: this._state.hasClaudeCli }
    })

    registerUnary("PluginService", "getSkills", async () => {
      return { skills: SKILL_MAP }
    })

    // -----------------------------------------------------------------------
    // SpectrumService
    // -----------------------------------------------------------------------

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

    registerUnary("SpectrumService", "pause", async () => {
      if (!this._spectrumEngine?.isRunning) {
        return { ok: false, error: "Spectrum is not running" }
      }
      this._spectrumEngine.pause()
      await this.updateState({ spectrum: this._spectrumEngine.state })
      return { ok: true }
    })

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
  // Internal: .prism/ helpers
  // ---------------------------------------------------------------------------

  protected async _loadStories(storiesPath: string): Promise<void> {
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

  protected async _onPrismFileChange(
    type: "stories" | "research" | "plans" | "validation" | "spectrum" | "other",
  ): Promise<void> {
    if (type === "stories" && this._state.storiesPath) {
      await this._loadStories(this._state.storiesPath)
    }
    this.emit("fileChange", { type })
  }

  protected async _checkClaudeCli(): Promise<void> {
    const claudePath = await checkClaudeCli()
    await this.updateState({ hasClaudeCli: claudePath !== null })
  }

  // ---------------------------------------------------------------------------
  // Internal: ModeBridge
  // ---------------------------------------------------------------------------

  protected _getOrCreateModeBridge(workspaceRoot: string): ModeBridge {
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
  // Internal: CLI chat
  // ---------------------------------------------------------------------------

  protected async _runChatSession(
    prompt: string,
    workspaceRoot: string,
    assistantMsg: PrismChatMessage,
  ): Promise<void> {
    if (this._chatRunner) {
      this._chatRunner.terminate()
      this._chatRunner = null
    }

    const runner = new ClaudeRunner()
    this._chatRunner = runner

    runner.on("event", (event: ClaudeRunnerEvent) => {
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
          if (!assistantMsg.text) {
            assistantMsg.text = se.result
          }
          void this.updateState({ chatMessages: [...this._chatMessages] })
        }
      }

      if (event.type === "tool_activity") {
        const toolMsg: PrismChatMessage = {
          id: uuidv4(), ts: Date.now(), type: "tool_use",
          toolName: event.activity.toolName,
          toolInput: { description: event.activity.description },
          toolUseId: uuidv4(),
          needsApproval: false, approved: true,
        }
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

  protected _buildChatPrompt(currentText: string, systemPrompt: string): string {
    const priorMessages = this._chatMessages.filter(
      (m) => (m.type === "user" || m.type === "assistant_text") && m.text && !m.isStreaming,
    )
    const historyMsgs = priorMessages.slice(0, -1)

    if (historyMsgs.length === 0) {
      return `${systemPrompt}\n\n${currentText}`
    }

    const history = historyMsgs
      .map((m) => {
        const role = m.type === "user" ? "User" : "Assistant"
        return `${role}: ${m.text}`
      })
      .join("\n\n")

    return `${systemPrompt}\n\n## Previous conversation\n${history}\n\n## Current request\n${currentText}`
  }

  // ---------------------------------------------------------------------------
  // Internal: Spectrum execution loop
  // ---------------------------------------------------------------------------

  protected _startSpectrumLoop(
    workspaceRoot: string,
    storiesPath: string,
    config: Partial<SpectrumConfig>,
  ): void {
    if (this._spectrumEngine) {
      this._spectrumEngine.dispose()
    }
    if (this._spectrumRunner) {
      this._spectrumRunner.terminate()
    }

    this._spectrumAbort = false

    this._spectrumEngine = new SpectrumEngine(config, async (state) => {
      await this.updateState({ spectrum: state })
    })

    this._spectrumRunner = new SpectrumRunner(workspaceRoot, this.storiesManager)

    this._spectrumRunner.on("event", (event: SpectrumRunnerEventType) => {
      if (!this._spectrumEngine) return
      switch (event.type) {
        case "story_started":
          this._spectrumEngine.setCurrentStory(
            event.storyId,
            this.storiesManager.completedCount(),
            this.storiesManager.completedCount() + this.storiesManager.remainingCount(),
          )
          // Register session in agent bridge for Office integration
          this.agentBridge.registerSession(event.sessionId, {
            storyId: event.storyId,
            storyTitle: event.storyTitle,
          })
          this.emit("sessionStart", {
            sessionId: event.sessionId,
            storyId: event.storyId,
            storyTitle: event.storyTitle,
            isSpectrum: true,
          })
          this.emit("storyUpdate", { storyId: event.storyId, storyTitle: event.storyTitle })
          break
        case "story_complete":
        case "story_blocked":
        case "story_retry":
          this._spectrumEngine.setCurrentStory(
            null,
            this.storiesManager.completedCount(),
            this.storiesManager.completedCount() + this.storiesManager.remainingCount(),
          )
          this.emit("spectrumStoryEnd", { sessionId: event.sessionId })
          break
        case "story_error":
          this._spectrumEngine.recordSignal("error", event.error)
          this._spectrumEngine.setCurrentStory(null, 0, 0)
          this.emit("spectrumStoryEnd", { sessionId: event.sessionId })
          break
        case "tool_activity":
          this._spectrumEngine.addActivity(event.activity.toolName, event.activity.description)
          break
        case "log":
          this._spectrumEngine.addLog(event.level, event.message)
          break
      }
    })

    const progressFile = ProgressFile.fromStoriesPath(storiesPath)
    void progressFile.exists().then(async (exists) => {
      if (!exists && this._state.plan) {
        await progressFile.initialize(this._state.plan.name).catch(() => {/* ignore */})
      }
    })
    this._spectrumRunner.setProgressFile(progressFile)

    const completed = this.storiesManager.completedCount()
    const total = completed + this.storiesManager.remainingCount()
    this._spectrumEngine.start(completed, total)

    void this._runSpectrumLoop(storiesPath).catch((err: Error) => {
      console.error("[Spectrum] Loop error:", err)
      if (this._spectrumEngine) {
        this._spectrumEngine.error(err.message)
        void this.updateState({ spectrum: this._spectrumEngine.state })
      }
    })
  }

  protected async _runSpectrumLoop(storiesPath: string): Promise<void> {
    if (!this._spectrumEngine || !this._spectrumRunner) return

    while (!this._spectrumAbort) {
      const execState = this._spectrumEngine.state.executionState

      if (execState === "paused") {
        await sleep(200)
        continue
      }

      if (execState !== "running") break

      if (!this._spectrumEngine.incrementIteration()) {
        break
      }

      const signalType = await this._spectrumRunner.runIteration(storiesPath)
      this._spectrumEngine.recordSignal(signalType, "")

      if (this._state.storiesPath) {
        await this._loadStories(this._state.storiesPath)
      }

      if (this.storiesManager.allComplete()) {
        this._spectrumEngine.complete()
        await this.updateState({ spectrum: this._spectrumEngine.state })
        break
      }

      if (signalType === "none") {
        this._spectrumEngine.addLog("warn", "No next story available — all blocked or complete")
        this._spectrumEngine.stop()
        await this.updateState({ spectrum: this._spectrumEngine.state })
        break
      }

      if (this._spectrumEngine.hasTooManyErrors()) {
        this._spectrumEngine.error(
          `${this._spectrumEngine.state.consecutiveErrors} consecutive errors exceeded limit`,
        )
        await this.updateState({ spectrum: this._spectrumEngine.state })
        break
      }

      if (!this._spectrumAbort) {
        await sleep(this._spectrumEngine.config.pauseMs)
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Internal: state broadcast
  // ---------------------------------------------------------------------------

  protected async _broadcastState(): Promise<void> {
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

    for (const id of deadSubscribers) {
      this._stateSubscribers.delete(id)
    }
  }
}
