/**
 * Claude CLI Runner — port of cmd/prism-cli/claude/runner.go.
 *
 * Spawns `claude` CLI sessions with `--output-format stream-json` and
 * parses the streaming output into typed events. Handles process lifecycle
 * with platform-specific termination (taskkill on Windows, kill on Unix).
 *
 * Two modes:
 *   1. runSession()    — one-shot: run to completion, return full output
 *   2. runStreaming()  — streaming: emit ClaudeRunnerEvents via callback
 */

import { ChildProcess, spawn } from "child_process"
import * as readline from "readline"
import * as path from "path"
import { EventEmitter } from "events"
import {
  ClaudeRunnerEvent,
  ToolActivity,
} from "./events"
import {
  parseStreamEvent,
  extractToolActivity,
  OutputParser,
} from "./parser"
import { progressPathFromStories } from "../prism/progress"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RunnerOptions {
  /** Working directory for the Claude process. */
  projectDir: string
  /** Path to stories.json (used to derive progress path in prompts). */
  storiesPath?: string
  /** Maximum runtime in milliseconds (default: 30 minutes). */
  timeoutMs?: number
  /** Extra CLI arguments to pass to `claude`. */
  extraArgs?: string[]
  /** Session ID to pass as --session-id. Causes Claude to write a JSONL transcript. */
  sessionId?: string
}

export interface RunSessionResult {
  exitCode: number
  output: string
  durationMs: number
  error?: string
}

// ---------------------------------------------------------------------------
// ClaudeRunner
// ---------------------------------------------------------------------------

/**
 * Manages Claude CLI process lifecycle.
 *
 * Usage:
 *   const runner = new ClaudeRunner()
 *   runner.on('event', (e: ClaudeRunnerEvent) => { ... })
 *   await runner.runStreaming({ projectDir, prompt: "..." })
 *   runner.terminate()  // if needed
 */
export class ClaudeRunner extends EventEmitter {
  private _process: ChildProcess | null = null
  private _running = false
  private _parser = new OutputParser()
  private _outputBuffer = ""
  private _timeoutHandle: ReturnType<typeof setTimeout> | null = null

  get isRunning(): boolean {
    return this._running
  }

  get parser(): OutputParser {
    return this._parser
  }

  // -------------------------------------------------------------------------
  // One-shot session
  // -------------------------------------------------------------------------

  /**
   * Run Claude to completion, returning the full output.
   * Does not emit streaming events — use `runStreaming` for that.
   */
  async runSession(
    prompt: string,
    options: RunnerOptions,
  ): Promise<RunSessionResult> {
    const startTime = Date.now()
    const args = this._buildArgs(prompt, options, false)

    return new Promise((resolve) => {
      const proc = spawn("claude", args, {
        cwd: options.projectDir,
        shell: true,
        stdio: ["ignore", "pipe", "pipe"],
      })

      let output = ""
      let stderrOutput = ""

      proc.stdout?.on("data", (chunk: Buffer) => {
        output += chunk.toString()
      })

      proc.stderr?.on("data", (chunk: Buffer) => {
        stderrOutput += chunk.toString()
      })

      proc.on("error", (err) => {
        resolve({
          exitCode: -1,
          output: output + stderrOutput,
          durationMs: Date.now() - startTime,
          error: err.message,
        })
      })

      proc.on("close", (code) => {
        resolve({
          exitCode: code ?? -1,
          output,
          durationMs: Date.now() - startTime,
          error: stderrOutput || undefined,
        })
      })
    })
  }

  // -------------------------------------------------------------------------
  // Streaming session
  // -------------------------------------------------------------------------

  /**
   * Run Claude with `--output-format stream-json`, emitting events
   * for each parsed line of output.
   *
   * Returns a promise that resolves when the process exits.
   */
  async runStreaming(
    prompt: string,
    options: RunnerOptions,
  ): Promise<RunSessionResult> {
    if (this._running) {
      throw new Error("ClaudeRunner: already running")
    }

    this._running = true
    this._parser.reset()
    this._outputBuffer = ""

    const startTime = Date.now()
    const args = this._buildArgs(prompt, options, true)
    const timeoutMs = options.timeoutMs ?? 30 * 60 * 1000

    return new Promise((resolve) => {
      const proc = spawn("claude", args, {
        cwd: options.projectDir,
        shell: true,
        stdio: ["ignore", "pipe", "pipe"],
      })
      this._process = proc

      // Emit started event
      const pid = proc.pid ?? -1
      this._emit({ type: "started", pid })

      // Set timeout
      this._timeoutHandle = setTimeout(() => {
        this.terminate()
        resolve({
          exitCode: -1,
          output: this._outputBuffer,
          durationMs: Date.now() - startTime,
          error: `Timed out after ${timeoutMs}ms`,
        })
      }, timeoutMs)

      // Stream stdout line by line
      if (proc.stdout) {
        const rl = readline.createInterface({ input: proc.stdout })
        rl.on("line", (line) => {
          this._processLine(line, false)
        })
      }

      // Stream stderr line by line
      if (proc.stderr) {
        const rl = readline.createInterface({ input: proc.stderr })
        rl.on("line", (line) => {
          this._processLine(line, true)
        })
      }

      proc.on("error", (err) => {
        this._cleanup()
        this._emit({ type: "error", message: err.message })
        resolve({
          exitCode: -1,
          output: this._outputBuffer,
          durationMs: Date.now() - startTime,
          error: err.message,
        })
      })

      proc.on("close", (code) => {
        this._cleanup()
        const result: RunSessionResult = {
          exitCode: code ?? -1,
          output: this._outputBuffer,
          durationMs: Date.now() - startTime,
        }
        this._emit({
          type: "finished",
          exitCode: result.exitCode,
          output: result.output,
          durationMs: result.durationMs,
        })
        resolve(result)
      })
    })
  }

  // -------------------------------------------------------------------------
  // Process management
  // -------------------------------------------------------------------------

  /**
   * Terminate the running Claude process.
   * Uses taskkill on Windows for process tree kill, kill on Unix.
   */
  terminate(): void {
    if (!this._process) return

    const proc = this._process
    const pid = proc.pid

    if (!pid) {
      proc.kill("SIGKILL")
      this._cleanup()
      return
    }

    if (process.platform === "win32") {
      // Windows: use taskkill for tree kill (/T kills child processes)
      const kill = spawn("taskkill", ["/F", "/T", "/PID", String(pid)], {
        shell: true,
      })
      kill.on("error", () => {
        // Fallback: direct kill
        try { proc.kill("SIGKILL") } catch { /* already dead */ }
      })
    } else {
      // Unix: send SIGTERM first, then SIGKILL after 2s
      try {
        proc.kill("SIGTERM")
        setTimeout(() => {
          try { proc.kill("SIGKILL") } catch { /* already dead */ }
        }, 2000)
      } catch {
        /* already dead */
      }
    }

    this._cleanup()
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  /** Build CLI arguments for the claude command. */
  private _buildArgs(prompt: string, options: RunnerOptions, streaming: boolean): string[] {
    const args = [
      "--dangerously-skip-permissions",
      "--print",
    ]

    if (options.sessionId) {
      args.push("--session-id", options.sessionId)
    }

    if (streaming) {
      args.push("--output-format", "stream-json")
      args.push("--verbose")
    }

    if (options.extraArgs) {
      args.push(...options.extraArgs)
    }

    args.push(prompt)
    return args
  }

  /**
   * Process a single line of output from stdout or stderr.
   * Tries to parse as stream-json; falls back to raw output.
   */
  private _processLine(line: string, isStderr: boolean): void {
    this._outputBuffer += line + "\n"

    // Emit raw output
    this._emit({
      type: "output",
      data: { text: line, isStderr, timestamp: Date.now() },
    })

    if (isStderr) return

    // Try to parse as stream-json event
    const event = parseStreamEvent(line)
    if (!event) return

    // Emit the parsed stream event
    this._emit({ type: "stream_event", event })

    // Extract tool activity
    const activity = extractToolActivity(event)
    if (activity) {
      this._emit({ type: "tool_activity", activity })
    }

    // Run through the stateful output parser for signals, phases, stories
    const textContent = this._extractTextFromEvent(event)
    if (textContent) {
      const parseEvents = this._parser.parseLine(textContent)
      for (const pe of parseEvents) {
        switch (pe.type) {
          case "story_announced":
            if (pe.storyId) {
              this._emit({
                type: "story_announced",
                storyId: pe.storyId,
                storyTitle: pe.storyTitle ?? "",
              })
            }
            break
          case "phase_changed":
            if (pe.phase) {
              this._emit({
                type: "phase_detected",
                detection: { phase: pe.phase as PhaseDetectionPhase, source: line },
              })
            }
            break
          case "signal_detected":
            if (pe.signal) {
              this._emit({
                type: "signal_detected",
                signalType: pe.signal.type,
                content: pe.signal.content,
                reason: pe.signal.reason,
              })
            }
            break
        }
      }
    }
  }

  /** Extract displayable text content from a stream event. */
  private _extractTextFromEvent(event: { type: string; message?: { content: Array<{ type: string; text?: string }> }; result?: string }): string {
    if (event.type === "assistant" && event.message) {
      for (const block of event.message.content) {
        if (block.type === "text" && block.text) {
          return block.text
        }
      }
    }
    if (event.type === "result" && event.result) {
      return event.result
    }
    return ""
  }

  /** Emit a runner event. */
  private _emit(event: ClaudeRunnerEvent): void {
    this.emit("event", event)
  }

  /** Clean up process state. */
  private _cleanup(): void {
    this._running = false
    this._process = null
    if (this._timeoutHandle) {
      clearTimeout(this._timeoutHandle)
      this._timeoutHandle = null
    }
  }
}

// ---------------------------------------------------------------------------
// Helper: phase detection type
// ---------------------------------------------------------------------------

type PhaseDetectionPhase =
  | "Research"
  | "Planning"
  | "Implementation"
  | "Browser Verification"
  | "Quality Gates"
  | "Committing"

// ---------------------------------------------------------------------------
// Convenience: build prompt for Spectrum execution
// ---------------------------------------------------------------------------

/**
 * Build the prompt string for a Spectrum story execution.
 * Mirrors runner.go → RunClaudeStreamingCmd prompt construction.
 */
export function buildSpectrumPrompt(storiesPath: string): string {
  const progressPath = progressPathFromStories(storiesPath)
  return `Execute the next story from ${storiesPath} using the /prism-spectrum workflow. Progress file: ${progressPath}`
}

/**
 * Build the prompt string for a skill invocation.
 * Used by the plugin bridge to trigger Prism skills.
 */
export function buildSkillPrompt(skillName: string, args?: string): string {
  const prompt = `/${skillName}`
  return args ? `${prompt} ${args}` : prompt
}

/**
 * Check if the `claude` CLI is available on PATH.
 * Returns the resolved path or null.
 */
export async function checkClaudeCli(): Promise<string | null> {
  const { execSync } = await import("child_process")
  try {
    const cmd = process.platform === "win32" ? "where claude" : "which claude"
    const result = execSync(cmd, { encoding: "utf-8", timeout: 5000 }).trim()
    return result.split("\n")[0] ?? null
  } catch {
    return null
  }
}
