/**
 * Hybrid Chat Mode Bridge — SDK ↔ CLI mode switching.
 *
 * The extension operates in two modes:
 *   1. SDK Mode (default) — Interactive chat via Claude Agent SDK
 *      Used for: general questions, code review, debugging, etc.
 *
 *   2. Plugin Mode — Spawns Claude CLI with Prism plugin loaded
 *      Used for: /prism-research, /prism-plan, /prism-implement, /prism-validate, etc.
 *      CLI runs with --dangerously-skip-permissions --print --output-format stream-json
 *
 * When a user types a command like "/prism-research" in the chat, the mode
 * bridge detects it, switches to Plugin Mode, spawns the CLI session, and
 * converts streaming CLI output into chat messages that display in the
 * existing ChatView.
 *
 * When the CLI session completes, control returns to SDK Mode.
 */

import { v4 as uuidv4 } from "uuid"
import { PrismChatMessage } from "../../api/types"
import { PluginBridge, BridgeEvent, SKILL_MAP, isWorkflowSkill } from "./plugin-bridge"
import { ToolActivity } from "../../../claude/events"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ChatMode = "sdk" | "plugin"

export interface ModeBridgeState {
  mode: ChatMode
  /** The skill currently running in plugin mode (null if SDK mode). */
  activeSkill: string | null
  /** Messages generated from CLI output (displayed in chat). */
  pluginMessages: PrismChatMessage[]
  /** Whether the plugin is currently streaming output. */
  isPluginStreaming: boolean
}

export type ModeBridgeUpdateFn = (
  messages: PrismChatMessage[],
  isStreaming: boolean,
  mode: ChatMode,
) => void

// ---------------------------------------------------------------------------
// Skill detection
// ---------------------------------------------------------------------------

/** Known skill trigger patterns in user messages. */
const SKILL_TRIGGERS: Array<{ pattern: RegExp; skill: string }> = [
  { pattern: /^\/prism-research\b/i, skill: "prism-research" },
  { pattern: /^\/prism-plan\b/i, skill: "prism-plan" },
  { pattern: /^\/prism-implement\b/i, skill: "prism-implement" },
  { pattern: /^\/prism-validate\b/i, skill: "prism-validate" },
  { pattern: /^\/prism-spectrum\b/i, skill: "prism-spectrum" },
  { pattern: /^\/decompose_plan\b/i, skill: "decompose_plan" },
  { pattern: /^\/commit\b/i, skill: "commit" },
  { pattern: /^\/create_handoff\b/i, skill: "create_handoff" },
  { pattern: /^\/describe_pr\b/i, skill: "describe_pr" },
]

/**
 * Check if a user message is a skill trigger.
 * Returns the skill name and remaining args, or null if not a skill.
 */
export function detectSkillTrigger(text: string): { skill: string; args: string } | null {
  const trimmed = text.trim()
  for (const trigger of SKILL_TRIGGERS) {
    const match = trigger.pattern.exec(trimmed)
    if (match) {
      const args = trimmed.slice(match[0].length).trim()
      return { skill: trigger.skill, args }
    }
  }
  return null
}

// ---------------------------------------------------------------------------
// ModeBridge
// ---------------------------------------------------------------------------

/**
 * Manages switching between SDK mode (interactive chat) and Plugin mode
 * (CLI skill execution) with seamless output bridging.
 *
 * Usage:
 *   const bridge = new ModeBridge(projectDir, onUpdate)
 *   // Check if user message triggers a skill
 *   if (bridge.shouldSwitchToPlugin(userText)) {
 *     await bridge.runPluginSkill(userText)
 *   } else {
 *     // Continue with SDK mode
 *   }
 */
export class ModeBridge {
  private _pluginBridge: PluginBridge
  private _state: ModeBridgeState = {
    mode: "sdk",
    activeSkill: null,
    pluginMessages: [],
    isPluginStreaming: false,
  }
  private _onUpdate: ModeBridgeUpdateFn
  private _currentAssistantMsg: PrismChatMessage | null = null
  private _recentActivities: ToolActivity[] = []

  constructor(projectDir: string, onUpdate: ModeBridgeUpdateFn) {
    this._pluginBridge = new PluginBridge(projectDir)
    this._onUpdate = onUpdate

    // Wire bridge events to message conversion
    this._pluginBridge.on("event", (e: BridgeEvent) => {
      this._handleBridgeEvent(e)
    })
  }

  get mode(): ChatMode {
    return this._state.mode
  }

  get activeSkill(): string | null {
    return this._state.activeSkill
  }

  get isPluginStreaming(): boolean {
    return this._state.isPluginStreaming
  }

  get pluginMessages(): PrismChatMessage[] {
    return this._state.pluginMessages
  }

  /** Update the project directory. */
  setProjectDir(dir: string): void {
    this._pluginBridge.setProjectDir(dir)
  }

  /**
   * Check if a user message should trigger a switch to Plugin mode.
   */
  shouldSwitchToPlugin(text: string): boolean {
    return detectSkillTrigger(text) !== null
  }

  /**
   * Run a skill in Plugin mode, converting CLI output to chat messages.
   * Returns when the skill completes.
   *
   * @param userText  The user's message (e.g., "/prism-research auth system")
   */
  async runPluginSkill(userText: string): Promise<void> {
    const trigger = detectSkillTrigger(userText)
    if (!trigger) {
      throw new Error("ModeBridge: not a skill trigger")
    }

    this._state.mode = "plugin"
    this._state.activeSkill = trigger.skill
    this._state.isPluginStreaming = true
    this._state.pluginMessages = []
    this._currentAssistantMsg = null
    this._recentActivities = []

    // Add a system message indicating mode switch
    this._addPluginMessage({
      id: uuidv4(),
      ts: Date.now(),
      type: "assistant_text",
      text: `Starting **/${trigger.skill}**${trigger.args ? ` with: ${trigger.args}` : ""}...`,
      isStreaming: false,
    })
    this._pushUpdate()

    try {
      await this._pluginBridge.executeSkill(trigger.skill, trigger.args || undefined)
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      this._addPluginMessage({
        id: uuidv4(),
        ts: Date.now(),
        type: "error",
        errorText: errMsg,
      })
    } finally {
      this._state.mode = "sdk"
      this._state.activeSkill = null
      this._state.isPluginStreaming = false
      this._pushUpdate()
    }
  }

  /**
   * Run a Spectrum iteration, converting output to chat messages.
   */
  async runSpectrum(storiesPath: string): Promise<void> {
    this._state.mode = "plugin"
    this._state.activeSkill = "prism-spectrum"
    this._state.isPluginStreaming = true
    this._state.pluginMessages = []
    this._currentAssistantMsg = null
    this._recentActivities = []

    this._addPluginMessage({
      id: uuidv4(),
      ts: Date.now(),
      type: "assistant_text",
      text: "Starting **Spectrum** iteration...",
      isStreaming: false,
    })
    this._pushUpdate()

    try {
      await this._pluginBridge.executeSpectrum(storiesPath, crypto.randomUUID())
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      this._addPluginMessage({
        id: uuidv4(),
        ts: Date.now(),
        type: "error",
        errorText: errMsg,
      })
    } finally {
      this._state.mode = "sdk"
      this._state.activeSkill = null
      this._state.isPluginStreaming = false
      this._pushUpdate()
    }
  }

  /** Terminate the running plugin skill. */
  terminate(): void {
    this._pluginBridge.terminate()
    this._state.mode = "sdk"
    this._state.activeSkill = null
    this._state.isPluginStreaming = false
    this._pushUpdate()
  }

  // -------------------------------------------------------------------------
  // Event → Message conversion
  // -------------------------------------------------------------------------

  /**
   * Convert BridgeEvents from the PluginBridge into PrismChatMessages
   * that display in the ChatView.
   */
  private _handleBridgeEvent(event: BridgeEvent): void {
    switch (event.type) {
      case "skill_output":
        // Accumulate text output into the current assistant message
        if (event.text && !event.isStderr) {
          this._appendToCurrentAssistant(event.text)
        }
        break

      case "skill_tool_activity":
        if (event.activity) {
          this._recentActivities.push(event.activity)
          // Convert tool activity to a tool_use chat message
          this._addPluginMessage({
            id: uuidv4(),
            ts: Date.now(),
            type: "tool_use",
            toolName: event.activity.toolName,
            toolInput: { description: event.activity.description },
            toolUseId: uuidv4(),
            needsApproval: false,
            approved: true,
          })
          this._pushUpdate()
        }
        break

      case "skill_phase_detected":
        if (event.phase) {
          this._addPluginMessage({
            id: uuidv4(),
            ts: Date.now(),
            type: "assistant_text",
            text: `Phase: **${event.phase}**`,
            isStreaming: false,
          })
          this._pushUpdate()
        }
        break

      case "skill_signal_detected":
        if (event.signalType) {
          const signalText = event.signalType === "complete"
            ? "Skill completed successfully."
            : `Signal: **${event.signalType}**${event.signalContent ? ` — ${event.signalContent}` : ""}`
          this._addPluginMessage({
            id: uuidv4(),
            ts: Date.now(),
            type: "completion",
            completionText: signalText,
          })
          this._pushUpdate()
        }
        break

      case "skill_story_announced":
        if (event.storyId) {
          this._addPluginMessage({
            id: uuidv4(),
            ts: Date.now(),
            type: "assistant_text",
            text: `Executing story: **${event.storyId}** — ${event.storyTitle ?? ""}`,
            isStreaming: false,
          })
          this._pushUpdate()
        }
        break

      case "skill_completed":
        // Finalize any open streaming message
        this._finalizeCurrentAssistant()
        if (event.exitCode !== 0 && event.exitCode !== undefined) {
          this._addPluginMessage({
            id: uuidv4(),
            ts: Date.now(),
            type: "error",
            errorText: `Skill exited with code ${event.exitCode}`,
          })
        } else {
          this._addPluginMessage({
            id: uuidv4(),
            ts: Date.now(),
            type: "completion",
            completionText: `**/${event.skillName}** completed${event.durationMs ? ` in ${(event.durationMs / 1000).toFixed(1)}s` : ""}`,
          })
        }
        this._pushUpdate()
        break

      case "skill_error":
        this._addPluginMessage({
          id: uuidv4(),
          ts: Date.now(),
          type: "error",
          errorText: event.error ?? "Unknown error",
        })
        this._pushUpdate()
        break
    }
  }

  // -------------------------------------------------------------------------
  // Message helpers
  // -------------------------------------------------------------------------

  /** Start or append to the current streaming assistant message. */
  private _appendToCurrentAssistant(text: string): void {
    if (!this._currentAssistantMsg) {
      this._currentAssistantMsg = {
        id: uuidv4(),
        ts: Date.now(),
        type: "assistant_text",
        text: "",
        isStreaming: true,
      }
      this._state.pluginMessages.push(this._currentAssistantMsg)
    }
    this._currentAssistantMsg.text = (this._currentAssistantMsg.text ?? "") + text + "\n"
    this._pushUpdate()
  }

  /** Finalize the current streaming assistant message. */
  private _finalizeCurrentAssistant(): void {
    if (this._currentAssistantMsg) {
      this._currentAssistantMsg.isStreaming = false
      this._currentAssistantMsg = null
    }
  }

  /** Add a chat message to the plugin messages list. */
  private _addPluginMessage(msg: PrismChatMessage): void {
    // Finalize any open streaming message before adding a non-text message
    if (msg.type !== "assistant_text" || !msg.isStreaming) {
      this._finalizeCurrentAssistant()
    }
    this._state.pluginMessages.push(msg)
  }

  /** Push current state to the update callback. */
  private _pushUpdate(): void {
    this._onUpdate(
      [...this._state.pluginMessages],
      this._state.isPluginStreaming,
      this._state.mode,
    )
  }
}
