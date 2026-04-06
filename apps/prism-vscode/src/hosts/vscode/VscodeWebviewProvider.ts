import * as vscode from "vscode"
import * as path from "path"
import { WebviewProvider, getNonce } from "../../core/webview/WebviewProvider"
import { PrismController } from "../../core/controller/index"
import { handleGrpcRequest } from "@prism-core/core/controller/grpc-handler"
import { WebviewToExtMessage } from "@prism-core/shared/PrismMessage"

/**
 * VS Code WebviewViewProvider implementation.
 *
 * Responsibilities:
 * - Generate webview HTML with proper CSP headers
 * - Set up bidirectional message passing (postMessage ↔ grpc handler)
 * - Manage lifecycle (dispose, visibility)
 */
export class VscodeWebviewProvider extends WebviewProvider implements vscode.WebviewViewProvider {
  public static readonly SIDEBAR_ID = "prism.sidebar"

  private _webviewView: vscode.WebviewView | undefined
  private _controller: PrismController
  private _disposables: vscode.Disposable[] = []

  constructor(private readonly _context: vscode.ExtensionContext) {
    super()
    this._controller = new PrismController(_context)
  }

  get controller(): PrismController {
    return this._controller
  }

  async resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): Promise<void> {
    this._webviewView = webviewView

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this._context.extensionUri, "webview-ui", "build"),
        vscode.Uri.joinPath(this._context.extensionUri, "media"),
      ],
    }

    webviewView.webview.html = this.getHtmlContent(webviewView.webview)

    // Wire the controller's post-message function to this webview
    this._controller.setPostMessageFn(async (msg) => {
      await this.sendToWebview(msg)
    })

    this._setWebviewMessageListener(webviewView.webview)

    // Re-send state when webview becomes visible again
    const visibilityListener = webviewView.onDidChangeVisibility(async () => {
      if (webviewView.visible) {
        await this._controller._detectPrismDir()
      }
    })

    webviewView.onDidDispose(() => {
      visibilityListener.dispose()
      this._disposables.forEach((d) => d.dispose())
      this._disposables = []
    })
  }

  private _setWebviewMessageListener(webview: vscode.Webview): void {
    const disposable = webview.onDidReceiveMessage(async (message: unknown) => {
      await this.handleMessage(message)
    })
    this._disposables.push(disposable)
  }

  async handleMessage(message: unknown): Promise<void> {
    const msg = message as WebviewToExtMessage

    if (msg.type === "grpc_request") {
      await handleGrpcRequest(
        async (response) => await this.sendToWebview(response),
        msg.grpc_request,
      )
    } else if (msg.type === "grpc_request_cancel") {
      this._controller.removeSubscriber(msg.grpc_request_cancel.request_id)
    }
  }

  async sendToWebview(message: unknown): Promise<void> {
    if (this._webviewView) {
      await this._webviewView.webview.postMessage(message)
    }
  }

  /** Send a command directly to the webview (bypasses gRPC). */
  async sendCommandToWebview(command: string, payload?: unknown): Promise<void> {
    await this.sendToWebview({ type: "command", command, payload })
  }

  getHtmlContent(webview: vscode.Webview): string {
    const nonce = getNonce()
    const cspSource = webview.cspSource

    // In production: load bundled assets from webview-ui/build
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._context.extensionUri, "webview-ui", "build", "assets", "main.js"),
    )
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._context.extensionUri, "webview-ui", "build", "assets", "index.css"),
    )

    // Check if we're in development mode (Vite dev server running)
    const vitePortPath = path.join(this._context.extensionUri.fsPath, "webview-ui", ".vite-port")
    let devServerUrl: string | null = null
    try {
      const port = require("fs").readFileSync(vitePortPath, "utf-8").trim()
      if (port && process.env.IS_PRODUCTION !== "true") {
        devServerUrl = `http://localhost:${port}`
      }
    } catch {
      // Not in dev mode
    }

    if (devServerUrl) {
      // HMR mode: load from Vite dev server
      return this._getDevHtml(nonce, devServerUrl)
    }

    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta
    http-equiv="Content-Security-Policy"
    content="
      default-src 'none';
      font-src ${cspSource} data:;
      style-src ${cspSource} 'unsafe-inline';
      img-src ${cspSource} https: data:;
      script-src 'nonce-${nonce}' 'unsafe-eval';
    "
  />
  <link rel="stylesheet" href="${styleUri}" />
  <title>Prism</title>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`
  }

  private _getDevHtml(nonce: string, devServerUrl: string): string {
    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta
    http-equiv="Content-Security-Policy"
    content="
      default-src 'none';
      connect-src ${devServerUrl} ws://localhost:*;
      font-src ${devServerUrl} data:;
      style-src 'unsafe-inline' ${devServerUrl};
      img-src https: data:;
      script-src 'nonce-${nonce}' 'unsafe-eval' ${devServerUrl};
    "
  />
  <title>Prism (Dev)</title>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" type="module">
    import RefreshRuntime from '${devServerUrl}/@react-refresh';
    RefreshRuntime.injectIntoGlobalHook(window);
    window.$RefreshReg$ = () => {};
    window.$RefreshSig$ = () => (type) => type;
    window.__vite_plugin_react_preamble_installed__ = true;
  </script>
  <script nonce="${nonce}" type="module" src="${devServerUrl}/@vite/client"></script>
  <script nonce="${nonce}" type="module" src="${devServerUrl}/src/main.tsx"></script>
</body>
</html>`
  }
}
