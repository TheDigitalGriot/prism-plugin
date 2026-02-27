---
date: 2026-02-27T00:00:00Z
feature: "VSCode Extension — Unified Prism Panel with Full Canvas Office"
status: draft
author: Claude Opus 4.6
tags: [vscode, extension, unified-panel, office, monitor, workspaces, draggable-divider, canvas]
research: ".prism/shared/research/2026-02-27-prism-panel-unified-office-integration.md"
ref_prototype: ".prism/shared/ref/vscode-panel/prism-panel.jsx"
ref_guide: ".prism/shared/ref/vscode-panel/prism-panel-implementation-prompt.md"
---

# Implementation Plan: Unified Prism Panel with Full Canvas Office

**Date**: 2026-02-27
**Status**: Draft
**Research**: `.prism/shared/research/2026-02-27-prism-panel-unified-office-integration.md`

---

## Goal

Merge the three separate VSCode webviews (Monitor bottom panel tab, Workspaces bottom panel tab, Pixel Office sidebar) into **one unified "Prism" bottom panel tab** with:
- **Left side**: Toggle between Monitor (existing) and Office (full canvas engine, not SVG)
- **Right side**: Workspaces (existing)
- **Draggable middle divider**: 5px wide, clamped 25%-80%, persisted to workspaceState
- **Sidebar Office removed entirely**

## What We're NOT Doing

- Not building a simplified SVG Office — embedding the full canvas engine from `webview-office/`
- Not modifying the Office canvas engine itself (OfficeCanvas, sprites, editor, animations)
- Not changing the existing Monitor or Workspaces view React components (just re-parenting them)
- Not changing the extension-host office backend modules (agentManager, fileWatcher, transcriptParser, etc.)
- Not deleting `webview-office/` from the codebase (it stays dormant for future use)
- Not adding new features to Monitor, Workspaces, or Office — this is a layout/integration change only

---

## Success Criteria

### Automated Verification
- [ ] `cd cmd/prism-vscode/webview-panel && npm run build` — succeeds with all office code merged
- [ ] `cd cmd/prism-vscode && npm run compile` — no TypeScript errors
- [ ] `cd cmd/prism-vscode && npx tsc --noEmit` — passes
- [ ] `cd cmd/prism-vscode && npm run package` — VSIX packages successfully

### Manual Verification
- [ ] Single "Prism" tab appears in VS Code bottom panel (NOT separate Monitor/Workspaces tabs)
- [ ] Left panel shows Monitor view by default
- [ ] Clicking ⌂ Office toggle switches to full canvas Office with walk animations, zoom/pan, editor
- [ ] Clicking ◈ Monitor toggle switches back to Monitor dashboard
- [ ] Dragging the middle divider resizes left/right panels (25%-80% range)
- [ ] Divider position persists across VS Code restarts (workspaceState)
- [ ] Active view toggle (monitor/office) persists across restarts
- [ ] Sidebar no longer has a Pixel Office tab
- [ ] Monitor: quality gates load from stories.json, "Run" executes gates, results show pass/fail
- [ ] Workspaces: projects discovered, stories listed, worktrees manageable
- [ ] Office: agents spawn when `claude` terminal opens, walk to desks, show tool activity bubbles
- [ ] Office: layout editor works (furniture placement, undo/redo, save)
- [ ] Office: layout persists to `~/.prism/office-layout.json` and syncs cross-window
- [ ] `prism.office.launchAgent` command still works (launches terminal via PrismPanelProvider)

---

## Phase 1: Merge webview-office source into webview-panel

**Goal**: Copy all office webview React code into the panel's Vite app so both can build from a single entry point.

### Step 1.1: Copy office source directories

Copy these directories/files from `cmd/prism-vscode/webview-office/src/` into `cmd/prism-vscode/webview-panel/src/`:

```
webview-office/src/office/           → webview-panel/src/office/
webview-office/src/hooks/            → webview-panel/src/hooks/office/
webview-office/src/components/       → webview-panel/src/components/office/
webview-office/src/fonts/            → webview-panel/src/fonts/
webview-office/src/constants.ts      → webview-panel/src/office-constants.ts
webview-office/src/notificationSound.ts → webview-panel/src/notificationSound.ts
webview-office/src/index.css         → webview-panel/src/office.css
webview-office/src/theme/spectral-office.css → webview-panel/src/theme/spectral-office.css
```

**Note**: Hooks and office-level components go into `hooks/office/` and `components/office/` subdirectories to avoid collisions with existing panel components/hooks.

### Step 1.2: Fix `vscodeApi` imports (6 files)

All office code must import from the panel's single `src/vscodeApi.ts`. Files to fix:

| Source File (after copy) | Current Import | New Import |
|---|---|---|
| `views/OfficeApp.tsx` (created in 1.4) | `'./vscodeApi.js'` | `'../vscodeApi.js'` |
| `components/office/DebugView.tsx` | `'../vscodeApi.js'` | `'../../vscodeApi.js'` |
| `components/office/SettingsModal.tsx` | `'../vscodeApi.js'` | `'../../vscodeApi.js'` |
| `hooks/office/useEditorActions.ts` | `'../vscodeApi.js'` | `'../../vscodeApi.js'` |
| `hooks/office/useExtensionMessages.ts` | `'../vscodeApi.js'` | `'../../vscodeApi.js'` |
| `office/components/OfficeCanvas.tsx` | `'../../vscodeApi.js'` | `'../../vscodeApi.js'` (no change — same depth) |

### Step 1.3: Fix `constants` imports (16+ files)

The file `constants.ts` is renamed to `office-constants.ts` to avoid collision with panel's own types. All imports need updating:

**Depth 0** (same directory — now at `src/office-constants.ts`):
| File | Current | New |
|---|---|---|
| `notificationSound.ts` | `'./constants.js'` | `'./office-constants.js'` |

**Depth 1** (one level up):
| File | Current | New |
|---|---|---|
| `components/office/ZoomControls.tsx` | `'../constants.js'` | `'../../office-constants.js'` |
| `hooks/office/useEditorActions.ts` | `'../constants.js'` | `'../../office-constants.js'` |
| `office/types.ts` | `'../constants.js'` | `'../office-constants.js'` |
| `office/toolUtils.ts` | `'../constants.js'` | `'../office-constants.js'` |
| `office/floorTiles.ts` | `'../constants.js'` | `'../office-constants.js'` |

**Depth 2** (two levels up):
| File | Current | New |
|---|---|---|
| `office/components/OfficeCanvas.tsx` | `'../../constants.js'` | `'../../office-constants.js'` |
| `office/components/ToolOverlay.tsx` | `'../../constants.js'` | `'../../office-constants.js'` |
| `office/editor/editorState.ts` | `'../../constants.js'` | `'../../office-constants.js'` |
| `office/editor/editorActions.ts` | `'../../constants.js'` | `'../../office-constants.js'` |
| `office/engine/officeState.ts` | `'../../constants.js'` | `'../../office-constants.js'` |
| `office/engine/gameLoop.ts` | `'../../constants.js'` | `'../../office-constants.js'` |
| `office/engine/renderer.ts` | `'../../constants.js'` | `'../../office-constants.js'` |
| `office/engine/characters.ts` | `'../../constants.js'` | `'../../office-constants.js'` |
| `office/engine/matrixEffect.ts` | `'../../constants.js'` | `'../../office-constants.js'` |

### Step 1.4: Fix cross-reference imports (hooks ↔ components ↔ office)

Since hooks and components moved into subdirectories, cross-references need updating:

**components/office/ → hooks:**
| File | Current Import | New Import |
|---|---|---|
| `components/office/AgentLabels.tsx` | `'../hooks/useExtensionMessages.js'` | `'../../hooks/office/useExtensionMessages.js'` |
| `components/office/StoryLabels.tsx` | `'../hooks/useExtensionMessages.js'` | `'../../hooks/office/useExtensionMessages.js'` |

**components/office/ → office/:**
| File | Current Import | New Import |
|---|---|---|
| `components/office/AgentLabels.tsx` | `'../office/engine/officeState.js'` | `'../../office/engine/officeState.js'` |
| `components/office/AgentLabels.tsx` | `'../office/types.js'` | `'../../office/types.js'` |
| `components/office/StoryLabels.tsx` | `'../office/engine/officeState.js'` | `'../../office/engine/officeState.js'` |
| `components/office/StoryLabels.tsx` | `'../office/types.js'` | `'../../office/types.js'` |
| `components/office/DebugView.tsx` | `'../office/types.js'` | `'../../office/types.js'` |
| `components/office/BottomToolbar.tsx` | `'./SettingsModal.js'` | `'./SettingsModal.js'` (no change — same dir) |
| `components/office/SettingsModal.tsx` | `'../notificationSound.js'` | `'../../notificationSound.js'` |

**hooks/office/ → office/:**
| File | Current Import | New Import |
|---|---|---|
| `hooks/office/useEditorActions.ts` | `'../office/...'` | `'../../office/...'` (all office refs add one `../`) |
| `hooks/office/useEditorKeyboard.ts` | `'../office/...'` | `'../../office/...'` |
| `hooks/office/useExtensionMessages.ts` | `'../office/...'` | `'../../office/...'` |
| `hooks/office/useExtensionMessages.ts` | `'../notificationSound.js'` | `'../../notificationSound.js'` |

**office/ → hooks/ (reverse dependency — 1 file):**
| File | Current Import | New Import |
|---|---|---|
| `office/components/ToolOverlay.tsx` | `'../../hooks/useExtensionMessages.js'` | `'../../hooks/office/useExtensionMessages.js'` |

### Step 1.5: Fix CSS/font references

**office.css** (copied from `index.css`): Contains `@font-face` with `url('./fonts/FSPixelSansUnicode-Regular.ttf')`. Since fonts/ is at `src/fonts/`, this relative path works from `src/office.css`.

**spectral-office.css**: Copied to `src/theme/spectral-office.css`. No import path changes needed — it uses CSS custom properties only.

### Step 1.6: Create OfficeApp.tsx view wrapper

Create `cmd/prism-vscode/webview-panel/src/views/OfficeApp.tsx`:

This is adapted from `webview-office/src/App.tsx` with corrected import paths:
- Import `OfficeState` from `'../office/engine/officeState.js'`
- Import `OfficeCanvas` from `'../office/components/OfficeCanvas.js'`
- Import `ToolOverlay` from `'../office/components/ToolOverlay.js'`
- Import `EditorToolbar` from `'../office/editor/EditorToolbar.js'`
- Import `EditorState` from `'../office/editor/editorState.js'`
- Import `EditTool` from `'../office/types.js'`
- Import `isRotatable` from `'../office/layout/furnitureCatalog.js'`
- Import `vscode` from `'../vscodeApi.js'`
- Import `useExtensionMessages` from `'../hooks/office/useExtensionMessages.js'`
- Import `PULSE_ANIMATION_DURATION_SEC` from `'../office-constants.js'`
- Import `useEditorActions` from `'../hooks/office/useEditorActions.js'`
- Import `useEditorKeyboard` from `'../hooks/office/useEditorKeyboard.js'`
- Import `ZoomControls` from `'../components/office/ZoomControls.js'`
- Import `BottomToolbar` from `'../components/office/BottomToolbar.js'`
- Import `DebugView` from `'../components/office/DebugView.js'`
- Import `StoryLabels` from `'../components/office/StoryLabels.js'`
- Import `'../office.css'`
- Import `'../theme/spectral-office.css'`

The component logic stays identical to the original `App.tsx` — just the imports change.

### Step 1.7: Verify merged build

```bash
cd cmd/prism-vscode/webview-panel && npm install && npm run build
```

**Checkpoint**: [x] `dist/webview-panel/` builds successfully with all office code included. No TypeScript errors.

## Phase 1 Complete — 2026-02-27

**Changes**:
- Copied 42 office source files into webview-panel/src/ (office/, hooks/office/, components/office/, fonts/, theme/)
- Renamed constants.ts → office-constants.ts (no collision with panel's own files)
- Fixed all import paths: vscodeApi (4 files), constants (15 files), cross-references (10 files)
- Created src/views/OfficeApp.tsx (adapted from webview-office/src/App.tsx)

**Verification**: `npm run build` → tsc -b passed, 39 modules, 209.86 kB bundle, 512ms

---

## Phase 2: Build PrismPanel unified layout

**Goal**: The webview renders the full split-panel UI with divider, toggle, and status bar. MonitorView and OfficeApp swap in the left panel. WorkspacesView stays on the right.

### Step 2.1: Update main.tsx

Remove `data-view` routing. Render `<PrismPanel />` directly:

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { PrismPanel } from './PrismPanel'
import './theme/panel.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><PrismPanel /></React.StrictMode>
)
```

### Step 2.2: Create DraggableDivider.tsx

`cmd/prism-vscode/webview-panel/src/components/DraggableDivider.tsx`:

Props: `{ isDragging: boolean; onMouseDown: (e: React.MouseEvent) => void }`

Behavior (exact from prototype `prism-panel.jsx:693-734`):
- 5px wide strip, `cursor: col-resize`, `flexShrink: 0`, `zIndex: 10`
- Background: `var(--prism-border)` → `var(--prism-blue)` when `isDragging`
- Transition: `background 0.15s` when not dragging, `none` when dragging
- 3 vertical grip dots centered (`position: absolute; top: 50%; transform: translate(-50%, -50%)`)
  - Each dot: 3px × 3px, `border-radius: 50%`
  - Color: `var(--prism-text-dim)` → `#fff` when dragging
  - Opacity: 0.4 → 1 when dragging
- Wider invisible hit target: `position: absolute; top: 0; bottom: 0; left: -4px; right: -4px; cursor: col-resize`

### Step 2.3: Create ViewToggle.tsx

`cmd/prism-vscode/webview-panel/src/components/ViewToggle.tsx`:

Props: `{ activeView: 'monitor' | 'office'; onToggle: (view: 'monitor' | 'office') => void; activeAgentCount?: number }`

Layout (from prototype `prism-panel.jsx:628-681`):
- 32px height, `flexShrink: 0`
- Background: `var(--prism-bg-panel)`
- Bottom border: `1px solid var(--prism-border)`
- Contents (flex row, align center, gap 2):
  - "View" label: 10px font, dim monospace, uppercase, letter-spacing 0.08em, marginRight 8px
  - Two toggle buttons:
    - Active: `var(--prism-bg-card)` bg, `1px solid var(--prism-border-active)`, color `var(--prism-text)`, fontWeight 600
    - Inactive: transparent bg, `1px solid transparent`, color `var(--prism-text-dim)`, fontWeight 400
    - Each has icon prefix: `◈` for Monitor, `⌂` for Office
    - Transition: `all 0.15s ease`
  - Right side (only when Office active AND agents > 0): green dot (5px) + "N active" text in green

### Step 2.4: Create StatusBar.tsx

`cmd/prism-vscode/webview-panel/src/components/StatusBar.tsx`:

Props: `{ storyCount: number; storyTotal: number; projectName: string; status?: string }`

Layout (from prototype `prism-panel.jsx:767-794`):
- 22px height, `flexShrink: 0`
- Background: `var(--prism-bg-deep)`, border-top: `1px solid var(--prism-border)`
- Flex row, align center, padding `0 10px`, gap 16
- Contents:
  - "PRISM" text with spectral gradient (`linear-gradient(135deg, blue, teal, green)` + `-webkit-background-clip: text`)
  - Status text (e.g. "Idle"), 9px, dim
  - Story count (e.g. "☰ 8/8 stories (100%)"), 9px, dim
  - Project name, 9px, dim
  - Right side (flex: 1, then right-aligned): error/warning indicators

### Step 2.5: Create PrismPanel.tsx

`cmd/prism-vscode/webview-panel/src/PrismPanel.tsx`:

Root component. Structure follows prototype (`prism-panel.jsx:505-797`).

**State**:
```typescript
const [leftView, setLeftView] = useState<'monitor' | 'office'>('monitor')
const [dividerPos, setDividerPos] = useState(55) // percentage
const [isDragging, setIsDragging] = useState(false)
const containerRef = useRef<HTMLDivElement>(null)
```

**Drag handlers** (useCallback):
- `handleMouseDown`: `e.preventDefault(); setIsDragging(true)`
- `handleMouseMove`: if not dragging or no container, return. Calculate percentage from `e.clientX` relative to container. Clamp `Math.min(80, Math.max(25, pct))`. Call `setDividerPos`.
- `handleMouseUp`: `setIsDragging(false)`. Post `{ type: 'dividerPositionChanged', value: dividerPos }` to extension.

**useEffect for drag listeners**: When `isDragging` changes to true, attach `mousemove`/`mouseup` to `window`. Cleanup on false or unmount.

**useEffect for initial state**: Listen for `message` events. On `initialState`: restore `dividerPos` and `activeView`. On `monitorState`/`workspacesState`: pass through to child views via context or state lifting.

**Toggle handler**: `setLeftView(view)`. Post `{ type: 'viewToggleChanged', value: view }` to extension.

**JSX layout**:
```tsx
<div className="prism-panel-root">
  <div ref={containerRef} className="prism-main-content"
       style={{ cursor: isDragging ? 'col-resize' : 'default', userSelect: isDragging ? 'none' : 'auto' }}>
    {/* Left Panel */}
    <div className="prism-left-panel" style={{ width: `${dividerPos}%` }}>
      <ViewToggle activeView={leftView} onToggle={handleToggle} activeAgentCount={agentCount} />
      <div className="prism-view-content">
        {leftView === 'monitor' ? <MonitorView /> : <OfficeApp />}
      </div>
    </div>
    {/* Divider */}
    <DraggableDivider isDragging={isDragging} onMouseDown={handleMouseDown} />
    {/* Right Panel */}
    <div className="prism-right-panel">
      <div className="prism-workspaces-header">
        <span>WORKSPACES</span>
        <span className="prism-connection-status">● connected</span>
      </div>
      <div className="prism-view-content">
        <WorkspacesView />
      </div>
    </div>
  </div>
  <StatusBar storyCount={...} storyTotal={...} projectName={...} />
</div>
```

### Step 2.6: Update panel.css

Add to `cmd/prism-vscode/webview-panel/src/theme/panel.css`:

**Spectral theme variables** (from prototype):
```css
:root {
  --prism-bg: #1a1d23;
  --prism-bg-deep: #13151a;
  --prism-bg-panel: #1e2128;
  --prism-bg-card: #252830;
  --prism-bg-hover: #2a2d36;
  --prism-border: #2d3039;
  --prism-border-active: #3d4049;
  --prism-text: #c8ccd4;
  --prism-text-dim: #6b7280;
  --prism-text-muted: #4b5260;
  --prism-blue: #3B82F6;
  --prism-teal: #14B8A6;
  --prism-green: #22C55E;
  --prism-amber: #F59E0B;
  --prism-red: #EF4444;
  --prism-purple: #8B5CF6;
}
```

**Layout classes**:
```css
.prism-panel-root { width: 100%; height: 100vh; display: flex; flex-direction: column; overflow: hidden; }
.prism-main-content { flex: 1; display: flex; overflow: hidden; }
.prism-left-panel { display: flex; flex-direction: column; overflow: hidden; }
.prism-right-panel { flex: 1; display: flex; flex-direction: column; overflow: hidden; min-width: 200px; }
.prism-view-content { flex: 1; overflow: auto; background: var(--prism-bg-panel); }
.prism-workspaces-header { height: 32px; display: flex; align-items: center; padding: 0 12px; border-bottom: 1px solid var(--prism-border); background: var(--prism-bg-panel); flex-shrink: 0; }
```

### Phase 2 Verification

```bash
cd cmd/prism-vscode/webview-panel && npm run build
```

**Checkpoint**: Build succeeds. The webview renders PrismPanel with split layout, divider, toggle, and status bar. MonitorView and OfficeApp swap correctly.

---

## Phase 3: Create PrismPanelProvider

**Goal**: Single extension-host provider handles ALL message types for the unified webview — replacing MonitorViewProvider, WorkspacesViewProvider, and OfficeViewProvider.

### Step 3.1: Create PrismPanelProvider.ts

`cmd/prism-vscode/src/hosts/vscode/PrismPanelProvider.ts`

**VIEW_ID**: `'prism.mainView'`

**Constructor takes**: `(context: vscode.ExtensionContext, controller?: PrismController)`

**Imports from existing modules** (these stay where they are):
```typescript
// Office agent lifecycle
import { launchNewTerminal, removeAgent, restoreAgents, persistAgents, sendExistingAgents, sendLayout, getProjectDirPath, createHeadlessAgent } from '../../office/agentManager'
import { ensureProjectScan } from '../../office/fileWatcher'
import { loadFurnitureAssets, sendAssetsToWebview, loadFloorTiles, sendFloorTilesToWebview, loadWallTiles, sendWallTilesToWebview, loadCharacterSprites, sendCharacterSpritesToWebview, loadDefaultLayout } from '../../office/assetLoader'
import { WORKSPACE_KEY_AGENT_SEATS, GLOBAL_KEY_SOUND_ENABLED } from '../../office/constants'
import { writeLayoutToFile, readLayoutFromFile, watchLayoutFile } from '../../office/layoutPersistence'
```

### Step 3.2: Provider structure (merged from all three)

```typescript
export class PrismPanelProvider implements vscode.WebviewViewProvider {
  static readonly VIEW_ID = 'prism.mainView'

  private _webviewView: vscode.WebviewView | undefined

  // ── From OfficeViewProvider ──
  readonly nextAgentId = { current: 1 }
  readonly nextTerminalIndex = { current: 1 }
  readonly agents = new Map<number, AgentState>()
  readonly fileWatchers = new Map<number, fs.FSWatcher>()
  readonly pollingTimers = new Map<number, ReturnType<typeof setInterval>>()
  readonly waitingTimers = new Map<number, ReturnType<typeof setTimeout>>()
  readonly jsonlPollTimers = new Map<number, ReturnType<typeof setInterval>>()
  readonly permissionTimers = new Map<number, ReturnType<typeof setTimeout>>()
  readonly activeAgentId = { current: null as number | null }
  readonly knownJsonlFiles = new Set<string>()
  readonly projectScanTimer = { current: null as ReturnType<typeof setInterval> | null }
  private _defaultLayout: Record<string, unknown> | null = null
  private _layoutWatcher: LayoutWatcher | null = null
  private _spectrumAgentMap = new Map<string, number>()

  // ── From MonitorViewProvider ──
  private _gates: QualityGate[] = []
  private _outputChannel: vscode.OutputChannel | undefined

  // ── From WorkspacesViewProvider ──
  private _projects: ProjectInfo[] = []
  private _worktrees: WorktreeInfo[] = []
  private _parentWatcher: vscode.FileSystemWatcher | undefined
  private _globalWatcher: vscode.FileSystemWatcher | undefined

  // ── Unified panel state ──
  private _dividerPos: number = 55
  private _activeView: 'monitor' | 'office' = 'monitor'

  constructor(context, controller?) {
    // Restore panel state from workspaceState
    this._dividerPos = context.workspaceState.get('prismPanelDividerPos', 55)
    this._activeView = context.workspaceState.get('prismPanelActiveView', 'monitor')

    // ── Controller subscriptions (from OfficeViewProvider constructor:71-125) ──
    // onDidStartSession → createHeadlessAgent for Spectrum
    // onDidEndSpectrumStory → remove headless agent
    // onDidUpdateStory → push agentStoryContext to webview

    // ── File watchers (from WorkspacesViewProvider) ──
    // Watch parent dir for sibling .prism/ directories
    // Watch ~/.prism/workspaces.json
  }
}
```

### Step 3.3: Message routing

The `_handleMessage` method routes ALL message types:

```typescript
private async _handleMessage(msg: { type: string; [k: string]: unknown }): Promise<void> {
  switch (msg.type) {
    // ── Panel-level messages ──
    case 'ready': /* same as 'webviewReady' — send initialState + assets + layout */ break
    case 'dividerPositionChanged':
      this._dividerPos = msg.value as number
      this._context.workspaceState.update('prismPanelDividerPos', this._dividerPos)
      break
    case 'viewToggleChanged':
      this._activeView = msg.value as 'monitor' | 'office'
      this._context.workspaceState.update('prismPanelActiveView', this._activeView)
      break

    // ── Monitor messages (from MonitorViewProvider._handleMessage:196-211) ──
    case 'webviewReady': this._sendInitialState(); break
    case 'runGate': await this._runGate(msg.command as string); break
    case 'runAllGates': await this._runAllGates(); break
    case 'refresh': this.pushMonitorState(); this._pushWorkspacesState(); break

    // ── Workspaces messages (from WorkspacesViewProvider._handleMessage) ──
    case 'openProject': /* vscode.openFolder */ break
    case 'createWorktree': await this._createWorktree(msg.branch as string); break
    case 'deleteWorktree': /* confirm dialog → git worktree remove */ break
    case 'openWorktree': /* vscode.openFolder */ break
    case 'pickAndAddWorkspace': /* file dialog → add to ~/.prism/workspaces.json */ break

    // ── Office messages (from OfficeViewProvider._handleMessage:213-401) ──
    case 'openClaude': /* launchNewTerminal() */ break
    case 'focusAgent': /* find agent by id, terminal.show() */ break
    case 'closeAgent': /* dispose terminal or remove headless agent */ break
    case 'saveAgentSeats': /* persist to workspaceState */ break
    case 'saveLayout': /* markOwnWrite + writeLayoutToFile */ break
    case 'setSoundEnabled': /* persist to globalState */ break
    case 'openSessionsFolder': /* vscode.env.openExternal */ break
    case 'exportLayout': /* read layout, save dialog, write file */ break
    case 'importLayout': /* file picker, validate, write to layout file */ break
  }
}
```

### Step 3.4: Initial state push

When webview sends `ready` or `webviewReady`:

```typescript
private async _sendInitialState(): Promise<void> {
  const webview = this._webviewView?.webview
  if (!webview) return

  // 1. Push panel state (divider pos, active view)
  webview.postMessage({
    type: 'initialState',
    dividerPos: this._dividerPos,
    activeView: this._activeView,
  })

  // 2. Push monitor state
  this.pushMonitorState()

  // 3. Push workspaces state
  await this._pushWorkspacesState()

  // 4. Office initialization (from OfficeViewProvider webviewReady handler:249-361)
  // Restore agents
  // Load settings (soundEnabled)
  // Load assets (characters, floor tiles, wall tiles, furniture)
  // Send layout
  // Start layout watcher
  // Send existing agents
}
```

### Step 3.5: HTML generation

`_getWebviewContent()` follows MonitorViewProvider's pattern but:
- **No `data-view` injection** — the React app renders `<PrismPanel>` directly
- **localResourceRoots** include `dist/webview-panel/`, `dist/assets/` (for office sprites), and `media/`
- **CSP** adds `blob:` to `img-src` (canvas uses toDataURL)
- **Dev mode** checks `.vite-panel-port` file (same as MonitorViewProvider:222-233)

### Step 3.6: Public methods (called from extension.ts)

```typescript
// Called by controller.onDidChangeState in extension.ts
pushMonitorState(): void { ... }  // from MonitorViewProvider.pushState()
pushWorkspacesState(): void { ... }  // from WorkspacesViewProvider.pushState()
updateAgentStatuses(agents: any[]): void { ... }  // from WorkspacesViewProvider

// Called by commands
async runGate(command: string): Promise<void> { ... }
async runAllGates(): Promise<void> { ... }
launchNewTerminal(): void { ... }  // from OfficeViewProvider
exportDefaultLayout(): void { ... }  // from OfficeViewProvider
async createWorktree(branchName: string): Promise<void> { ... }
async deleteWorktree(path: string, deleteBranch: boolean): Promise<void> { ... }

// Cleanup
dispose(): void { ... }  // clean up all watchers, timers, agents
```

### Phase 3 Verification

```bash
cd cmd/prism-vscode && npm run compile
```

**Checkpoint**: Extension compiles with PrismPanelProvider. No TypeScript errors.

---

## Phase 4: Update package.json and extension.ts

**Goal**: Replace 3 provider registrations with 1. Remove sidebar Office. Update commands.

### Step 4.1: package.json changes

**File**: `cmd/prism-vscode/package.json`

**Remove from `views.prism`**: the `prism.officeView` entry (sidebar office)

**Replace `views.prism-panel`**: Replace both `prism.monitorView` and `prism.workspacesView` with single entry:
```json
"prism-panel": [
  {
    "type": "webview",
    "id": "prism.mainView",
    "name": "Prism"
  }
]
```

**Update commands**: Remove commands that no longer apply:
- Remove: `prism.monitor.show` (replaced by focusing the unified panel)
- Remove: `prism.workspaces.show` (replaced by focusing the unified panel)
- Keep: `prism.monitor.runGate`, `prism.monitor.runAllGates` (still useful as external triggers)
- Keep: `prism.workspaces.openProject`, `prism.workspaces.newWorktree`, `prism.workspaces.deleteWorktree`
- Redirect: `prism.office.show` → `prism.mainView.focus`
- Keep: `prism.office.launchAgent`, `prism.office.exportLayout`

**Update npm scripts**: Remove `build:office` and `watch:office`. Update `compile` and `package` to exclude `webview-office` build.

### Step 4.2: extension.ts changes

**File**: `cmd/prism-vscode/src/extension.ts`

**Remove imports**:
```typescript
// Remove:
import { OfficeViewProvider } from "./hosts/vscode/OfficeViewProvider"
import { MonitorViewProvider } from "./hosts/vscode/MonitorViewProvider"
import { WorkspacesViewProvider } from "./hosts/vscode/WorkspacesViewProvider"
```

**Add import**:
```typescript
import { PrismPanelProvider } from "./hosts/vscode/PrismPanelProvider"
```

**Remove globals**: `_officeProvider`, `_monitorProvider`, `_workspacesProvider`

**Add global**: `_panelProvider: PrismPanelProvider | undefined`

**Replace provider registrations** (~lines 91-121): Remove all three, add:
```typescript
_panelProvider = new PrismPanelProvider(context, controller)
context.subscriptions.push(
  vscode.window.registerWebviewViewProvider(
    PrismPanelProvider.VIEW_ID,
    _panelProvider,
    { webviewOptions: { retainContextWhenHidden: true } }
  )
)
```

**Update state subscription** (~line 124-130):
```typescript
controller.onDidChangeState(() => {
  _panelProvider?.pushMonitorState()
  _panelProvider?.updateAgentStatuses(controller.state.office?.activeAgents ?? [])
})
```

**Update command registrations** (~lines 211-267):
```typescript
// Office commands → redirect to panel provider
vscode.commands.registerCommand("prism.office.show", async () => {
  await vscode.commands.executeCommand("prism.mainView.focus")
})
vscode.commands.registerCommand("prism.office.launchAgent", () => {
  _panelProvider?.launchNewTerminal()
})
vscode.commands.registerCommand("prism.office.exportLayout", () => {
  _panelProvider?.exportDefaultLayout()
})

// Monitor commands
vscode.commands.registerCommand("prism.monitor.runGate", async (command?: string) => {
  if (command) await _panelProvider?.runGate(command)
})
vscode.commands.registerCommand("prism.monitor.runAllGates", () => {
  _panelProvider?.runAllGates()
})

// Workspaces commands
vscode.commands.registerCommand("prism.workspaces.newWorktree", async () => {
  const branch = await vscode.window.showInputBox({ prompt: "Branch name", placeHolder: "feat/my-feature" })
  if (branch) await _panelProvider?.createWorktree(branch)
})
// ... etc
```

### Phase 4 Verification

```bash
cd cmd/prism-vscode && npm run compile && npx tsc --noEmit
```

**Checkpoint**: Extension compiles. Single "Prism" tab in bottom panel. Sidebar Office gone.

---

## Phase 5: Cleanup + final verification

**Goal**: Remove old provider files, update build system, full verification.

### Step 5.1: Delete old provider files

```
cmd/prism-vscode/src/hosts/vscode/MonitorViewProvider.ts → delete
cmd/prism-vscode/src/hosts/vscode/WorkspacesViewProvider.ts → delete
```

Keep `OfficeViewProvider.ts` in the codebase for reference (dormant).

### Step 5.2: Update esbuild.mjs

- Remove `copyOfficeAssets()` function if it exists (office no longer has separate dist)
- Ensure `copyPanelAssets()` handles the merged output correctly
- Ensure `media/` assets (sprites loaded by extension host, not webview) are still copied

### Step 5.3: Final build verification

```bash
cd cmd/prism-vscode/webview-panel && npm install && npm run build
cd cmd/prism-vscode && npm run compile
cd cmd/prism-vscode && npx tsc --noEmit
cd cmd/prism-vscode && npm run package
```

All four must succeed.

### Step 5.4: Save plan to .prism/shared/plans/

Update this plan's status to `approved` once verified.

---

## Risks and Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| `acquireVsCodeApi()` called twice from both panel and office code | Medium | High (crash) | Ensure all 6 office files import from panel's `src/vscodeApi.ts`; Vite module dedup handles the rest |
| Office canvas doesn't render correctly when embedded in flex container | Low | Medium | The OfficeCanvas is already `width: 100%; height: 100%` with `position: relative; overflow: hidden`. The parent `.prism-view-content` just needs `overflow: hidden` |
| Office asset loading fails because assets are served differently | Low | Low | Assets are sent as base64 via postMessage from extension host, not as URIs. No change needed — the same `assetLoader.ts` functions work regardless of which webview receives the messages |
| Import path fixes miss a file — build fails | Medium | Low | The tables in Step 1.2-1.4 enumerate every file. TypeScript compiler will catch any remaining errors during Phase 1.7 build verification |
| Divider drag conflicts with Office canvas mouse events | Low | Medium | The divider captures `mousemove`/`mouseup` on `window` with `user-select: none` on the container. Office canvas has its own pointer handlers but only within its bounds |
| Panel height too short for Office canvas | Medium | Low | Office uses `preserveAspectRatio` and canvas auto-sizing. When panel is very short, it still renders — just smaller. This is existing Office behavior |
| PrismPanelProvider is very large (1000+ lines) | Expected | Low | This is acceptable for a unified provider. Logic is organized into clear sections (monitor/workspaces/office). Can be refactored into separate modules later if needed |

## Edge Cases

- **No agents**: Office shows empty desks. Monitor shows "No agents running" empty state.
- **No stories.json**: Monitor shows empty execution history. Quality gates section hidden.
- **Extremely narrow divider position (25%)**: Office canvas may be cramped but still renders. User can drag wider.
- **Switch toggle while Office is loading assets**: OfficeApp unmounts, assets continue loading in background via message listener. When toggled back, `useExtensionMessages` hook re-requests state with `webviewReady`.
- **webview-panel/node_modules**: Dependencies are identical between webview-office and webview-panel (both React 19.2.0 + Vite 6). No version conflicts.
