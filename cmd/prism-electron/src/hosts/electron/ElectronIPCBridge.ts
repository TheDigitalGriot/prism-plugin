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
import { ElectronPrismController } from './ElectronPrismController'
import { ElectronOfficeProvider } from '../../office/ElectronOfficeProvider'

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
  private _currentProjectDir: string | undefined

  constructor(private mainWindow: BrowserWindow) {
    this.controller = new ElectronPrismController()
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
    ipcMain.removeHandler('prism:openProject')
    ipcMain.removeHandler('shell:openExternal')
    ipcMain.removeHandler('prism:readFile')
    ipcMain.removeHandler('prism:gitStatus')
    ipcMain.removeHandler('prism:gitLog')
    ipcMain.removeHandler('prism:gitBranchInfo')
    ipcMain.removeHandler('prism:fileTree')
    ipcMain.removeHandler('prism:saveLayoutState')
    ipcMain.removeHandler('prism:loadLayoutState')
    this._officeProvider.dispose()
    this.controller.dispose()
  }
}
