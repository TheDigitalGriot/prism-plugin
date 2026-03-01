/**
 * ElectronOfficeProvider — main-process office orchestrator for Electron.
 *
 * Responsibilities:
 *   - Load assets from bundled assets/ directory on startup
 *   - Manage agent lifecycle via ElectronAgentManager
 *   - Dispatch office messages to/from the renderer
 *   - Subscribe to ElectronPrismController events for Spectrum→Office pipeline
 *
 * Message flow:
 *   Renderer → ipcMain.on('office:action') → _handleRendererMessage()
 *   Main     → win.webContents.send('office:message') → renderer
 */

import * as path from 'path'
import * as fs from 'fs'
import * as os from 'os'
import { BrowserWindow, app, ipcMain } from 'electron'
import { ElectronAgentManager } from './ElectronAgentManager'
import { ElectronPrismController } from '../hosts/electron/ElectronPrismController'
import {
  loadFurnitureAssets,
  sendAssetsToWebview,
  loadCharacterSprites,
  sendCharacterSpritesToWebview,
  loadFloorTiles,
  sendFloorTilesToWebview,
  loadWallTiles,
  sendWallTilesToWebview,
  loadDefaultLayout,
} from '@prism-core/office/assetLoader'
import {
  loadLayout,
  writeLayoutToFile,
  watchLayoutFile,
} from '@prism-core/office/layoutPersistence'
import type { LayoutWatcher } from '@prism-core/office/layoutPersistence'
import type { PostMessageFn } from '@prism-core/office/types'
import type { AgentSessionData, UpdatedStoryData } from '@prism-core/core/controller/types'

export class ElectronOfficeProvider {
  private _win: BrowserWindow
  private _controller: ElectronPrismController
  private _agentManager: ElectronAgentManager
  private _postMessage: PostMessageFn
  private _layoutWatcher: LayoutWatcher | null = null

  /** sessionId → agentId for active Spectrum runs */
  private _spectrumAgents: Map<string, number> = new Map()

  /** Bound handler stored so we can remove it precisely in dispose() */
  private _officeActionHandler: (event: Electron.IpcMainEvent, msg: unknown) => void

  constructor(win: BrowserWindow, controller: ElectronPrismController) {
    this._win = win
    this._controller = controller
    this._agentManager = new ElectronAgentManager(win)

    this._postMessage = (msg) => {
      if (!this._win.isDestroyed()) {
        this._win.webContents.send('office:message', msg)
      }
    }

    // Subscribe to controller events for Spectrum / Chat integration
    this._controller.on('sessionStart', (data: AgentSessionData) => {
      this._onSessionStart(data)
    })
    this._controller.on('spectrumStoryEnd', (data: { sessionId: string }) => {
      this._onSpectrumStoryEnd(data.sessionId)
    })
    this._controller.on('storyUpdate', (data: UpdatedStoryData) => {
      this._onStoryUpdate(data)
    })

    // Watch layout file for external changes (other windows writing it)
    this._layoutWatcher = watchLayoutFile((layout) => {
      this._postMessage({ type: 'layoutLoaded', layout })
    })

    // Register the office:action IPC handler (renderer → main)
    this._officeActionHandler = (_event, msg) => {
      this._handleRendererMessage(msg)
    }
    ipcMain.on('office:action', this._officeActionHandler)
  }

  // ---------------------------------------------------------------------------
  // Controller event handlers
  // ---------------------------------------------------------------------------

  private _onSessionStart(data: AgentSessionData): void {
    if (!data.isSpectrum) return

    const projectRoot = this._controller._projectDir
    if (!projectRoot) {
      console.warn('[Prism Office] sessionStart: no project directory set, cannot create agent')
      return
    }

    const projectDirPath = this._agentManager.getProjectDirPath(projectRoot)
    const agentId = this._agentManager.createHeadlessAgent(data.sessionId, projectDirPath)
    this._spectrumAgents.set(data.sessionId, agentId)

    // Forward story context immediately if available
    if (data.storyId && data.storyTitle) {
      this._postMessage({
        type: 'agentStoryContext',
        agentId,
        storyId: data.storyId,
        storyTitle: data.storyTitle,
      })
    }

    console.log(
      `[Prism Office] Spectrum agent created: id=${agentId} sessionId=${data.sessionId}`,
    )
  }

  private _onSpectrumStoryEnd(sessionId: string): void {
    const agentId = this._spectrumAgents.get(sessionId)
    if (agentId === undefined) {
      console.log(`[Prism Office] spectrumStoryEnd: no agent found for sessionId=${sessionId}`)
      return
    }
    this._agentManager.removeAgent(agentId)
    this._spectrumAgents.delete(sessionId)
    console.log(`[Prism Office] Spectrum agent removed: id=${agentId} sessionId=${sessionId}`)
  }

  private _onStoryUpdate(data: UpdatedStoryData): void {
    // Forward updated story context to all active Spectrum agents
    for (const agentId of this._spectrumAgents.values()) {
      this._postMessage({
        type: 'agentStoryContext',
        agentId,
        storyId: data.storyId,
        storyTitle: data.storyTitle,
      })
    }
  }

  // ---------------------------------------------------------------------------
  // Renderer message handler
  // ---------------------------------------------------------------------------

  private _handleRendererMessage(msg: unknown): void {
    if (!msg || typeof msg !== 'object') return
    const message = msg as { type: string; [key: string]: unknown }

    switch (message.type) {
      case 'webviewReady':
        void this._onWebviewReady()
        break

      case 'openClaude': {
        const cwd = (message.cwd as string | undefined) ?? this._controller._projectDir
        if (cwd) {
          const agentId = this._agentManager.launchAgent(cwd)
          console.log(`[Prism Office] openClaude: launched agent ${agentId} in ${cwd}`)
        } else {
          console.warn('[Prism Office] openClaude: no project directory available')
        }
        break
      }

      case 'focusAgent':
        // No-op in Electron (no terminal window to focus)
        break

      case 'closeAgent': {
        const agentId = message.id as number
        this._agentManager.removeAgent(agentId)
        break
      }

      case 'saveAgentSeats': {
        this._saveAgentSeats(message.seats as unknown[])
        break
      }

      case 'saveLayout': {
        if (message.layout && typeof message.layout === 'object') {
          writeLayoutToFile(message.layout as Record<string, unknown>)
          this._layoutWatcher?.markOwnWrite()
        }
        break
      }

      default:
        console.log(`[Prism Office] Unknown renderer message: ${message.type}`)
    }
  }

  // ---------------------------------------------------------------------------
  // Webview ready — load and broadcast all assets
  // ---------------------------------------------------------------------------

  private async _onWebviewReady(): Promise<void> {
    const assetsRoot = this._getAssetsRoot()
    console.log(`[Prism Office] Webview ready — loading assets from: ${assetsRoot}`)

    // Load all asset types in parallel
    const [charSprites, floorTiles, wallTiles, furnitureAssets, defaultLayout] = await Promise.all([
      loadCharacterSprites(assetsRoot),
      loadFloorTiles(assetsRoot),
      loadWallTiles(assetsRoot),
      loadFurnitureAssets(assetsRoot),
      Promise.resolve(loadDefaultLayout(assetsRoot)),
    ])

    if (charSprites) {
      sendCharacterSpritesToWebview(this._postMessage, charSprites)
    }
    if (floorTiles) {
      sendFloorTilesToWebview(this._postMessage, floorTiles)
    }
    if (wallTiles) {
      sendWallTilesToWebview(this._postMessage, wallTiles)
    }
    if (furnitureAssets) {
      sendAssetsToWebview(this._postMessage, furnitureAssets)
    }

    // Load persisted layout (or fall back to bundled default)
    const layout = loadLayout(defaultLayout)
    if (layout) {
      this._postMessage({ type: 'layoutLoaded', layout })
    }

    // Re-send any agents that were active before the renderer was ready
    this._agentManager.sendExistingAgents()

    console.log('[Prism Office] Assets sent to renderer')
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /**
   * Determine the root directory that contains the 'assets/' folder.
   *
   * - Development: cmd/prism-electron/../prism-vscode = cmd/prism-vscode/
   *   (the canonical source of truth for all office assets)
   * - Packaged: extraResource copies cmd/prism-vscode/assets → resources/assets/
   *   so we return process.resourcesPath which contains the assets/ subdirectory
   */
  private _getAssetsRoot(): string {
    if (app.isPackaged) {
      return process.resourcesPath
    }
    // In dev mode, app.getAppPath() = cmd/prism-electron/
    return path.resolve(app.getAppPath(), '..', 'prism-vscode')
  }

  private _saveAgentSeats(seats: unknown[]): void {
    const seatsPath = path.join(os.homedir(), '.prism', 'office-agent-seats.json')
    const dir = path.dirname(seatsPath)
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      fs.writeFileSync(seatsPath, JSON.stringify(seats, null, 2), 'utf-8')
    } catch (err) {
      console.error('[Prism Office] Failed to save agent seats:', err)
    }
  }

  dispose(): void {
    ipcMain.removeListener('office:action', this._officeActionHandler)
    this._layoutWatcher?.dispose()
    this._agentManager.dispose()
    this._spectrumAgents.clear()
    console.log('[Prism Office] ElectronOfficeProvider disposed')
  }
}
