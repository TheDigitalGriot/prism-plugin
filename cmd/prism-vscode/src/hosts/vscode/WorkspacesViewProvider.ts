import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import type { PrismController } from '../../core/controller';

export class WorkspacesViewProvider implements vscode.WebviewViewProvider {
  static readonly VIEW_ID = 'prism.workspacesView';

  private _webviewView: vscode.WebviewView | undefined;

  constructor(
    private readonly _context: vscode.ExtensionContext,
    private readonly _controller?: PrismController,
  ) {}

  private get _extensionUri(): vscode.Uri {
    return this._context.extensionUri;
  }

  private get _webview(): vscode.Webview | undefined {
    return this._webviewView?.webview;
  }

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this._webviewView = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this._extensionUri, 'dist'),
        vscode.Uri.joinPath(this._extensionUri, 'media'),
      ],
    };

    webviewView.webview.html = this._getWebviewContent(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(async (message) => {
      await this._handleMessage(message);
    });
  }

  /** Push current workspaces state to the webview. */
  pushState(): void {
    if (!this._webview) return;
    // TODO Phase 3: send full WorkspacesState
    this._webview.postMessage({ type: 'workspacesState', state: { projects: [], worktrees: [], loading: false } });
  }

  /** Update agent statuses from Office (called by extension.ts on state change). */
  updateAgentStatuses(_agents: unknown[]): void {
    // TODO Phase 3: map agents to worktrees
  }

  private async _handleMessage(message: { type: string; [key: string]: unknown }): Promise<void> {
    if (message.type === 'webviewReady') {
      this.pushState();
    } else if (message.type === 'refresh') {
      this.pushState();
    } else if (message.type === 'openProject') {
      const projectPath = message.path as string;
      if (projectPath) {
        await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(projectPath));
      }
    } else if (message.type === 'openWorktree') {
      const worktreePath = message.path as string;
      if (worktreePath) {
        await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(worktreePath));
      }
    }
    // TODO Phase 3: handle createWorktree, deleteWorktree, addWorkspace
  }

  private _getWebviewContent(webview: vscode.Webview): string {
    const nonce = getNonce();
    const cspSource = webview.cspSource;

    // Check for Vite dev server (development mode)
    const vitePortPath = path.join(this._extensionUri.fsPath, 'webview-panel', '.vite-panel-port');
    let devServerUrl: string | null = null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const port = require('fs').readFileSync(vitePortPath, 'utf-8').trim() as string;
      if (port && process.env['IS_PRODUCTION'] !== 'true') {
        devServerUrl = `http://localhost:${port}`;
      }
    } catch {
      // Not in dev mode
    }

    if (devServerUrl) {
      return this._getDevHtml(nonce, devServerUrl, 'workspaces');
    }

    // Production: load from dist/webview-panel/
    const distPath = vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview-panel');
    const indexPath = vscode.Uri.joinPath(distPath, 'index.html').fsPath;

    if (fs.existsSync(indexPath)) {
      let html = fs.readFileSync(indexPath, 'utf-8');
      // Inject data-view="workspaces"
      html = html.replace('data-view=""', 'data-view="workspaces"');
      // Rewrite relative asset URLs to webview URIs
      html = html.replace(/(href|src)="\.\/([^"]+)"/g, (_match: string, attr: string, filePath: string) => {
        const fileUri = vscode.Uri.joinPath(distPath, filePath);
        const webviewUri = webview.asWebviewUri(fileUri);
        return `${attr}="${webviewUri}"`;
      });
      // Inject CSP after <head>
      const csp = [
        `default-src 'none'`,
        `style-src ${cspSource} 'unsafe-inline'`,
        `img-src ${cspSource} data:`,
        `font-src ${cspSource} data:`,
        `script-src ${cspSource} 'unsafe-eval'`,
      ].join('; ');
      html = html.replace('<head>', `<head>\n  <meta http-equiv="Content-Security-Policy" content="${csp}" />`);
      return html;
    }

    // Fallback placeholder
    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta
    http-equiv="Content-Security-Policy"
    content="
      default-src 'none';
      style-src ${cspSource} 'unsafe-inline';
      script-src 'nonce-${nonce}';
    "
  />
  <title>Prism Workspaces</title>
  <style>
    body {
      background: var(--vscode-panel-background);
      color: var(--vscode-foreground);
      font-family: var(--vscode-font-family, monospace);
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      margin: 0;
      font-size: 12px;
    }
    .loading { text-align: center; opacity: 0.6; }
  </style>
</head>
<body>
  <div class="loading">
    <div>Workspaces</div>
    <div style="margin-top:8px;font-size:10px;">Build webview-panel to activate</div>
  </div>
</body>
</html>`;
  }

  private _getDevHtml(nonce: string, devServerUrl: string, viewType: string): string {
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
  <title>Prism Workspaces (Dev)</title>
</head>
<body>
  <div id="root" data-view="${viewType}"></div>
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
</html>`;
  }
}

function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
