---
date: 2026-02-27T00:00:00Z
feature: "VSCode Extension — Monitor & Workspaces Bottom Panel Webviews"
status: approved
author: Claude Opus 4.6
tags: [vscode, extension, monitor, workspaces, webview, panel, kanban]
---

# Implementation Plan: Monitor & Workspaces Bottom Panel Webviews

**Date**: 2026-02-27
**Status**: Approved
**Research**: `.prism/shared/research/2026-02-27-vscode-monitor-workspaces-sections.md`

---

## Goal

Add Monitor and Workspaces as rich React webview panels in the VSCode **bottom panel area** (alongside Terminal, Problems, Output). Monitor provides a real-time execution dashboard with quality gate runner, execution history table, agent health cards, and a kanban board. Workspaces provides multi-project discovery, git worktree management, and agent-status kanban. Both share a single `webview-panel/` Vite React app with common components (kanban board, progress bars, agent status cards).

## Key Architectural Decisions

1. **Bottom panel via `viewsContainers.panel`** — Not sidebar tree views. Same `registerWebviewViewProvider` API, different manifest location. Gives horizontal space for tables, timelines, kanban boards.
2. **Single `webview-panel/` React app** — Both Monitor and Workspaces load the same built `index.html`. A `data-view` attribute injected by each provider tells the app which view to render. Shared components (kanban, progress bars, agent cards) avoid duplication.
3. **`OfficeViewProvider` pattern** — New providers follow the Office pattern: read built `dist/webview-panel/index.html`, regex-rewrite asset URLs, inject CSP. Dev mode via `.vite-panel-port` file.
4. **Direct `postMessage`** — Like Office, not gRPC-over-postMessage. Monitor/Workspaces need simple state pushes, not request/response streaming.
5. **Quality gates from `stories.json`** — Read `plan.qualityGates` string array. No hardcoded gates. Run via hidden `OutputChannel` with result piped back via `postMessage`.
6. **Project discovery** — Sibling `.prism/` directory scan + `~/.prism/workspaces.json` global registry (same algorithm as CLI's `plugin_workspaces.go`).
7. **Worktree management** — `git worktree list --porcelain` via `child_process.exec`. Create/delete actions with confirmation dialogs.

## What We're NOT Doing

- Not adding tree-view sections (webviews replace that need entirely)
- Not adding Monitor/Workspaces to the sidebar (bottom panel is the right home)
- Not creating separate `webview-monitor/` and `webview-workspaces/` apps (single shared app)
- Not using gRPC-over-postMessage (overkill for simple state pushes)
- Not polling for data (file watchers + event-driven updates)
- Not implementing the CLI's Go runtime health stats (no Go in VSCode — show agent count instead)
- Not building a full Spectrum execution runner here (that's the existing SpectrumView in sidebar)
- Not modifying existing sidebar, office, or tree-view sections

---

## Success Criteria

### Automated Verification
- [ ] Extension compiles: `cd cmd/prism-vscode && npm run compile`
- [ ] TypeScript checks pass: `cd cmd/prism-vscode && npx tsc --noEmit`
- [ ] Panel webview builds: `cd cmd/prism-vscode/webview-panel && npm run build`
- [ ] Full package builds: `cd cmd/prism-vscode && npm run package`

### Manual Verification
- [ ] "Prism Monitor" tab appears in bottom panel area
- [ ] "Prism Workspaces" tab appears in bottom panel area
- [ ] Monitor: execution history table shows completed stories with status icons, duration, timestamps
- [ ] Monitor: quality gates section shows gates from `stories.json` with run buttons
- [ ] Monitor: clicking "Run" on a gate executes the command and shows pass/fail result
- [ ] Monitor: "Run All" executes all gates concurrently
- [ ] Monitor: agent health section shows active agents from Office with status indicators
- [ ] Monitor: kanban board groups agents by status (Active/Thinking/Waiting/Done/Paused)
- [ ] Workspaces: projects section discovers sibling `.prism/` directories with progress bars
- [ ] Workspaces: worktrees section lists git worktrees with branch, HEAD, type
- [ ] Workspaces: "New Worktree" creates a git worktree via input dialog
- [ ] Workspaces: "Delete Worktree" removes with confirmation (blocked for main worktree)
- [ ] Workspaces: "Open Project" opens folder in VSCode
- [ ] Workspaces: kanban board groups worktrees by agent status
- [ ] Both panels handle resize/reflow when dragged to sidebar
- [ ] Both panels retain state when hidden (`retainContextWhenHidden`)
- [ ] Both panels adapt to light/dark theme via VSCode CSS variables

---

## Phase 1: Scaffold — webview-panel App + Providers + Build Integration

**Goal**: Create the `webview-panel/` Vite React app, both ViewProviders, register in `package.json` and `extension.ts`. Both panels appear in the bottom panel area with placeholder content.

### Step 1.1: Create `webview-panel/` Vite React App

**Create directory**: `cmd/prism-vscode/webview-panel/`

**Create files**:

#### `webview-panel/package.json`
```json
{
  "name": "prism-webview-panel",
  "private": true,
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.4",
    "typescript": "^5.6.3",
    "vite": "^6.0.0"
  }
}
```

#### `webview-panel/vite.config.ts`
Follow `webview-office/vite.config.ts` pattern exactly:
- `base: './'` — relative URLs for webview URI rewriting
- `outDir: '../dist/webview-panel'` — output alongside `dist/webview-office/`
- `entryFileNames: 'assets/[name].js'` — predictable asset names
- Port 5175, write `.vite-panel-port` for dev detection
- Add `writePortPlugin` (same pattern as `webview-ui/vite.config.ts:10-20`)

#### `webview-panel/tsconfig.json`
Copy from `webview-office/tsconfig.json`, adjust `include` path.

#### `webview-panel/index.html`
Standard Vite React template with `<div id="root"></div>`. Add a `<div id="root" data-view=""></div>` — the `data-view` attribute will be injected by the provider at runtime.

#### `webview-panel/src/main.tsx`
```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { MonitorView } from './views/MonitorView'
import { WorkspacesView } from './views/WorkspacesView'
import './theme/panel.css'

const root = document.getElementById('root')!
const viewType = root.getAttribute('data-view') || 'monitor'

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    {viewType === 'workspaces' ? <WorkspacesView /> : <MonitorView />}
  </React.StrictMode>
)
```

#### `webview-panel/src/vscodeApi.ts`
Follow `webview-office/src/vscodeApi.ts` pattern:
```typescript
declare function acquireVsCodeApi(): { postMessage(msg: unknown): void }
export const vscode = acquireVsCodeApi()
```

#### `webview-panel/src/views/MonitorView.tsx`
Placeholder: renders "Monitor" heading with basic layout skeleton (3 sections).

#### `webview-panel/src/views/WorkspacesView.tsx`
Placeholder: renders "Workspaces" heading with basic layout skeleton (2 sections).

#### `webview-panel/src/theme/panel.css`
VSCode CSS variable mappings. Follow `webview-office/src/theme/spectral-office.css` pattern:
```css
:root {
  --panel-bg: var(--vscode-panel-background);
  --panel-fg: var(--vscode-foreground);
  --panel-border: var(--vscode-panel-border);
  --prism-blue: #3B82F6;
  --prism-teal: #14B8A6;
  --prism-green: #22C55E;
  --prism-amber: #F59E0B;
  --prism-purple: #7C3AED;
  --prism-red: #EF4444;
}
body {
  margin: 0;
  padding: 0;
  background: var(--panel-bg);
  color: var(--panel-fg);
  font-family: var(--vscode-font-family);
  font-size: var(--vscode-font-size);
}
```

### Step 1.2: Create `MonitorViewProvider.ts`

**Create file**: `cmd/prism-vscode/src/hosts/vscode/MonitorViewProvider.ts`

Follow `OfficeViewProvider.ts` pattern (lines 163-211, 461-580):
- `static VIEW_ID = "prism.monitorView"`
- Implement `vscode.WebviewViewProvider`
- `resolveWebviewView()`: set options, load HTML, wire message listener
- `_getWebviewContent()`: read `dist/webview-panel/index.html`, regex-rewrite URLs, inject CSP, **inject `data-view="monitor"` into the root div**
- `_getDevHtml()`: dev mode with `.vite-panel-port` detection, same React Refresh preamble
- `_handleMessage()`: handle messages from webview (gate run requests, refresh requests)
- `postMessage()`: send state updates to webview
- Local `getNonce()` function

**Key difference from Office**: Inject `data-view="monitor"` by replacing `data-view=""` in the HTML:
```typescript
html = html.replace('data-view=""', 'data-view="monitor"')
```

### Step 1.3: Create `WorkspacesViewProvider.ts`

**Create file**: `cmd/prism-vscode/src/hosts/vscode/WorkspacesViewProvider.ts`

Nearly identical to `MonitorViewProvider`, but:
- `static VIEW_ID = "prism.workspacesView"`
- Injects `data-view="workspaces"` instead
- `_handleMessage()`: handles workspace-specific messages (open project, create/delete worktree)
- Has methods for git commands: `getWorktrees()`, `createWorktree()`, `deleteWorktree()`, `discoverProjects()`

### Step 1.4: Update `package.json`

**File**: `cmd/prism-vscode/package.json`

**Add `viewsContainers.panel`** (new key alongside existing `activitybar`):
```json
"viewsContainers": {
  "activitybar": [ ... existing ... ],
  "panel": [
    {
      "id": "prism-panel",
      "title": "Prism",
      "icon": "media/prism-icon.svg"
    }
  ]
}
```

**Add views under `prism-panel`**:
```json
"views": {
  "prism": [ ... existing sidebar views ... ],
  "prism-panel": [
    {
      "type": "webview",
      "id": "prism.monitorView",
      "name": "Monitor"
    },
    {
      "type": "webview",
      "id": "prism.workspacesView",
      "name": "Workspaces"
    }
  ]
}
```

**Add commands** to `contributes.commands`:
```json
{ "command": "prism.monitor.show", "title": "Show Monitor", "category": "Prism" },
{ "command": "prism.monitor.runGate", "title": "Run Quality Gate", "category": "Prism" },
{ "command": "prism.monitor.runAllGates", "title": "Run All Quality Gates", "category": "Prism" },
{ "command": "prism.workspaces.show", "title": "Show Workspaces", "category": "Prism" },
{ "command": "prism.workspaces.openProject", "title": "Open Project", "category": "Prism" },
{ "command": "prism.workspaces.newWorktree", "title": "New Worktree", "category": "Prism" },
{ "command": "prism.workspaces.deleteWorktree", "title": "Delete Worktree", "category": "Prism" }
```

### Step 1.5: Update `extension.ts`

**File**: `cmd/prism-vscode/src/extension.ts`

Add after the office provider registration (~line 95):

```typescript
import { MonitorViewProvider } from "./hosts/vscode/MonitorViewProvider"
import { WorkspacesViewProvider } from "./hosts/vscode/WorkspacesViewProvider"

// Panel webview providers (bottom panel)
const monitorProvider = new MonitorViewProvider(context, controller)
const workspacesProvider = new WorkspacesViewProvider(context, controller)

context.subscriptions.push(
  vscode.window.registerWebviewViewProvider(
    MonitorViewProvider.VIEW_ID,
    monitorProvider,
    { webviewOptions: { retainContextWhenHidden: true } },
  ),
  vscode.window.registerWebviewViewProvider(
    WorkspacesViewProvider.VIEW_ID,
    workspacesProvider,
    { webviewOptions: { retainContextWhenHidden: true } },
  ),
)
```

### Step 1.6: Update Build System

**File**: `cmd/prism-vscode/package.json` scripts:
- Add `"build:panel": "cd webview-panel && npm run build"`
- Add `"watch:panel": "cd webview-panel && npm run dev"`
- Update `"compile"` to include `npm run build:panel`
- Update `"watch"` to include `watch:panel`
- Update `"package"` to include `npm run build:panel`

**File**: `cmd/prism-vscode/esbuild.mjs`:
- Add `copyPanelAssets()` function alongside existing `copyOfficeAssets()` — copies `dist/webview-panel/` assets if needed.

### Step 1.7: Install Dependencies + Verify

```bash
cd cmd/prism-vscode/webview-panel && npm install
cd cmd/prism-vscode && npm run compile
```

### Phase 1 Verification
- [ ] `npm run compile` succeeds (extension + all 3 webviews build)
- [ ] "Prism Monitor" and "Prism Workspaces" tabs appear in bottom panel
- [ ] Both show placeholder content
- [ ] Dev mode works (`npm run watch` + `.vite-panel-port` detection)

---

## Phase 2: Monitor View — Full Dashboard

**Goal**: Build the complete Monitor dashboard with four sections: System Health, Execution History, Quality Gates, and Agent Kanban.

### Step 2.1: Define Monitor Message Types

**Create file**: `cmd/prism-vscode/webview-panel/src/types/monitor.ts`

```typescript
export interface AgentStatus {
  id: number
  sessionId?: string
  storyId?: string
  storyTitle?: string
  agentType: string      // "claude" | "codex" | "cursor"
  status: string         // "active" | "thinking" | "waiting" | "done" | "paused"
  worktreePath?: string
}

export interface ExecutionRecord {
  storyId: string
  storyTitle: string
  result: "complete" | "error" | "blocked"
  durationMs: number
  completedAt: string    // ISO timestamp
  commitHash?: string
}

export interface QualityGate {
  name: string           // derived from command (e.g., "npm test" → "Tests")
  command: string        // raw command string from stories.json
  status: "unknown" | "pass" | "fail" | "running" | "pending"
  lastRun?: string       // ISO timestamp
  output?: string        // captured stdout+stderr (truncated to last 50 lines)
  durationMs?: number
}

export interface MonitorState {
  agents: AgentStatus[]
  history: ExecutionRecord[]
  gates: QualityGate[]
}
```

### Step 2.2: Build `MonitorViewProvider` Message Handling

**File**: `cmd/prism-vscode/src/hosts/vscode/MonitorViewProvider.ts`

Add methods:
- `pushState()` — sends full `MonitorState` to webview via `postMessage({ type: 'monitorState', state })`
- `_buildMonitorState()` — assembles state from controller:
  - `agents`: map from `controller.state.office.activeAgents`
  - `history`: derive from `controller.state.stories` where `status === 'complete'` (sorted by `completedAt` desc, limited to 50)
  - `gates`: map from `controller.state.plan?.qualityGates` string array → `QualityGate[]` objects
- `_handleMessage()` cases:
  - `{ type: 'runGate', command: string }` → execute gate, stream result back
  - `{ type: 'runAllGates' }` → execute all gates concurrently
  - `{ type: 'refresh' }` → re-push state
  - `{ type: 'webviewReady' }` → initial state push

Add gate execution method:
```typescript
private async _runGate(command: string): Promise<void> {
  const gate = this._gates.find(g => g.command === command)
  if (!gate) return

  gate.status = 'running'
  this.pushState()

  const channel = this._outputChannel  // vscode.window.createOutputChannel("Prism Gates")
  const startTime = Date.now()

  try {
    const { stdout, stderr } = await execAsync(command, { cwd: workspaceRoot })
    gate.status = 'pass'
    gate.output = truncateOutput(stdout + stderr, 50)
    channel.appendLine(`[PASS] ${command}\n${gate.output}`)
  } catch (err) {
    gate.status = 'fail'
    gate.output = truncateOutput(err.stdout + err.stderr, 50)
    channel.appendLine(`[FAIL] ${command}\n${gate.output}`)
  }

  gate.durationMs = Date.now() - startTime
  gate.lastRun = new Date().toISOString()
  this.pushState()
}
```

Wire state updates in `extension.ts`:
```typescript
controller.onDidChangeState(() => {
  monitorProvider.pushState()
})
```

### Step 2.3: Build Shared Components

**Create files in `webview-panel/src/components/`**:

#### `StatusIcon.tsx`
Reusable status indicator component:
- `complete`/`pass` → green circle `●`
- `error`/`fail` → red circle `●`
- `running` → blue animated spinner
- `blocked`/`pending` → yellow circle `○`
- `active` → green pulse
- `thinking` → blue pulse
- `waiting` → yellow
- `paused`/`done` → gray

#### `ProgressBar.tsx`
Filled/empty bar with percentage label. Uses `--prism-green` for fill. Accepts `value` (0-1), `label`, optional `size` (sm/md).

#### `KanbanBoard.tsx`
Generic kanban component used by both Monitor (agents by status) and Workspaces (worktrees by agent status):
```tsx
interface KanbanColumn<T> {
  id: string
  title: string
  color: string
  items: T[]
}

interface KanbanBoardProps<T> {
  columns: KanbanColumn<T>[]
  renderCard: (item: T) => React.ReactNode
  emptyText?: string
}
```

Five columns: Active (green), Thinking (blue), Waiting (yellow), Done (gray), Paused (dim).
Each card rendered by the parent's `renderCard` function.

#### `AgentCard.tsx`
Card component for kanban board:
- Agent type badge (claude/codex/cursor)
- Status indicator dot
- Story context (ID + title) if assigned
- Worktree path (basename) if available

#### `DataTable.tsx`
Generic sortable table component:
```tsx
interface Column<T> {
  key: string
  label: string
  width?: string
  render: (item: T) => React.ReactNode
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  emptyText?: string
}
```

Styled with VSCode CSS variables. Rows alternate `--vscode-list-inactiveSelectionBackground`.

### Step 2.4: Build MonitorView

**File**: `webview-panel/src/views/MonitorView.tsx`

Layout — horizontal flex with 4 sections arranged in a 2x2 grid (responsive: stacks vertically when narrow):

```
┌─────────────────────────────┬────────────────────────────────┐
│ System Health               │ Execution History              │
│ ● 2 agents active           │ ┌──────────┬────┬─────┬──────┐│
│ [●] claude feat/dark  active│ │ Story    │ ✓/✗│ Dur │ Time ││
│ [◉] claude fix/nav thinking │ │ STORY-008│ ✓  │ 2m  │14:32 ││
│                             │ │ STORY-007│ ✗  │ 45s │14:28 ││
│                             │ │ STORY-006│ ✓  │ 1m  │14:20 ││
│ Last refresh: 14:32:01      │ └──────────┴────┴─────┴──────┘│
├─────────────────────────────┼────────────────────────────────┤
│ Quality Gates               │ Agent Kanban                   │
│ [✓] npm test        12s ago │ Active(1) │Thinking(1)│Wait(0)│
│ [✗] npm run build    5s ago │ ┌──────┐  │┌──────┐   │       │
│ [?] npm run lint   Never run│ │claude│  ││claude│   │       │
│                             │ │feat/ │  ││fix/  │   │       │
│ [Run All]                   │ └──────┘  │└──────┘   │       │
└─────────────────────────────┴────────────────────────────────┘
```

#### System Health Section
- Active agent count with status summary
- List of agents with type, worktree basename, status icon
- "Last refresh" timestamp

#### Execution History Section
- `DataTable` with columns: Story (ID + title), Result (StatusIcon), Duration (formatted), Time (HH:MM:SS)
- Sorted by timestamp descending (most recent first)
- Max 50 entries, scrollable
- Click row to open related story in stories tree (post message to extension)

#### Quality Gates Section
- List of gates with status icon, command, last run time
- "Run" button per gate (sends `{ type: 'runGate', command }` to extension)
- "Run All" button at bottom (sends `{ type: 'runAllGates' }`)
- Running gates show animated spinner
- Click gate to show output in expandable panel below

#### Agent Kanban Section
- `KanbanBoard` component with `AgentCard` renderer
- 5 columns grouped by agent status
- Cards show agent type, worktree branch, story context

### Step 2.5: Wire MonitorView Message Handling

**File**: `webview-panel/src/views/MonitorView.tsx`

```tsx
const [state, setState] = useState<MonitorState>({ agents: [], history: [], gates: [] })

useEffect(() => {
  const handler = (e: MessageEvent) => {
    const msg = e.data
    if (msg.type === 'monitorState') setState(msg.state)
  }
  window.addEventListener('message', handler)
  vscode.postMessage({ type: 'webviewReady' })
  return () => window.removeEventListener('message', handler)
}, [])
```

### Phase 2 Verification
- [ ] `npm run compile` succeeds
- [ ] Monitor panel shows all 4 sections with real data
- [ ] Quality gates load from `stories.json`
- [ ] Running a gate shows spinner → pass/fail result
- [ ] "Run All" executes concurrently
- [ ] Agent kanban shows agents from Office
- [ ] Execution history populates from completed stories
- [ ] Responsive layout adjusts when panel resized

---

## Phase 3: Workspaces View — Projects + Worktrees + Kanban

**Goal**: Build the complete Workspaces view with project discovery, worktree management, and agent kanban.

### Step 3.1: Define Workspaces Message Types

**Create file**: `cmd/prism-vscode/webview-panel/src/types/workspaces.ts`

```typescript
export interface EpicInfo {
  name: string
  storiesPath: string
  storyCount: number
  completedCount: number
}

export interface ProjectInfo {
  name: string
  path: string
  branch: string
  storiesTotal: number
  storiesComplete: number
  epics: EpicInfo[]
  isCurrent: boolean      // true if this is the active workspace
}

export interface WorktreeInfo {
  path: string
  branch: string
  head: string            // short commit hash
  isBare: boolean
  isMain: boolean
  prunable: boolean
  agentStatus?: {
    agentType: string
    status: string
  }
}

export interface WorkspacesState {
  projects: ProjectInfo[]
  worktrees: WorktreeInfo[]
  loading: boolean
}
```

### Step 3.2: Build `WorkspacesViewProvider` Backend

**File**: `cmd/prism-vscode/src/hosts/vscode/WorkspacesViewProvider.ts`

Core methods:

#### `discoverProjects()`
Port the CLI algorithm from `plugin_workspaces.go:1649-1715`:
1. Get workspace root via `vscode.workspace.workspaceFolders[0]`
2. Read parent directory entries via `fs.readdir(path.dirname(workspaceRoot))`
3. For each sibling, check if `.prism/` exists via `fs.stat()`
4. Merge with `~/.prism/workspaces.json` via `os.homedir()` — parse JSON, deduplicate by `path.resolve()`
5. For each project: run `git rev-parse --abbrev-ref HEAD` for branch, scan `.prism/stories/` for epics, parse `stories.json` for counts
6. Sort alphabetically by name
7. Mark current workspace as `isCurrent: true`

#### `getWorktrees()`
Port from `plugin_workspaces.go:1579-1647`:
1. Find git root: `git rev-parse --show-toplevel`
2. Run `git -C <root> worktree list --porcelain`
3. Parse porcelain output: split on blank lines, extract `worktree`, `HEAD`, `branch`, `bare`, `prunable` fields
4. Strip `refs/heads/` from branch names
5. Mark first entry as `isMain: true`

#### `createWorktree(branchName: string)`
1. Compute path: `../<repoName>-<safeBranch>` (replace `/` with `-`)
2. Run `git -C <root> worktree add -b <branch> <path>`
3. Refresh worktree list
4. Push updated state

#### `deleteWorktree(worktreePath: string, deleteBranch: boolean)`
1. Run `git -C <root> worktree remove <path>`
2. If `deleteBranch`: run `git -C <root> branch -D <branch>` (best-effort)
3. Refresh worktree list
4. Push updated state

#### `_handleMessage()` cases:
- `{ type: 'webviewReady' }` → initial state push (discover projects + get worktrees)
- `{ type: 'refresh' }` → re-discover + re-push
- `{ type: 'openProject', path: string }` → `vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(path))`
- `{ type: 'createWorktree', branch: string }` → `createWorktree()`
- `{ type: 'deleteWorktree', path: string, branch: string, deleteBranch: boolean }` → confirmation dialog → `deleteWorktree()`
- `{ type: 'openWorktree', path: string }` → `vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(path))`
- `{ type: 'addWorkspace', path: string }` → add to `~/.prism/workspaces.json`

### Step 3.3: Build Workspaces-Specific Components

**Create files in `webview-panel/src/components/`**:

#### `ProjectCard.tsx`
Card component for project list:
- Project name (bold if current workspace)
- Branch badge
- Progress bar with `X/Y stories (Z%)`
- Epic count badge
- Click to expand → show epics with individual progress bars
- "Open" button → sends `{ type: 'openProject', path }`

#### `WorktreeRow.tsx`
Row component for worktree list:
- Branch name (with `●` main, `▸` linked, `○` bare icons)
- HEAD hash (first 7 chars, monospace, dimmed)
- Type label (Main/Linked/Bare)
- Agent status badge (if assigned via kanban data)
- "Open" button → `{ type: 'openWorktree', path }`
- "Delete" button (disabled for main) → `{ type: 'deleteWorktree', ... }`

#### `NewWorktreeDialog.tsx`
Inline form (not a modal — inline within the Worktrees section):
- Branch name input field
- "Create" button → `{ type: 'createWorktree', branch }`
- "Cancel" button to dismiss

### Step 3.4: Build WorkspacesView

**File**: `webview-panel/src/views/WorkspacesView.tsx`

Layout — three sections in a responsive layout:

```
┌──────────────────────────────┬───────────────────────────────┐
│ Projects                     │ Worktrees                     │
│ ┌──────────────────────────┐ │ ┌──────────────────────────┐  │
│ │ ● prism-plugin     main  │ │ │ ● main       abc1234     │  │
│ │   ████████ 8/8 (100%)    │ │ │ ▸ feat/dark  def5678     │  │
│ │   2 epics                │ │ │ ○ fix/nav    ghi9012     │  │
│ ├──────────────────────────┤ │ │                          │  │
│ │   my-other-proj  feat/api│ │ │ [+ New Worktree]         │  │
│ │   ████░░░ 2/5 (40%)     │ │ └──────────────────────────┘  │
│ │   1 epic                 │ │                               │
│ └──────────────────────────┘ │                               │
├──────────────────────────────┴───────────────────────────────┤
│ Agent Kanban                                                 │
│ Active (1)     │ Thinking (1)   │ Waiting (0)  │ Done (2)   │
│ ┌────────────┐ │ ┌────────────┐ │              │ ┌────────┐ │
│ │ claude     │ │ │ claude     │ │              │ │ claude │ │
│ │ feat/dark  │ │ │ fix/nav    │ │              │ │ main   │ │
│ │ STORY-008  │ │ │            │ │              │ │        │ │
│ └────────────┘ │ └────────────┘ │              │ └────────┘ │
└──────────────────────────────────────────────────────────────┘
```

#### Projects Section (left top)
- Scrollable list of `ProjectCard` components
- Current workspace highlighted with accent border
- "Add Workspace..." action at bottom (file picker dialog)

#### Worktrees Section (right top)
- List of `WorktreeRow` components
- "+ New Worktree" action at bottom (reveals inline `NewWorktreeDialog`)
- Main worktree pinned at top

#### Agent Kanban Section (full width bottom)
- Shared `KanbanBoard` component, same as Monitor
- Cards show worktree branch + agent status + story context
- Worktrees without agents appear in "Waiting" column

### Step 3.5: Wire WorkspacesView Message Handling

Same pattern as MonitorView — `useEffect` listener for `workspacesState`, send `webviewReady` on mount.

### Step 3.6: File Watcher for Auto-Refresh

**File**: `cmd/prism-vscode/src/hosts/vscode/WorkspacesViewProvider.ts`

Add file watcher on the parent directory to detect new/removed sibling projects:
```typescript
const parentDir = path.dirname(workspaceRoot)
const watcher = vscode.workspace.createFileSystemWatcher(
  new vscode.RelativePattern(parentDir, '**/.prism'),
  false, true, false  // watch creates and deletes only
)
watcher.onDidCreate(() => this._refreshProjects())
watcher.onDidDelete(() => this._refreshProjects())
context.subscriptions.push(watcher)
```

Also watch `~/.prism/workspaces.json` for external additions:
```typescript
const globalWatcher = vscode.workspace.createFileSystemWatcher(
  path.join(os.homedir(), '.prism', 'workspaces.json')
)
globalWatcher.onDidChange(() => this._refreshProjects())
```

### Phase 3 Verification
- [ ] `npm run compile` succeeds
- [ ] Workspaces panel discovers sibling `.prism/` projects
- [ ] Current workspace is visually highlighted
- [ ] Progress bars show correct story completion
- [ ] Worktree list matches `git worktree list` output
- [ ] "New Worktree" creates worktree successfully
- [ ] "Delete Worktree" removes with confirmation (main blocked)
- [ ] "Open Project" switches VSCode workspace folder
- [ ] Agent kanban shows worktrees grouped by agent status
- [ ] File watcher triggers refresh on sibling project changes

---

## Phase 4: Extension Wiring — Commands, State Subscriptions, Polish

**Goal**: Wire all commands in `extension.ts`, connect state subscriptions between controller/office/monitor/workspaces, add shared component polish and responsive styling.

### Step 4.1: Register Commands in `extension.ts`

**File**: `cmd/prism-vscode/src/extension.ts`

Add command block after existing Office commands:

```typescript
// Commands — Monitor panel
context.subscriptions.push(
  vscode.commands.registerCommand("prism.monitor.show", async () => {
    await vscode.commands.executeCommand("prism.monitorView.focus")
  }),
  vscode.commands.registerCommand("prism.monitor.runGate", async (command?: string) => {
    if (command) monitorProvider.runGate(command)
  }),
  vscode.commands.registerCommand("prism.monitor.runAllGates", () => {
    monitorProvider.runAllGates()
  }),
)

// Commands — Workspaces panel
context.subscriptions.push(
  vscode.commands.registerCommand("prism.workspaces.show", async () => {
    await vscode.commands.executeCommand("prism.workspacesView.focus")
  }),
  vscode.commands.registerCommand("prism.workspaces.openProject", async (projectPath?: string) => {
    if (projectPath) {
      await vscode.commands.executeCommand("vscode.openFolder", vscode.Uri.file(projectPath))
    }
  }),
  vscode.commands.registerCommand("prism.workspaces.newWorktree", async () => {
    const branch = await vscode.window.showInputBox({
      prompt: "Branch name for new worktree",
      placeHolder: "feat/my-feature",
    })
    if (branch) await workspacesProvider.createWorktree(branch)
  }),
  vscode.commands.registerCommand("prism.workspaces.deleteWorktree", async (worktreePath?: string) => {
    if (worktreePath) await workspacesProvider.deleteWorktree(worktreePath, false)
  }),
)
```

### Step 4.2: Connect State Subscriptions

**File**: `cmd/prism-vscode/src/extension.ts`

Add to the existing `controller.onDidChangeState` handler:

```typescript
controller.onDidChangeState(() => {
  const s = controller.state
  // ... existing tree provider updates ...

  // Push to panel webviews
  monitorProvider.pushState()
  workspacesProvider.updateAgentStatuses(s.office.activeAgents)
})
```

Add controller file change subscription for monitor:
```typescript
controller.onDidChangePrismFile((event) => {
  // ... existing tree updates ...
  if (event.type === "stories") monitorProvider.pushState()
})
```

### Step 4.3: Cross-Provider Agent Bridge

The Monitor and Workspaces kanban boards both need agent status data. This flows from Office:

```
OfficeViewProvider (agent terminals)
  → controller.state.office.activeAgents (already updates on state change)
    → monitorProvider.pushState() (includes agents from state)
    → workspacesProvider.updateAgentStatuses() (maps agents to worktrees)
```

No new bridge needed — the existing `controller.onDidChangeState` already propagates office agent data. Both panel providers read from `controller.state.office.activeAgents` when building their state.

### Step 4.4: Shared Component Polish

#### Responsive Layout
Both views should handle:
- Full width bottom panel (primary use case)
- Narrow sidebar (if user drags the panel to sidebar)
- Use CSS `@container` queries or JS `ResizeObserver` to switch from 2-column to 1-column layout below 600px width

#### Theme Integration
- All colors via VSCode CSS variables (no hardcoded colors except Prism accent palette)
- Hover states use `--vscode-list-hoverBackground`
- Active/selected use `--vscode-list-activeSelectionBackground`
- Borders use `--vscode-panel-border`
- Scrollbars use `--vscode-scrollbar-shadow`

#### Animations
- Gate "running" → spinning SVG icon (CSS `@keyframes spin`)
- Agent status pulse (CSS `@keyframes pulse` on active agents)
- Kanban card transitions (CSS `transition: transform 0.2s`)
- Keep animations subtle and performant

#### Empty States
- No stories → "No stories found. Create a plan and decompose it to get started."
- No quality gates → "No quality gates configured. Add `qualityGates` to your stories.json plan."
- No agents → "No agents running. Launch an agent from the Office panel."
- No projects → "No sibling projects found. Add a workspace or create `.prism/` in a sibling directory."
- No worktrees → "Single worktree (main). Create a new worktree to work on a branch."

### Step 4.5: Update Research Document

**File**: `.prism/shared/research/2026-02-27-vscode-monitor-workspaces-sections.md`

Append a section noting the pivot from tree views to panel webviews, with a link to this plan.

### Phase 4 Verification
- [ ] All commands registered and functional
- [ ] State flows from controller → monitor → webview on every change
- [ ] State flows from controller → workspaces → webview on every change
- [ ] Agent kanban updates in real-time when office agents change
- [ ] Responsive layout handles narrow width gracefully
- [ ] Light and dark themes both look correct
- [ ] Empty states show helpful guidance
- [ ] `npm run compile` succeeds
- [ ] `npm run package` succeeds (full production build)

---

## Risks and Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Panel webview port conflict with existing webviews | Low | Low | Use port 5175 (after 5173 sidebar, 5174 office), `strictPort: false` fallback |
| `git worktree list --porcelain` format varies across git versions | Low | Medium | Test with git 2.30+ (porcelain format is stable); add fallback parsing for edge cases |
| `~/.prism/workspaces.json` doesn't exist on fresh installs | Medium | Low | Guard with try/catch, return empty array. Create file on first "Add Workspace" action |
| Users drag panel views to sidebar — layout breaks | Medium | Medium | Use CSS container queries / `ResizeObserver` for responsive layout from Phase 4 |
| Quality gate command hangs indefinitely | Low | High | Add 60-second timeout to `execAsync()`, kill process on timeout, report as "timeout" status |
| Large number of sibling projects causes slow discovery | Low | Low | Limit sibling scan to 50 directories; show loading indicator during scan |

## Edge Cases

- **No `.prism/` directory**: Monitor shows execution history as empty, gates as empty. Workspaces still shows worktrees (git-based, doesn't need `.prism/`).
- **No `stories.json`**: Monitor shows "No stories found" empty state. Gates section hidden.
- **No `plan.qualityGates`**: Gates section shows "No quality gates configured" with guidance.
- **Git not installed**: Worktree section shows error message. Projects section still works (filesystem-based).
- **Windows paths**: Use `path.resolve()` and `path.normalize()` everywhere. `os.homedir()` for `~`. Forward slashes in git output handled by Node's `path` module.
- **Multiple workspace folders**: Use `vscode.workspace.workspaceFolders[0]` as primary root (same as existing extension).
- **Concurrent gate execution**: Multiple gates can run simultaneously. Each gate tracks its own status independently. "Run All" fires all at once, results arrive in any order.
