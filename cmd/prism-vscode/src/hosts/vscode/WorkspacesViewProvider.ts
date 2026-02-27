import * as child_process from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as util from 'util';
import * as vscode from 'vscode';
import type { PrismController } from '../../core/controller';

// ---------------------------------------------------------------------------
// Types — mirrored from webview-panel/src/types/workspaces.ts (kept in sync)
// ---------------------------------------------------------------------------

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

export class WorkspacesViewProvider implements vscode.WebviewViewProvider {
  static readonly VIEW_ID = 'prism.workspacesView';

  private _webviewView: vscode.WebviewView | undefined;
  private _cachedState: WorkspacesState = { projects: [], worktrees: [], loading: false };
  private _activeAgents: Array<{
    id: number;
    sessionId?: string;
    storyId?: string;
    storyTitle?: string;
  }> = [];

  constructor(
    private readonly _context: vscode.ExtensionContext,
    private readonly _controller?: PrismController,
  ) {
    this._setupFileWatchers();
  }

  private get _extensionUri(): vscode.Uri {
    return this._context.extensionUri;
  }

  private get _webview(): vscode.Webview | undefined {
    return this._webviewView?.webview;
  }

  private get _workspaceRoot(): string {
    return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? process.cwd();
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
  }

  // ---------------------------------------------------------------------------
  // Public API (called from extension.ts)
  // ---------------------------------------------------------------------------

  /** Push current workspaces state to the webview. */
  pushState(): void {
    if (!this._webview) return;
    this._webview.postMessage({ type: 'workspacesState', state: this._cachedState });
  }

  /** Update agent statuses from Office (called by extension.ts on state change). */
  updateAgentStatuses(agents: Array<{ id: number; sessionId?: string; storyId?: string; storyTitle?: string }>): void {
    this._activeAgents = agents;
    // Re-overlay agent statuses on worktrees — can't map by path without worktreePath
    // but we keep the data for future use and push updated state
    if (this._webview) {
      this.pushState();
    }
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
      case 'webviewReady':
        await this._refreshAll();
        break;

      case 'refresh':
        await this._refreshAll();
        break;

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
          await this._refreshAll();
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
          await this._refreshAll();
        }
        break;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Core data methods
  // ---------------------------------------------------------------------------

  private async _refreshAll(): Promise<void> {
    // Push loading state immediately
    this._cachedState = { ...this._cachedState, loading: true };
    this.pushState();

    const [projects, worktrees] = await Promise.all([
      this._discoverProjects(),
      this._getWorktrees(),
    ]);

    this._cachedState = { projects, worktrees, loading: false };
    this.pushState();
  }

  /** Refresh only projects (for file watcher). */
  private async _refreshProjects(): Promise<void> {
    const projects = await this._discoverProjects();
    this._cachedState = { ...this._cachedState, projects };
    this.pushState();
  }

  /** Refresh only worktrees (for post-create/delete). */
  private async _refreshWorktrees(): Promise<void> {
    const worktrees = await this._getWorktrees();
    this._cachedState = { ...this._cachedState, worktrees };
    this.pushState();
  }

  /**
   * Discover projects by scanning sibling directories for `.prism/` and
   * merging with `~/.prism/workspaces.json`.
   */
  private async _discoverProjects(): Promise<ProjectInfo[]> {
    const workspaceRoot = this._workspaceRoot;
    const parentDir = path.dirname(workspaceRoot);
    const seen = new Set<string>();
    const candidates: string[] = [];

    // 1. Sibling scan (limit to 50 to avoid slow large parent dirs)
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

    // 2. Global workspaces registry (~/.prism/workspaces.json)
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

    // 3. Build ProjectInfo for each candidate
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

    // Sort: current first, then alphabetically
    projects.sort((a, b) => {
      if (a.isCurrent && !b.isCurrent) return -1;
      if (!a.isCurrent && b.isCurrent) return 1;
      return a.name.localeCompare(b.name);
    });

    return projects;
  }

  private async _buildProjectInfo(projectPath: string, currentResolved: string): Promise<ProjectInfo | null> {
    // Verify directory exists
    try {
      const stat = await fs.promises.stat(projectPath);
      if (!stat.isDirectory()) return null;
    } catch {
      return null;
    }

    const name = path.basename(projectPath);
    const isCurrent = projectPath === currentResolved;

    // Git branch
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

    // Stories — scan .prism/stories/ for epics and root stories.json
    const prismDir = path.join(projectPath, '.prism');
    const epics: EpicInfo[] = [];
    let storiesTotal = 0;
    let storiesComplete = 0;

    // Root stories.json (or .prism/stories/stories.json)
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

    // Epic subdirectories under .prism/stories/
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

  /**
   * Run `git worktree list --porcelain` and parse the output.
   */
  private async _getWorktrees(): Promise<WorktreeInfo[]> {
    try {
      // Find git root
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

  /**
   * Create a new git worktree at a sibling path.
   */
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

      // Check if branch already exists
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

  /**
   * Remove a git worktree (and optionally its branch).
   */
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

  // ---------------------------------------------------------------------------
  // Global workspaces registry
  // ---------------------------------------------------------------------------

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
  // File watchers
  // ---------------------------------------------------------------------------

  private _setupFileWatchers(): void {
    const workspaceRoot = this._workspaceRoot;
    const parentDir = path.dirname(workspaceRoot);

    // Watch sibling directories for new/removed .prism directories
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

    // Watch global workspaces registry
    try {
      const globalRegistryPath = path.join(os.homedir(), '.prism', 'workspaces.json');
      const globalWatcher = vscode.workspace.createFileSystemWatcher(
        globalRegistryPath,
      );
      globalWatcher.onDidChange(() => void this._refreshProjects());
      globalWatcher.onDidCreate(() => void this._refreshProjects());
      this._context.subscriptions.push(globalWatcher);
    } catch {
      // Not all environments support file watchers
    }
  }

  // ---------------------------------------------------------------------------
  // HTML generation (scaffold already written in Phase 1 — kept intact)
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

/**
 * Parse a stories.json file and return total/complete counts.
 * Returns null if file doesn't exist or can't be parsed.
 */
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

/**
 * Parse `git worktree list --porcelain` output.
 *
 * Each block looks like:
 *   worktree /path/to/wt
 *   HEAD abc1234def
 *   branch refs/heads/feat/my-branch
 *   (bare | prunable reason=...)
 */
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
