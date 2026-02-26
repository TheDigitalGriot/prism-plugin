import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import type { AgentState } from '../../office/types';
import {
	launchNewTerminal,
	removeAgent,
	restoreAgents,
	persistAgents,
	sendExistingAgents,
	sendLayout,
	getProjectDirPath,
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
} from '../../office/assetLoader';
import { WORKSPACE_KEY_AGENT_SEATS, GLOBAL_KEY_SOUND_ENABLED } from '../../office/constants';
import { writeLayoutToFile, readLayoutFromFile, watchLayoutFile } from '../../office/layoutPersistence';
import type { LayoutWatcher } from '../../office/layoutPersistence';

export class OfficeViewProvider implements vscode.WebviewViewProvider {
	static readonly VIEW_ID = 'prism.officeView';

	private _webviewView: vscode.WebviewView | undefined;

	// Agent tracking
	readonly nextAgentId = { current: 1 };
	readonly nextTerminalIndex = { current: 1 };
	readonly agents = new Map<number, AgentState>();

	// Per-agent timers
	readonly fileWatchers = new Map<number, fs.FSWatcher>();
	readonly pollingTimers = new Map<number, ReturnType<typeof setInterval>>();
	readonly waitingTimers = new Map<number, ReturnType<typeof setTimeout>>();
	readonly jsonlPollTimers = new Map<number, ReturnType<typeof setInterval>>();
	readonly permissionTimers = new Map<number, ReturnType<typeof setTimeout>>();

	// /clear detection: project-level scan for new JSONL files
	readonly activeAgentId = { current: null as number | null };
	readonly knownJsonlFiles = new Set<string>();
	readonly projectScanTimer = { current: null as ReturnType<typeof setInterval> | null };

	// Bundled default layout
	private _defaultLayout: Record<string, unknown> | null = null;

	// Cross-window layout sync
	private _layoutWatcher: LayoutWatcher | null = null;

	constructor(private readonly _context: vscode.ExtensionContext) {}

	private get _extensionUri(): vscode.Uri {
		return this._context.extensionUri;
	}

	private get _webview(): vscode.Webview | undefined {
		return this._webviewView?.webview;
	}

	private _persistAgents = (): void => {
		persistAgents(this.agents, this._context);
	};

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

	private async _handleMessage(message: { type: string; [key: string]: unknown }): Promise<void> {
		if (message.type === 'openClaude') {
			launchNewTerminal(
				this.nextAgentId, this.nextTerminalIndex,
				this.agents, this.activeAgentId, this.knownJsonlFiles,
				this.fileWatchers, this.pollingTimers, this.waitingTimers, this.permissionTimers,
				this.jsonlPollTimers, this.projectScanTimer,
				this._webview, this._persistAgents,
			);
		} else if (message.type === 'focusAgent') {
			const agent = this.agents.get(message.id as number);
			if (agent) {
				agent.terminalRef.show();
			}
		} else if (message.type === 'closeAgent') {
			const agent = this.agents.get(message.id as number);
			if (agent) {
				agent.terminalRef.dispose();
			}
		} else if (message.type === 'saveAgentSeats') {
			console.log(`[Prism Office] saveAgentSeats:`, JSON.stringify(message.seats));
			await this._context.workspaceState.update(WORKSPACE_KEY_AGENT_SEATS, message.seats);
		} else if (message.type === 'saveLayout') {
			this._layoutWatcher?.markOwnWrite();
			writeLayoutToFile(message.layout as Record<string, unknown>);
		} else if (message.type === 'setSoundEnabled') {
			await this._context.globalState.update(GLOBAL_KEY_SOUND_ENABLED, message.enabled);
		} else if (message.type === 'webviewReady') {
			restoreAgents(
				this._context,
				this.nextAgentId, this.nextTerminalIndex,
				this.agents, this.knownJsonlFiles,
				this.fileWatchers, this.pollingTimers, this.waitingTimers, this.permissionTimers,
				this.jsonlPollTimers, this.projectScanTimer, this.activeAgentId,
				this._webview, this._persistAgents,
			);

			const soundEnabled = this._context.globalState.get<boolean>(GLOBAL_KEY_SOUND_ENABLED, true);
			this._webview?.postMessage({ type: 'settingsLoaded', soundEnabled });

			const projectDir = getProjectDirPath();
			const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
			console.log('[Prism Office] workspaceRoot:', workspaceRoot);
			console.log('[Prism Office] projectDir:', projectDir);

			if (projectDir) {
				ensureProjectScan(
					projectDir, this.knownJsonlFiles, this.projectScanTimer, this.activeAgentId,
					this.nextAgentId, this.agents,
					this.fileWatchers, this.pollingTimers, this.waitingTimers, this.permissionTimers,
					this._webview, this._persistAgents,
				);

				// Load assets BEFORE sending layout
				void (async () => {
					try {
						console.log('[Prism Office] Loading furniture assets...');
						const extensionPath = this._extensionUri.fsPath;
						console.log('[Prism Office] extensionPath:', extensionPath);

						const bundledAssetsDir = path.join(extensionPath, 'dist', 'assets');
						let assetsRoot: string | null = null;
						if (fs.existsSync(bundledAssetsDir)) {
							console.log('[Prism Office] Found bundled assets at dist/');
							assetsRoot = path.join(extensionPath, 'dist');
						} else if (workspaceRoot) {
							console.log('[Prism Office] Trying workspace for assets...');
							assetsRoot = workspaceRoot;
						}

						if (!assetsRoot) {
							console.log('[Prism Office] ⚠️  No assets directory found');
							if (this._webview) {
								sendLayout(this._context, this._webview, this._defaultLayout);
								this._startLayoutWatcher();
							}
							return;
						}

						console.log('[Prism Office] Using assetsRoot:', assetsRoot);

						this._defaultLayout = loadDefaultLayout(assetsRoot);

						const charSprites = await loadCharacterSprites(assetsRoot);
						if (charSprites && this._webview) {
							sendCharacterSpritesToWebview(this._webview, charSprites);
						}

						const floorTiles = await loadFloorTiles(assetsRoot);
						if (floorTiles && this._webview) {
							sendFloorTilesToWebview(this._webview, floorTiles);
						}

						const wallTiles = await loadWallTiles(assetsRoot);
						if (wallTiles && this._webview) {
							sendWallTilesToWebview(this._webview, wallTiles);
						}

						const assets = await loadFurnitureAssets(assetsRoot);
						if (assets && this._webview) {
							sendAssetsToWebview(this._webview, assets);
						}
					} catch (err) {
						console.error('[Prism Office] ❌ Error loading assets:', err);
					}
					if (this._webview) {
						sendLayout(this._context, this._webview, this._defaultLayout);
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
							if (cs && this._webview) {
								sendCharacterSpritesToWebview(this._webview, cs);
							}
							const ft = await loadFloorTiles(distRoot);
							if (ft && this._webview) {
								sendFloorTilesToWebview(this._webview, ft);
							}
							const wt = await loadWallTiles(distRoot);
							if (wt && this._webview) {
								sendWallTilesToWebview(this._webview, wt);
							}
						}
					} catch { /* ignore */ }
					if (this._webview) {
						sendLayout(this._context, this._webview, this._defaultLayout);
						this._startLayoutWatcher();
					}
				})();
			}
			sendExistingAgents(this.agents, this._context, this._webview);
		} else if (message.type === 'openSessionsFolder') {
			const projectDir = getProjectDirPath();
			if (projectDir && fs.existsSync(projectDir)) {
				void vscode.env.openExternal(vscode.Uri.file(projectDir));
			}
		} else if (message.type === 'exportLayout') {
			const layout = readLayoutFromFile();
			if (!layout) {
				void vscode.window.showWarningMessage('Prism Office: No saved layout to export.');
				return;
			}
			const uri = await vscode.window.showSaveDialog({
				filters: { 'JSON Files': ['json'] },
				defaultUri: vscode.Uri.file(path.join(os.homedir(), 'prism-office-layout.json')),
			});
			if (uri) {
				fs.writeFileSync(uri.fsPath, JSON.stringify(layout, null, 2), 'utf-8');
				void vscode.window.showInformationMessage('Prism Office: Layout exported successfully.');
			}
		} else if (message.type === 'importLayout') {
			const uris = await vscode.window.showOpenDialog({
				filters: { 'JSON Files': ['json'] },
				canSelectMany: false,
			});
			if (!uris || uris.length === 0) return;
			try {
				const raw = fs.readFileSync(uris[0].fsPath, 'utf-8');
				const imported = JSON.parse(raw) as Record<string, unknown>;
				if (imported.version !== 1 || !Array.isArray(imported.tiles)) {
					void vscode.window.showErrorMessage('Prism Office: Invalid layout file.');
					return;
				}
				this._layoutWatcher?.markOwnWrite();
				writeLayoutToFile(imported);
				this._webview?.postMessage({ type: 'layoutLoaded', layout: imported });
				void vscode.window.showInformationMessage('Prism Office: Layout imported successfully.');
			} catch {
				void vscode.window.showErrorMessage('Prism Office: Failed to read or parse layout file.');
			}
		}
	}

	/** Launch a new Claude Code terminal (called from command palette) */
	launchNewTerminal(): void {
		launchNewTerminal(
			this.nextAgentId, this.nextTerminalIndex,
			this.agents, this.activeAgentId, this.knownJsonlFiles,
			this.fileWatchers, this.pollingTimers, this.waitingTimers, this.permissionTimers,
			this.jsonlPollTimers, this.projectScanTimer,
			this._webview, this._persistAgents,
		);
	}

	/** Export current saved layout to webview-office/public/assets/default-layout.json (dev utility) */
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
		const json = JSON.stringify(layout, null, 2);
		fs.writeFileSync(targetPath, json, 'utf-8');
		void vscode.window.showInformationMessage(`Prism Office: Default layout exported to ${targetPath}`);
	}

	private _startLayoutWatcher(): void {
		if (this._layoutWatcher) return;
		this._layoutWatcher = watchLayoutFile((layout) => {
			console.log('[Prism Office] External layout change — pushing to webview');
			this._webview?.postMessage({ type: 'layoutLoaded', layout });
		});
	}

	dispose(): void {
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

	private _getWebviewContent(webview: vscode.Webview): string {
		const nonce = getNonce();
		const cspSource = webview.cspSource;

		// Check for Vite dev server (development mode)
		const vitePortPath = path.join(this._extensionUri.fsPath, 'webview-office', '.vite-office-port');
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

		// Production: load from dist/webview-office/
		const distPath = vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview-office');
		const indexPath = vscode.Uri.joinPath(distPath, 'index.html').fsPath;

		if (fs.existsSync(indexPath)) {
			let html = fs.readFileSync(indexPath, 'utf-8');
			html = html.replace(/(href|src)="\.\/([^"]+)"/g, (_match: string, attr: string, filePath: string) => {
				const fileUri = vscode.Uri.joinPath(distPath, filePath);
				const webviewUri = webview.asWebviewUri(fileUri);
				return `${attr}="${webviewUri}"`;
			});
			return html;
		}

		// Fallback: placeholder HTML when webview-office is not yet built
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
  <title>Prism Office</title>
  <style>
    body {
      background: #0F172A;
      color: #94A3B8;
      font-family: var(--vscode-font-family, monospace);
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      margin: 0;
      font-size: 12px;
    }
    .loading {
      text-align: center;
      opacity: 0.6;
    }
  </style>
</head>
<body>
  <div class="loading">
    <div>Office</div>
    <div style="margin-top:8px;font-size:10px;">Build webview-office to activate</div>
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
      img-src https: data:;
      script-src 'nonce-${nonce}' 'unsafe-eval' ${devServerUrl};
    "
  />
  <title>Prism Office (Dev)</title>
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

function getNonce(): string {
	let text = '';
	const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	for (let i = 0; i < 32; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}
