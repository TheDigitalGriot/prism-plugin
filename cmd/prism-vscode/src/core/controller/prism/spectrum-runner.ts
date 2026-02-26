/**
 * SpectrumRunner — single-iteration executor for the Spectrum loop.
 *
 * Each call to `runIteration()` spawns one Claude CLI session for the next
 * pending story, parses the resulting signal, and updates stories.json.
 *
 * The outer loop (in PrismController) handles:
 *   - pause/resume
 *   - max iterations check
 *   - inter-iteration sleep
 *   - consecutive error limit
 */

import { EventEmitter } from "events"
import { PluginBridge, BridgeEvent } from "./plugin-bridge"
import { StoriesManager } from "./stories"
import { ProgressFile } from "../../../prism/progress"
import { parseSignal } from "../../../prism/signals"
import { ToolActivity } from "../../../claude/events"

// ---------------------------------------------------------------------------
// Event types
// ---------------------------------------------------------------------------

export type SpectrumRunnerEventType =
  | { type: "story_started"; storyId: string; storyTitle: string; sessionId: string }
  | { type: "story_complete"; storyId: string; sessionId: string }
  | { type: "story_blocked"; storyId: string; reason: string; sessionId: string }
  | { type: "story_retry"; storyId: string; reason: string; sessionId: string }
  | { type: "story_error"; storyId: string; error: string; sessionId: string }
  | { type: "all_complete" }
  | { type: "no_next_story" }
  | { type: "tool_activity"; activity: ToolActivity }
  | { type: "log"; level: "info" | "warn" | "error"; message: string }

// ---------------------------------------------------------------------------
// SpectrumRunner
// ---------------------------------------------------------------------------

/**
 * Executes one Spectrum story iteration.
 *
 * Usage:
 *   const runner = new SpectrumRunner(projectDir, storiesManager)
 *   runner.on("event", (e) => { ... })
 *   const signal = await runner.runIteration(storiesPath)
 */
export class SpectrumRunner extends EventEmitter {
  private _bridge: PluginBridge
  private _storiesManager: StoriesManager
  private _progressFile: ProgressFile | null = null

  constructor(projectDir: string, storiesManager: StoriesManager) {
    super()
    this._storiesManager = storiesManager
    this._bridge = new PluginBridge(projectDir)

    // Forward bridge events to runner events
    this._bridge.on("event", (e: BridgeEvent) => {
      this._handleBridgeEvent(e)
    })
  }

  // -------------------------------------------------------------------------
  // Configuration
  // -------------------------------------------------------------------------

  /** Set the progress file for appending iteration summaries. */
  setProgressFile(file: ProgressFile): void {
    this._progressFile = file
  }

  /** Update the project directory (e.g. on workspace change). */
  setProjectDir(dir: string): void {
    this._bridge.setProjectDir(dir)
  }

  // -------------------------------------------------------------------------
  // Execution
  // -------------------------------------------------------------------------

  /**
   * Execute a single Spectrum iteration — one story.
   *
   * Flow:
   *   1. Get next pending story from StoriesManager
   *   2. Mark it in_progress
   *   3. Spawn Claude CLI via PluginBridge.executeSpectrum()
   *   4. Parse signal from output
   *   5. Update story status based on signal
   *   6. Return the signal type
   *
   * Returns "none" if no story is available.
   */
  async runIteration(storiesPath: string): Promise<string> {
    // -----------------------------------------------------------------------
    // 1. Get the next story
    // -----------------------------------------------------------------------
    const story = this._storiesManager.getNextStory()

    if (!story) {
      if (this._storiesManager.allComplete()) {
        this._emit({ type: "all_complete" })
      } else {
        this._emit({ type: "no_next_story" })
      }
      return "none"
    }

    // -----------------------------------------------------------------------
    // 2. Mark in-progress and generate a session ID for JSONL tracking
    // -----------------------------------------------------------------------
    await this._storiesManager.markInProgress(story.id)
    const sessionId = crypto.randomUUID()
    this._emit({ type: "story_started", storyId: story.id, storyTitle: story.title, sessionId })
    this._emit({
      type: "log",
      level: "info",
      message: `Starting story: ${story.id} — ${story.title}`,
    })

    // -----------------------------------------------------------------------
    // 3. Execute via Claude CLI (passes --session-id so Claude writes JSONL)
    // -----------------------------------------------------------------------
    const result = await this._bridge.executeSpectrum(storiesPath, sessionId)
    const signal = parseSignal(result.output)

    this._emit({
      type: "log",
      level: signal.type === "error" ? "error" : "info",
      message: `Story ${story.id} finished with signal: ${signal.type}`,
    })

    // -----------------------------------------------------------------------
    // 4. Handle signal
    // -----------------------------------------------------------------------
    switch (signal.type) {
      case "complete": {
        await this._storiesManager.markComplete(story.id, "")
        this._emit({ type: "story_complete", storyId: story.id, sessionId })

        // Append to progress.md
        if (this._progressFile) {
          await this._progressFile
            .appendEntry({
              timestamp: new Date(),
              storyID: story.id,
              summary: story.title,
              learnings: [],
              files: story.files.map((f) => f.path),
              qualityGatesStatus: "Passed",
              qualityGates: {},
            })
            .catch((err) => {
              this._emit({
                type: "log",
                level: "warn",
                message: `Failed to update progress.md: ${String(err)}`,
              })
            })
        }
        break
      }

      case "blocked": {
        // Reset to pending — will be re-evaluated next iteration (may become unblocked)
        await this._storiesManager.load(storiesPath) // reload fresh state
        this._emit({
          type: "story_blocked",
          storyId: story.id,
          reason: signal.content,
          sessionId,
        })
        break
      }

      case "retry": {
        // Reset to pending for a retry on the next iteration
        await this._storiesManager.load(storiesPath) // reload fresh state
        this._emit({
          type: "story_retry",
          storyId: story.id,
          reason: signal.content,
          sessionId,
        })
        break
      }

      case "error": {
        this._emit({
          type: "story_error",
          storyId: story.id,
          error: signal.content || result.error || "Unknown error",
          sessionId,
        })
        // Keep story as in_progress — controller decides whether to stop
        break
      }

      default: {
        // "continue" or "none" — treat as a successful iteration
        await this._storiesManager.markComplete(story.id, "")
        this._emit({ type: "story_complete", storyId: story.id, sessionId })
        break
      }
    }

    return signal.type
  }

  // -------------------------------------------------------------------------
  // Control
  // -------------------------------------------------------------------------

  get isRunning(): boolean {
    return this._bridge.isRunning
  }

  /** Terminate the currently running Claude CLI session. */
  terminate(): void {
    this._bridge.terminate()
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  private _handleBridgeEvent(e: BridgeEvent): void {
    switch (e.type) {
      case "skill_tool_activity":
        if (e.activity) {
          this._emit({ type: "tool_activity", activity: e.activity })
        }
        break

      case "skill_error":
        this._emit({
          type: "log",
          level: "error",
          message: `Bridge error: ${e.error ?? "unknown"}`,
        })
        break

      case "skill_signal_detected":
        if (e.signalType) {
          this._emit({
            type: "log",
            level: "info",
            message: `Signal detected: ${e.signalType}`,
          })
        }
        break
    }
  }

  private _emit(event: SpectrumRunnerEventType): void {
    this.emit("event", event)
  }
}
