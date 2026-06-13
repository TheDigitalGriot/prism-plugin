/**
 * ElectronIPCBridge — wires ipcMain handlers to ElectronPrismController.
 *
 * Replaces VscodeWebviewProvider: instead of webview.onDidReceiveMessage /
 * webview.postMessage, uses ipcMain.handle / mainWindow.webContents.send.
 */

import * as path from 'path'
import * as fs from 'fs'
import { BrowserWindow, app, ipcMain, dialog, shell } from 'electron'
import { handleGrpcRequest } from '@prism-core/core/controller/grpc-handler'
import { discoverProjects, addToGlobalWorkspaces, listWorktrees } from '@prism-core/workspace/discovery'
import { createWorktree, deleteWorktree } from '@prism-core/workspace/worktrees'
import { executeGate } from '@prism-core/workspace/qualityGates'
import { discoverResearch } from '@prism-core/workspace/research'
import { discoverPlans } from '@prism-core/workspace/plans'
import { getApiKey, setApiKey, deleteApiKey, isValidApiKey } from '@prism-core/core/api/auth'
import { ElectronPrismController } from './ElectronPrismController'
import { ElectronOfficeProvider } from '../../office/ElectronOfficeProvider'
import { ElectronSecretStorage } from '../../auth/ElectronSecretStorage'
import type { DaemonManager, DaemonStatus } from '../../daemon/daemon-manager'

// ---------------------------------------------------------------------------
// File tree helper
// ---------------------------------------------------------------------------

const IGNORED_DIRS = new Set(['node_modules', '.git', '.vite', 'dist', 'out'])

interface FileTreeNode {
  name: string
  type: 'file' | 'dir'
  children?: FileTreeNode[]
  language?: string
}

async function buildFileTree(
  dirPath: string,
  maxDepth: number,
  currentDepth = 0,
): Promise<FileTreeNode[]> {
  if (currentDepth >= maxDepth) return []
  const entries = await fs.promises.readdir(dirPath, { withFileTypes: true })
  const result: FileTreeNode[] = []

  for (const entry of entries) {
    if (IGNORED_DIRS.has(entry.name)) continue
    if (entry.isDirectory()) {
      const children = await buildFileTree(
        path.join(dirPath, entry.name),
        maxDepth,
        currentDepth + 1,
      )
      result.push({ name: entry.name, type: 'dir', children })
    } else if (entry.isFile()) {
      const ext = entry.name.split('.').pop() ?? ''
      result.push({ name: entry.name, type: 'file', language: ext || undefined })
    }
  }

  // Directories first, then files — both alphabetically
  result.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'dir' ? -1 : 1
    return a.name.localeCompare(b.name)
  })

  return result
}

export class ElectronIPCBridge {
  private controller: ElectronPrismController
  private _officeProvider: ElectronOfficeProvider
  private _secretStorage: ElectronSecretStorage
  private _currentProjectDir: string | undefined
  /** AbortControllers for in-flight quality gate executions, keyed by command string. */
  private _gateAbortControllers: Map<string, AbortController> = new Map()
  /** Bound listener forwarding daemon status to the renderer (removed on dispose). */
  private _onDaemonStatus: (s: DaemonStatus) => void

  constructor(
    private mainWindow: BrowserWindow,
    private _daemonManager: DaemonManager,
  ) {
    this.controller = new ElectronPrismController()
    this._secretStorage = new ElectronSecretStorage()
    this.controller.setPostMessageFn(async (msg) => {
      mainWindow.webContents.send('grpc_response', msg)
    })

    // Wire up office provider — subscribes to controller events for Spectrum→Office pipeline
    this._officeProvider = new ElectronOfficeProvider(mainWindow, this.controller)

    // Subscribe to controller events and forward to renderer
    this.controller.on('stateChange', () => {
      if (!mainWindow.isDestroyed()) {
        mainWindow.webContents.send('prism:stateChange', this.controller.state)
      }
    })
    this.controller.on('sessionStart', (data) => {
      if (!mainWindow.isDestroyed()) {
        mainWindow.webContents.send('prism:sessionStart', data)
      }
    })
    this.controller.on('storyUpdate', (data) => {
      if (!mainWindow.isDestroyed()) {
        mainWindow.webContents.send('prism:storyUpdate', data)
      }
    })
    this.controller.on('spectrumStoryEnd', (data) => {
      if (!mainWindow.isDestroyed()) {
        mainWindow.webContents.send('prism:spectrumStoryEnd', data)
      }
    })
    this.controller.on('fileChange', (data) => {
      if (!mainWindow.isDestroyed()) {
        mainWindow.webContents.send('prism:fileChange', data)
      }
    })

    // Forward broker daemon status to the renderer (status dot in the shell).
    this._onDaemonStatus = (s: DaemonStatus) => {
      if (!mainWindow.isDestroyed()) {
        mainWindow.webContents.send('daemon:statusChange', s)
      }
    }
    this._daemonManager.on('statusChange', this._onDaemonStatus)

    this._registerHandlers()
  }

  /** The currently open project directory (undefined if no project opened). */
  get currentProjectDir(): string | undefined {
    return this._currentProjectDir
  }

  /** The AgentBridge instance — needed by Phase 12 ElectronOfficeProvider. */
  get agentBridge() {
    return this.controller.agentBridge
  }

  /** Set project directory directly — used for CLI args and last-opened restore. */
  async setProjectDir(dir: string): Promise<void> {
    this._currentProjectDir = dir
    await this.controller.setProjectDir(dir)
  }

  private _registerHandlers(): void {
    // Main gRPC request channel: renderer → main process
    ipcMain.handle('grpc_request', async (_event, grpcRequest) => {
      await handleGrpcRequest(
        async (msg) => {
          if (!this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send('grpc_response', msg)
          }
        },
        grpcRequest,
      )
    })

    // Cancel a streaming request by request_id
    ipcMain.handle('grpc_request_cancel', (_event, payload: { request_id: string }) => {
      this.controller.removeSubscriber(payload.request_id)
    })

    // ── Daemon broker supervisor ─────────────────────────────────────────────
    ipcMain.handle('daemon:status', () => this._daemonManager.getStatus())
    ipcMain.handle('daemon:start', () => this._daemonManager.start())
    ipcMain.handle('daemon:stop', () => this._daemonManager.stop())
    ipcMain.handle('daemon:restart', () => this._daemonManager.restart())

    // Open an external URL in the default browser
    ipcMain.handle('shell:openExternal', async (_event, url: string) => {
      if (typeof url === 'string' && (url.startsWith('https://') || url.startsWith('http://'))) {
        await shell.openExternal(url)
      }
    })

    // Open a project folder via native dialog
    ipcMain.handle('prism:openProject', async () => {
      const result = await dialog.showOpenDialog(this.mainWindow, {
        properties: ['openDirectory'],
        title: 'Open Prism Project',
      })
      if (!result.canceled && result.filePaths[0]) {
        await this.setProjectDir(result.filePaths[0])
        return { ok: true, path: result.filePaths[0] }
      }
      return { ok: false }
    })

    // Read file content (for FileContentView)
    ipcMain.handle('prism:readFile', async (_event, filePath: string) => {
      if (!this._currentProjectDir) return { ok: false, error: 'No project open' }
      const resolved = path.resolve(this._currentProjectDir, filePath)
      if (!resolved.startsWith(this._currentProjectDir)) {
        return { ok: false, error: 'Path traversal rejected' }
      }
      try {
        const content = await fs.promises.readFile(resolved, 'utf-8')
        return { ok: true, content }
      } catch (err) {
        return { ok: false, error: String(err) }
      }
    })

    // Git status (for GitPanel)
    ipcMain.handle('prism:gitStatus', async () => {
      if (!this._currentProjectDir) return { ok: false, error: 'No project open' }
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { execSync } = require('child_process') as typeof import('child_process')
        const raw = execSync('git status --porcelain', {
          cwd: this._currentProjectDir,
          encoding: 'utf-8',
        })
        const staged: Array<{ path: string; status: string }> = []
        const unstaged: Array<{ path: string; status: string }> = []
        for (const line of raw.split('\n').filter(Boolean)) {
          const index = line[0]
          const worktree = line[1]
          const filePath = line.slice(3)
          if (index !== ' ' && index !== '?') staged.push({ path: filePath, status: index })
          if (worktree !== ' ')
            unstaged.push({ path: filePath, status: worktree === '?' ? 'U' : worktree })
        }
        return { ok: true, staged, unstaged }
      } catch (err) {
        return { ok: false, error: String(err) }
      }
    })

    // Git log (for GitGraphView)
    ipcMain.handle('prism:gitLog', async (_event, opts?: { limit?: number }) => {
      if (!this._currentProjectDir) return { ok: false, error: 'No project open' }
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { execSync } = require('child_process') as typeof import('child_process')
        const limit = opts?.limit ?? 50
        const raw = execSync(
          `git log -${limit} --format="%H%n%h%n%an%n%ar%n%s%n%D%n---"`,
          { cwd: this._currentProjectDir, encoding: 'utf-8' },
        )
        const commits = raw
          .split('---\n')
          .filter(Boolean)
          .map((block: string) => {
            const [hash, shortHash, author, time, message, refs] = block.trim().split('\n')
            return { hash, shortHash, author, time, message, refs: refs ?? '' }
          })
        return { ok: true, commits }
      } catch (err) {
        return { ok: false, error: String(err) }
      }
    })

    // Git branch info (for GitPanel header)
    ipcMain.handle('prism:gitBranchInfo', async () => {
      if (!this._currentProjectDir) return { ok: false, error: 'No project open' }
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { execSync } = require('child_process') as typeof import('child_process')
        const branch = execSync('git rev-parse --abbrev-ref HEAD', {
          cwd: this._currentProjectDir,
          encoding: 'utf-8',
        }).trim()
        let ahead = 0
        let behind = 0
        try {
          const counts = execSync('git rev-list --left-right --count HEAD...@{upstream}', {
            cwd: this._currentProjectDir,
            encoding: 'utf-8',
          })
            .trim()
            .split('\t')
          ahead = parseInt(counts[0]) || 0
          behind = parseInt(counts[1]) || 0
        } catch {
          /* no upstream */
        }
        return { ok: true, branch, ahead, behind }
      } catch (err) {
        return { ok: false, error: String(err) }
      }
    })

    // File tree listing (for FilesPanel)
    ipcMain.handle('prism:fileTree', async (_event, opts?: { depth?: number }) => {
      if (!this._currentProjectDir) return { ok: false, error: 'No project open' }
      try {
        const maxDepth = opts?.depth ?? 4
        const tree = await buildFileTree(this._currentProjectDir, maxDepth)
        return { ok: true, tree }
      } catch (err) {
        return { ok: false, error: String(err) }
      }
    })

    // Persist layout state (panel positions, collapsed states)
    const layoutStatePath = path.join(app.getPath('userData'), 'prism-layout-state.json')

    ipcMain.handle('prism:saveLayoutState', async (_event, state: unknown) => {
      try {
        fs.writeFileSync(layoutStatePath, JSON.stringify(state, null, 2), 'utf-8')
      } catch {
        // Non-critical — layout persistence is best-effort
      }
    })

    ipcMain.handle('prism:loadLayoutState', async () => {
      try {
        const raw = fs.readFileSync(layoutStatePath, 'utf-8')
        return JSON.parse(raw)
      } catch {
        return null
      }
    })

    // Workspace discovery
    ipcMain.handle('prism:discoverProjects', async () => {
      const projectDir = this._currentProjectDir
      if (!projectDir) return []
      try {
        return await discoverProjects(projectDir)
      } catch {
        return []
      }
    })

    // Add a path to the global workspaces registry
    ipcMain.handle('prism:addWorkspace', async (_event, projectPath: string) => {
      try {
        await addToGlobalWorkspaces(projectPath)
        return { ok: true }
      } catch (err) {
        return { ok: false, error: String(err) }
      }
    })

    // Open a project folder via native dialog and add to global registry
    ipcMain.handle('prism:browseAndAddWorkspace', async () => {
      const result = await dialog.showOpenDialog(this.mainWindow, {
        properties: ['openDirectory'],
        title: 'Add Workspace',
      })
      if (!result.canceled && result.filePaths[0]) {
        try {
          await addToGlobalWorkspaces(result.filePaths[0])
          return { ok: true, path: result.filePaths[0] }
        } catch (err) {
          return { ok: false, error: String(err) }
        }
      }
      return { ok: false }
    })

    // List git worktrees for the current project
    ipcMain.handle('prism:listWorktrees', async () => {
      const projectDir = this._currentProjectDir
      if (!projectDir) return []
      try {
        return await listWorktrees(projectDir)
      } catch {
        return []
      }
    })

    // Create a new git worktree for the given branch name
    ipcMain.handle('prism:createWorktree', async (_event, branchName: string) => {
      const projectDir = this._currentProjectDir
      if (!projectDir) return { ok: false, error: 'No project open' }
      try {
        await createWorktree(projectDir, branchName)
        return { ok: true }
      } catch (err) {
        return { ok: false, error: String(err) }
      }
    })

    // Delete a git worktree (and optionally its branch).
    // Args are packed into an array by the renderer: [worktreePath, deleteBranch, branchName]
    ipcMain.handle(
      'prism:deleteWorktree',
      async (_event, args: [string, boolean, string]) => {
        const projectDir = this._currentProjectDir
        if (!projectDir) return { ok: false, error: 'No project open' }
        const [worktreePath, deleteBranch, branchName] = args
        try {
          await deleteWorktree(projectDir, worktreePath, deleteBranch, branchName)
          return { ok: true }
        } catch (err) {
          return { ok: false, error: String(err) }
        }
      },
    )

    // Switch the active project to the given directory (e.g. opening a worktree)
    ipcMain.handle('prism:switchProject', async (_event, dir: string) => {
      try {
        await this.setProjectDir(dir)
        return { ok: true }
      } catch (err) {
        return { ok: false, error: String(err) }
      }
    })

    // Execute a quality gate command in the current project directory
    ipcMain.handle('prism:executeGate', async (_event, command: string) => {
      const projectDir = this._currentProjectDir
      if (!projectDir) return { success: false, output: 'No project open', duration: 0 }
      // Create an AbortController so the renderer can cancel this gate
      const ac = new AbortController()
      this._gateAbortControllers.set(command, ac)
      try {
        return await executeGate(command, projectDir, ac.signal)
      } finally {
        this._gateAbortControllers.delete(command)
      }
    })

    // Cancel a running quality gate by command string
    ipcMain.handle('prism:cancelGate', (_event, command: string) => {
      const ac = this._gateAbortControllers.get(command)
      if (ac) {
        ac.abort()
        this._gateAbortControllers.delete(command)
        return { ok: true }
      }
      return { ok: false, reason: 'Gate not running' }
    })

    // Research file discovery
    ipcMain.handle('prism:getResearch', async () => {
      const projectDir = this._currentProjectDir
      if (!projectDir) return []
      const prismDir = path.join(projectDir, '.prism')
      try {
        return await discoverResearch(prismDir)
      } catch {
        return []
      }
    })

    // Plans file discovery
    ipcMain.handle('prism:getPlans', async () => {
      const projectDir = this._currentProjectDir
      if (!projectDir) return []
      const prismDir = path.join(projectDir, '.prism')
      try {
        return await discoverPlans(prismDir)
      } catch {
        return []
      }
    })

    // ── API key management (Phase 19) ────────────────────────────────────────

    ipcMain.handle('prism:getApiKey', async () => {
      try {
        return await getApiKey(this._secretStorage)
      } catch {
        return undefined
      }
    })

    ipcMain.handle('prism:setApiKey', async (_event, key: string) => {
      try {
        await setApiKey(this._secretStorage, key)
        return { ok: true }
      } catch (err) {
        return { ok: false, error: String(err) }
      }
    })

    ipcMain.handle('prism:deleteApiKey', async () => {
      try {
        await deleteApiKey(this._secretStorage)
        return { ok: true }
      } catch (err) {
        return { ok: false, error: String(err) }
      }
    })

    ipcMain.handle('prism:validateApiKey', (_event, key: string) => {
      return isValidApiKey(key)
    })
  }

  /** Called from native menu "Open Project…" action. */
  async openProject(): Promise<void> {
    const result = await dialog.showOpenDialog(this.mainWindow, {
      properties: ['openDirectory'],
      title: 'Open Prism Project',
    })
    if (!result.canceled && result.filePaths[0]) {
      await this.setProjectDir(result.filePaths[0])
    }
  }

  dispose(): void {
    ipcMain.removeHandler('grpc_request')
    ipcMain.removeHandler('grpc_request_cancel')
    ipcMain.removeHandler('daemon:status')
    ipcMain.removeHandler('daemon:start')
    ipcMain.removeHandler('daemon:stop')
    ipcMain.removeHandler('daemon:restart')
    this._daemonManager.off('statusChange', this._onDaemonStatus)
    ipcMain.removeHandler('prism:openProject')
    ipcMain.removeHandler('shell:openExternal')
    ipcMain.removeHandler('prism:readFile')
    ipcMain.removeHandler('prism:gitStatus')
    ipcMain.removeHandler('prism:gitLog')
    ipcMain.removeHandler('prism:gitBranchInfo')
    ipcMain.removeHandler('prism:fileTree')
    ipcMain.removeHandler('prism:saveLayoutState')
    ipcMain.removeHandler('prism:loadLayoutState')
    ipcMain.removeHandler('prism:discoverProjects')
    ipcMain.removeHandler('prism:addWorkspace')
    ipcMain.removeHandler('prism:browseAndAddWorkspace')
    ipcMain.removeHandler('prism:listWorktrees')
    ipcMain.removeHandler('prism:createWorktree')
    ipcMain.removeHandler('prism:deleteWorktree')
    ipcMain.removeHandler('prism:switchProject')
    ipcMain.removeHandler('prism:executeGate')
    ipcMain.removeHandler('prism:cancelGate')
    // Abort any in-flight gate executions
    for (const ac of this._gateAbortControllers.values()) { ac.abort() }
    this._gateAbortControllers.clear()
    ipcMain.removeHandler('prism:getResearch')
    ipcMain.removeHandler('prism:getPlans')
    ipcMain.removeHandler('prism:getApiKey')
    ipcMain.removeHandler('prism:setApiKey')
    ipcMain.removeHandler('prism:deleteApiKey')
    ipcMain.removeHandler('prism:validateApiKey')
    this._officeProvider.dispose()
    this.controller.dispose()
  }
}
