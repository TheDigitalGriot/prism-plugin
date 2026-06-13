import * as child_process from 'child_process';
import * as fs from 'fs';
import * as http from 'http';
import * as os from 'os';
import * as path from 'path';
import * as util from 'util';
import * as vscode from 'vscode';
import type { AgentState, PostMessageFn } from '@prism-core/office/types';
import {
  launchNewTerminal,
  removeAgent,
  restoreAgents,
  persistAgents,
  sendExistingAgents,
  sendLayout,
  getProjectDirPath,
  createHeadlessAgent,
} from '../../office/agentManager';
import { ensureProjectScan } from '../../office/fileWatcher';
import {
  loadFurnitureAssets,
  sendAssetsToWebview,
  loadFloorTiles,
  sendFloorTilesToWebview,
  loadWallTiles,
  sendWallTilesToWebview,
  loadCharacterSprites,
  sendCharacterSpritesToWebview,
  loadDefaultLayout,
} from '@prism-core/office/assetLoader';
import { WORKSPACE_KEY_AGENT_SEATS, GLOBAL_KEY_SOUND_ENABLED } from '@prism-core/office/constants';
import { writeLayoutToFile, readLayoutFromFile, watchLayoutFile } from '@prism-core/office/layoutPersistence';
import type { LayoutWatcher } from '@prism-core/office/layoutPersistence';
import type { PrismController } from '../../core/controller';

// ---------------------------------------------------------------------------
// Types — mirrored from webview (kept in sync manually)
// ---------------------------------------------------------------------------

interface AgentStatus {
  id: number;
  sessionId?: string;
  storyId?: string;
  storyTitle?: string;
  agentType: string;
  status: string;
  worktreePath?: string;
}

interface ExecutionRecord {
  storyId: string;
  storyTitle: string;
  result: 'complete' | 'error' | 'blocked';
  durationMs: number;
  completedAt: string;
  commitHash?: string;
}

interface QualityGate {
  name: string;
  command: string;
  status: 'unknown' | 'pass' | 'fail' | 'running' | 'pending';
  lastRun?: string;
  output?: string;
  durationMs?: number;
}

interface MonitorState {
  agents: AgentStatus[];
  history: ExecutionRecord[];
  gates: QualityGate[];
}

interface EpicInfo {
  name: string;
  storiesPath: string;
  storyCount: number;
  completedCount: number;
}

interface ProjectInfo {
  name: string;
  path: string;
  branch: string;
  storiesTotal: number;
  storiesComplete: number;
  epics: EpicInfo[];
  isCurrent: boolean;
}

interface WorktreeInfo {
  path: string;
  branch: string;
  head: string;
  isBare: boolean;
  isMain: boolean;
  prunable: boolean;
  agentStatus?: {
    agentType: string;
    status: string;
  };
}

interface WorkspacesState {
  projects: ProjectInfo[];
  worktrees: WorktreeInfo[];
  loading: boolean;
}

const execAsync = util.promisify(child_process.exec);

export class PrismPanelProvider implements vscode.WebviewViewProvider {
  static readonly VIEW_ID = 'prism.mainView';

  private _webviewView: vscode.WebviewView | undefined;

  // ── From OfficeViewProvider ──
  readonly nextAgentId = { current: 1 };
  readonly nextTerminalIndex = { current: 1 };
  readonly agents = new Map<number, AgentState>();
  readonly fileWatchers = new Map<number, fs.FSWatcher>();
  readonly pollingTimers = new Map<number, ReturnType<typeof setInterval>>();
  readonly waitingTimers = new Map<number, ReturnType<typeof setTimeout>>();
  readonly jsonlPollTimers = new Map<number, ReturnType<typeof setInterval>>();
  readonly permissionTimers = new Map<number, ReturnType<typeof setTimeout>>();
  readonly activeAgentId = { current: null as number | null };
  readonly knownJsonlFiles = new Set<string>();
  readonly projectScanTimer = { current: null as ReturnType<typeof setInterval> | null };
  private _defaultLayout: Record<string, unknown> | null = null;
  private _layoutWatcher: LayoutWatcher | null = null;
  private readonly _spectrumAgentMap = new Map<string, number>();
  private readonly _subscriptions: vscode.Disposable[] = [];

  // ── From MonitorViewProvider ──
  private _gates: QualityGate[] = [];
  private _outputChannel: vscode.OutputChannel | undefined;

  // ── From WorkspacesViewProvider ──
  private _cachedWorkspacesState: WorkspacesState = { projects: [], worktrees: [], loading: false };
  private _activeAgents: Array<{
    id: number;
    sessionId?: string;
    storyId?: string;
    storyTitle?: string;
  }> = [];

  // ── Unified panel state ──
  private _dividerPos: number = 55;
  private _activeView: 'monitor' | 'office' | 'design' = 'monitor';

  // ── Design Engine state ──
  private _designEngineProcess: child_process.ChildProcess | null = null;
  private _designEngineStatus: 'stopped' | 'starting' | 'running' | 'error' = 'stopped';
  private readonly _designEnginePort = 7456;
  private readonly _designRelayPort  = 7457;
  // Prism daemon-broker control plane (POST /call). When the broker is up, design
  // engine ops route through design-gen.*; otherwise each helper falls back to a
  // direct connection so the panel still works with no daemon running.
  private readonly _brokerPort = 6780;

  constructor(
    private readonly _context: vscode.ExtensionContext,
    private readonly _controller?: PrismController,
  ) {
    // Restore panel state from workspaceState
    this._dividerPos = this._context.workspaceState.get('prismPanelDividerPos', 55);
    this._activeView = this._context.workspaceState.get('prismPanelActiveView', 'monitor');

    // ── Controller subscriptions (from OfficeViewProvider constructor) ──
    if (_controller) {
      this._subscriptions.push(
        _controller.onDidStartSession(({ sessionId, storyId, storyTitle, isSpectrum }) => {
          _controller.agentBridge.registerSession(sessionId, { storyId, storyTitle });
          if (isSpectrum) {
            const projectDir = getProjectDirPath();
            if (projectDir) {
              const agentId = createHeadlessAgent(
                sessionId, projectDir,
                this.nextAgentId, this.agents, this.knownJsonlFiles,
                this.jsonlPollTimers, this.fileWatchers, this.pollingTimers,
                this.waitingTimers, this.permissionTimers, this._postMessage,
              );
              this._spectrumAgentMap.set(sessionId, agentId);
              this._persistAgents();
            }
          }
        }),
      );

      this._subscriptions.push(
        _controller.onDidEndSpectrumStory(({ sessionId }) => {
          const agentId = this._spectrumAgentMap.get(sessionId);
          if (agentId !== undefined) {
            removeAgent(
              agentId, this.agents,
              this.fileWatchers, this.pollingTimers, this.waitingTimers,
              this.permissionTimers, this.jsonlPollTimers, this._persistAgents,
            );
            this._spectrumAgentMap.delete(sessionId);
            this._webview?.postMessage({ type: 'agentClosed', id: agentId });
          }
        }),
      );

      this._subscriptions.push(
        _controller.onDidUpdateStory(() => {
          for (const [agentId, ctx] of _controller.agentBridge.getAllContexts()) {
            if (ctx.storyId) {
              this._webview?.postMessage({
                type: 'agentStoryContext',
                id: agentId,
                storyId: ctx.storyId,
                storyTitle: ctx.storyTitle ?? '',
              });
            }
          }
        }),
      );
    }

    // ── File watchers (from WorkspacesViewProvider) ──
    this._setupFileWatchers();
  }

  private get _extensionUri(): vscode.Uri {
    return this._context.extensionUri;
  }

  private get _webview(): vscode.Webview | undefined {
    return this._webviewView?.webview;
  }

  /** Wrapped postMessage function for office module calls (no vscode.Webview dependency). */
  private get _postMessage(): PostMessageFn | undefined {
    const webview = this._webview;
    if (!webview) return undefined;
    return (msg) => void webview.postMessage(msg);
  }

  private get _workspaceRoot(): string {
    return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? process.cwd();
  }

  private get _outputCh(): vscode.OutputChannel {
    if (!this._outputChannel) {
      this._outputChannel = vscode.window.createOutputChannel('Prism Quality Gates');
      this._context.subscriptions.push(this._outputChannel);
    }
    return this._outputChannel;
  }

  // ---------------------------------------------------------------------------
  // WebviewViewProvider
  // ---------------------------------------------------------------------------

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

    vscode.window.onDidChangeActiveTerminal((terminal) => {
      this.activeAgentId.current = null;
      if (!terminal) return;
      for (const [id, agent] of this.agents) {
        if (agent.terminalRef === terminal) {
          this.activeAgentId.current = id;
          webviewView.webview.postMessage({ type: 'agentSelected', id });
          break;
        }
      }
    });

    vscode.window.onDidCloseTerminal((closed) => {
      for (const [id, agent] of this.agents) {
        if (agent.terminalRef === closed) {
          if (this.activeAgentId.current === id) {
            this.activeAgentId.current = null;
          }
          removeAgent(
            id, this.agents,
            this.fileWatchers, this.pollingTimers, this.waitingTimers, this.permissionTimers,
            this.jsonlPollTimers, this._persistAgents,
          );
          webviewView.webview.postMessage({ type: 'agentClosed', id });
        }
      }
    });

    webviewView.onDidDispose(() => {
      this.dispose();
    });
  }

  // ---------------------------------------------------------------------------
  // Public API (called from extension.ts)
  // ---------------------------------------------------------------------------

  /** Push current monitor state to the webview. */
  pushMonitorState(): void {
    if (!this._webview) return;
    const state = this._buildMonitorState();
    this._webview.postMessage({ type: 'monitorState', state });
  }

  /** Push current workspaces state to the webview. */
  pushWorkspacesState(): void {
    if (!this._webview) return;
    this._webview.postMessage({ type: 'workspacesState', state: this._cachedWorkspacesState });
  }

  /** Update agent statuses from controller (called by extension.ts on state change). */
  updateAgentStatuses(agents: Array<{ id: number; sessionId?: string; storyId?: string; storyTitle?: string }>): void {
    this._activeAgents = agents;
    if (this._webview) {
      this.pushWorkspacesState();
    }
  }

  /** Public: run a single quality gate by command string. */
  async runGate(command: string): Promise<void> {
    await this._runGate(command);
  }

  /** Public: run all quality gates concurrently. */
  async runAllGates(): Promise<void> {
    await Promise.all(this._gates.map((g) => this._runGate(g.command)));
  }

  /** Launch a new Claude Code terminal (called from command palette). */
  launchNewTerminal(): void {
    launchNewTerminal(
      this.nextAgentId, this.nextTerminalIndex,
      this.agents, this.activeAgentId, this.knownJsonlFiles,
      this.fileWatchers, this.pollingTimers, this.waitingTimers, this.permissionTimers,
      this.jsonlPollTimers, this.projectScanTimer,
      this._postMessage, this._persistAgents,
    );
  }

  /** Export current saved layout to webview-office/public/assets/default-layout.json (dev utility). */
  exportDefaultLayout(): void {
    const layout = readLayoutFromFile();
    if (!layout) {
      void vscode.window.showWarningMessage('Prism Office: No saved layout found.');
      return;
    }
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) {
      void vscode.window.showErrorMessage('Prism Office: No workspace folder found.');
      return;
    }
    const targetPath = path.join(workspaceRoot, 'webview-office', 'public', 'assets', 'default-layout.json');
    fs.writeFileSync(targetPath, JSON.stringify(layout, null, 2), 'utf-8');
    void vscode.window.showInformationMessage(`Prism Office: Default layout exported to ${targetPath}`);
  }

  /** Public: create a worktree from extension command. */
  async createWorktree(branchName: string): Promise<void> {
    await this._createWorktree(branchName);
  }

  /** Public: delete a worktree from extension command. */
  async deleteWorktree(worktreePath: string, deleteBranch: boolean): Promise<void> {
    await this._deleteWorktree(worktreePath, '', deleteBranch);
  }

  // ---------------------------------------------------------------------------
  // Message handler
  // ---------------------------------------------------------------------------

  private async _handleMessage(message: { type: string; [key: string]: unknown }): Promise<void> {
    switch (message.type) {
      // ── Panel-level messages ──
      case 'ready':
        await this._sendInitialState();
        break;

      case 'dividerPositionChanged':
        this._dividerPos = message.value as number;
        await this._context.workspaceState.update('prismPanelDividerPos', this._dividerPos);
        break;

      case 'viewToggleChanged':
        this._activeView = message.value as 'monitor' | 'office' | 'design';
        await this._context.workspaceState.update('prismPanelActiveView', this._activeView);
        break;

      // ── Monitor messages ──
      case 'webviewReady':
        await this._sendInitialState();
        break;

      case 'runGate':
        await this._runGate(message.command as string);
        break;

      case 'runAllGates':
        await this.runAllGates();
        break;

      case 'refresh':
        this.pushMonitorState();
        await this._refreshWorkspacesAll();
        break;

      // ── Workspaces messages ──
      case 'openProject': {
        const projectPath = message.path as string;
        if (projectPath) {
          await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(projectPath));
        }
        break;
      }

      case 'openWorktree': {
        const worktreePath = message.path as string;
        if (worktreePath) {
          await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(worktreePath));
        }
        break;
      }

      case 'createWorktree': {
        const branch = message.branch as string;
        if (branch) {
          await this._createWorktree(branch);
        }
        break;
      }

      case 'deleteWorktree': {
        const wtPath = message.path as string;
        const wtBranch = message.branch as string;
        const deleteBranch = message.deleteBranch as boolean;
        const confirm = await vscode.window.showWarningMessage(
          `Delete worktree "${path.basename(wtPath)}"?${deleteBranch ? ' (branch will also be deleted)' : ''}`,
          { modal: true },
          'Delete',
        );
        if (confirm === 'Delete') {
          await this._deleteWorktree(wtPath, wtBranch, deleteBranch);
        }
        break;
      }

      case 'addWorkspace': {
        const addPath = message.path as string;
        if (addPath) {
          await this._addToGlobalWorkspaces(addPath);
          await this._refreshWorkspacesAll();
        }
        break;
      }

      case 'pickAndAddWorkspace': {
        const uris = await vscode.window.showOpenDialog({
          canSelectFolders: true,
          canSelectMany: false,
          openLabel: 'Add Workspace',
        });
        if (uris && uris[0]) {
          await this._addToGlobalWorkspaces(uris[0].fsPath);
          await this._refreshWorkspacesAll();
        }
        break;
      }

      // ── Office messages ──
      case 'openClaude':
        launchNewTerminal(
          this.nextAgentId, this.nextTerminalIndex,
          this.agents, this.activeAgentId, this.knownJsonlFiles,
          this.fileWatchers, this.pollingTimers, this.waitingTimers, this.permissionTimers,
          this.jsonlPollTimers, this.projectScanTimer,
          this._postMessage, this._persistAgents,
        );
        break;

      case 'focusAgent': {
        const agent = this.agents.get(message.id as number);
        if (agent?.terminalRef) {
          (agent.terminalRef as vscode.Terminal).show();
        }
        break;
      }

      case 'closeAgent': {
        const agent = this.agents.get(message.id as number);
        if (agent?.terminalRef) {
          (agent.terminalRef as vscode.Terminal).dispose();
          // Terminal close handler will call removeAgent + postMessage agentClosed
        } else if (agent) {
          // Headless agent (no terminal) — remove directly
          removeAgent(
            agent.id, this.agents,
            this.fileWatchers, this.pollingTimers, this.waitingTimers,
            this.permissionTimers, this.jsonlPollTimers, this._persistAgents,
          );
          this._webview?.postMessage({ type: 'agentClosed', id: agent.id });
        }
        break;
      }

      case 'saveAgentSeats':
        console.log(`[Prism Office] saveAgentSeats:`, JSON.stringify(message.seats));
        await this._context.workspaceState.update(WORKSPACE_KEY_AGENT_SEATS, message.seats);
        break;

      case 'saveLayout':
        this._layoutWatcher?.markOwnWrite();
        writeLayoutToFile(message.layout as Record<string, unknown>);
        break;

      case 'setSoundEnabled':
        await this._context.globalState.update(GLOBAL_KEY_SOUND_ENABLED, message.enabled);
        break;

      case 'openSessionsFolder': {
        const projectDir = getProjectDirPath();
        if (projectDir && fs.existsSync(projectDir)) {
          void vscode.env.openExternal(vscode.Uri.file(projectDir));
        }
        break;
      }

      case 'exportLayout': {
        const layout = readLayoutFromFile();
        if (!layout) {
          void vscode.window.showWarningMessage('Prism Office: No saved layout to export.');
          break;
        }
        const uri = await vscode.window.showSaveDialog({
          filters: { 'JSON Files': ['json'] },
          defaultUri: vscode.Uri.file(path.join(os.homedir(), 'prism-office-layout.json')),
        });
        if (uri) {
          fs.writeFileSync(uri.fsPath, JSON.stringify(layout, null, 2), 'utf-8');
          void vscode.window.showInformationMessage('Prism Office: Layout exported successfully.');
        }
        break;
      }

      case 'importLayout': {
        const uris = await vscode.window.showOpenDialog({
          filters: { 'JSON Files': ['json'] },
          canSelectMany: false,
        });
        if (!uris || uris.length === 0) break;
        try {
          const raw = fs.readFileSync(uris[0].fsPath, 'utf-8');
          const imported = JSON.parse(raw) as Record<string, unknown>;
          if (imported.version !== 1 || !Array.isArray(imported.tiles)) {
            void vscode.window.showErrorMessage('Prism Office: Invalid layout file.');
            break;
          }
          this._layoutWatcher?.markOwnWrite();
          writeLayoutToFile(imported);
          this._webview?.postMessage({ type: 'layoutLoaded', layout: imported });
          void vscode.window.showInformationMessage('Prism Office: Layout imported successfully.');
        } catch {
          void vscode.window.showErrorMessage('Prism Office: Failed to read or parse layout file.');
        }
        break;
      }

      // ── Design Engine messages ──────────────────────────────────────────

      case 'requestDesignEngineState':
        await this._pushDesignEngineState();
        break;

      case 'launchDesignEngine':
        await this._launchDesignEngine();
        break;

      case 'stopDesignEngine':
        await this._stopDesignEngine();
        break;

      case 'sendDesignPrompt': {
        const yaml = message.yaml as string | undefined;
        if (yaml) await this._sendDesignPrompt(yaml);
        break;
      }

      case 'openDesignArtifact': {
        const artifactPath = message.path as string | undefined;
        if (artifactPath) {
          if (artifactPath.endsWith('.html') || artifactPath.endsWith('.mp4') || artifactPath.endsWith('.pdf')) {
            void vscode.env.openExternal(vscode.Uri.file(artifactPath));
          } else {
            void vscode.window.showTextDocument(vscode.Uri.file(artifactPath));
          }
        }
        break;
      }

      case 'openFile': {
        const filePath = message.path as string | undefined;
        if (filePath) void vscode.window.showTextDocument(vscode.Uri.file(filePath));
        break;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Design Engine — private helpers
  // ---------------------------------------------------------------------------

  private _designEngineRepoPath(): string {
    return path.join(os.homedir(), 'Developer', 'prism-design-engine');
  }

  /**
   * Unary call to the Prism daemon broker's HTTP control plane (POST /call).
   * Resolves the parsed { ok, result?, error? } envelope, or null when the
   * broker is unreachable — callers treat null as "broker down, fall back to
   * the direct connection". Uses the built-in `http` module (no ws/daemon-client
   * bundling, so this stays a zero-dependency migration).
   */
  private _brokerCall(
    method: string,
    payload?: unknown,
  ): Promise<{ ok: boolean; result?: unknown; error?: string } | null> {
    return new Promise((resolve) => {
      const body = JSON.stringify({ service: 'design-gen', method, payload });
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port: this._brokerPort,
          path: '/call',
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
        },
        (res) => {
          let data = '';
          res.on('data', (c) => (data += c));
          res.on('end', () => {
            try {
              resolve(JSON.parse(data) as { ok: boolean; result?: unknown; error?: string });
            } catch {
              resolve(null);
            }
          });
        },
      );
      req.on('error', () => resolve(null)); // ECONNREFUSED → broker not running
      req.setTimeout(2500, () => { req.destroy(); resolve(null); });
      req.write(body);
      req.end();
    });
  }

  private async _pushDesignEngineState(): Promise<void> {
    if (!this._webview) return;
    const artifacts = this._scanDesignArtifacts();
    const latestPrompt = this._readLatestDesignPrompt();
    const latestLedger = this._findLatestLedger();

    // Status of record: prefer the daemon broker (design-gen.state → relay /status).
    // The broker is the single source of truth for engine liveness when it's up;
    // fall back to a direct probe only when the broker is unreachable.
    const brokerState = await this._brokerCall('state');
    if (brokerState?.ok && brokerState.result && typeof brokerState.result === 'object') {
      const running = (brokerState.result as { running?: boolean }).running === true;
      if (running) this._designEngineStatus = 'running';
      else if (this._designEngineStatus !== 'starting') this._designEngineStatus = 'stopped';
    } else if (this._designEngineStatus === 'running') {
      const alive = await this._probeEngine();
      if (!alive) this._designEngineStatus = 'stopped';
    }

    this._webview.postMessage({
      type: 'designEngineState',
      state: {
        status: this._designEngineStatus,
        port: this._designEnginePort,
        version: '',
        artifacts,
        latestDesignPrompt: latestPrompt,
        latestLedger,
        activeSession: null,
      },
    });
  }

  private async _launchDesignEngine(): Promise<void> {
    if (this._designEngineProcess) return;

    // Prefer the daemon broker (design-gen.launch → design-studio relay spawns the
    // engine). When the broker handles it, the relay owns the process lifecycle —
    // we just reflect 'starting' and let the next state poll confirm 'running'.
    const viaBroker = await this._brokerCall('launch');
    if (viaBroker?.ok) {
      this._designEngineStatus = 'starting';
      await this._pushDesignEngineState();
      return;
    }

    const engineDaemon = path.join(this._designEngineRepoPath(), 'apps', 'daemon');
    if (!fs.existsSync(engineDaemon)) {
      void vscode.window.showErrorMessage(
        `Prism Design Engine not found at ${this._designEngineRepoPath()}. ` +
        'Clone TheDigitalGriot/prism-design-engine to ~/Developer/prism-design-engine first.',
      );
      this._designEngineStatus = 'error';
      await this._pushDesignEngineState();
      return;
    }

    this._designEngineStatus = 'starting';
    await this._pushDesignEngineState();

    const proc = child_process.spawn('pnpm', ['run', 'daemon'], {
      cwd: engineDaemon,
      shell: true,
      env: {
        ...process.env,
        OD_PORT: String(this._designEnginePort),
        OD_DEFAULT_DESIGN_SYSTEM: 'griotwave',
      },
    });

    this._designEngineProcess = proc;

    proc.on('spawn', () => {
      // Give the daemon a moment to bind the port
      setTimeout(async () => {
        const alive = await this._probeEngine();
        this._designEngineStatus = alive ? 'running' : 'starting';
        await this._pushDesignEngineState();
      }, 2500);
    });

    proc.on('exit', async () => {
      this._designEngineProcess = null;
      this._designEngineStatus = 'stopped';
      await this._pushDesignEngineState();
    });

    proc.on('error', async () => {
      this._designEngineProcess = null;
      this._designEngineStatus = 'error';
      await this._pushDesignEngineState();
    });
  }

  private async _stopDesignEngine(): Promise<void> {
    // Prefer the daemon broker (design-gen.stop → relay /stop). Only fall back to
    // killing a locally-spawned process when the broker didn't handle it.
    const viaBroker = await this._brokerCall('stop');
    if (!viaBroker?.ok && this._designEngineProcess) {
      this._designEngineProcess.kill('SIGTERM');
    }
    this._designEngineProcess = null;
    this._designEngineStatus = 'stopped';
    await this._pushDesignEngineState();
  }

  private async _sendDesignPrompt(yaml: string): Promise<void> {
    const payload = {
      brief: yaml,
      design_system: 'griotwave',
      type: 'prototype',
      source: 'prism-design',
    };

    // Prefer the daemon broker (design-gen.send → engine /api/chat). Same payload
    // shape on the wire either way, so the engine can't tell the difference.
    const viaBroker = await this._brokerCall('send', payload);
    if (viaBroker?.ok) return;

    return new Promise<void>((resolve) => {
      const body = JSON.stringify(payload);
      const req = http.request({
        hostname: 'localhost',
        port: this._designEnginePort,
        path: '/api/chat',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      }, () => resolve());
      req.on('error', () => {
        void vscode.window.showWarningMessage('Prism Design: engine not reachable at localhost:' + String(this._designEnginePort));
        resolve();
      });
      req.write(body);
      req.end();
    });
  }

  private _probeEngine(): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      const req = http.request(
        { hostname: 'localhost', port: this._designEnginePort, path: '/api/skills', method: 'GET' },
        (res) => { resolve(res.statusCode !== undefined && res.statusCode < 500); },
      );
      req.on('error', () => resolve(false));
      req.setTimeout(1500, () => { req.destroy(); resolve(false); });
      req.end();
    });
  }

  private _scanDesignArtifacts(): unknown[] {
    const root = this._workspaceRoot;
    const designsDir = path.join(root, '.prism', 'shared', 'designs');
    if (!fs.existsSync(designsDir)) return [];

    const EXTS: Record<string, string> = {
      '.md': 'md', '.pen': 'pen', '.html': 'html',
      '.pdf': 'pdf', '.pptx': 'pptx', '.mp4': 'mp4',
      '.zip': 'zip', '.yaml': 'yaml',
    };

    const results: unknown[] = [];
    const walk = (dir: string): void => {
      let entries: fs.Dirent[];
      try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
      for (const e of entries) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) { walk(full); continue; }
        const ext = path.extname(e.name).toLowerCase();
        if (!EXTS[ext]) continue;
        const stat = fs.statSync(full);
        const dateMatch = e.name.match(/^(\d{4}-\d{2}-\d{2})/);
        const topic = e.name.replace(/^\d{4}-\d{2}-\d{2}-/, '').replace(/[-_]/g, ' ').replace(/\.(md|pen|html|pdf|pptx|mp4|zip|yaml)$/, '');
        results.push({
          name: e.name,
          type: EXTS[ext],
          path: full,
          date: dateMatch ? dateMatch[1] : new Date(stat.mtimeMs).toISOString(),
          sizeKb: Math.round(stat.size / 1024),
          topic,
        });
      }
    };
    walk(designsDir);
    return results.sort((a: unknown, b: unknown) => {
      const ad = (a as { date: string }).date;
      const bd = (b as { date: string }).date;
      return bd.localeCompare(ad);
    });
  }

  private _readLatestDesignPrompt(): string | null {
    // Check idea_init's emitted design_prompt.yaml first
    const candidates = [
      path.join(this._workspaceRoot, '.prism', 'shared', 'designs', 'design_prompt.yaml'),
      path.join(os.homedir(), 'Developer', 'idea_init', 'idea_init app', 'app', 'design_prompt.yaml'),
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) {
        try { return fs.readFileSync(c, 'utf-8'); } catch { /* skip */ }
      }
    }
    return null;
  }

  private _findLatestLedger(): string | null {
    const ledgersDir = path.join(this._workspaceRoot, '.prism', 'shared', 'brainstorms');
    if (!fs.existsSync(ledgersDir)) return null;
    try {
      const files = fs.readdirSync(ledgersDir)
        .filter((f) => f.endsWith('.md'))
        .map((f) => path.join(ledgersDir, f))
        .sort()
        .reverse();
      return files[0] ?? null;
    } catch { return null; }
  }

  // ---------------------------------------------------------------------------
  // Initial state push (called when webview sends 'ready' or 'webviewReady')
  // ---------------------------------------------------------------------------

  private async _sendInitialState(): Promise<void> {
    if (!this._webview) return;

    // 1. Push panel state (divider pos, active view, version)
    this._webview.postMessage({
      type: 'initialState',
      dividerPos: this._dividerPos,
      activeView: this._activeView,
      version: this._controller?.state?.version ?? '',
    });

    // 2. Push monitor state
    this.pushMonitorState();

    // 3. Push workspaces state (refresh then push)
    await this._refreshWorkspacesAll();

    // 4. Push design engine state
    await this._pushDesignEngineState();

    // 5. Office initialization (from OfficeViewProvider webviewReady handler)
    restoreAgents(
      this._context,
      this.nextAgentId, this.nextTerminalIndex,
      this.agents, this.knownJsonlFiles,
      this.fileWatchers, this.pollingTimers, this.waitingTimers, this.permissionTimers,
      this.jsonlPollTimers, this.projectScanTimer, this.activeAgentId,
      this._postMessage, this._persistAgents,
    );

    const soundEnabled = this._context.globalState.get<boolean>(GLOBAL_KEY_SOUND_ENABLED, true);
    this._webview?.postMessage({ type: 'settingsLoaded', soundEnabled });

    const projectDir = getProjectDirPath();
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    console.log('[Prism] workspaceRoot:', workspaceRoot);
    console.log('[Prism] projectDir:', projectDir);

    if (projectDir) {
      ensureProjectScan(
        projectDir, this.knownJsonlFiles, this.projectScanTimer, this.activeAgentId,
        this.nextAgentId, this.agents,
        this.fileWatchers, this.pollingTimers, this.waitingTimers, this.permissionTimers,
        this._postMessage, this._persistAgents,
      );

      void (async () => {
        try {
          console.log('[Prism] Loading furniture assets...');
          const extensionPath = this._extensionUri.fsPath;
          console.log('[Prism] extensionPath:', extensionPath);

          const bundledAssetsDir = path.join(extensionPath, 'dist', 'assets');
          let assetsRoot: string | null = null;
          if (fs.existsSync(bundledAssetsDir)) {
            console.log('[Prism] Found bundled assets at dist/');
            assetsRoot = path.join(extensionPath, 'dist');
          } else if (workspaceRoot) {
            console.log('[Prism] Trying workspace for assets...');
            assetsRoot = workspaceRoot;
          }

          if (!assetsRoot) {
            console.log('[Prism] ⚠️  No assets directory found');
            const pm = this._postMessage;
            if (pm) {
              sendLayout(this._context, pm, this._defaultLayout);
              this._startLayoutWatcher();
            }
            return;
          }

          console.log('[Prism] Using assetsRoot:', assetsRoot);
          this._defaultLayout = loadDefaultLayout(assetsRoot);

          const charSprites = await loadCharacterSprites(assetsRoot);
          const pm1 = this._postMessage;
          if (charSprites && pm1) {
            sendCharacterSpritesToWebview(pm1, charSprites);
          }

          const floorTiles = await loadFloorTiles(assetsRoot);
          const pm2 = this._postMessage;
          if (floorTiles && pm2) {
            sendFloorTilesToWebview(pm2, floorTiles);
          }

          const wallTiles = await loadWallTiles(assetsRoot);
          const pm3 = this._postMessage;
          if (wallTiles && pm3) {
            sendWallTilesToWebview(pm3, wallTiles);
          }

          const assets = await loadFurnitureAssets(assetsRoot);
          const pm4 = this._postMessage;
          if (assets && pm4) {
            sendAssetsToWebview(pm4, assets);
          }
        } catch (err) {
          console.error('[Prism] ❌ Error loading assets:', err);
        }
        const pm5 = this._postMessage;
        if (pm5) {
          sendLayout(this._context, pm5, this._defaultLayout);
          this._startLayoutWatcher();
        }
      })();
    } else {
      // No project dir — still try to load floor/wall tiles
      void (async () => {
        try {
          const ep = this._extensionUri.fsPath;
          const bundled = path.join(ep, 'dist', 'assets');
          if (fs.existsSync(bundled)) {
            const distRoot = path.join(ep, 'dist');
            this._defaultLayout = loadDefaultLayout(distRoot);
            const cs = await loadCharacterSprites(distRoot);
            const pmA = this._postMessage;
            if (cs && pmA) {
              sendCharacterSpritesToWebview(pmA, cs);
            }
            const ft = await loadFloorTiles(distRoot);
            const pmB = this._postMessage;
            if (ft && pmB) {
              sendFloorTilesToWebview(pmB, ft);
            }
            const wt = await loadWallTiles(distRoot);
            const pmC = this._postMessage;
            if (wt && pmC) {
              sendWallTilesToWebview(pmC, wt);
            }
          }
        } catch { /* ignore */ }
        const pm6 = this._postMessage;
        if (pm6) {
          sendLayout(this._context, pm6, this._defaultLayout);
          this._startLayoutWatcher();
        }
      })();
    }

    sendExistingAgents(this.agents, this._context, this._postMessage);
  }

  // ---------------------------------------------------------------------------
  // Office helpers
  // ---------------------------------------------------------------------------

  private _persistAgents = (): void => {
    persistAgents(this.agents, this._context);
    this._syncAgentState();
  };

  private _syncAgentState(): void {
    if (!this._controller) return;
    const bridge = this._controller.agentBridge;
    const activeAgents = Array.from(this.agents.keys()).map((id) => {
      const ctx = bridge.getContext(id);
      return {
        id,
        sessionId: ctx?.sessionId,
        storyId: ctx?.storyId,
        storyTitle: ctx?.storyTitle,
      };
    });
    void this._controller.updateState({
      office: {
        enabled: true,
        agentCount: this.agents.size,
        activeAgents,
      },
    });
  }

  private _startLayoutWatcher(): void {
    if (this._layoutWatcher) return;
    this._layoutWatcher = watchLayoutFile((layout) => {
      console.log('[Prism] External layout change — pushing to webview');
      this._webview?.postMessage({ type: 'layoutLoaded', layout });
    });
  }

  // ---------------------------------------------------------------------------
  // Monitor helpers
  // ---------------------------------------------------------------------------

  private _buildMonitorState(): MonitorState {
    const s = this._controller?.state;

    const agents: AgentStatus[] = (s?.office?.activeAgents ?? []).map((a) => ({
      id: a.id,
      sessionId: a.sessionId,
      storyId: a.storyId,
      storyTitle: a.storyTitle,
      agentType: 'claude',
      status: 'active',
    }));

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

    const planGates: string[] = s?.epic?.qualityGates ?? [];
    const existingByCmd = new Map(this._gates.map((g) => [g.command, g]));
    this._gates = planGates.map((cmd) => {
      const existing = existingByCmd.get(cmd);
      if (existing) return existing;
      return { name: _gateLabel(cmd), command: cmd, status: 'unknown' as const };
    });

    return { agents, history, gates: this._gates };
  }

  private async _runGate(command: string): Promise<void> {
    const gate = this._gates.find((g) => g.command === command);
    if (!gate) return;

    gate.status = 'running';
    this.pushMonitorState();

    const workspaceRoot = this._workspaceRoot;
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
    this.pushMonitorState();
  }

  // ---------------------------------------------------------------------------
  // Workspaces helpers
  // ---------------------------------------------------------------------------

  private async _refreshWorkspacesAll(): Promise<void> {
    this._cachedWorkspacesState = { ...this._cachedWorkspacesState, loading: true };
    this.pushWorkspacesState();

    const [projects, worktrees] = await Promise.all([
      this._discoverProjects(),
      this._getWorktrees(),
    ]);

    this._cachedWorkspacesState = { projects, worktrees, loading: false };
    this.pushWorkspacesState();
  }

  private async _refreshProjects(): Promise<void> {
    const projects = await this._discoverProjects();
    this._cachedWorkspacesState = { ...this._cachedWorkspacesState, projects };
    this.pushWorkspacesState();
  }

  private async _refreshWorktrees(): Promise<void> {
    const worktrees = await this._getWorktrees();
    this._cachedWorkspacesState = { ...this._cachedWorkspacesState, worktrees };
    this.pushWorkspacesState();
  }

  private async _discoverProjects(): Promise<ProjectInfo[]> {
    const workspaceRoot = this._workspaceRoot;
    const parentDir = path.dirname(workspaceRoot);
    const seen = new Set<string>();
    const candidates: string[] = [];

    try {
      const siblings = await fs.promises.readdir(parentDir, { withFileTypes: true });
      for (const entry of siblings.slice(0, 50)) {
        if (!entry.isDirectory()) continue;
        const fullPath = path.join(parentDir, entry.name);
        try {
          await fs.promises.stat(path.join(fullPath, '.prism'));
          const resolved = path.resolve(fullPath);
          if (!seen.has(resolved)) {
            seen.add(resolved);
            candidates.push(resolved);
          }
        } catch {
          // No .prism/ — skip
        }
      }
    } catch {
      // Can't read parent dir — no-op
    }

    try {
      const globalPath = path.join(os.homedir(), '.prism', 'workspaces.json');
      const raw = await fs.promises.readFile(globalPath, 'utf-8');
      const parsed = JSON.parse(raw) as { paths?: string[]; workspaces?: string[] };
      const globalPaths = parsed.paths ?? parsed.workspaces ?? [];
      for (const p of globalPaths) {
        const resolved = path.resolve(p);
        if (!seen.has(resolved)) {
          seen.add(resolved);
          candidates.push(resolved);
        }
      }
    } catch {
      // File doesn't exist or malformed — skip
    }

    const currentResolved = path.resolve(workspaceRoot);
    const projects: ProjectInfo[] = [];

    await Promise.all(
      candidates.map(async (projectPath) => {
        try {
          const info = await this._buildProjectInfo(projectPath, currentResolved);
          if (info) projects.push(info);
        } catch {
          // Skip broken projects
        }
      }),
    );

    projects.sort((a, b) => {
      if (a.isCurrent && !b.isCurrent) return -1;
      if (!a.isCurrent && b.isCurrent) return 1;
      return a.name.localeCompare(b.name);
    });

    return projects;
  }

  private async _buildProjectInfo(projectPath: string, currentResolved: string): Promise<ProjectInfo | null> {
    try {
      const stat = await fs.promises.stat(projectPath);
      if (!stat.isDirectory()) return null;
    } catch {
      return null;
    }

    const name = path.basename(projectPath);
    const isCurrent = projectPath === currentResolved;

    let branch = 'unknown';
    try {
      const { stdout } = await execAsync('git rev-parse --abbrev-ref HEAD', {
        cwd: projectPath,
        timeout: 5_000,
      });
      branch = stdout.trim() || 'unknown';
    } catch {
      // Not a git repo or git not installed
    }

    const prismDir = path.join(projectPath, '.prism');
    const epics: EpicInfo[] = [];
    let storiesTotal = 0;
    let storiesComplete = 0;

    const rootStoriesPaths = [
      path.join(prismDir, 'stories', 'stories.json'),
      path.join(prismDir, 'stories.json'),
    ];
    for (const sp of rootStoriesPaths) {
      const result = _parseStoriesJson(sp);
      if (result) {
        storiesTotal += result.total;
        storiesComplete += result.complete;
        break;
      }
    }

    try {
      const storiesDir = path.join(prismDir, 'stories');
      const entries = await fs.promises.readdir(storiesDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const epicStoriesPath = path.join(storiesDir, entry.name, 'stories.json');
        const result = _parseStoriesJson(epicStoriesPath);
        if (result) {
          epics.push({
            name: entry.name,
            storiesPath: epicStoriesPath,
            storyCount: result.total,
            completedCount: result.complete,
          });
          storiesTotal += result.total;
          storiesComplete += result.complete;
        }
      }
    } catch {
      // No stories dir — fine
    }

    return { name, path: projectPath, branch, storiesTotal, storiesComplete, epics, isCurrent };
  }

  private async _getWorktrees(): Promise<WorktreeInfo[]> {
    try {
      const { stdout: rootOut } = await execAsync('git rev-parse --show-toplevel', {
        cwd: this._workspaceRoot,
        timeout: 5_000,
      });
      const gitRoot = rootOut.trim();

      const { stdout } = await execAsync('git worktree list --porcelain', {
        cwd: gitRoot,
        timeout: 10_000,
      });

      return _parsePorcelainWorktrees(stdout);
    } catch {
      return [];
    }
  }

  private async _createWorktree(branchName: string): Promise<void> {
    try {
      const { stdout: rootOut } = await execAsync('git rev-parse --show-toplevel', {
        cwd: this._workspaceRoot,
        timeout: 5_000,
      });
      const gitRoot = rootOut.trim();
      const repoName = path.basename(gitRoot);
      const safeBranch = branchName.replace(/\//g, '-');
      const worktreePath = path.join(path.dirname(gitRoot), `${repoName}-${safeBranch}`);

      let branchExists = false;
      try {
        await execAsync(`git -C "${gitRoot}" rev-parse --verify "${branchName}"`, { timeout: 5_000 });
        branchExists = true;
      } catch {
        // Branch doesn't exist
      }

      if (branchExists) {
        await execAsync(`git -C "${gitRoot}" worktree add "${worktreePath}" "${branchName}"`, { timeout: 15_000 });
      } else {
        await execAsync(`git -C "${gitRoot}" worktree add -b "${branchName}" "${worktreePath}"`, { timeout: 15_000 });
      }

      await this._refreshWorktrees();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      void vscode.window.showErrorMessage(`Failed to create worktree: ${msg}`);
    }
  }

  private async _deleteWorktree(worktreePath: string, branchName: string, deleteBranch: boolean): Promise<void> {
    try {
      const { stdout: rootOut } = await execAsync('git rev-parse --show-toplevel', {
        cwd: this._workspaceRoot,
        timeout: 5_000,
      });
      const gitRoot = rootOut.trim();

      await execAsync(`git -C "${gitRoot}" worktree remove "${worktreePath}"`, { timeout: 15_000 });

      if (deleteBranch && branchName) {
        try {
          await execAsync(`git -C "${gitRoot}" branch -D "${branchName}"`, { timeout: 5_000 });
        } catch {
          // Best-effort — branch might be checked out somewhere else
        }
      }

      await this._refreshWorktrees();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      void vscode.window.showErrorMessage(`Failed to delete worktree: ${msg}`);
    }
  }

  private async _addToGlobalWorkspaces(projectPath: string): Promise<void> {
    const globalDir = path.join(os.homedir(), '.prism');
    const globalFile = path.join(globalDir, 'workspaces.json');

    try {
      await fs.promises.mkdir(globalDir, { recursive: true });
    } catch {
      // Already exists
    }

    let data: { paths: string[] } = { paths: [] };
    try {
      const raw = await fs.promises.readFile(globalFile, 'utf-8');
      const parsed = JSON.parse(raw) as { paths?: string[] };
      data.paths = parsed.paths ?? [];
    } catch {
      // File doesn't exist yet
    }

    const resolved = path.resolve(projectPath);
    if (!data.paths.some((p) => path.resolve(p) === resolved)) {
      data.paths.push(resolved);
      await fs.promises.writeFile(globalFile, JSON.stringify(data, null, 2), 'utf-8');
    }
  }

  // ---------------------------------------------------------------------------
  // File watchers (from WorkspacesViewProvider)
  // ---------------------------------------------------------------------------

  private _setupFileWatchers(): void {
    const workspaceRoot = this._workspaceRoot;
    const parentDir = path.dirname(workspaceRoot);

    try {
      const siblingWatcher = vscode.workspace.createFileSystemWatcher(
        new vscode.RelativePattern(
          vscode.Uri.file(parentDir),
          '*/.prism',
        ),
        false, // create triggers refresh
        true,  // change ignored
        false, // delete triggers refresh
      );
      siblingWatcher.onDidCreate(() => void this._refreshProjects());
      siblingWatcher.onDidDelete(() => void this._refreshProjects());
      this._context.subscriptions.push(siblingWatcher);
    } catch {
      // Not all environments support file watchers
    }

    try {
      const globalRegistryPath = path.join(os.homedir(), '.prism', 'workspaces.json');
      const globalWatcher = vscode.workspace.createFileSystemWatcher(globalRegistryPath);
      globalWatcher.onDidChange(() => void this._refreshProjects());
      globalWatcher.onDidCreate(() => void this._refreshProjects());
      this._context.subscriptions.push(globalWatcher);
    } catch {
      // Not all environments support file watchers
    }
  }

  // ---------------------------------------------------------------------------
  // Dispose
  // ---------------------------------------------------------------------------

  dispose(): void {
    for (const sub of this._subscriptions) {
      sub.dispose();
    }
    this._subscriptions.length = 0;
    this._layoutWatcher?.dispose();
    this._layoutWatcher = null;
    for (const id of [...this.agents.keys()]) {
      removeAgent(
        id, this.agents,
        this.fileWatchers, this.pollingTimers, this.waitingTimers, this.permissionTimers,
        this.jsonlPollTimers, this._persistAgents,
      );
    }
    if (this.projectScanTimer.current) {
      clearInterval(this.projectScanTimer.current);
      this.projectScanTimer.current = null;
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
      return this._getDevHtml(nonce, devServerUrl);
    }

    // Production: load from dist/webview-panel/
    const distPath = vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview-panel');
    const indexPath = vscode.Uri.joinPath(distPath, 'index.html').fsPath;

    if (fs.existsSync(indexPath)) {
      let html = fs.readFileSync(indexPath, 'utf-8');
      // Rewrite relative asset URLs to webview URIs (no data-view injection needed)
      html = html.replace(/(href|src)="\.\/([^"]+)"/g, (_match: string, attr: string, filePath: string) => {
        const fileUri = vscode.Uri.joinPath(distPath, filePath);
        const webviewUri = webview.asWebviewUri(fileUri);
        return `${attr}="${webviewUri}"`;
      });
      // Inject CSP after <head> — includes blob: for canvas toDataURL
      const csp = [
        `default-src 'none'`,
        `style-src ${cspSource} 'unsafe-inline'`,
        `img-src ${cspSource} data: blob:`,
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
  <title>Prism</title>
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
    <div>Prism</div>
    <div style="margin-top:8px;font-size:10px;">Build webview-panel to activate</div>
  </div>
</body>
</html>`;
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
      img-src https: data: blob:;
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

function _gateLabel(command: string): string {
  const first = command.trim().split(/\s+/)[0] ?? command;
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

function _truncateOutput(output: string, lines: number): string {
  const all = output.trimEnd().split('\n');
  return all.slice(-lines).join('\n');
}

function _parseStoriesJson(filePath: string): { total: number; complete: number } | null {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const json = JSON.parse(raw) as {
      stories?: Array<{ status?: string }>;
    };
    const stories = json.stories ?? [];
    const total = stories.length;
    const complete = stories.filter((s) => s.status === 'complete').length;
    return { total, complete };
  } catch {
    return null;
  }
}

function _parsePorcelainWorktrees(output: string): WorktreeInfo[] {
  const blocks = output.trim().split(/\n\n+/);
  return blocks
    .map((block, index): WorktreeInfo | null => {
      const lines = block.trim().split('\n');
      const worktreeLine = lines.find((l) => l.startsWith('worktree '));
      const headLine = lines.find((l) => l.startsWith('HEAD '));
      const branchLine = lines.find((l) => l.startsWith('branch '));
      const isBare = lines.some((l) => l === 'bare');
      const prunable = lines.some((l) => l.startsWith('prunable'));

      if (!worktreeLine) return null;

      const wtPath = worktreeLine.slice('worktree '.length).trim();
      const head = headLine ? headLine.slice('HEAD '.length).trim().slice(0, 7) : '???????';
      const rawBranch = branchLine ? branchLine.slice('branch '.length).trim() : '';
      const branch = rawBranch.replace(/^refs\/heads\//, '') || '(detached)';

      return {
        path: wtPath,
        branch,
        head,
        isBare,
        isMain: index === 0,
        prunable,
      };
    })
    .filter((wt): wt is WorktreeInfo => wt !== null);
}
