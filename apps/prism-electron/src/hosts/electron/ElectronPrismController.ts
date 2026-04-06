/**
 * ElectronPrismController — platform shell for the Electron app.
 *
 * Extends BasePrismController, adding:
 *   - _projectDir storage (the currently open project)
 *   - setProjectDir() for the File → Open Project flow
 *   - _getWorkspaceRoot() returns _projectDir
 *
 * Gains for free from BasePrismController:
 *   - All gRPC handlers
 *   - agentBridge + session events ('sessionStart', 'storyUpdate', 'spectrumStoryEnd')
 *   - chokidar-based PrismWatcher
 *   - All chat/spectrum/mode-bridge logic
 */

import { BasePrismController } from '@prism-core/core/controller/BasePrismController'

export type { PostMessageFn } from '@prism-core/core/controller/types'

export class ElectronPrismController extends BasePrismController {
  /** The currently open project directory (set via setProjectDir). */
  _projectDir: string | undefined

  constructor() {
    super()
  }

  // ---------------------------------------------------------------------------
  // BasePrismController abstract implementation
  // ---------------------------------------------------------------------------

  protected _getWorkspaceRoot(): string | undefined {
    return this._projectDir
  }

  // ---------------------------------------------------------------------------
  // Electron-specific API
  // ---------------------------------------------------------------------------

  /** Set the active project directory and re-detect .prism/. */
  async setProjectDir(dir: string): Promise<void> {
    this._projectDir = dir
    await this._detectPrismDir()
  }
}
