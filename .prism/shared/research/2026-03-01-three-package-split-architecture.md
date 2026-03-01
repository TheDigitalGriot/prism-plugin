---
date: 2026-03-01T00:00:00Z
researcher: Claude
repository: prism-plugin
branch: main
topic: "Option B — Three-Package Split: packages/prism-core + packages/prism-ui + thin platform shells"
tags: [research, architecture, electron, vscode, shared-packages, three-package-split, office, canvas, monorepo]
status: complete
last_updated: 2026-03-01
last_updated_by: Claude
---

# Three-Package Split Architecture Research
## Full Technical Investigation for Code Sharing between prism-vscode and prism-electron

---

## Research Question

What is the complete technical blueprint for implementing Option B — a three-package split (`packages/prism-core`, `packages/prism-ui`, thin platform shells) — to share code between `cmd/prism-vscode` and `cmd/prism-electron`, including the full functional office system port, all workflows (Spectrum, Monitor, Git, Files), and production-ready cross-platform parity?

---

## Summary

The codebase currently has two parallel implementations that share ~40% of code via a fragile TypeScript path alias (`@prism-core/* → ../prism-vscode/src/*`). The webview-ui is fully duplicated (24 files with only CSS variable differences separating 13 of them). The VSCode office system is a complete HTML5 Canvas 2D game engine with sprite sheets, character FSM, furniture layout editor, JSONL transcript parsing, and real agent tracking — fundamentally different from Electron's 331-line CSS mockup. A three-package split requires: (1) extracting 10 fully agnostic + 7 adapter-wrapped core files into `packages/prism-core`, (2) extracting the shared webview-ui into `packages/prism-ui` with a CSS bridge layer and platform transport adapter, (3) porting the entire VSCode office/canvas system to Electron as a shared `packages/prism-ui` sub-system, and (4) wiring both platform shells with Node.js EventEmitters and proper AgentBridge integration in ElectronPrismController.

---

## Files Discovered

### 1. packages/prism-core Candidates (from cmd/prism-vscode/src/)

#### FULLY AGNOSTIC — Zero Platform Imports (Move as-is)

| Path | Description |
|------|-------------|
| `src/shared/types.ts` | `WorkflowPhase` enum, styling helpers |
| `src/shared/PrismMessage.ts` | All IPC message types (gRPC wire format) |
| `src/shared/PrismState.ts` | Full extension state shape `PrismExtensionState` |
| `src/core/api/types.ts` | SDK types |
| `src/claude/events.ts` | Claude event types |
| `src/prism/signals.ts` | Spectrum signal protocol constants |
| `src/core/controller/prism/spectrum.ts` | `SpectrumEngine` pure state machine |
| `src/core/controller/prism/workflow.ts` | `WorkflowStateMachine` pure state machine |
| `src/core/controller/grpc-handler.ts` | gRPC dispatch registry (transport-agnostic) |
| `src/claude/parser.ts` | Claude event parser |
| `src/office/agentBridge.ts` | Session→agent ID mapping, zero VSCode imports |
| `src/office/constants.ts` | Timing constants, asset dimensions |

#### NEEDS ADAPTER — Platform-Coupled but Abstractable

| Path | VSCode Coupling | Electron Equivalent |
|------|-----------------|---------------------|
| `src/prism/stories.ts` | `vscode.workspace.workspaceFolders` | `_projectDir: string` |
| `src/prism/progress.ts` | vscode for some path ops | Pure Node.js fs |
| `src/claude/runner.ts` | Platform-specific CLI launching | Different runner config |
| `src/core/controller/prism/stories.ts` | Workspace path | Constructor-injected path |
| `src/core/controller/prism/plugin-bridge.ts` | Workspace path | Same |
| `src/core/controller/prism/spectrum-runner.ts` | Path resolution | Same |
| `src/core/controller/prism/mode-bridge.ts` | Path resolution | Same |
| `src/prism/init.ts` | Imports vscode but `initPrismDir()` is pure | Remove import, inject path |

#### VSCODE-SPECIFIC — Cannot Move to Shared Core

| Path | Reason |
|------|--------|
| `src/extension.ts` | `vscode.window.registerTreeDataProvider`, command registration |
| `src/core/controller/index.ts` | 5 `vscode.EventEmitter` instances, `vscode.workspace.workspaceFolders` |
| `src/hosts/vscode/VscodeWebviewProvider.ts` | `vscode.WebviewViewProvider` |
| `src/hosts/vscode/OfficeViewProvider.ts` | `vscode.WebviewViewProvider` + `vscode.Terminal` |
| `src/hosts/vscode/PrismPanelProvider.ts` | `vscode.WebviewViewProvider` + full terminal lifecycle |
| `src/providers/research-tree.ts` | `vscode.TreeDataProvider` |
| `src/providers/plans-tree.ts` | `vscode.TreeDataProvider` |
| `src/providers/stories-tree.ts` | `vscode.TreeDataProvider` |
| `src/providers/workflow-status.ts` | `vscode.StatusBarItem` ×3 |
| `src/core/api/auth.ts` | `vscode.ExtensionContext.secrets` |

### 2. Office Module Files (src/office/) — Detailed Classification

| File | Classification | vscode Coupling |
|------|----------------|-----------------|
| `agentBridge.ts` | FULLY_AGNOSTIC | Zero vscode imports |
| `constants.ts` | FULLY_AGNOSTIC | Zero vscode imports |
| `types.ts` | NEEDS_ADAPTER | `AgentState.terminalRef: vscode.Terminal` — swap to generic handle |
| `agentManager.ts` | VSCODE_ONLY | `vscode.window.createTerminal`, `context.workspaceState` |
| `fileWatcher.ts` | NEEDS_ADAPTER | `vscode.Webview` type param + `vscode.Terminal` ref |
| `layoutPersistence.ts` | NEEDS_ADAPTER | `context.workspaceState` for migration only; file I/O is pure Node.js |
| `timerManager.ts` | NEARLY_AGNOSTIC | Only uses `webview?.postMessage()` callback |
| `transcriptParser.ts` | NEEDS_ADAPTER | `vscode.Webview` type as parameter |
| `assetLoader.ts` | NEEDS_ADAPTER | `vscode.Webview` only in `sendTo*` functions; asset loading is pure |

### 3. packages/prism-ui Candidates (from cmd/prism-vscode/webview-ui/src/)

#### IDENTICAL between VSCode and Electron (5 files)

| Path | Notes |
|------|-------|
| `context/PrismStateContext.tsx` | 245 lines, byte-for-byte identical |
| `services/grpc-client-base.ts` | 3-line diff only (import + 2 calls) |
| `components/views/ChatView.tsx` | Identical |
| `components/spectrum/SpectrumPanel.tsx` | Identical |
| `components/views/WelcomeView.tsx` | Minor diff (Electron has logo, VSCode has prism words) |

#### MINOR DIFF — CSS Variables Only (13 files, `--vscode-*` → `--prism-*`)

| Path | Diff Type |
|------|-----------|
| `components/chat/ChatInput.tsx` | CSS vars |
| `components/chat/ChatMessage.tsx` | CSS vars |
| `components/chat/ChatScrollButton.tsx` | CSS vars |
| `components/chat/FloatingSpectrumPill.tsx` | CSS vars + small feature diff |
| `components/spectrum/PhaseProgress.tsx` | CSS vars |
| `components/spectrum/SpectrumStatus.tsx` | CSS vars |
| `components/spectrum/StoryCard.tsx` | CSS vars |
| `components/spectrum/StoryItem.tsx` | CSS vars |
| `components/spectrum/StoryList.tsx` | CSS vars |
| `components/views/ResearchView.tsx` | CSS vars |
| `components/views/PlansView.tsx` | CSS vars |
| `hooks/useGrpcClient.ts` | CSS vars / minor |
| `hooks/useMessages.ts` | CSS vars / minor |

#### FUNDAMENTALLY DIFFERENT (4 files)

| Path | VSCode Version | Electron Version |
|------|---------------|-----------------|
| `App.tsx` | 138 lines: manages `currentView` state, command listener, floating Spectrum pill | 37 lines: delegates entirely to `<AppShell />` |
| `theme/theme.css` | All `var(--vscode-*, fallback)` references | All hardcoded hex values + 5 V2 layout tokens |
| `vscode.ts` / `electron.ts` | `acquireVsCodeApi()` singleton | `electronApi` with IPC subscription |
| `grpc-client-base.ts` | `vscodeApi.postMessage(...)` | `electronApi.postMessage(...)` |

#### ELECTRON-ONLY (19 files — V2 IDE Shell Layout)

| Path | Description |
|------|-------------|
| `components/layout/AppShell.tsx` | Full IDE shell, keyboard shortcuts, command handler |
| `components/layout/ActivityBar.tsx` | 44px vertical bar, 6 SVG icon buttons |
| `components/layout/ContentRail.tsx` | 260px collapsible panel, routes to 6 panels |
| `components/layout/TabBar.tsx` | 36px horizontal tab strip, pinned tabs |
| `components/layout/BottomPanel.tsx` | 180px Office/Terminal collapsible |
| `components/layout/HeaderBar.tsx` | 34px with RPIV phase buttons, gRPC phase transitions |
| `components/layout/BottomStatusBar.tsx` | 24px story count, version, office toggle |
| `components/layout/FloatingChatPill.tsx` | Return-to-chat button for tab-based UI |
| `components/panels/FilesPanel.tsx` | File tree via `prism:fileTree` IPC |
| `components/panels/GitPanel.tsx` | Git status/log via IPC |
| `components/panels/MonitorPanel.tsx` | System health, gates display |
| `components/panels/StoriesPanel.tsx` | Flat stories list, placeholder research/plans |
| `components/panels/SpectrumPanel.tsx` | Spectrum controls + activity log |
| `components/panels/WorkspacePanel.tsx` | Mock kanban, current project only |
| `components/views/StoryDetailView.tsx` | Center tab story view |
| `components/views/FileContentView.tsx` | Center tab file viewer |
| `components/views/GitGraphView.tsx` | Center tab git graph |
| `context/LayoutContext.tsx` | React reducer, IPC persistence (load/save) |
| `components/office/PixelOffice.tsx` | CSS pixel art mockup (331 lines, MOCK) |

### 4. VSCode Office System — Complete File Inventory

The office system spans FOUR sub-applications in VSCode:

#### A. Extension Host Office Module (src/office/ — 9 files)
Already listed above with classifications.

#### B. webview-office/ — Full Canvas Office React App

| Path | Description |
|------|-------------|
| `src/main.tsx` | React entry point |
| `src/OfficeApp.tsx` | Root — mounts OfficeCanvas, manages OfficeState ref |
| `src/office-constants.ts` | All tuning constants |
| `src/vscodeApi.ts` | 3 lines: `acquireVsCodeApi()` |
| `src/office/types.ts` | `SpriteData = string[][]`, `Character`, `Seat`, `OfficeLayout` |
| `src/office/colorize.ts` | HSL sprite colorization (Photoshop Colorize mode) |
| `src/office/floorTiles.ts` | Floor pattern storage |
| `src/office/wallTiles.ts` | Auto-tiling wall system (16-bitmask) |
| `src/office/toolUtils.ts` | Tool name extraction from JSONL |
| `src/office/components/OfficeCanvas.tsx` | Canvas element, mouse handlers, camera follow, pan/zoom |
| `src/office/components/ToolOverlay.tsx` | HTML overlay for tool labels |
| `src/office/engine/gameLoop.ts` | requestAnimationFrame loop |
| `src/office/engine/characters.ts` | Character FSM (TYPE/IDLE/WALK states) |
| `src/office/engine/renderer.ts` | All Canvas 2D drawing (Y-axis depth sorted) |
| `src/office/engine/officeState.ts` | Central mutable game state (outside React) |
| `src/office/engine/matrixEffect.ts` | Spawn/despawn digital rain effect |
| `src/office/sprites/spriteData.ts` | All sprite data (character templates + furniture) ~1100 lines |
| `src/office/sprites/spriteCache.ts` | Zoom-level offscreen canvas cache |
| `src/office/layout/furnitureCatalog.ts` | Furniture registry + rotation groups |
| `src/office/layout/layoutSerializer.ts` | Layout ↔ tile/furniture conversion |
| `src/office/layout/tileMap.ts` | BFS pathfinding + walkability |
| `src/office/editor/editorState.ts` | Editor mutable state |
| `src/office/editor/editorActions.ts` | Layout mutations (paint, place, move, expand) |
| `src/office/editor/EditorToolbar.tsx` | Editor UI panel |
| `src/hooks/useExtensionMessages.ts` | All incoming extension host messages → OfficeState |
| `src/hooks/useEditorActions.ts` | Editor mutation hook |
| `src/hooks/useEditorKeyboard.ts` | Keyboard shortcuts |
| `src/components/AgentLabels.tsx` | Agent name overlay |
| `src/components/StoryLabels.tsx` | Spectrum story context labels |
| `src/components/BottomToolbar.tsx` | Bottom toolbar (zoom, layout editor toggle) |
| `src/components/SettingsModal.tsx` | Sound settings |
| `src/components/ZoomControls.tsx` | Zoom UI |
| `src/components/DebugView.tsx` | Debug overlay |
| `src/fonts/FSPixelSansUnicode-Regular.ttf` | Pixel font |

#### C. webview-panel/ — Three-Pane Panel (Monitor + Office + Workspaces)

| Path | Description |
|------|-------------|
| `src/main.tsx` | React 19 entry |
| `src/PrismPanel.tsx` | Split-pane root: left=Monitor|Office, right=Workspaces |
| `src/vscodeApi.ts` | `acquireVsCodeApi()` |
| `src/views/OfficeApp.tsx` | Office view — mounts same canvas system |
| `src/views/MonitorView.tsx` | Agent kanban + quality gates |
| `src/views/WorkspacesView.tsx` | Projects + worktrees |
| `src/office/` | **SAME canvas system** as webview-office (duplicated or symlinked) |
| `src/types/monitor.ts`, `workspaces.ts` | TypeScript types |
| `src/components/` | AgentCard, KanbanBoard, ProjectCard, StatusBar, etc. |
| `src/hooks/office/useExtensionMessages.ts` | Message handler (receives 20+ message types) |
| `vite.config.ts` | Output: `../dist/webview-panel/`, port 5175 |

#### D. Extension Host Providers

| File | Description |
|------|-------------|
| `src/hosts/vscode/OfficeViewProvider.ts` | Sidebar office (subscribes to 3 controller events, manages agent lifecycle, loads assets) |
| `src/hosts/vscode/PrismPanelProvider.ts` | Bottom panel (~1200 lines: Monitor + Workspaces + Office + quality gates + worktree management) |

---

## Component Analysis

### 1. Transport Adapter Pattern

The core IPC abstraction is already transport-agnostic:

```
cmd/prism-vscode/src/core/controller/grpc-handler.ts (line 12)
handleGrpcRequest(postMessage: (msg: unknown) => Promise<void>, request)
```

`postMessage` is a plain injected function — not a vscode type. Both platforms supply their own implementation:
- **VSCode**: `VscodeWebviewProvider` calls `webview.postMessage(msg)`
- **Electron**: `ElectronIPCBridge` calls `event.reply('grpc_response', msg)` or `win.webContents.send(...)`

On the webview side:
- **VSCode**: `vscodeApi.postMessage(msg)` → `acquireVsCodeApi().postMessage(msg)`
- **Electron**: `electronApi.postMessage(msg)` → `window.electronAPI.invoke('grpc_request', msg)`

These are the ONLY platform-specific lines in `grpc-client-base.ts`.

### 2. ElectronPrismController Gaps vs PrismController

**PrismController has these EventEmitters** (src/core/controller/index.ts):
```typescript
onDidChangePrismFile: vscode.EventEmitter<string>          // file change events
onDidChangeState: vscode.EventEmitter<PrismExtensionState> // state updates
onDidStartSession: vscode.EventEmitter<AgentSessionData>   // agent created
onDidUpdateStory: vscode.EventEmitter<UpdatedStoryData>    // story updated
onDidEndSpectrumStory: vscode.EventEmitter<string>         // spectrum story ended
```

**ElectronPrismController has**:
- Chokidar watcher (Node.js EventEmitter via chokidar)
- `_chatRunner` explicitly terminated in `dispose()`
- `_projectDir: string` instead of `vscode.workspace.workspaceFolders`
- Does NOT have: AgentBridge, the 5 EventEmitters above, Office session lifecycle

**20 gRPC handlers are functionally identical** between the two controllers.

**The minimal shared interface** both controllers must implement:
```typescript
interface IPrismController {
  state: PrismExtensionState
  handleGrpcRequest(postMessage: PostMessageFn, request: GrpcRequest): Promise<void>
  on(event: 'fileChange', listener: (path: string) => void): this
  on(event: 'stateChange', listener: (state: PrismExtensionState) => void): this
  on(event: 'sessionStart', listener: (data: AgentSessionData) => void): this
  on(event: 'storyUpdate', listener: (data: UpdatedStoryData) => void): this
  on(event: 'spectrumStoryEnd', listener: (storyId: string) => void): this
  dispose(): void
}
```

### 3. Canvas Office System Architecture

The office is a **pure software renderer**:
- `SpriteData = string[][]` — 2D arrays of hex colors (no PNG images at runtime)
- Each sprite pixel is one `ctx.fillRect(c * zoom, r * zoom, zoom, zoom)` call
- Sprites are cached in `WeakMap<SpriteData, HTMLCanvasElement>` per zoom level
- `imageSmoothingEnabled = false` critical for pixel art
- Z-sorting: all drawables collected, sorted by Y-bottom, rendered in one pass

**Character FSM** (3 states):
- `TYPE`: Seated, alternates frames every 0.3s, transitions to IDLE when `isActive=false`
- `IDLE`: Counts down `wanderTimer` (2-20s), pathfinds to random tile or back to seat
- `WALK`: BFS pathfinding (4-directional grid), LERP position, 4-frame walk animation

**JSONL Transcript Format** (`~/.claude/projects/<workspace-dir>/<session-uuid>.jsonl`):
```jsonl
{"role":"assistant","content":[{"type":"tool_use","id":"toolu_xxx","name":"Read","input":{...}}]}
{"role":"user","content":[{"type":"tool_result","tool_use_id":"toolu_xxx","content":[...]}]}
{"type":"progress","subtype":"child_progress","data":{"content":[...]}}
{"type":"system","subtype":"turn_duration","timestamp":"...","duration_ms":1234}
```

**Agent lifecycle messages** (extension host → webview):

| Message | Trigger | Payload |
|---------|---------|---------|
| `agentCreated` | Terminal launched | `{id, agentId}` |
| `agentStatus` | State change | `{id, status: 'thinking'|'idle'|'waiting'}` |
| `agentToolStart` | Tool use detected | `{id, toolName, toolId}` |
| `agentToolDone` | Tool result detected | `{id, toolId}` |
| `agentToolsClear` | Turn end detected | `{id}` |
| `agentToolPermission` | Permission request | `{id, toolName}` |
| `agentClosed` | Terminal closed | `{id}` |
| `subagentToolStart` | Sub-Task tool | `{parentId, toolId, toolName}` |
| `characterSpritesLoaded` | Asset load complete | `{sprites: SpriteData[][][]}` |
| `layoutLoaded` | Layout read | `{layout: OfficeLayout}` |
| `furnitureAssetsLoaded` | Dynamic catalog built | `{catalog, sprites}` |
| `agentStoryContext` | Spectrum story mapped | `{agentId, storyId, storyTitle}` |
| `existingAgents` | Webview ready + agents exist | `{agents: [{id, paletteIndex, seatKey}]}` |

### 4. Build System Current State

**No npm workspaces configured** — no root `package.json`.

**7 distinct package.json files**:
1. `cmd/prism-vscode/package.json` (extension host)
2. `cmd/prism-vscode/webview-ui/package.json` (sidebar webview)
3. `cmd/prism-vscode/webview-panel/package.json` (panel + office — React 19)
4. `cmd/prism-vscode/webview-office/package.json` (standalone office — React 18)
5. `cmd/prism-electron/package.json` (Electron root)
6. `cmd/prism-electron/webview-ui/package.json` (React UI — React 18)

**TypeScript path aliases** (current):
- `cmd/prism-electron/tsconfig.json`: `@prism-core/*` → `../prism-vscode/src/*`
- `cmd/prism-electron/vite.main.config.mts`: `@prism-core` → `../prism-vscode/src`

**Version conflicts to resolve**:
- React: 18.x in both webview-ui packages vs 19.x in electron root + webview-panel/office
- TypeScript: `~4.5.4` in electron root (non-strict, old) vs `^5.4.5+` everywhere else
- No `@prism-ui/*` alias exists yet

### 5. Feature Parity Matrix

#### Features in VSCode ONLY (10 major gaps in Electron)

| Feature | VSCode Implementation | Electron Gap |
|---------|----------------------|--------------|
| Research Tree | `TreeDataProvider` + frontmatter parsing | Placeholder text only |
| Plans Tree | `TreeDataProvider` + status icons | Placeholder text only |
| Story Step Expansion | Expandable tree nodes | Flat list, no steps |
| Functional Office | Full canvas game engine + real agents | CSS decorative mockup |
| Agent Terminal Management | `vscode.Terminal` lifecycle | Not implemented |
| Quality Gate Execution | `child_process.exec` + real output | Display only |
| Project Discovery (multi-workspace) | Sibling dir scan + `~/.prism/workspaces.json` | Current project only |
| Git Worktree CRUD | Create/delete worktrees | Not implemented |
| API Key Secure Storage | `vscode.SecretStorage` (OS keychain) | Not implemented |
| Command Palette Integration | 21+ VSCode commands | UI-only |

#### Features in Electron ONLY (not possible/needed in VSCode)

| Feature | Electron Implementation | VSCode Equivalent |
|---------|------------------------|-------------------|
| Custom Tab System | `TabBar.tsx` + `LayoutContext.tsx` | VSCode native editor tabs |
| Dual-Rail Collapsible Layout | `ContentRail.tsx` left + right | VSCode sidebar + secondary sidebar |
| Built-in File Explorer Panel | `FilesPanel.tsx` via `prism:fileTree` IPC | VSCode native explorer |
| Built-in Git Source Control | `GitPanel.tsx` via `prism:gitStatus` IPC | VSCode native SCM |
| Git Graph Visualization | `GitGraphView.tsx` center tab | Not implemented |
| File Content Viewer | `FileContentView.tsx` via `prism:readFile` | VSCode native editor |
| Window Bounds Persistence | `window-state.ts` | Managed by VSCode |
| Floating Chat Pill | `FloatingChatPill.tsx` | Not needed |
| Custom Keyboard Shortcuts | React event handler in `AppShell.tsx` | VSCode keybindings.json |
| Native App Menu | `Menu.buildFromTemplate` | VSCode menu |

#### Shared Components (already in both or easily shareable)

| Component | Status | Notes |
|-----------|--------|-------|
| `PrismStateContext.tsx` | IDENTICAL | Move to prism-ui as-is |
| `ChatView.tsx` | IDENTICAL | Move to prism-ui |
| `SpectrumPanel.tsx` | IDENTICAL | Move to prism-ui |
| `SpectrumEngine` | AGNOSTIC | Move to prism-core |
| `WorkflowStateMachine` | AGNOSTIC | Move to prism-core |
| `grpc-handler.ts` | AGNOSTIC | Move to prism-core |
| `AgentBridge` | AGNOSTIC | Move to prism-core |
| gRPC handler (20 handlers) | IDENTICAL | Move to prism-core |
| `StoriesManager` | NEEDS_ADAPTER | Move to prism-core with path injection |

### 6. Office System — Electron Port Requirements

**What Electron needs for a functional office**:

1. **Process management** (replacing `vscode.window.createTerminal`):
   - Use `node-pty` to spawn `claude` CLI processes
   - Track PID → agent ID mapping
   - Forward stdout to JSONL watcher

2. **JSONL file watching** (replacing `fileWatcher.ts` vscode.Webview type):
   - Same `chokidar` approach (already used in Electron for watcher)
   - Replace `webview.postMessage(msg)` with `win.webContents.send('office_msg', msg)`
   - The logic itself is pure Node.js

3. **Asset loading** (replacing `assetLoader.ts` vscode.Webview URIs):
   - VSCode uses `webview.asWebviewUri()` for asset URLs
   - Electron: assets served from local file protocol or bundled into renderer
   - Sprite data (PNG → SpriteData arrays) processed in main process, sent via IPC

4. **Layout persistence** (replacing `layoutPersistence.ts` vscode.workspaceState):
   - Already pure Node.js file I/O (`~/.prism/office-layout.json`)
   - Only migration code uses `context.workspaceState` → can be removed for Electron
   - `ElectronIPCBridge` already handles `prism:loadLayoutState` / `prism:saveLayoutState`

5. **Webview communication bridge** (replacing vscodeApi.ts 3 lines):
   - Create `electronOfficeApi.ts` using `window.electronAPI.invoke(...)` / `window.electronAPI.on(...)`
   - Register IPC handlers in `ElectronIPCBridge` for `office_msg` channel

6. **Canvas office app itself** (webview-office/src/):
   - **Fully portable** — zero VSCode imports except 3 lines in `vscodeApi.ts`
   - Move entire `src/office/` directory to `packages/prism-ui/src/office/`
   - Only change: `vscodeApi.ts` → platform-injected `postMessageFn` + `addMessageListener`

---

## Patterns Found

### Pattern 1: Platform Adapter Interface
**Location**: `cmd/prism-vscode/webview-ui/src/vscode.ts:1-44`, `cmd/prism-electron/webview-ui/src/electron.ts:1-59`

Both adapters expose the same contract:
```typescript
interface WebviewTransport {
  postMessage(msg: unknown): void
  getState(): unknown
  setState(state: unknown): void
}
```
The `grpc-client-base.ts` uses this interface — replace import only.

### Pattern 2: PostMessage Function Injection
**Location**: `cmd/prism-vscode/src/core/controller/grpc-handler.ts:12`
```typescript
handleGrpcRequest(postMessage: (msg: unknown) => Promise<void>, request: GrpcRequest)
```
This pattern means all 20 gRPC handlers are transport-agnostic by design.

### Pattern 3: CSS Variable Bridge
**Location**: All 13 "minor diff" files use `--vscode-editor-background` vs `--prism-editor-background`.

A CSS bridge in `packages/prism-ui/src/styles/bridge.css`:
```css
/* VSCode context: map --prism-* to --vscode-* */
[data-platform="vscode"] {
  --prism-editor-background: var(--vscode-editor-background, #1e1e1e);
  --prism-editor-foreground: var(--vscode-editor-foreground, #d4d4d4);
  /* ...etc */
}
/* Electron context: use hardcoded values */
[data-platform="electron"] {
  --prism-editor-background: #0f1419;
  --prism-editor-foreground: #e6edf3;
}
```
This eliminates 13 of 24 file divergences in one go.

### Pattern 4: OfficeState Outside React
**Location**: `cmd/prism-vscode/webview-office/src/office/engine/officeState.ts:22`

`OfficeState` is a mutable class instance held in a `useRef` outside the React tree. Updates flow:
```
extension postMessage → useExtensionMessages hook → officeState mutations → RAF renders
```
React only re-renders for UI overlays (toolbar, labels). This pattern is already platform-agnostic.

### Pattern 5: Message-Driven Office Architecture
**Location**: `cmd/prism-vscode/webview-office/src/hooks/useExtensionMessages.ts:64`

All office state is driven by typed messages:
```
Extension host → postMessage(typed message) → useExtensionMessages → OfficeState mutation
```
This is already a clean adapter seam: only `vscodeApi.postMessage` / `window.addEventListener('message')` need platform swapping.

### Pattern 6: Node.js EventEmitter as vscode.EventEmitter Drop-in
**Location**: `cmd/prism-electron/src/hosts/electron/ElectronPrismController.ts` (missing)

VSCode's `vscode.EventEmitter<T>` API:
```typescript
const emitter = new vscode.EventEmitter<T>()
emitter.event  // subscribable event
emitter.fire(value)
```
Node.js replacement:
```typescript
import { EventEmitter } from 'events'
const emitter = new EventEmitter()
emitter.on('event', listener)  // subscribe
emitter.emit('event', value)   // fire
```
This is the key to extracting `PrismController` into a shared `BasePrismController`.

### Pattern 7: SpriteData — Pure TypeScript Sprites
**Location**: `cmd/prism-vscode/webview-office/src/office/sprites/spriteData.ts:52`

```typescript
export type SpriteData = string[][]  // 2D array of hex colors, '' = transparent
```

All visual data is pure TypeScript arrays. No binary images loaded at runtime in the webview. PNG assets (character sprites, floor tiles, wall tiles, furniture) are processed by the extension host into `SpriteData[][]` format and sent via `characterSpritesLoaded` messages. This makes the entire renderer fully portable.

---

## Open Questions

1. **npm workspaces root**: Should the root `package.json` use npm workspaces with `"workspaces": ["packages/*", "cmd/*"]`? This would allow `npm install` at root to install all dependencies. React/TypeScript version conflicts must be resolved first.

2. **Office sub-app structure**: The VSCode side has `webview-office/` (sidebar office) and `webview-panel/` (panel office) — both contain the same canvas code. Should `packages/prism-ui` contain ONE office implementation that both platform shells reference?

3. **Electron office IPC**: For Electron, office messages go through `win.webContents.send()` in main process → renderer. The office webview is the MAIN renderer in Electron (not a sidebar), so the IPC is simpler than VSCode's webview isolation.

4. **node-pty vs child_process**: Does Electron already have `node-pty` as a dependency, or does it need to be added? The JSONL file watching approach (Claude CLI writes to `~/.claude/projects/`) might not require PTY at all — just spawn with `child_process.spawn` and let the file watcher detect output.

5. **React 19 migration**: The electron root and webview-panel use React 19 while webview-ui uses React 18. Should `packages/prism-ui` target React 18 or 19?

6. **TypeScript strict mode**: Electron root uses `~4.5.4` (non-strict). Any shared package must compile with the most restrictive tsconfig in the chain.

7. **Vite build for shared packages**: Can `packages/prism-core` be bundled once (CJS + ESM) and referenced via `workspace:*` protocol? Or should each platform build include the source directly via path aliases?

8. **Auth/SecretStorage in Electron**: Should `packages/prism-core/src/core/api/auth.ts` use an injected storage adapter interface, with VSCode using `secretStorage` and Electron using `safeStorage` / `keytar`?

9. **PixelOffice → CanvasOffice migration**: The 331-line CSS `PixelOffice.tsx` in Electron needs to be replaced with the full canvas office. This is a complete replacement, not a migration. The existing component should be deleted.

---

## Architecture Decision Records

### ADR-001: CSS Variable Bridge (not CSS-in-JS)
The 13-file CSS variable divergence should be solved with a single CSS bridge file that maps `--prism-*` tokens to either `--vscode-*` vars or hardcoded Electron hex values. This avoids changing component code at all.

### ADR-002: packages/prism-ui contains the full office system
The office canvas code (game engine, sprite system, message handler) is 95% portable (only `vscodeApi.ts` needs swapping). Move the entire `webview-office/src/office/` to `packages/prism-ui/src/office/`. Both platform shells reference this via path alias or workspace dependency.

### ADR-003: BasePrismController uses Node.js EventEmitter
Extract `PrismController` into `BasePrismController` in `packages/prism-core` using Node.js `EventEmitter` for the 5 events. `PrismController` (VSCode) wraps them in `vscode.EventEmitter` for VSCode compatibility. `ElectronPrismController` uses `EventEmitter` directly.

### ADR-004: AgentManager needs platform adapter interface
`agentManager.ts` currently uses `vscode.window.createTerminal`. The Electron equivalent uses `node-pty` or `child_process`. Extract to a `TerminalAdapter` interface:
```typescript
interface TerminalAdapter {
  create(name: string, shellPath: string, args: string[], cwd: string): TerminalHandle
  dispose(handle: TerminalHandle): void
  onDidClose(handle: TerminalHandle, listener: () => void): void
}
```

### ADR-005: npm workspaces at repo root
Add root `package.json` with `"workspaces": ["packages/*", "cmd/*"]`. Resolve React/TS version conflicts before enabling. This is Phase 1 of the implementation.

---

## Phase Decomposition Preview

Based on this research, the implementation requires approximately 18 phases:

**Foundation (Phases 1-3)**:
1. npm workspaces root setup + resolve version conflicts
2. Create `packages/prism-core` structure with tsconfig + vite
3. Move 10 fully-agnostic files to `packages/prism-core` + update all imports

**Core Extraction (Phases 4-6)**:
4. Create `BasePrismController` with Node.js EventEmitter + adapter interfaces
5. Extend `ElectronPrismController` with missing EventEmitters + AgentBridge
6. Move 7 needs-adapter files with injected dependencies

**UI Package (Phases 7-9)**:
7. Create `packages/prism-ui` structure + CSS variable bridge layer
8. Move 18 shared webview-ui files (5 identical + 13 CSS-var-only)
9. Wire both platform shells to reference `packages/prism-ui`

**Office Port — Infrastructure (Phases 10-12)**:
10. Move canvas office system to `packages/prism-ui/src/office/`
11. Create Electron office IPC bridge (`ElectronOfficeIPCBridge`)
12. Port `agentManager.ts` to Electron using `child_process` + JSONL watching

**Office Port — Integration (Phases 13-15)**:
13. Integrate AgentBridge + EventEmitters into `ElectronPrismController` for Spectrum→Office
14. Port asset loading system to Electron (PNG → SpriteData + IPC delivery)
15. Replace `PixelOffice.tsx` with full canvas office in Electron bottom panel

**Feature Parity (Phases 16-18)**:
16. Port workspace discovery + worktree management to Electron `WorkspacePanel`
17. Port quality gate execution to Electron `MonitorPanel`
18. Production hardening: error handling, reconnection, performance, testing

---

## References

- Prior research: `.prism/shared/research/2026-02-28-prism-shared-architecture.md`
- Shared architecture plan (Phases 1-5 complete): `.prism/shared/plans/2026-02-28-prism-electron-shared-architecture.md`
- V2 UI plan (Phases 1-9 complete): `.prism/shared/plans/2026-02-28-prism-electron-v2-ui.md`
- Documentation: `.prism/shared/docs/PRISM-DOCUMENTATION-2.3.0.md`
- Electron SDK fix ref: `.prism/shared/ref/claude-electron-sdk-fix/`
