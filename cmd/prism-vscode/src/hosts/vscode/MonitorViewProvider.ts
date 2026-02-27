import * as child_process from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as util from 'util';
import * as vscode from 'vscode';
import type { PrismController } from '../../core/controller';

// Types mirrored from webview-panel/src/types/monitor.ts (kept in sync manually)
interface AgentStatus {
  id: number
  sessionId?: string
  storyId?: string
  storyTitle?: string
  agentType: string
  status: string
  worktreePath?: string
}

interface ExecutionRecord {
  storyId: string
  storyTitle: string
  result: 'complete' | 'error' | 'blocked'
  durationMs: number
  completedAt: string
  commitHash?: string
}

interface QualityGate {
  name: string
  command: string
  status: 'unknown' | 'pass' | 'fail' | 'running' | 'pending'
  lastRun?: string
  output?: string
  durationMs?: number
}

interface MonitorState {
  agents: AgentStatus[]
  history: ExecutionRecord[]
  gates: QualityGate[]
}

const execAsync = util.promisify(child_process.exec);

export class MonitorViewProvider implements vscode.WebviewViewProvider {
  static readonly VIEW_ID = 'prism.monitorView';

  private _webviewView: vscode.WebviewView | undefined;
  /** Mutable gate state — tracks run status independently of controller */
  private _gates: QualityGate[] = [];
  private _outputChannel: vscode.OutputChannel | undefined;

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

  private get _outputCh(): vscode.OutputChannel {
    if (!this._outputChannel) {
      this._outputChannel = vscode.window.createOutputChannel('Prism Quality Gates');
      this._context.subscriptions.push(this._outputChannel);
    }
    return this._outputChannel;
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

  /** Push current monitor state to the webview. */
  pushState(): void {
    if (!this._webview) return;
    const state = this._buildMonitorState();
    this._webview.postMessage({ type: 'monitorState', state });
  }

  /** Public: run a single quality gate by command string. */
  async runGate(command: string): Promise<void> {
    await this._runGate(command);
  }

  /** Public: run all quality gates concurrently. */
  async runAllGates(): Promise<void> {
    await Promise.all(this._gates.map((g) => this._runGate(g.command)));
  }

  // ---------------------------------------------------------------------------
  // State building
  // ---------------------------------------------------------------------------

  private _buildMonitorState(): MonitorState {
    const s = this._controller?.state;

    // ── Agents ────────────────────────────────────────────────────────────────
    const agents: AgentStatus[] = (s?.office?.activeAgents ?? []).map((a) => ({
      id: a.id,
      sessionId: a.sessionId,
      storyId: a.storyId,
      storyTitle: a.storyTitle,
      agentType: 'claude',   // default — the Office only tracks Claude agents currently
      status: 'active',
    }));

    // ── Execution history ─────────────────────────────────────────────────────
    const history: ExecutionRecord[] = (s?.stories ?? [])
      .filter((st) => st.status === 'complete')
      .map((st) => ({
        storyId: st.id,
        storyTitle: st.title,
        result: 'complete' as const,
        durationMs: 0,
        completedAt: (st as { completedAt?: string }).completedAt ?? new Date().toISOString(),
        commitHash: (st as { commitHash?: string }).commitHash,
      }))
      .sort((a, b) => b.completedAt.localeCompare(a.completedAt))
      .slice(0, 50);

    // ── Quality gates ─────────────────────────────────────────────────────────
    const planGates: string[] = s?.plan?.qualityGates ?? [];
    // Sync mutable gate state from plan (add new, remove deleted)
    const existingByCmd = new Map(this._gates.map((g) => [g.command, g]));
    this._gates = planGates.map((cmd) => {
      const existing = existingByCmd.get(cmd);
      if (existing) return existing;
      return { name: _gateLabel(cmd), command: cmd, status: 'unknown' as const };
    });

    return { agents, history, gates: this._gates };
  }

  // ---------------------------------------------------------------------------
  // Gate execution
  // ---------------------------------------------------------------------------

  private async _runGate(command: string): Promise<void> {
    const gate = this._gates.find((g) => g.command === command);
    if (!gate) return;

    gate.status = 'running';
    this.pushState();

    const workspaceRoot =
      vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? process.cwd();
    const startTime = Date.now();

    this._outputCh.appendLine(`\n[Prism Gates] Running: ${command}`);

    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: workspaceRoot,
        timeout: 60_000,
      });
      const combined = stdout + stderr;
      gate.status = 'pass';
      gate.output = _truncateOutput(combined, 50);
      this._outputCh.appendLine(`[PASS] ${command}\n${gate.output}`);
    } catch (err: unknown) {
      const execErr = err as { stdout?: string; stderr?: string; message?: string };
      const combined = (execErr.stdout ?? '') + (execErr.stderr ?? execErr.message ?? '');
      gate.status = 'fail';
      gate.output = _truncateOutput(combined, 50);
      this._outputCh.appendLine(`[FAIL] ${command}\n${gate.output}`);
    }

    gate.durationMs = Date.now() - startTime;
    gate.lastRun = new Date().toISOString();
    this.pushState();
  }

  // ---------------------------------------------------------------------------
  // Message handler
  // ---------------------------------------------------------------------------

  private async _handleMessage(message: { type: string; [key: string]: unknown }): Promise<void> {
    switch (message.type) {
      case 'webviewReady':
        this.pushState();
        break;
      case 'refresh':
        this.pushState();
        break;
      case 'runGate':
        await this._runGate(message.command as string);
        break;
      case 'runAllGates':
        await this.runAllGates();
        break;
    }
  }

  // ---------------------------------------------------------------------------
  // HTML generation
  // ---------------------------------------------------------------------------

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
      return this._getDevHtml(nonce, devServerUrl, 'monitor');
    }

    // Production: load from dist/webview-panel/
    const distPath = vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview-panel');
    const indexPath = vscode.Uri.joinPath(distPath, 'index.html').fsPath;

    if (fs.existsSync(indexPath)) {
      let html = fs.readFileSync(indexPath, 'utf-8');
      // Inject data-view="monitor"
      html = html.replace('data-view=""', 'data-view="monitor"');
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
  <title>Prism Monitor</title>
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
    <div>Monitor</div>
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
  <title>Prism Monitor (Dev)</title>
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

/** Derive a human-readable gate label from its command. */
function _gateLabel(command: string): string {
  const first = command.trim().split(/\s+/)[0] ?? command;
  // npm test → Tests, npm run build → Build, npx tsc → TypeScript
  const map: Record<string, string> = {
    test: 'Tests',
    build: 'Build',
    lint: 'Lint',
    tsc: 'TypeScript',
    typecheck: 'TypeCheck',
  };
  for (const [key, label] of Object.entries(map)) {
    if (command.includes(key)) return label;
  }
  return first.charAt(0).toUpperCase() + first.slice(1);
}

/** Keep last N lines of output. */
function _truncateOutput(output: string, lines: number): string {
  const all = output.trimEnd().split('\n');
  return all.slice(-lines).join('\n');
}
