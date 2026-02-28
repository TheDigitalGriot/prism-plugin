/**
 * ElectronIPCBridge — wires ipcMain handlers to ElectronPrismController.
 *
 * Replaces VscodeWebviewProvider: instead of webview.onDidReceiveMessage /
 * webview.postMessage, uses ipcMain.handle / mainWindow.webContents.send.
 */

import { BrowserWindow, ipcMain, dialog } from 'electron'
import { handleGrpcRequest } from '@prism-core/core/controller/grpc-handler'
import { ElectronPrismController } from './ElectronPrismController'

export class ElectronIPCBridge {
  private controller: ElectronPrismController

  constructor(private mainWindow: BrowserWindow) {
    this.controller = new ElectronPrismController()
    this.controller.setPostMessageFn(async (msg) => {
      mainWindow.webContents.send('grpc_response', msg)
    })
    this._registerHandlers()
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

    // Open a project folder via native dialog
    ipcMain.handle('prism:openProject', async () => {
      const result = await dialog.showOpenDialog(this.mainWindow, {
        properties: ['openDirectory'],
        title: 'Open Prism Project',
      })
      if (!result.canceled && result.filePaths[0]) {
        await this.controller.setProjectDir(result.filePaths[0])
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
      await this.controller.setProjectDir(result.filePaths[0])
    }
  }

  dispose(): void {
    ipcMain.removeHandler('grpc_request')
    ipcMain.removeHandler('grpc_request_cancel')
    ipcMain.removeHandler('prism:openProject')
    this.controller.dispose()
  }
}
