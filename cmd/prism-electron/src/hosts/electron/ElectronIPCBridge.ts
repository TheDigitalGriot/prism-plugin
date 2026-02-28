/**
 * ElectronIPCBridge — wires ipcMain handlers to ElectronPrismController.
 *
 * Replaces VscodeWebviewProvider: instead of webview.onDidReceiveMessage /
 * webview.postMessage, uses ipcMain.handle / mainWindow.webContents.send.
 */

import { BrowserWindow, ipcMain, dialog, shell } from 'electron'
import { handleGrpcRequest } from '@prism-core/core/controller/grpc-handler'
import { ElectronPrismController } from './ElectronPrismController'

export class ElectronIPCBridge {
  private controller: ElectronPrismController
  private _currentProjectDir: string | undefined

  constructor(private mainWindow: BrowserWindow) {
    this.controller = new ElectronPrismController()
    this.controller.setPostMessageFn(async (msg) => {
      mainWindow.webContents.send('grpc_response', msg)
    })
    this._registerHandlers()
  }

  /** The currently open project directory (undefined if no project opened). */
  get currentProjectDir(): string | undefined {
    return this._currentProjectDir
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
    this.controller.dispose()
  }
}
