---
date: 2026-02-27T00:00:00Z
researcher: Claude Opus 4.6
repository: prism-plugin
branch: main
topic: "VSCode Extension — Monitor and Workspaces Sections"
tags: [research, vscode, extension, monitor, workspaces, tree-view, sections]
status: complete
last_updated: 2026-02-27
last_updated_by: Claude
---

# VSCode Extension: Monitor and Workspaces Sections — Research

## Research Question

What does the Monitor and Workspaces TUI screens in prism-cli do, and how should equivalent sections be added to the VSCode extension following the established Research/Plans/Stories tree-view pattern?

---

## Summary

The prism-cli Monitor screen is a three-panel real-time dashboard showing system/agent health, Spectrum execution history, and quality gate statuses. The Workspaces screen is a two-pane browser for multi-project discovery, git worktree management, and agent Kanban board. Both should become native VSCode tree-view sections in the prism sidebar, following the exact pattern used by the existing Research, Plans, and Stories sections. Monitor maps to a collapsible tree with three groups (Health, History, Gates). Workspaces maps to a collapsible tree with two groups (Projects, Worktrees).

---

## Files Discovered

### prism-cli TUI Screens

| File | Description |
|------|-------------|
| `cmd/prism-cli/app/plugin_monitor.go` | Monitor plugin — 3-panel health/history/gates dashboard |
| `cmd/prism-cli/app/plugin_workspaces.go` | Workspaces plugin — 2-pane projects/worktrees/kanban browser |
| `cmd/prism-cli/app/views.go` | ActiveView enum, ViewModeProjects/Worktrees/Kanban constants |
| `cmd/prism-cli/plugin/events.go` | Event types: StoryCompletedEvent, AgentStatusEvent, QualityGateResultEvent |
| `cmd/prism-cli/plugin/context.go` | Plugin context: ProjectDir, EventBus, Epoch |
| `cmd/prism-cli/domain/story.go` | LoadStoriesFile() — parses stories.json |
| `cmd/prism-cli/registry/registry.go` | LoadAll() — reads ~/.prism/workspaces.json global project registry |

### VSCode Extension Pattern Files

| File | Description |
|------|-------------|
| `cmd/prism-vscode/src/extension.ts` | Extension activation, tree provider registration, command wiring |
| `cmd/prism-vscode/src/providers/research-tree.ts` | ResearchTreeDataProvider — filesystem-based tree (model for Monitor) |
| `cmd/prism-vscode/src/providers/plans-tree.ts` | PlansTreeDataProvider — filesystem-based tree with status icons |
| `cmd/prism-vscode/src/providers/stories-tree.ts` | StoriesTreeDataProvider — in-memory tree with children (model for Workspaces) |
| `cmd/prism-vscode/package.json` | contributes.views, contributes.commands, contributes.menus |
| `cmd/prism-vscode/src/prism/config.ts` | getPrismConfig() — resolves .prism/ subdirectory paths |
| `cmd/prism-vscode/src/shared/PrismState.ts` | PrismState interface |
| `cmd/prism-vscode/src/shared/PrismMessage.ts` | Message types for extension-webview communication |

### Existing Research

| Document | Relevance |
|----------|-----------|
| `.prism/shared/research/2026-02-17-sidecar-port-screen-audit.md` | Per-screen analysis of Monitor (Prism-specific, not a port target) and Workspaces (two-pane target) |
| `.prism/shared/research/2026-02-26-prism-vscode-extension-architecture.md` | Original mapping: Monitor → StatusBar+OutputChannel+webview; Workspaces → TreeDataProvider |

---

## Component Analysis

### A. Monitor Screen (plugin_monitor.go)

#### State Model
```
MonitorState {
  // System Health panel
  Goroutines int, MemAllocMB float64, MemTotalMB float64, GCCount uint32
  ActiveAgents []AgentInfo { WorktreePath, AgentType, Status }

  // Execution History panel
  History []ExecutionRecord { StoryID, StoryName, Duration, Result, Timestamp }
  SelectedRow int

  // Quality Gates panel
  QualityGates []QualityGate { Name, Command, Status, LastRun, Output, Category }
  GatesSelected int

  FocusedPanel MonitorPanel  // PanelHealth | PanelHistory | PanelGates
  LastRefresh time.Time
  RefreshTicker *time.Ticker  // 5-second auto-refresh
}
```

#### Three UI Panels
1. **System Health**: Go runtime metrics (goroutines, memory, GC), agent status indicators (active/thinking/waiting/paused)
2. **Execution History**: Last 50 Spectrum story executions with result icons (✓/✗/⊘), duration, timestamp
3. **Quality Gates**: Pre-configured gates (Lint=`golangci-lint run`, Tests=`go test ./...`, Build=`go build ./...`) + browser verification gates. Each shows status (pass/fail/pending/running/unknown), last run time, command.

#### Real-Time Data Sources
- **5-second auto-refresh ticker**: updates Go runtime health stats
- **EventBus `story.completed`**: appends to execution history
- **EventBus `agent.status`**: updates active agents list and kanban
- **EventBus `browser.verification`**: adds/updates browser quality gates
- **Async gate execution**: `runGateCmd()` via `exec.Command`, captures stdout+stderr, returns GateResultMsg

#### Key Keyboard Interactions
- `Tab/Shift+Tab`: cycle panel focus
- `j/k`: navigate history rows or gate rows
- `Enter` (Gates): run selected gate
- `Enter` (History): open execution detail modal
- `R`: run all gates concurrently
- `r`: manual refresh
- `o`: view gate output in modal

#### Public API (for cross-plugin access)
- `AddExecutionRecord(record ExecutionRecord)`: injects from outside (used by spectrum runner)
- `UpdateQualityGate(name, status, output string)`: updates gate from outside

---

### B. Workspaces Screen (plugin_workspaces.go)

#### State Model
```
WorkspacesState {
  ViewMode: Projects | Worktrees | Kanban

  // Projects view
  Projects []ProjectInfo { Name, Path, Branch, StoriesTotal, StoriesComplete, Epics []EpicInfo }
  SelectedProject int
  EpicsView bool, SelectedEpic int

  // Worktrees view
  Worktrees []WorktreeInfo { Path, Branch, HEAD, IsBare, IsMain, Prunable }
  SelectedWorktree int

  // Kanban
  agentStatuses map[string]KanbanCardInfo { AgentType, Status }
  kanbanCol int, kanbanRow int

  // Two-pane layout
  activePane: PaneLeft | PaneRight
  previewTab int  // 0=Info, 1=Stories, 2=Progress
}
```

#### Three View Modes
1. **Projects**: Discovers `.prism/` directories from sibling dirs (parent scan) + `~/.prism/workspaces.json` global registry. Shows name, branch, story progress bar (X/Y). Preview tabs: Info (path/branch/counts), Stories (per-story status list from stories.json), Progress (progress bars per epic).
2. **Worktrees**: `git worktree list --porcelain` parsing. Shows branch, HEAD hash, type (main/linked/bare). Preview: path, HEAD, delete action.
3. **Kanban**: Groups worktrees into columns by agent status (Active/Thinking/Waiting/Done/Paused). Uses EventBus `agent.status` events.

#### Data Discovery
- **Projects**: `os.ReadDir(parent)` + `os.Stat(.prism/)` check + `registry.LoadAll()` merge + sort alphabetically
- **Per-project**: `git rev-parse --abbrev-ref HEAD` + `domain.LoadStoriesFile()` for each epic's stories.json
- **Worktrees**: `git -C <gitRoot> worktree list --porcelain` → custom parser

#### CRUD Operations
- **Create worktree**: `git worktree add -b <branch> <path>` → publishes WorktreeChangedEvent
- **Delete worktree**: `git worktree remove <path>` + optional `git branch -D` → publishes WorktreeChangedEvent
- **Switch project**: broadcasts FocusPluginMsg with new project dir

#### Key Keyboard Interactions
- `w`: cycle Projects→Worktrees
- `v`: toggle Kanban
- `Tab`: switch pane focus (left list ↔ right preview)
- `j/k`: navigate list
- `Enter`: select/switch project/worktree
- `n`: create new worktree modal
- `d`: delete worktree (confirmation modal)
- `r`: rescan
- `[/]` in preview: switch tabs

---

### C. VSCode Extension Pattern (Existing)

#### Registration Pattern (5 coordinated changes)
```
1. package.json contributes.views → add view entry with id + name + when
2. package.json contributes.commands → add refresh + action commands
3. package.json contributes.menus → view/title refresh + view/item/context actions
4. src/providers/<name>-tree.ts → TreeDataProvider<ItemType> + Disposable
5. src/extension.ts → instantiate → push subscriptions → registerTreeDataProvider → connect events
```

#### TreeDataProvider Template
```typescript
class XxxTreeDataProvider implements vscode.TreeDataProvider<XxxItem>, vscode.Disposable {
  private _onDidChangeTreeData = new vscode.EventEmitter<XxxItem | undefined>()
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event

  refresh() { this._onDidChangeTreeData.fire() }
  setData(data: T) { this._data = data; this.refresh() }

  getTreeItem(element: XxxItem) { return element }
  async getChildren(element?: XxxItem): Promise<XxxItem[]> { /* ... */ }
  dispose() { this._onDidChangeTreeData.dispose() }
}
```

#### Two Data Source Patterns
1. **Filesystem-based** (Research, Plans): Store `_prismDir`, read files in `getChildren()`, sort by date desc
2. **In-memory** (Stories): Store parsed `Story[]` array, `setData()` called by controller

#### Context Key System (when clauses)
- `prism.hasPrismDir` — set by controller when `.prism/` is found
- `prism.hasStoriesJson` — set by controller when stories.json found
- New sections can use same keys or new ones (`prism.hasWorktrees`, etc.)

#### Existing Sections Summary
| Section ID | Provider File | Data Source | Items |
|-----------|--------------|-------------|-------|
| `prism.research` | research-tree.ts | filesystem `.prism/shared/research/` | Flat `.md` files with date/topic |
| `prism.plans` | plans-tree.ts | filesystem `.prism/shared/plans/` | Flat `.md` files with status icons |
| `prism.stories` | stories-tree.ts | in-memory `Story[]` | Hierarchical stories + steps |

---

## Design Decisions for New Sections

### MONITOR Section Design

**Section ID**: `prism.monitor`

**Tree structure** (3 group nodes, each collapsible):
```
MONITOR
├── System Health
│   ├── [●] 2 Agents Active
│   │   ├── claude • feat/dark-mode [active]
│   │   └── claude • fix/navbar [thinking]
│   └── Last refresh: 14:32:01
├── Execution History   (last 10 entries)
│   ├── [✓] STORY-006: Build general settings panel  2m 34s
│   ├── [✓] STORY-005: Build appearance panel  1m 12s
│   └── [✗] STORY-003: Implement CSS theme system  0m 45s
└── Quality Gates
    ├── [✓] Lint  (golangci-lint run)
    ├── [✓] Tests  (go test ./...)
    ├── [?] Build  (go build ./...)  Never run
    └── [⟳] Browser Screenshot  Running...
```

**Data sources**:
- Execution history: parse from stories.json `status=complete` + `.prism/shared/spectrum/progress.md`
- Quality gates: from stories.json `plan.qualityGates` array (e.g., `["npm test", "npm run build"]`)
- Agent statuses: from `.prism/local/agents.json` (or similar — needs to be designed/invented for VSCode since it doesn't have Go EventBus)
- System health: simplified (no Go runtime stats in VSCode) — show active Claude terminals, workspace counts

**Commands**:
- `prism.monitor.refresh` — re-read history and gates
- `prism.monitor.runGate` — execute selected gate in terminal
- `prism.monitor.runAllGates` — run all gates in parallel terminals
- `prism.monitor.openHistory` — open related story/artifact
- `prism.monitor.clearHistory` — clear displayed history

**Implementation approach**: Hybrid filesystem + in-memory. History items come from `domain.LoadStoriesFile()` equivalent (TS version). Quality gates come from `stories.json` `plan.qualityGates`. Agent statuses polled from controller state.

---

### WORKSPACES Section Design

**Section ID**: `prism.workspaces`

**Tree structure** (2 group nodes, each collapsible):
```
WORKSPACES
├── Projects  (discovered sibling .prism/ dirs)
│   ├── prism-plugin  [main • 8/8 stories ████████ 100%]
│   │   ├── Epic: electron-ready  8/8 ✓
│   │   └── Epic: pixel-agents  4/6 ▸
│   ├── my-other-project  [feat/api • 2/5 stories ████░░░ 40%]
│   └── + Add workspace...
└── Worktrees  (git worktree list)
    ├── [●] main • abc1234  (main)
    ├── [▸] feat/dark-mode • def5678
    ├── [○] fix/navbar-bug • ghi9012
    └── + New worktree...
```

**Data sources**:
- Projects: sibling directory scan + `~/.prism/workspaces.json` global registry (same as CLI)
- Worktrees: `git worktree list --porcelain` executed via Node child_process
- Story counts: parse `stories.json` per-project/epic

**Commands**:
- `prism.workspaces.refresh` — rescan projects and worktrees
- `prism.workspaces.openProject` — `vscode.openFolder()` to switch to selected project
- `prism.workspaces.addWorkspace` — register a workspace in `~/.prism/workspaces.json`
- `prism.workspaces.newWorktree` — prompt for branch name → `git worktree add -b <branch> <path>`
- `prism.workspaces.deleteWorktree` — confirmation → `git worktree remove <path>`
- `prism.workspaces.openWorktree` — `vscode.openFolder()` to worktree path

**Implementation approach**: Primarily filesystem + shell-command based. No in-memory dependency on controller. Uses `child_process.exec` for git commands. File watcher on parent directory for project changes.

---

## Patterns Found

### Icon Strategy for Status Items
```typescript
// From plans-tree.ts:40-51 pattern
_iconForStatus(status: string): vscode.ThemeIcon {
  switch (status) {
    case "pass":    return new vscode.ThemeIcon("pass-filled", new vscode.ThemeColor("testing.iconPassed"))
    case "fail":    return new vscode.ThemeIcon("testing-error-icon", new vscode.ThemeColor("testing.iconFailed"))
    case "running": return new vscode.ThemeIcon("sync~spin", new vscode.ThemeColor("notificationsInfoIcon.foreground"))
    case "pending": return new vscode.ThemeIcon("clock", new vscode.ThemeColor("list.deemphasizedForeground"))
    default:        return new vscode.ThemeIcon("question")
  }
}
```

### Hierarchical Items with Children
```typescript
// From stories-tree.ts pattern — for group nodes
class GroupItem extends vscode.TreeItem {
  constructor(label: string, public children: vscode.TreeItem[]) {
    super(label, children.length > 0
      ? vscode.TreeItemCollapsibleState.Expanded
      : vscode.TreeItemCollapsibleState.Collapsed)
    this.contextValue = "group"
  }
}
```

### Shell Commands in VSCode (equivalent to CLI's exec.Command)
```typescript
import { exec } from 'child_process'
import { promisify } from 'util'
const execAsync = promisify(exec)

async function getWorktrees(projectDir: string): Promise<WorktreeInfo[]> {
  const { stdout } = await execAsync('git worktree list --porcelain', { cwd: projectDir })
  return parseWorktreeListPorcelain(stdout)
}
```

### Progress Bar via Description Field
```typescript
// Use TreeItem.description for inline progress
this.description = `${complete}/${total} stories`
// Or use tooltip for detailed progress bar
this.tooltip = `[${'█'.repeat(filled)}${'░'.repeat(empty)}] ${pct}%`
```

---

## Open Questions

1. **Agent health data source**: In CLI, agent statuses come from EventBus `agent.status` events published by the office webview. In VSCode, the OfficeViewProvider could publish to a shared in-memory EventEmitter in extension.ts — the MonitorTreeProvider would subscribe to it.

2. **Quality gate config location**: CLI hardcodes 3 gates. VSCode should read from `stories.json` `plan.qualityGates` array. If absent, show a "No quality gates configured" placeholder.

3. **Gate execution in VSCode**: CLI uses `exec.Command` to run gates directly. VSCode should use `vscode.window.createTerminal()` to run gates visibly (better UX than hidden exec), or use `child_process.exec` with output captured to a vscode.OutputChannel.

4. **Workspace global registry**: `~/.prism/workspaces.json` must be readable from VSCode extension. Need to confirm Node.js path resolution for `~` on Windows.

5. **Auto-refresh strategy**: CLI uses a Go ticker. VSCode should use `setInterval` or `vscode.workspace.createFileSystemWatcher` for file-based updates (not polling).

6. **Section ordering**: Current order is PRISM → RESEARCH → PLANS → STORIES → OFFICE. Where should MONITOR and WORKSPACES go? Logical: PRISM → RESEARCH → PLANS → STORIES → MONITOR → WORKSPACES → OFFICE.

7. **When-clause for new sections**: Should Monitor and Workspaces sections be gated on `prism.hasPrismDir` or always visible? Workspaces probably always visible (helpful even without .prism/). Monitor probably gated on `prism.hasStoriesJson`.
