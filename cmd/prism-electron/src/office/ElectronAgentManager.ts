/**
 * ElectronAgentManager — Electron equivalent of VSCode's agentManager.ts.
 *
 * Responsibilities:
 *   - Spawn Claude CLI processes via child_process.spawn
 *   - Watch JSONL transcripts in ~/.claude/projects/<workspace-dir>/
 *   - Forward agent activity messages to the renderer via win.webContents.send('office:message', msg)
 *
 * Uses shared logic from @prism-core/office:
 *   - processTranscriptLine — parses JSONL events into office messages
 *   - cancelWaitingTimer / cancelPermissionTimer — timer management
 *   - AgentState / PostMessageFn types
 */

import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { randomUUID } from 'crypto'
import { spawn, ChildProcess } from 'child_process'
import { BrowserWindow } from 'electron'
import type { AgentState, PostMessageFn } from '@prism-core/office/types'
import {
  cancelWaitingTimer,
  cancelPermissionTimer,
} from '@prism-core/office/timerManager'
import { processTranscriptLine } from '@prism-core/office/transcriptParser'
import {
  JSONL_POLL_INTERVAL_MS,
  FILE_WATCHER_POLL_INTERVAL_MS,
} from '@prism-core/office/constants'

export class ElectronAgentManager {
  private _win: BrowserWindow
  private _postMessage: PostMessageFn

  private _agents: Map<number, AgentState> = new Map()
  private _processes: Map<number, ChildProcess> = new Map()
  private _fileWatchers: Map<number, fs.FSWatcher> = new Map()
  private _pollingTimers: Map<number, ReturnType<typeof setInterval>> = new Map()
  private _waitingTimers: Map<number, ReturnType<typeof setTimeout>> = new Map()
  private _permissionTimers: Map<number, ReturnType<typeof setTimeout>> = new Map()
  private _jsonlPollTimers: Map<number, ReturnType<typeof setInterval>> = new Map()
  private _knownJsonlFiles: Set<string> = new Set()
  private _nextAgentId = 0

  constructor(win: BrowserWindow) {
    this._win = win
    this._postMessage = (msg) => {
      if (!this._win.isDestroyed()) {
        this._win.webContents.send('office:message', msg)
      }
    }
  }

  get agents(): Map<number, AgentState> {
    return this._agents
  }

  // ---------------------------------------------------------------------------
  // Path helpers
  // ---------------------------------------------------------------------------

  /** Convert a workspace directory path to the ~/.claude/projects/<dir> path
   *  using the same encoding Claude CLI uses (colons and slashes → dashes). */
  getProjectDirPath(cwd: string): string {
    const dirName = cwd.replace(/[:\\/]/g, '-')
    return path.join(os.homedir(), '.claude', 'projects', dirName)
  }

  // ---------------------------------------------------------------------------
  // Agent lifecycle
  // ---------------------------------------------------------------------------

  /**
   * Spawn a new Claude CLI process and begin tracking its JSONL transcript.
   * Returns the new agent ID.
   */
  launchAgent(cwd: string): number {
    const sessionId = randomUUID()
    const projectDir = this.getProjectDirPath(cwd)
    const expectedFile = path.join(projectDir, `${sessionId}.jsonl`)

    this._knownJsonlFiles.add(expectedFile)

    const id = this._nextAgentId++

    // Spawn claude CLI — write stdout/stderr to /dev/null; we track via JSONL
    const proc = spawn('claude', ['--session-id', sessionId], {
      cwd,
      stdio: 'ignore',
      detached: false,
    })
    this._processes.set(id, proc)

    proc.on('exit', (code) => {
      this._processes.delete(id)
      console.log(`[Prism Office] Agent ${id}: process exited (code ${code ?? 'null'})`)
    })

    proc.on('error', (err) => {
      this._processes.delete(id)
      console.error(`[Prism Office] Agent ${id}: process error: ${err.message}`)
    })

    const agent: AgentState = {
      id,
      terminalRef: proc, // ChildProcess stored as generic terminal handle
      projectDir,
      jsonlFile: expectedFile,
      fileOffset: 0,
      lineBuffer: '',
      activeToolIds: new Set(),
      activeToolStatuses: new Map(),
      activeToolNames: new Map(),
      activeSubagentToolIds: new Map(),
      activeSubagentToolNames: new Map(),
      isWaiting: false,
      permissionSent: false,
      hadToolsInTurn: false,
    }

    this._agents.set(id, agent)
    console.log(`[Prism Office] Agent ${id}: created, spawned claude --session-id ${sessionId}`)
    this._postMessage({ type: 'agentCreated', id })

    // Poll for the JSONL file to appear (Claude writes it on first turn)
    this._startJsonlPoll(id, agent)

    return id
  }

  /**
   * Create a headless agent for a Spectrum story — no process spawning,
   * just JSONL watching. The CLI is spawned by SpectrumRunner.
   * Returns the new agent ID.
   */
  createHeadlessAgent(sessionId: string, projectDir: string): number {
    const expectedFile = path.join(projectDir, `${sessionId}.jsonl`)
    this._knownJsonlFiles.add(expectedFile)

    const id = this._nextAgentId++
    const agent: AgentState = {
      id,
      terminalRef: null,
      projectDir,
      jsonlFile: expectedFile,
      fileOffset: 0,
      lineBuffer: '',
      activeToolIds: new Set(),
      activeToolStatuses: new Map(),
      activeToolNames: new Map(),
      activeSubagentToolIds: new Map(),
      activeSubagentToolNames: new Map(),
      isWaiting: false,
      permissionSent: false,
      hadToolsInTurn: false,
    }

    this._agents.set(id, agent)
    console.log(`[Prism Office] Headless agent ${id}: created for Spectrum session ${sessionId}`)
    this._postMessage({ type: 'agentCreated', id })

    // Poll until Claude creates the JSONL transcript file
    this._startJsonlPoll(id, agent)

    return id
  }

  /**
   * Remove an agent: kill its process, stop all watchers and timers,
   * and notify the renderer.
   */
  removeAgent(agentId: number): void {
    const agent = this._agents.get(agentId)
    if (!agent) return

    // Kill child process if still running
    const proc = this._processes.get(agentId)
    if (proc) {
      if (!proc.killed) {
        try { proc.kill() } catch { /* already exited */ }
      }
      this._processes.delete(agentId)
    }

    // Stop JSONL poll timer
    const jpTimer = this._jsonlPollTimers.get(agentId)
    if (jpTimer) { clearInterval(jpTimer) }
    this._jsonlPollTimers.delete(agentId)

    // Stop file watching
    this._fileWatchers.get(agentId)?.close()
    this._fileWatchers.delete(agentId)
    const pt = this._pollingTimers.get(agentId)
    if (pt) { clearInterval(pt) }
    this._pollingTimers.delete(agentId)

    // Cancel state-machine timers
    cancelWaitingTimer(agentId, this._waitingTimers)
    cancelPermissionTimer(agentId, this._permissionTimers)

    this._agents.delete(agentId)
    console.log(`[Prism Office] Agent ${agentId}: removed`)
    this._postMessage({ type: 'agentClosed', id: agentId })
  }

  /**
   * Push the current agent list and live tool statuses to the renderer.
   * Called when the webview signals it is ready (webviewReady).
   */
  sendExistingAgents(): void {
    const agentIds = [...this._agents.keys()].sort((a, b) => a - b)
    this._postMessage({
      type: 'existingAgents',
      agents: agentIds,
      agentMeta: {},
    })
    this._sendCurrentAgentStatuses()
  }

  /** Kill all processes and stop all timers. */
  dispose(): void {
    for (const proc of this._processes.values()) {
      if (!proc.killed) {
        try { proc.kill() } catch { /* already exited */ }
      }
    }
    this._processes.clear()

    for (const timer of this._jsonlPollTimers.values()) { clearInterval(timer) }
    this._jsonlPollTimers.clear()

    for (const watcher of this._fileWatchers.values()) { watcher.close() }
    this._fileWatchers.clear()

    for (const timer of this._pollingTimers.values()) { clearInterval(timer) }
    this._pollingTimers.clear()

    for (const agentId of this._agents.keys()) {
      cancelWaitingTimer(agentId, this._waitingTimers)
      cancelPermissionTimer(agentId, this._permissionTimers)
    }

    this._agents.clear()
    console.log('[Prism Office] ElectronAgentManager disposed')
  }

  // ---------------------------------------------------------------------------
  // Private — JSONL watching
  // ---------------------------------------------------------------------------

  private _startJsonlPoll(id: number, agent: AgentState): void {
    const pollTimer = setInterval(() => {
      try {
        if (fs.existsSync(agent.jsonlFile)) {
          console.log(
            `[Prism Office] Agent ${id}: found JSONL file ${path.basename(agent.jsonlFile)}`,
          )
          clearInterval(pollTimer)
          this._jsonlPollTimers.delete(id)
          this._startFileWatching(id, agent.jsonlFile)
          this._readNewLines(id)
        }
      } catch { /* file may not exist yet */ }
    }, JSONL_POLL_INTERVAL_MS)
    this._jsonlPollTimers.set(id, pollTimer)
  }

  private _startFileWatching(agentId: number, filePath: string): void {
    // Primary: fs.watch for immediate notification
    try {
      const watcher = fs.watch(filePath, () => {
        this._readNewLines(agentId)
      })
      this._fileWatchers.set(agentId, watcher)
    } catch (e) {
      console.log(`[Prism Office] fs.watch failed for agent ${agentId}: ${e}`)
    }

    // Backup: poll every 2s to catch missed fs events
    const interval = setInterval(() => {
      if (!this._agents.has(agentId)) { clearInterval(interval); return }
      this._readNewLines(agentId)
    }, FILE_WATCHER_POLL_INTERVAL_MS)
    this._pollingTimers.set(agentId, interval)
  }

  private _readNewLines(agentId: number): void {
    const agent = this._agents.get(agentId)
    if (!agent) return
    try {
      const stat = fs.statSync(agent.jsonlFile)
      if (stat.size <= agent.fileOffset) return

      const buf = Buffer.alloc(stat.size - agent.fileOffset)
      const fd = fs.openSync(agent.jsonlFile, 'r')
      fs.readSync(fd, buf, 0, buf.length, agent.fileOffset)
      fs.closeSync(fd)
      agent.fileOffset = stat.size

      const text = agent.lineBuffer + buf.toString('utf-8')
      const lines = text.split('\n')
      agent.lineBuffer = lines.pop() ?? ''

      const hasLines = lines.some(l => l.trim())
      if (hasLines) {
        cancelWaitingTimer(agentId, this._waitingTimers)
        cancelPermissionTimer(agentId, this._permissionTimers)
        if (agent.permissionSent) {
          agent.permissionSent = false
          this._postMessage({ type: 'agentToolPermissionClear', id: agentId })
        }
      }

      for (const line of lines) {
        if (!line.trim()) continue
        processTranscriptLine(
          agentId, line, this._agents,
          this._waitingTimers, this._permissionTimers, this._postMessage,
        )
      }
    } catch (e) {
      console.log(`[Prism Office] Read error for agent ${agentId}: ${e}`)
    }
  }

  private _sendCurrentAgentStatuses(): void {
    for (const [agentId, agent] of this._agents) {
      for (const [toolId, status] of agent.activeToolStatuses) {
        this._postMessage({ type: 'agentToolStart', id: agentId, toolId, status })
      }
      if (agent.isWaiting) {
        this._postMessage({ type: 'agentStatus', id: agentId, status: 'waiting' })
      }
    }
  }
}
