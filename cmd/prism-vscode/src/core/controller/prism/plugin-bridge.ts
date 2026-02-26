/**
 * Prism Plugin Command Bridge — maps VS Code commands to Prism plugin skills.
 *
 * Spawns Claude CLI sessions with the appropriate skill trigger phrase,
 * captures streaming output, and routes events to the extension.
 *
 * Command mapping:
 *   prism.research   → /prism-research
 *   prism.plan       → /prism-plan
 *   prism.implement  → /prism-implement
 *   prism.validate   → /prism-validate
 *   prism.spectrum   → /prism-spectrum
 *   prism.decompose  → /decompose_plan
 *   prism.commit     → /commit
 *   prism.handoff    → /create_handoff
 *   prism.describePR → /describe_pr
 */

import { EventEmitter } from "events"
import {
  ClaudeRunner,
  RunnerOptions,
  RunSessionResult,
  buildSkillPrompt,
  buildSpectrumPrompt,
  checkClaudeCli,
} from "../../../claude/runner"
import { ClaudeRunnerEvent, ToolActivity } from "../../../claude/events"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Maps VS Code command IDs to Prism plugin skill names. */
export const SKILL_MAP: Record<string, string> = {
  "prism.research": "prism-research",
  "prism.plan": "prism-plan",
  "prism.implement": "prism-implement",
  "prism.validate": "prism-validate",
  "prism.spectrum": "prism-spectrum",
  "prism.decompose": "decompose_plan",
  "prism.commit": "commit",
  "prism.handoff": "create_handoff",
  "prism.describePR": "describe_pr",
}

/** The workflow skills that use the full 4-phase workflow. */
export const WORKFLOW_SKILLS = new Set([
  "prism-research",
  "prism-plan",
  "prism-implement",
  "prism-validate",
  "prism-spectrum",
])

export type BridgeEventType =
  | "skill_started"
  | "skill_output"
  | "skill_tool_activity"
  | "skill_phase_detected"
  | "skill_signal_detected"
  | "skill_story_announced"
  | "skill_completed"
  | "skill_error"

export interface BridgeEvent {
  type: BridgeEventType
  skillName: string
  /** For skill_output */
  text?: string
  isStderr?: boolean
  /** For skill_tool_activity */
  activity?: ToolActivity
  /** For skill_phase_detected */
  phase?: string
  /** For skill_signal_detected */
  signalType?: string
  signalContent?: string
  signalReason?: string
  /** For skill_story_announced */
  storyId?: string
  storyTitle?: string
  /** For skill_completed */
  exitCode?: number
  durationMs?: number
  output?: string
  /** For skill_error */
  error?: string
}

// ---------------------------------------------------------------------------
// PluginBridge
// ---------------------------------------------------------------------------

/**
 * Bridges VS Code commands to Prism plugin skills via the Claude CLI.
 *
 * Usage:
 *   const bridge = new PluginBridge(projectDir)
 *   bridge.on('event', (e: BridgeEvent) => { ... })
 *   await bridge.executeSkill('prism-research', 'Research the auth system')
 */
export class PluginBridge extends EventEmitter {
  private _runner: ClaudeRunner | null = null
  private _activeSkill: string | null = null
  private _projectDir: string

  constructor(projectDir: string) {
    super()
    this._projectDir = projectDir
  }

  get isRunning(): boolean {
    return this._runner?.isRunning ?? false
  }

  get activeSkill(): string | null {
    return this._activeSkill
  }

  /** Update the project directory (e.g., on workspace change). */
  setProjectDir(dir: string): void {
    this._projectDir = dir
  }

  // -------------------------------------------------------------------------
  // Skill execution
  // -------------------------------------------------------------------------

  /**
   * Execute a Prism plugin skill via the Claude CLI.
   *
   * @param skillName  The skill name (e.g., "prism-research")
   * @param args       Optional arguments to pass to the skill
   * @returns The session result when the skill completes
   */
  async executeSkill(skillName: string, args?: string): Promise<RunSessionResult> {
    if (this._runner?.isRunning) {
      throw new Error(`PluginBridge: skill '${this._activeSkill}' is already running`)
    }

    // Check that claude CLI is available
    const claudePath = await checkClaudeCli()
    if (!claudePath) {
      const err = "Claude CLI not found. Please install it: https://docs.anthropic.com/en/docs/claude-code"
      this._emitBridgeEvent({ type: "skill_error", skillName, error: err })
      return { exitCode: -1, output: "", durationMs: 0, error: err }
    }

    this._activeSkill = skillName
    this._runner = new ClaudeRunner()

    // Wire runner events → bridge events
    this._runner.on("event", (e: ClaudeRunnerEvent) => {
      this._handleRunnerEvent(e, skillName)
    })

    this._emitBridgeEvent({ type: "skill_started", skillName })

    const prompt = buildSkillPrompt(skillName, args)
    const options: RunnerOptions = {
      projectDir: this._projectDir,
    }

    try {
      const result = await this._runner.runStreaming(prompt, options)
      this._emitBridgeEvent({
        type: "skill_completed",
        skillName,
        exitCode: result.exitCode,
        durationMs: result.durationMs,
        output: result.output,
      })
      return result
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      this._emitBridgeEvent({ type: "skill_error", skillName, error: errMsg })
      return { exitCode: -1, output: "", durationMs: 0, error: errMsg }
    } finally {
      this._activeSkill = null
      this._runner = null
    }
  }

  /**
   * Execute a VS Code command by looking up its skill mapping.
   *
   * @param commandId  The VS Code command ID (e.g., "prism.research")
   * @param args       Optional arguments
   */
  async executeCommand(commandId: string, args?: string): Promise<RunSessionResult> {
    const skillName = SKILL_MAP[commandId]
    if (!skillName) {
      const err = `PluginBridge: unknown command '${commandId}'`
      return { exitCode: -1, output: "", durationMs: 0, error: err }
    }
    return this.executeSkill(skillName, args)
  }

  /**
   * Execute a Spectrum iteration — spawns Claude for the next story.
   *
   * @param storiesPath  Path to stories.json
   * @param sessionId    UUID passed as --session-id so Claude writes a JSONL transcript
   */
  async executeSpectrum(storiesPath: string, sessionId: string): Promise<RunSessionResult> {
    if (this._runner?.isRunning) {
      throw new Error(`PluginBridge: skill '${this._activeSkill}' is already running`)
    }

    this._activeSkill = "prism-spectrum"
    this._runner = new ClaudeRunner()

    this._runner.on("event", (e: ClaudeRunnerEvent) => {
      this._handleRunnerEvent(e, "prism-spectrum")
    })

    this._emitBridgeEvent({ type: "skill_started", skillName: "prism-spectrum" })

    const prompt = buildSpectrumPrompt(storiesPath)
    const options: RunnerOptions = {
      projectDir: this._projectDir,
      storiesPath,
      sessionId,
    }

    try {
      const result = await this._runner.runStreaming(prompt, options)
      this._emitBridgeEvent({
        type: "skill_completed",
        skillName: "prism-spectrum",
        exitCode: result.exitCode,
        durationMs: result.durationMs,
        output: result.output,
      })
      return result
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      this._emitBridgeEvent({ type: "skill_error", skillName: "prism-spectrum", error: errMsg })
      return { exitCode: -1, output: "", durationMs: 0, error: errMsg }
    } finally {
      this._activeSkill = null
      this._runner = null
    }
  }

  // -------------------------------------------------------------------------
  // Process control
  // -------------------------------------------------------------------------

  /** Terminate the running skill. */
  terminate(): void {
    if (this._runner) {
      this._runner.terminate()
      if (this._activeSkill) {
        this._emitBridgeEvent({
          type: "skill_completed",
          skillName: this._activeSkill,
          exitCode: -1,
          durationMs: 0,
          output: "Terminated by user",
        })
      }
      this._activeSkill = null
      this._runner = null
    }
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  /** Map ClaudeRunnerEvents to BridgeEvents. */
  private _handleRunnerEvent(event: ClaudeRunnerEvent, skillName: string): void {
    switch (event.type) {
      case "output":
        this._emitBridgeEvent({
          type: "skill_output",
          skillName,
          text: event.data.text,
          isStderr: event.data.isStderr,
        })
        break

      case "tool_activity":
        this._emitBridgeEvent({
          type: "skill_tool_activity",
          skillName,
          activity: event.activity,
        })
        break

      case "phase_detected":
        this._emitBridgeEvent({
          type: "skill_phase_detected",
          skillName,
          phase: event.detection.phase,
        })
        break

      case "signal_detected":
        this._emitBridgeEvent({
          type: "skill_signal_detected",
          skillName,
          signalType: event.signalType,
          signalContent: event.content,
          signalReason: event.reason,
        })
        break

      case "story_announced":
        this._emitBridgeEvent({
          type: "skill_story_announced",
          skillName,
          storyId: event.storyId,
          storyTitle: event.storyTitle,
        })
        break

      case "error":
        this._emitBridgeEvent({
          type: "skill_error",
          skillName,
          error: event.message,
        })
        break
    }
  }

  private _emitBridgeEvent(event: BridgeEvent): void {
    this.emit("event", event)
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Check if a skill name is a workflow skill (4-phase). */
export function isWorkflowSkill(skillName: string): boolean {
  return WORKFLOW_SKILLS.has(skillName)
}

/** Get the VS Code command ID for a skill name (reverse lookup). */
export function commandIdForSkill(skillName: string): string | undefined {
  for (const [cmdId, name] of Object.entries(SKILL_MAP)) {
    if (name === skillName) return cmdId
  }
  return undefined
}
