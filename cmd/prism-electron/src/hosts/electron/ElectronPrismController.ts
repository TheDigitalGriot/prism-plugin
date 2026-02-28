/**
 * ElectronPrismController — central orchestrator for the Electron app.
 *
 * Adapted from cmd/prism-vscode/src/core/controller/index.ts.
 * Key changes vs the VSCode version:
 *   - No vscode imports
 *   - No AgentBridge / Office integration (out of scope for Phase 1)
 *   - No vscode.EventEmitter — events to tree/status-bar providers not needed
 *   - _getWorkspaceRoot() reads from stored _projectDir
 *   - detectPrismDir/detectStoriesPath use Node.js fs.stat (Electron versions)
 *   - PrismWatcher uses chokidar (Electron version)
 *   - initPrismDir is from local src/prism/init.ts (VSCode-free copy)
 */

import * as path from 'path'
import { PrismExtensionState, DEFAULT_PRISM_STATE } from '@prism-core/shared/PrismState'
import { WorkflowPhase } from '@prism-core/shared/types'
import { registerUnary, registerStream, StreamResponseFn } from '@prism-core/core/controller/grpc-handler'
import { WorkflowStateMachine, WorkflowTransition } from '@prism-core/core/controller/prism/workflow'
import { StoriesManager } from '@prism-core/core/controller/prism/stories'
import { SpectrumEngine, DEFAULT_SPECTRUM_CONFIG, type SpectrumConfig } from '@prism-core/core/controller/prism/spectrum'
import { SpectrumRunner, type SpectrumRunnerEventType } from '@prism-core/core/controller/prism/spectrum-runner'
import { ProgressFile } from '@prism-core/prism/progress'
import { PrismChatMessage } from '@prism-core/core/api/types'
import { buildSystemPrompt } from '@prism-core/core/prompts/system-prompt'
import { ClaudeRunner, checkClaudeCli, type RunnerOptions } from '@prism-core/claude/runner'
import type { ClaudeRunnerEvent, ClaudeStreamEvent } from '@prism-core/claude/events'
import { ModeBridge, detectSkillTrigger, type ChatMode } from '@prism-core/core/controller/prism/mode-bridge'
import { SKILL_MAP } from '@prism-core/core/controller/prism/plugin-bridge'
import { initPrismDir } from '../../prism/init'
import { PrismWatcher, type PrismFileChangeEvent } from '../../prism/watcher'
import { detectPrismDir, detectStoriesPath } from '../../prism/config'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export type PostMessageFn = (message: unknown) => Promise<void>

/**
 * ElectronPrismController — manages app state and broadcasts to webview.
 * Integrates workflow state machine, stories manager, .prism/ watcher,
 * and chat task management. VSCode-free variant of PrismController.
 */
export class ElectronPrismController {
  private _state: PrismExtensionState
  private _stateSubscribers = new Map<string, StreamResponseFn>()
  private _postMessage: PostMessageFn | null = null

  /** The currently open project directory (set via setProjectDir). */
  private _projectDir: string | undefined

  // Prism Core Services
  readonly workflow = new WorkflowStateMachine()
  readonly storiesManager = new StoriesManager()
  private readonly _watcher = new PrismWatcher()
  private _fileChangeListener: (event: PrismFileChangeEvent) => void

  // Chat / Task management
  private _chatRunner: ClaudeRunner | null = null
  private _chatMessages: PrismChatMessage[] = []

  // Mode bridge for hybrid CLI/plugin mode
  private _modeBridge: ModeBridge | undefined

  // Spectrum execution engine
  private _spectrumEngine: SpectrumEngine | undefined
  private _spectrumRunner: SpectrumRunner | undefined
  private _spectrumAbort = false

  constructor() {
    this._state = { ...DEFAULT_PRISM_STATE }

    this._fileChangeListener = (event: PrismFileChangeEvent) => {
      void this._onPrismFileChange(event.type)
    }
    this._watcher.on('change', this._fileChangeListener)

    this._registerHandlers()

    // Check if Claude CLI is available on startup
    void this._checkClaudeCli()
  }

  dispose(): void {
    this._watcher.off('change', this._fileChangeListener)
    this._watcher.dispose()
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

  /** Called once by ElectronIPCBridge after window resolves. */
  setPostMessageFn(fn: PostMessageFn): void {
    this._postMessage = fn
  }

  get state(): PrismExtensionState {
    return this._state
  }

  /** Set the active project directory and re-detect .prism/. */
  async setProjectDir(dir: string): Promise<void> {
    this._projectDir = dir
    await this._detectPrismDir()
  }

  /** Remove a state subscriber (called on grpc_request_cancel). */
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

  // ---------------------------------------------------------------------------
  // Handler registration
  // ---------------------------------------------------------------------------

  /** Register all gRPC service handlers. */
  private _registerHandlers(): void {
    // -----------------------------------------------------------------------
    // StateService
    // -----------------------------------------------------------------------

    registerStream(
      'StateService',
      'subscribeToState',
      async (_message: unknown, respond: StreamResponseFn, requestId: string) => {
        this._stateSubscribers.set(requestId, respond)
        const hydratedState: PrismExtensionState = { ...this._state, didHydrateState: true }
        await respond({ stateJson: JSON.stringify(hydratedState) })
      },
    )

    registerUnary('StateService', 'getState', async (_message: unknown) => {
      const hydratedState: PrismExtensionState = { ...this._state, didHydrateState: true }
      return { stateJson: JSON.stringify(hydratedState) }
    })

    // -----------------------------------------------------------------------
    // UiService
    // -----------------------------------------------------------------------

    registerUnary('UiService', 'initializeWebview', async (_message: unknown) => {
      await this._detectPrismDir()
      return { ok: true }
    })

    registerUnary('UiService', 'initPrism', async (_message: unknown) => {
      if (!this._projectDir) {
        return { ok: false, error: 'No project folder open. Use File → Open Project first.' }
      }
      const prismDirPath = path.join(this._projectDir, '.prism')
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
      'WorkflowService',
      'transition',
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

    registerUnary('WorkflowService', 'getAvailableTransitions', async () => {
      return { transitions: this.workflow.availableTransitions() }
    })

    // -----------------------------------------------------------------------
    // ChatService
    // -----------------------------------------------------------------------

    registerUnary(
      'ChatService',
      'sendMessage',
      async (message: unknown) => {
        const { text } = message as { text: string }

        if (!text?.trim()) {
          return { ok: false, error: 'Message text is required' }
        }

        const workspaceRoot = this._getWorkspaceRoot()
        if (!workspaceRoot) {
          return { ok: false, error: 'No project folder open. Use File → Open Project first.' }
        }

        const skillTrigger = detectSkillTrigger(text)
        if (skillTrigger) {
          if (!this._state.hasClaudeCli) {
            return { ok: false, error: 'Claude CLI not found. Install it to use Prism workflow commands.' }
          }
          const bridge = this._getOrCreateModeBridge(workspaceRoot)
          void bridge.runPluginSkill(text).catch((err: Error) => {
            console.error('[Prism] Plugin skill error:', err)
          })
          return { ok: true }
        }

        if (!this._state.hasClaudeCli) {
          return { ok: false, error: "Claude CLI not found. Install Claude Code and run 'claude login' to use Prism chat." }
        }

        const { v4: uuidv4 } = await import('uuid')
        const userMsg: PrismChatMessage = {
          id: uuidv4(), ts: Date.now(), type: 'user', text,
        }
        this._chatMessages = [...this._chatMessages, userMsg]

        const assistantMsg: PrismChatMessage = {
          id: uuidv4(), ts: Date.now(), type: 'assistant_text', text: '', isStreaming: true,
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

        void this._runChatSession(prompt, workspaceRoot, assistantMsg).catch((err: Error) => {
          console.error('[Prism] Chat session error:', err)
        })

        return { ok: true }
      },
    )

    registerUnary('ChatService', 'abortTask', async () => {
      if (this._modeBridge?.isPluginStreaming) {
        this._modeBridge.terminate()
      }
      if (this._chatRunner) {
        this._chatRunner.terminate()
        this._chatRunner = null
      }
      await this.updateState({
        isChatStreaming: false,
        chatMode: 'sdk',
        activePluginSkill: null,
      })
      return { ok: true }
    })

    registerUnary('ChatService', 'clearMessages', async () => {
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

    registerUnary('ChatService', 'approveToolUse', async () => {
      return { ok: true }
    })

    registerUnary('ChatService', 'setApiKey', async () => {
      return { ok: true }
    })

    // -----------------------------------------------------------------------
    // PluginService
    // -----------------------------------------------------------------------

    registerUnary(
      'PluginService',
      'executeSkill',
      async (message: unknown) => {
        const { skillName, args } = message as { skillName: string; args?: string }

        if (!this._state.hasClaudeCli) {
          return { ok: false, error: 'Claude CLI not found' }
        }

        const workspaceRoot = this._getWorkspaceRoot()
        if (!workspaceRoot) {
          return { ok: false, error: 'No project folder open' }
        }

        const bridge = this._getOrCreateModeBridge(workspaceRoot)
        void bridge.runPluginSkill(`/${skillName}${args ? ` ${args}` : ''}`).catch((err: Error) => {
          console.error('[Prism] Plugin skill error:', err)
        })

        return { ok: true }
      },
    )

    registerUnary('PluginService', 'terminateSkill', async () => {
      if (this._modeBridge) {
        this._modeBridge.terminate()
      }
      return { ok: true }
    })

    registerUnary('PluginService', 'checkCli', async () => {
      await this._checkClaudeCli()
      return { hasClaudeCli: this._state.hasClaudeCli }
    })

    registerUnary('PluginService', 'getSkills', async () => {
      return { skills: SKILL_MAP }
    })

    // -----------------------------------------------------------------------
    // SpectrumService
    // -----------------------------------------------------------------------

    registerUnary('SpectrumService', 'start', async (message: unknown) => {
      const msg = (message ?? {}) as { maxIterations?: number; pauseMs?: number }

      if (!this._state.hasClaudeCli) {
        return { ok: false, error: 'Claude CLI not found. Install it to use Spectrum.' }
      }

      const workspaceRoot = this._getWorkspaceRoot()
      if (!workspaceRoot) {
        return { ok: false, error: 'No project folder open' }
      }

      if (!this._state.storiesPath) {
        return { ok: false, error: 'No stories.json found. Create one with /decompose_plan.' }
      }

      if (this._spectrumEngine?.isActive) {
        return { ok: false, error: 'Spectrum is already running' }
      }

      const config: Partial<SpectrumConfig> = {
        ...DEFAULT_SPECTRUM_CONFIG,
        ...(msg.maxIterations !== undefined ? { maxIterations: msg.maxIterations } : {}),
        ...(msg.pauseMs !== undefined ? { pauseMs: msg.pauseMs } : {}),
      }

      this._startSpectrumLoop(workspaceRoot, this._state.storiesPath, config)
      return { ok: true }
    })

    registerUnary('SpectrumService', 'pause', async () => {
      if (!this._spectrumEngine?.isRunning) {
        return { ok: false, error: 'Spectrum is not running' }
      }
      this._spectrumEngine.pause()
      await this.updateState({ spectrum: this._spectrumEngine.state })
      return { ok: true }
    })

    registerUnary('SpectrumService', 'resume', async () => {
      if (!this._spectrumEngine?.isPaused) {
        return { ok: false, error: 'Spectrum is not paused' }
      }
      const completed = this.storiesManager.completedCount()
      const total = completed + this.storiesManager.remainingCount()
      this._spectrumEngine.resume(completed, total)
      await this.updateState({ spectrum: this._spectrumEngine.state })
      return { ok: true }
    })

    registerUnary('SpectrumService', 'stop', async () => {
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

    registerUnary('SpectrumService', 'skipStory', async () => {
      const currentStoryId = this._spectrumEngine?.state.currentStoryId
      if (!currentStoryId || !this._state.storiesPath) {
        return { ok: false, error: 'No active story to skip' }
      }
      try {
        await this.storiesManager.markComplete(currentStoryId, 'SKIPPED')
        this._spectrumEngine?.addLog('warn', `Skipped story: ${currentStoryId}`)
        if (this._spectrumEngine) {
          await this.updateState({ spectrum: this._spectrumEngine.state })
        }
        return { ok: true }
      } catch (err) {
        return { ok: false, error: String(err) }
      }
    })

    registerUnary('SpectrumService', 'reset', async () => {
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

  /** Detect .prism/ directory in the current project dir and start watching. */
  async _detectPrismDir(): Promise<void> {
    if (!this._projectDir) {
      return
    }

    const prismDir = await detectPrismDir(this._projectDir)
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
      prismDir: prismDir ?? '',
      storiesPath: storiesPath ?? '',
    })
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
      console.error('[Prism] Failed to load stories:', err)
    }
  }

  private async _onPrismFileChange(
    type: 'stories' | 'research' | 'plans' | 'validation' | 'spectrum' | 'other',
  ): Promise<void> {
    if (type === 'stories' && this._state.storiesPath) {
      await this._loadStories(this._state.storiesPath)
    }
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

  private async _runChatSession(
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

    runner.on('event', (event: ClaudeRunnerEvent) => {
      if (event.type === 'stream_event') {
        const se = event.event as ClaudeStreamEvent
        if (se.type === 'assistant' && se.message) {
          for (const block of se.message.content) {
            if (block.type === 'text' && block.text) {
              assistantMsg.text = (assistantMsg.text ?? '') + block.text
            }
          }
          void this.updateState({ chatMessages: [...this._chatMessages] })
        } else if (se.type === 'result' && se.result) {
          if (!assistantMsg.text) {
            assistantMsg.text = se.result
          }
          void this.updateState({ chatMessages: [...this._chatMessages] })
        }
      }

      if (event.type === 'tool_activity') {
        const { v4: uuidv4 } = require('uuid') as typeof import('uuid')
        const toolMsg: PrismChatMessage = {
          id: uuidv4(), ts: Date.now(), type: 'tool_use',
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

  private _buildChatPrompt(currentText: string, systemPrompt: string): string {
    const priorMessages = this._chatMessages.filter(
      m => (m.type === 'user' || m.type === 'assistant_text') && m.text && !m.isStreaming
    )
    const historyMsgs = priorMessages.slice(0, -1)

    if (historyMsgs.length === 0) {
      return `${systemPrompt}\n\n${currentText}`
    }

    const history = historyMsgs.map(m => {
      const role = m.type === 'user' ? 'User' : 'Assistant'
      return `${role}: ${m.text}`
    }).join('\n\n')

    return `${systemPrompt}\n\n## Previous conversation\n${history}\n\n## Current request\n${currentText}`
  }

  // ---------------------------------------------------------------------------
  // Spectrum execution loop
  // ---------------------------------------------------------------------------

  private _startSpectrumLoop(
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

    this._spectrumRunner.on('event', (event: SpectrumRunnerEventType) => {
      if (!this._spectrumEngine) return
      switch (event.type) {
        case 'story_started':
          this._spectrumEngine.setCurrentStory(
            event.storyId,
            this.storiesManager.completedCount(),
            this.storiesManager.completedCount() + this.storiesManager.remainingCount(),
          )
          break
        case 'story_complete':
        case 'story_blocked':
        case 'story_retry':
          this._spectrumEngine.setCurrentStory(
            null,
            this.storiesManager.completedCount(),
            this.storiesManager.completedCount() + this.storiesManager.remainingCount(),
          )
          break
        case 'story_error':
          this._spectrumEngine.recordSignal('error', event.error)
          this._spectrumEngine.setCurrentStory(null, 0, 0)
          break
        case 'tool_activity':
          this._spectrumEngine.addActivity(event.activity.toolName, event.activity.description)
          break
        case 'log':
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
      console.error('[Spectrum] Loop error:', err)
      if (this._spectrumEngine) {
        this._spectrumEngine.error(err.message)
        void this.updateState({ spectrum: this._spectrumEngine.state })
      }
    })
  }

  private async _runSpectrumLoop(storiesPath: string): Promise<void> {
    if (!this._spectrumEngine || !this._spectrumRunner) return

    while (!this._spectrumAbort) {
      const execState = this._spectrumEngine.state.executionState

      if (execState === 'paused') {
        await sleep(200)
        continue
      }

      if (execState !== 'running') break

      if (!this._spectrumEngine.incrementIteration()) {
        break
      }

      const signalType = await this._spectrumRunner.runIteration(storiesPath)
      this._spectrumEngine.recordSignal(signalType, '')

      if (this._state.storiesPath) {
        await this._loadStories(this._state.storiesPath)
      }

      if (this.storiesManager.allComplete()) {
        this._spectrumEngine.complete()
        await this.updateState({ spectrum: this._spectrumEngine.state })
        break
      }

      if (signalType === 'none') {
        this._spectrumEngine.addLog('warn', 'No next story available — all blocked or complete')
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

  private _getWorkspaceRoot(): string | undefined {
    return this._projectDir
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

    for (const id of deadSubscribers) {
      this._stateSubscribers.delete(id)
    }
  }
}
