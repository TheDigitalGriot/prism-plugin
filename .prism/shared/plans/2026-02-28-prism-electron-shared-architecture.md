---
date: 2026-02-28T00:00:00Z
author: Claude
repository: prism-plugin
branch: main
topic: "Prism Electron App — Shared Architecture with VSCode Extension"
status: approved
research: ".prism/shared/research/2026-02-28-prism-shared-architecture.md"
---

# Prism Electron App — Shared Architecture Plan

> Build the `prism-electron` desktop app by wiring the existing platform-agnostic
> prism-vscode core + React UI into Electron's IPC model, then replace the 8 VSCode-coupled
> files with Electron equivalents.

---

## Goal

Produce a fully functional `prism-electron` desktop app that shares:
- All business logic (workflow state machine, spectrum engine, stories manager, signal parser)
- All Claude CLI integration (runner, parser, events)
- All React UI components (ChatView, SpectrumView, WelcomeView and all sub-components)
- The complete gRPC-over-postMessage protocol (unchanged)

With platform shells that differ only in:
- IPC transport (Electron `ipcMain`/`ipcRenderer` vs VSCode `postMessage`)
- Workspace detection (`dialog.showOpenDialog` vs `workspace.workspaceFolders`)
- File watching (`chokidar` vs `vscode.FileSystemWatcher`)
- Credential storage (`electron-store` vs `vscode.SecretStorage`)

---

## What We're NOT Doing

- **No npm workspace monorepo** — files are co-located within `cmd/prism-electron/`, importing from `cmd/prism-vscode/src/` via relative paths or TypeScript path aliases. Package extraction comes later.
- **No Office visualization** — the pixel-art office feature (`PrismPanelProvider` / `office/` module) is out of scope for this phase. It depends on VSCode's Terminal API which has no trivial Electron equivalent.
- **No tree view parity** — VSCode's native tree views (`ResearchTreeDataProvider`, etc.) won't be ported. The Electron app uses React sidebar components instead.
- **No API key (Anthropic SDK) flow** — the Electron app uses Claude CLI authentication (`claude login`) exclusively. No `core/api/auth.ts` equivalent needed.
- **No new features** — this plan wires existing code into Electron. Zero new business logic.
- **No Vite SSR or multi-window** — single `BrowserWindow`, single React app.

---

## Architecture Overview

```
cmd/prism-electron/
├── src/
│   ├── main.ts                   ← Electron main process (replace boilerplate)
│   ├── preload.ts                ← contextBridge IPC bridge
│   ├── renderer.tsx              ← React DOM mount (unchanged)
│   ├── App.tsx                   ← Full desktop layout (new, replaces hello world)
│   │
│   ├── hosts/electron/           ← NEW: Platform shell (mirrors hosts/vscode/)
│   │   └── ElectronIPCBridge.ts  ← Registers ipcMain handlers, wires controller
│   │
│   ├── services/                 ← NEW: Renderer-side transport adapter
│   │   ├── electron-transport.ts ← Replaces vscode.ts (acquireVsCodeApi)
│   │   └── grpc-client.ts        ← Re-exports prism-vscode grpc-client unchanged
│   │
│   ├── prism/                    ← NEW: Electron-specific prism domain replacements
│   │   ├── config.ts             ← detectPrismDir() using fs.stat (no vscode)
│   │   └── watcher.ts            ← PrismWatcher using chokidar (no vscode)
│   │
│   └── context/                  ← Symlink or re-export from prism-vscode webview-ui
│
└── webview-ui/                   ← NEW: React SPA (based on prism-vscode webview-ui)
    ├── src/
    │   ├── main.tsx              ← React entry (same as vscode)
    │   ├── App.tsx               ← Desktop layout (adapted from vscode App.tsx)
    │   ├── Providers.tsx         ← Same as vscode
    │   ├── electron.ts           ← NEW: replaces vscode.ts transport
    │   ├── services/             ← grpc-client-base.ts + grpc-client.ts (unchanged)
    │   ├── context/              ← PrismStateContext.tsx (unchanged)
    │   ├── views/                ← ChatView, SpectrumView (unchanged)
    │   ├── components/           ← All components (unchanged)
    │   └── theme/                ← theme.css adapted (replace --vscode-* vars)
    └── ...
```

**Import strategy:** `prism-electron` imports the agnostic modules from `prism-vscode` using TypeScript path aliases in `tsconfig.json`:
```json
{
  "paths": {
    "@prism-core/*": ["../prism-vscode/src/*"],
    "@prism-ui/*":   ["../prism-vscode/webview-ui/src/*"]
  }
}
```
This avoids duplicating files while keeping both apps independently buildable.

---

## Success Criteria

### Automated Verification
- [ ] `cd cmd/prism-electron && npm run make` completes without errors
- [ ] `npm run lint` passes with zero TypeScript errors
- [ ] Electron app launches: `npm start`
- [ ] DevTools console shows no errors on startup
- [ ] `checkClaudeCli()` IPC handler returns the correct `claude.cmd` path on Windows

### Manual Verification
- [ ] App window opens at 1200×800 with Prism UI (not "Hello World")
- [ ] WelcomeView renders when no `.prism/` directory detected
- [ ] Opening a project folder via File menu → "Open Project" detects `.prism/` and transitions to ChatView
- [ ] Chat input sends a message and receives a streaming response from Claude
- [ ] `/prism-research` trigger in chat launches the research skill via CLI
- [ ] Spectrum tab: "Start" button begins autonomous execution, story list updates in real time
- [ ] Spectrum tab: "Pause" and "Stop" controls work
- [ ] Window close quits the app cleanly (no orphaned Claude processes)

---

## Phase 1 — Electron Main Process + IPC Bridge

**Goal:** Replace the boilerplate `main.ts` with a functional Electron main process that instantiates `PrismController` and wires all gRPC service handlers through `ipcMain`.

### Steps

**1.1 — Add dependencies to `cmd/prism-electron/package.json`** ✅
- Add `chokidar` (file watching)
- uuid + @types/uuid, @types/node (dev deps)
- Updated productName to "Prism"
- TypeScript path aliases configured in `tsconfig.json` (`@prism-core/*` → `../prism-vscode/src/*`)
- Vite alias configured in `vite.main.config.mts`
- Note: `electron-store` deferred to Phase 5; `@anthropic-ai/claude-agent-sdk` deferred (not needed yet)

**1.2 — Create `src/prism/config.ts` (Electron version)** ✅

Replace `vscode.workspace.workspaceFolders` + `vscode.workspace.fs.stat` with `fs.stat`:

```typescript
import * as fs from 'fs/promises';
import * as path from 'path';

export async function detectPrismDir(projectDir: string): Promise<string | undefined> {
  const candidate = path.join(projectDir, '.prism');
  try {
    await fs.stat(candidate);
    return candidate;
  } catch {
    return undefined;
  }
}

export async function detectStoriesPath(prismDir: string): Promise<string | undefined> {
  const candidate = path.join(prismDir, 'stories', 'stories.json');
  try {
    await fs.stat(candidate);
    return candidate;
  } catch {
    return undefined;
  }
}

export function getPrismConfig(prismDir: string) { /* same as vscode version */ }
```

**1.3 — Create `src/prism/watcher.ts` (Electron version)** ✅

Replace `vscode.FileSystemWatcher` with `chokidar`:

```typescript
import chokidar, { FSWatcher } from 'chokidar';
import { EventEmitter } from 'events';
import * as path from 'path';

export type PrismFileChangeType = 'stories' | 'research' | 'plans' | 'validation' | 'spectrum' | 'other';
export interface PrismFileChangeEvent { type: PrismFileChangeType; filePath: string; }

export class PrismWatcher extends EventEmitter {
  private _watcher: FSWatcher | null = null;

  start(prismDir: string): void {
    this.dispose();
    this._watcher = chokidar.watch(prismDir, { ignoreInitial: true, persistent: false });
    this._watcher.on('all', (event, filePath) => {
      const type = this._classify(prismDir, filePath);
      this.emit('change', { type, filePath });
    });
  }

  private _classify(prismDir: string, filePath: string): PrismFileChangeType {
    const rel = path.relative(prismDir, filePath);
    if (rel.startsWith('stories')) return 'stories';
    if (rel.startsWith(path.join('shared', 'research'))) return 'research';
    if (rel.startsWith(path.join('shared', 'plans'))) return 'plans';
    if (rel.startsWith(path.join('shared', 'validation'))) return 'validation';
    if (rel.startsWith(path.join('shared', 'spectrum'))) return 'spectrum';
    return 'other';
  }

  dispose(): void { this._watcher?.close(); this._watcher = null; }
}
```

**1.4 — Create `src/hosts/electron/ElectronIPCBridge.ts`** ✅

This file does what `VscodeWebviewProvider.ts` does: instantiates `PrismController`, registers IPC handlers, and wires bidirectional communication. Key differences:
- Uses `ipcMain.handle('grpc_request', ...)` instead of `webview.onDidReceiveMessage`
- Uses `mainWindow.webContents.send('grpc_response', ...)` instead of `webview.postMessage`
- Uses `ipcMain.handle('grpc_request_cancel', ...)` for cancellation
- Calls `controller.setPostMessageFn(msg => mainWindow.webContents.send('grpc_response', msg))`
- Exposes project directory setting via `ipcMain.handle('prism:openProject', ...)`

```typescript
import { BrowserWindow, ipcMain, dialog } from 'electron';
import { handleGrpcRequest } from '@prism-core/core/controller/grpc-handler';
import { ElectronPrismController } from './ElectronPrismController';

export class ElectronIPCBridge {
  private controller: ElectronPrismController;

  constructor(private mainWindow: BrowserWindow) {
    this.controller = new ElectronPrismController();
    this.controller.setPostMessageFn(async (msg) => {
      mainWindow.webContents.send('grpc_response', msg);
    });
    this._registerHandlers();
  }

  private _registerHandlers(): void {
    ipcMain.handle('grpc_request', async (_, request) => {
      await handleGrpcRequest(
        async (msg) => this.mainWindow.webContents.send('grpc_response', msg),
        request
      );
    });
    ipcMain.handle('grpc_request_cancel', (_, { request_id }) => {
      this.controller.removeSubscriber(request_id);
    });
    ipcMain.handle('prism:openProject', async () => {
      const result = await dialog.showOpenDialog(this.mainWindow, {
        properties: ['openDirectory'],
        title: 'Open Prism Project',
      });
      if (!result.canceled && result.filePaths[0]) {
        await this.controller.setProjectDir(result.filePaths[0]);
      }
    });
  }

  dispose(): void { this.controller.dispose(); }
}
```

**1.5 — Create `src/hosts/electron/ElectronPrismController.ts`** ✅

This replaces `PrismController` (which imports `vscode`). It extends the agnostic logic from `src/core/controller/index.ts` but substitutes:
- `vscode.EventEmitter` → Node.js `EventEmitter`
- `vscode.workspace.workspaceFolders` → stored `_projectDir` string (set by `setProjectDir()`)
- `vscode.commands.executeCommand` → no-op (context keys not applicable in Electron)
- `PrismWatcher` → Electron version (chokidar)
- `detectPrismDir` → Electron version (fs.stat)

The cleanest approach at this stage: copy `core/controller/index.ts` into `src/hosts/electron/ElectronPrismController.ts`, replace the 6 VSCode API usages (lines identified in research), and remove the `vscode` import.

**1.6 — Rewrite `src/main.ts`** ✅

```typescript
import { app, BrowserWindow } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import { ElectronIPCBridge } from './hosts/electron/ElectronIPCBridge';

if (started) app.quit();

let bridge: ElectronIPCBridge | null = null;

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200, height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  bridge = new ElectronIPCBridge(mainWindow);

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }

  mainWindow.on('closed', () => { bridge?.dispose(); bridge = null; });
}

app.on('ready', createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
```

**1.7 — Create `src/preload.ts`** ✅

```typescript
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  send: (channel: string, data: unknown) => ipcRenderer.send(channel, data),
  on:   (channel: string, cb: (data: unknown) => void) => {
    const wrapped = (_: Electron.IpcRendererEvent, data: unknown) => cb(data);
    ipcRenderer.on(channel, wrapped);
    return () => ipcRenderer.removeListener(channel, wrapped);
  },
  invoke: (channel: string, data?: unknown) => ipcRenderer.invoke(channel, data),
});

declare global {
  interface Window {
    electronAPI: {
      send: (channel: string, data: unknown) => void;
      on: (channel: string, cb: (data: unknown) => void) => () => void;
      invoke: (channel: string, data?: unknown) => Promise<unknown>;
    };
  }
}
```

**Checkpoint 1:** ✅ `npm start` launches the window. Build succeeded: main.ts + preload.ts compiled cleanly. `ipcMain` handlers registered. One fix applied: `initPrismDir` extracted to local `src/prism/init.ts` (prism-vscode's `prism/init.ts` has a vscode import in the same file via `initPrismDirInWorkspace`; local copy avoids the transitive vscode dependency).

**Session Note 2026-02-28:** Phase 1 complete. Next: Phase 2 — React Webview Setup (copy webview-ui from prism-vscode and add `electron.ts` transport adapter).

---

## Phase 2 — React Webview Setup

**Goal:** Stand up the React SPA in `webview-ui/` based on prism-vscode's webview but with the Electron transport adapter replacing `vscode.ts`.

### Steps

**2.1 — Bootstrap `webview-ui/`**

Copy the entire `cmd/prism-vscode/webview-ui/` into `cmd/prism-electron/webview-ui/`. This includes:
- `package.json` (React, Tailwind, react-markdown, lucide-react, uuid, react-virtuoso)
- `vite.config.ts`
- `tsconfig.json`
- All `src/` files

**2.2 — Create `webview-ui/src/electron.ts`** (replaces `vscode.ts`)

```typescript
// Electron transport adapter — drop-in replacement for vscode.ts
// Provides the same interface as VsCodeApi.postMessage + window "message" events

export interface ElectronTransportApi {
  postMessage: (message: unknown) => void;
}

function createElectronApi(): ElectronTransportApi {
  if (typeof window !== 'undefined' && window.electronAPI) {
    // Production: in Electron renderer
    window.electronAPI.on('grpc_response', (data) => {
      // Re-dispatch as a window "message" event so grpc-client-base.ts works unchanged
      window.dispatchEvent(new MessageEvent('message', { data }));
    });

    return {
      postMessage: (message) => {
        const msg = message as { type: string; grpc_request?: unknown; grpc_request_cancel?: unknown };
        if (msg.type === 'grpc_request') {
          window.electronAPI.invoke('grpc_request', msg.grpc_request);
        } else if (msg.type === 'grpc_request_cancel') {
          window.electronAPI.invoke('grpc_request_cancel', msg.grpc_request_cancel);
        }
      },
    };
  }

  // Dev fallback (Vite dev server outside Electron)
  console.warn('[Electron] electronAPI not available, using dev mock');
  return { postMessage: (msg) => console.log('[dev mock] postMessage:', msg) };
}

export const electronApi = createElectronApi();
```

**2.3 — Update `webview-ui/src/services/grpc-client-base.ts`**

Change the one import from `../vscode` to `../electron` and update the `vscodeApi` reference to `electronApi`. The postMessage calls and `window.addEventListener("message", ...)` listeners remain **identical** — this is the key benefit of the re-dispatch pattern in step 2.2.

```typescript
// Before (vscode):
import { vscodeApi } from '../vscode';
vscodeApi.postMessage({ type: "grpc_request", ... });

// After (electron):
import { electronApi } from '../electron';
electronApi.postMessage({ type: "grpc_request", ... });
```

**2.4 — Update `webview-ui/src/App.tsx`**

Two changes:
1. Remove VSCode CSS custom property references (`--vscode-sideBar-background`, `--vscode-foreground`, etc.) and replace with Tailwind classes or CSS custom properties defined in `theme.css`
2. Add a native menu bar / title bar section appropriate for a desktop app (File menu for "Open Project")

**2.5 — Update `webview-ui/src/theme/theme.css`**

Replace VSCode CSS variables with Electron-appropriate defaults:
```css
:root {
  --prism-bg: #1a1b2e;
  --prism-fg: #e2e8f0;
  --prism-font-family: 'Inter', system-ui, -apple-system, sans-serif;
  --prism-font-size: 13px;
  /* ... prism spectral theme colors */
}
```

**Checkpoint 2:** ✅ `npm start` launches the Electron window with the full Prism React UI. Vite dev server runs on port 5173 from webview-ui/. Main.ts and preload.ts compiled cleanly via Vite/Electron Forge. Webview-ui TypeScript type check passes with zero errors. Key implementation notes:
- webview-ui/src/electron.ts created: re-dispatches ipcRenderer grpc_response events as window "message" events so grpc-client-base.ts works without modification
- vscode.ts removed from webview-ui copy (replaced by electron.ts)
- theme.css: all --vscode-* vars replaced with hardcoded Prism dark theme values (#1a1b2e bg, #e2e8f0 fg)
- spectral.css: body.vscode-light and body.vscode-high-contrast selectors removed
- vite.renderer.config.mts: root set to ./webview-ui with React + Tailwind plugins
- @tailwindcss/vite + tailwindcss installed in main package for renderer config

**Session Note 2026-02-28:** Phase 2 complete. Next: Phase 3 — Claude CLI Integration + Workspace Detection. The UI loads but shows WelcomeView (no project opened). File menu → Open Project should trigger ElectronIPCBridge.openProject() → dialog.showOpenDialog → controller.setProjectDir() → detectPrismDir() → state update → ChatView.

---

## Phase 3 — Claude CLI Integration + Workspace Detection

**Goal:** Wire the Claude executable detection, workspace opening, and basic chat flow.

### Steps

**3.1 — Add Claude executable detection to `ElectronPrismController`**

Port `findClaudeCodeExecutable()` from the SDK fix reference (`.prism/shared/ref/claude-electron-sdk-fix/claude-electron-test/src/main.ts:19-87`):

```typescript
// In ElectronPrismController or a shared claude/detect.ts
function findClaudeCodeExecutable(): string | undefined {
  if (process.platform === 'win32') {
    // Try: where claude.cmd → APPDATA\npm\claude.cmd → LOCALAPPDATA\npm\claude.cmd
    try {
      const result = execSync('where claude.cmd', { encoding: 'utf-8' }).trim().split('\n')[0];
      if (fs.existsSync(result)) return result;
    } catch {}
    for (const p of [
      path.join(process.env.APPDATA || '', 'npm', 'claude.cmd'),
      path.join(process.env.LOCALAPPDATA || '', 'npm', 'claude.cmd'),
    ]) {
      if (fs.existsSync(p)) return p;
    }
  } else {
    try {
      const result = execSync('which claude', { encoding: 'utf-8' }).trim();
      if (fs.existsSync(result)) return result;
    } catch {}
  }
  return undefined;
}
```

The `ClaudeRunner` in `src/claude/runner.ts` uses `spawn("claude", args, { shell: true })` at line 96 which already works on Windows (shell mode handles `.cmd` files). The Agent SDK path (for `query()`) requires the `.cmd` → `cli.js` conversion — implement in the `PluginBridge` if the SDK path is used.

**3.2 — Implement `setProjectDir()` in `ElectronPrismController`**

```typescript
async setProjectDir(dir: string): Promise<void> {
  this._projectDir = dir;
  const prismDir = await detectPrismDir(dir);  // Electron version (fs.stat)
  const storiesPath = prismDir ? await detectStoriesPath(prismDir) : undefined;
  await this.updateState({
    hasPrismDir: !!prismDir,
    hasStoriesJson: !!storiesPath,
    prismDir: prismDir ?? '',
    storiesPath: storiesPath ?? '',
  });
  if (prismDir) {
    this._watcher.start(prismDir);
  }
}
```

**3.3 — Wire "Open Project" to File menu**

In `main.ts`, create a native application menu with `Menu.buildFromTemplate`:
```typescript
Menu.setApplicationMenu(Menu.buildFromTemplate([
  { label: 'File', submenu: [
    { label: 'Open Project…', accelerator: 'CmdOrCtrl+O',
      click: () => bridge?.openProject() },
    { type: 'separator' },
    { label: 'Quit', accelerator: 'CmdOrCtrl+Q', role: 'quit' },
  ]},
  { label: 'Edit', role: 'editMenu' },
  { label: 'View', role: 'viewMenu' },
  { label: 'Window', role: 'windowMenu' },
]));
```

**3.4 — Verify chat flow end-to-end**

Test sequence:
1. Open project via File menu → `.prism/` detected → state updates → ChatView renders
2. Type a message → `ChatService.sendMessage()` IPC → `ModeBridge` routes to CLI → `ClaudeRunner.runStreaming()` spawns claude → streaming events → chat messages appear

**Checkpoint 3:** Chat sends messages, Claude CLI responds, streaming output visible in chat. `/prism-research trigger` launches skill via CLI.

---

## Phase 4 — Spectrum Execution Dashboard

**Goal:** Wire the Spectrum autonomous execution loop through Electron IPC.

### Steps

**4.1 — Verify Spectrum IPC handlers**

The `SpectrumService` handlers in `ElectronPrismController` use `SpectrumEngine` and `SpectrumRunner` — both platform-agnostic. Confirm that:
- `SpectrumService.start` → `SpectrumEngine.start()` → `SpectrumRunner.runIteration()` loop
- `SpectrumRunner` spawns `ClaudeRunner` with `--session-id` and spectrum prompt
- Signal detection fires `SpectrumEngine.recordSignal()` → state update → webview push

**4.2 — Verify real-time dashboard updates**

The `SpectrumEngine` fires `onStateChange` callback on every state mutation. This calls `controller.updateState({ spectrum: newState })` which serializes and pushes to all `_stateSubscribers`. The `SpectrumView` in the React app consumes `state.spectrum` from `usePrismState()`.

Confirm:
- Progress bar updates as stories complete
- Activity log shows tool events
- Story list updates status icons (`pending` → `in_progress` → `complete`)
- Signal status shows last signal type

**4.3 — Verify process cleanup on window close**

`mainWindow.on('closed')` → `bridge.dispose()` → `controller.dispose()` → `spectrumRunner.terminate()` → `claudeRunner.terminate()` → `taskkill` (Windows) or `SIGTERM` (Unix).

**Checkpoint 4:** Spectrum executes stories autonomously. Dashboard updates in real time. Window close kills all child processes cleanly.

---

## Phase 5 — Polish and Packaging

**Goal:** Production-ready build that can be distributed.

### Steps

**5.1 — Window size + state persistence**

Use `electron-store` to persist:
- Last window bounds (x, y, width, height)
- Last opened project directory
- User preferences (if any)

**5.2 — Deep link / CLI argument support**

Allow `prism-electron /path/to/project` to open a project directly:
```typescript
// In main.ts
const projectArg = process.argv.find(a => !a.startsWith('-') && a !== app.getPath('exe'));
if (projectArg && fs.existsSync(projectArg)) {
  bridge?.setProjectDir(projectArg);
}
```

**5.3 — Remove `openDevTools()` from production build**

Wrap in `if (!app.isPackaged) mainWindow.webContents.openDevTools()`.

**5.4 — Verify `npm run make`**

Run `electron-forge make` and confirm:
- Windows: `.exe` installer via Squirrel
- macOS: `.zip` (or `.dmg` with custom maker)
- Linux: `.rpm` + `.deb`

Confirm all assets (webview HTML/JS/CSS) are included in the ASAR bundle.

**5.5 — Update `package.json` productName + description**

Change from `electron-react-vite-ts-starter` to `prism` with correct description.

**Checkpoint 5:** `npm run make` produces a distributable installer. App installs and runs from the installer. All Phase 4 checks pass on the packaged build.

---

## File Change Summary

### New Files

| File | Description |
|------|-------------|
| `src/hosts/electron/ElectronIPCBridge.ts` | ipcMain handler registration + controller wiring |
| `src/hosts/electron/ElectronPrismController.ts` | vscode-free controller (adapted from prism-vscode) |
| `src/prism/config.ts` | `.prism/` detection using `fs.stat` |
| `src/prism/watcher.ts` | `.prism/` watcher using chokidar |
| `webview-ui/src/electron.ts` | Transport adapter (replaces vscode.ts) |
| `webview-ui/` (full copy) | React SPA from prism-vscode webview-ui |

### Modified Files

| File | Change |
|------|--------|
| `src/main.ts` | Replace boilerplate with `ElectronIPCBridge` instantiation + Menu |
| `src/preload.ts` | Add `contextBridge.exposeInMainWorld('electronAPI', ...)` |
| `package.json` | Add `chokidar`, `electron-store`; update productName |
| `tsconfig.json` | Add `@prism-core/*` and `@prism-ui/*` path aliases |
| `webview-ui/src/services/grpc-client-base.ts` | Change `vscode` import → `electron` |
| `webview-ui/src/App.tsx` | Remove VSCode CSS vars; add File menu integration |
| `webview-ui/src/theme/theme.css` | Replace `--vscode-*` with `--prism-*` custom properties |

### Unchanged Files (imported from prism-vscode via path aliases)

All files under `src/core/controller/prism/`, `src/prism/stories.ts`, `src/prism/signals.ts`, `src/prism/progress.ts`, `src/claude/`, `src/shared/`, `src/core/api/claude-sdk.ts`, `src/core/api/types.ts`, and all `webview-ui/src/views/`, `webview-ui/src/components/`, `webview-ui/src/context/` files.

---

## Open Questions (To Resolve Before Finalizing)

1. **Path aliases vs file copying:** TypeScript path aliases (`@prism-core/*`) allow zero file duplication but require `forge.config.ts` + Vite config updates to resolve them at build time. Alternatively, files can be physically copied and kept in sync manually. Preference?

2. **VSCode CSS variables:** The existing Tailwind styles in prism-vscode use a mix of Tailwind utilities and `--vscode-*` CSS custom properties. The Electron app can either use a Prism dark theme (replace all vars) or attempt to match the VS Code Solarized/Dark+ palette exactly. Preference?

3. **Window chrome:** Electron allows a fully custom title bar (frameless window with drag region). Should the Electron app use native OS window chrome or a custom Prism-branded title bar?

4. **Recent projects list:** The Electron app could show a "recent projects" list at startup (like VS Code's welcome page) rather than just WelcomeView. Include in Phase 5 or defer?

5. **chokidar vs node:fs.watch:** `chokidar` is the most reliable cross-platform file watcher. `node:fs.watch` with `recursive: true` works on Windows/macOS but not all Linux configurations. Use chokidar (adds a dependency) or native Node.js?

---

## Reference Files

- Research: [.prism/shared/research/2026-02-28-prism-shared-architecture.md](.prism/shared/research/2026-02-28-prism-shared-architecture.md)
- SDK fix: [.prism/shared/ref/claude-electron-sdk-fix/CLAUDE-AGENT-SDK-ELECTRON.md](.prism/shared/ref/claude-electron-sdk-fix/CLAUDE-AGENT-SDK-ELECTRON.md)
- Working SDK test: [.prism/shared/ref/claude-electron-sdk-fix/claude-electron-test/src/main.ts](.prism/shared/ref/claude-electron-sdk-fix/claude-electron-test/src/main.ts)
- VSCode controller (to adapt): [cmd/prism-vscode/src/core/controller/index.ts](cmd/prism-vscode/src/core/controller/index.ts)
- gRPC handler (unchanged): [cmd/prism-vscode/src/core/controller/grpc-handler.ts](cmd/prism-vscode/src/core/controller/grpc-handler.ts)
- VSCode transport (to replace): [cmd/prism-vscode/webview-ui/src/vscode.ts](cmd/prism-vscode/webview-ui/src/vscode.ts)
- Electron boilerplate: [cmd/prism-electron/src/main.ts](cmd/prism-electron/src/main.ts)
