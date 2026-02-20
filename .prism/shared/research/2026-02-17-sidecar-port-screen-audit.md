# Sidecar Port Screen Audit

**Date**: 2026-02-17
**Question**: What is the current state of each Prism CLI plugin screen vs the Sidecar reference implementation?

## Summary

The Prism CLI has 5 plugin screens (Git, Files, Agent, Workspaces, Monitor) that were scaffolded during the Sidecar/Crush integration. All screens are significantly simplified compared to the full Sidecar source at `ref/sidecar/internal/plugins/`. The Git screen is the most visually incomplete (single-column file list, no persistent diff pane). The Sidecar reference code provides complete two-pane layouts with draggable dividers, gradient-bordered panels, scrollbars, and rich content rendering for all plugins.

## Reference: SIDECAR.md Target Designs

SIDECAR.md (root of repo) describes the target design for each plugin screen. Key excerpts:

### Git Status Target (SIDECAR.md Section 2.2)
```
╔═══════════════════════════════╦══════════════════════════════════╗
║ Files                         ║ Diff: src/App.tsx                ║
║                               ║ ────────────────────────────────  ║
║ Staged (2)                    ║                                   ║
║ ● src/App.tsx        +12 -3   ║  1 import React from 'react'      ║
║   src/theme.ts       +45 -12  ║  2 import { Theme } from './theme'║
║                               ║  3                                 ║
║ Modified (1)                  ║  4 function App() {               ║
║ ● src/utils.ts       +8  -2   ║  5 -  const theme = lightTheme    ║
║                               ║  6 +  const [theme, setTheme] =   ║
║ Untracked (1)                 ║                                   ║
║   tests/app.test.tsx          ║                                   ║
║ ───────────────────────────── ║                                   ║
║ Recent Commits                ║                                   ║
║ a1b2c3d Add dark mode         ║                                   ║
╠═══════════════════════════════╩══════════════════════════════════╣
║ s stage · u unstage · c commit · enter diff · P push · b branch ║
╚═════════════════════════════════════════════════════════════════╝
```
- **Layout**: 30/70 split - sidebar (files + commits) / diff pane
- **Diff modes**: Unified or side-by-side with syntax highlighting
- **Features**: Stage/unstage, commit, push, pull, branch picker, stash, commit graph

### File Browser Target (SIDECAR.md Section 2.5)
```
╔═══════════════════════════════╦══════════════════════════════════╗
║ Files                         ║ Preview: src/App.tsx [typescript] ║
║ ▼ src/                        ║   1 import React...               ║
║   ▼ components/               ║   2 import { Theme }...           ║
║     ● Navbar.tsx       M      ║   3                               ║
║       Button.tsx              ║   4 function App() {              ║
║   ● App.tsx            M      ║   5   const [theme...             ║
╠═══════════════════════════════╩══════════════════════════════════╣
║ enter open · ctrl+p find · ctrl+s search · e edit · b blame      ║
╚═════════════════════════════════════════════════════════════════╝
```
- **Layout**: 30/70 split - tree pane / preview pane
- **Tree**: Collapsible directories, git status icons (M/A/D/?)
- **Preview**: Syntax highlighting, line numbers, tabs, markdown render, image preview
- **Search**: Filename search, content search, quick open (ctrl+p), project search (ctrl+s)

### Conversations Target (SIDECAR.md Section 2.4)
```
╔═══════════════════════════════╦══════════════════════════════════╗
║ Sessions                      ║ Conversation                      ║
║ ● Today (3)                   ║ You:                              ║
║   Dark Mode Feature           ║ Add a dark mode toggle to the nav ║
║   Claude Code • 2h ago        ║                                   ║
║   45K tokens • $0.12          ║ Assistant:                        ║
║                               ║ I'll add a dark mode toggle...    ║
║   Fix navbar bug              ║ [Tool] Grep "theme" src/**/*.ts   ║
║   Cursor • 5h ago             ║                                   ║
╠═══════════════════════════════╩══════════════════════════════════╣
║ enter view · / search · e export · i resume · tab sidebar        ║
╚═════════════════════════════════════════════════════════════════╝
```
- **Layout**: 30/70 split - session sidebar / message content
- **Sidebar**: Sessions grouped by date, search, filters, adapter icons
- **Main**: Turn-based or conversation flow view, markdown rendering, tool use

### Workspaces Target (SIDECAR.md Section 2.6)
```
╔═══════════════════════════════╦══════════════════════════════════╗
║ Workspaces                    ║ Preview: feat/dark-mode           ║
║ ● feat/dark-mode       ⚡     ║ [Output] [Diff] [Task]           ║
║   Agent: Claude Code          ║ $ npx claude                     ║
║   Status: Thinking            ║ I'll implement the dark mode...  ║
║                               ║                                   ║
║   fix/navbar-bug       ⏸️     ║ [Reading src/theme.ts...]        ║
║   Agent: None                 ║                                   ║
╠═══════════════════════════════╩══════════════════════════════════╣
║ enter agent · n new · i interactive · m merge · d delete · v kanban
╚═════════════════════════════════════════════════════════════════╝
```
- **Layout**: 40/60 split - worktree list / preview with tabs
- **List**: Status icons, agent info, stats, shells section
- **Preview**: Output/Diff/Task tabs
- **Views**: List, Kanban board

## Files Discovered

### Prism CLI (current implementation)
| File | Description |
|------|-------------|
| `cmd/prism-cli/app/plugin_git.go` | Git plugin - single column file list |
| `cmd/prism-cli/app/plugin_files.go` | Files plugin - basic tree + preview |
| `cmd/prism-cli/app/plugin_agent.go` | Agent plugin - sidebar + chat |
| `cmd/prism-cli/app/plugin_workspaces.go` | Workspaces plugin - single column |
| `cmd/prism-cli/app/plugin_monitor.go` | Monitor plugin - three horizontal panels |
| `cmd/prism-cli/app/view.go` | Main View() router |
| `cmd/prism-cli/app/sidebar.go` | Right sidebar (SidebarWidth=38) |
| `cmd/prism-cli/app/shell.go` | renderBreadcrumb() helper |

### Sidecar Reference (target implementation)
| Directory | File Count | Key Files |
|-----------|-----------|-----------|
| `ref/sidecar/internal/plugins/gitstatus/` | ~25 files | view.go, sidebar_view.go, diff_renderer.go, diff_parser.go, syntax_highlight.go |
| `ref/sidecar/internal/plugins/filebrowser/` | ~20 files | view.go, tree.go, preview.go, tabs.go, blame.go, fuzzy.go |
| `ref/sidecar/internal/plugins/workspace/` | ~30 files | view_list.go, view_kanban.go, view_preview.go, agent.go |
| `ref/sidecar/internal/plugins/conversations/` | ~15 files | plugin.go, view_layout.go, view_content.go, content_search.go |

## Per-Screen Analysis

### 1. Git Plugin (`cmd/prism-cli/app/plugin_git.go`)

**Current State**:
- `View()` at line 165: Three mutually exclusive paths (error -> diff viewer -> file list)
- File list: Single column with `renderFileList()` sections (Staged/Modified/Untracked)
- Diff view: Full-screen replacement via `viewport.Model` when `ViewingDiff == true`
- No persistent two-pane layout
- No scrollbar, no file tree grouping, no commit history
- State: `GitState{BranchName, Ahead, Behind, StagedFiles, ModifiedFiles, UntrackedFiles, SelectedIdx, CurrentSection, ViewingDiff, DiffViewport, Error}`

**Sidecar Reference** (`gitstatus/sidebar_view.go:52-112`, `gitstatus/view.go:116-161`):
- `renderThreePaneView()`: Two-pane layout (sidebar 30% + diff 70%) using `lipgloss.JoinHorizontal`
- `calculatePaneWidths()`: 30/70 split, min 25 sidebar, min 40 diff, draggable divider
- `renderSidebar()`: File sections + recent commits + push status + scrollbar
- `renderDiffPane()`: Unified/side-by-side diff with syntax highlighting, word-level diff, horizontal scroll
- `renderDiffTwoPane()`: Full-diff view with sidebar still visible
- Uses `styles.RenderPanel()` for gradient-bordered panels
- Focus tracking between `PaneSidebar` and `PaneDiff`
- Commit preview in right pane when cursor on commit
- `diff_renderer.go`: `RenderLineDiff()`, `RenderSideBySide()`, `groupLinesForSideBySide()`, `renderDiffContent()` with word-level highlighting
- `diff_parser.go`: `ParseUnifiedDiff()` -> `ParsedDiff{Hunks[]Hunk{Lines[]DiffLine}}`

**Gap**: Current has NO two-pane layout. Diff replaces entire view. No commits, no scrollbar, no syntax highlighting.

### 2. Files Plugin (`cmd/prism-cli/app/plugin_files.go`)

**Current State**:
- `View()` at line 138: Two-pane layout exists (tree left + preview right)
- Tree: Uses emoji icons, basic file traversal
- Preview: Shows raw file content with word wrap
- Split: 50/50 using manual `[]string` zip pattern
- No tabs, no search, no line numbers, no syntax highlighting

**Sidecar Reference** (`filebrowser/view.go:58-275`):
- `renderNormalPanes()`: Two-pane (30/70) with `styles.RenderPanel()` + divider
- `renderTreePane()`: File tree with search mode, gitignore filter, sort modes, scrollbar
- `renderPreviewPane()`: Tabs, line numbers, syntax highlighting, image preview, markdown rendering, text selection
- Content search, quick open modal, blame view, inline editor
- Focus tracking between `PaneTree` and `PanePreview`
- `calculatePaneWidths()`: 30/70 default, draggable divider

**Gap**: Current has basic two-pane but 50/50 split, no bordered panels, no line numbers, no syntax highlighting, no search.

### 3. Agent Plugin (`cmd/prism-cli/app/plugin_agent.go`)

**Current State**:
- `View()` at line 138: Two-pane exists (sidebar + chat) via `renderWideMode()`
- Sidebar: Conversation list (hardcoded "Current Session")
- Chat: Message viewport + textarea input
- Messages: Placeholder responses only ("I'm a placeholder response...")
- Toggle: `ctrl+b` switches wide/compact mode
- Split: 33/67

**Sidecar Reference** (`conversations/view_layout.go:14-132`):
- `renderTwoPane()`: Session list sidebar + message content pane
- `renderSidebarPane()`: Session list with search, filters, group headers by date, adapter icons, scrollbar, loading skeleton
- `renderMainPane()`: Stats header (model badge, tokens, cost), resume command, turn-based/conversation-flow views
- `renderConversationFlow()`: Message bubbles, tool use rendering, thinking blocks, role separators
- `renderCompactTurn()`: Metadata-focused view with token/tool counts
- Detail mode for expanding individual turns

**Gap**: Current has basic two-pane skeleton but all content is placeholder. No real conversation loading, no adapter integration.

### 4. Workspaces Plugin (`cmd/prism-cli/app/plugin_workspaces.go`)

**Current State**:
- `View()` at line 104: Three mutually exclusive paths (loading -> epics -> projects)
- Single column lists for both epics and projects
- `renderProjectsView()` and `renderEpicsView()` return single pre-rendered strings
- No detail/preview pane, no split layout

**Sidecar Reference** (`workspace/view_list.go:91-209`):
- `renderListView()`: Two-pane (sidebar + preview) with `lipgloss.JoinHorizontal`
- `renderSidebarContent()`: Worktree list with shells, status icons, stats, scrollbar, [New] button
- `renderPreviewContent()`: Output/Diff/Task tabs
- Multiple view modes: Kanban, Create, Merge, Agent Choice, etc.
- `renderWorktreeItem()`: Two-line items with status, name, time, agent, stats
- Flash animations on preview changes

**Gap**: Current has NO two-pane layout. Single column only. No detail pane. No worktree/shell concepts.

### 5. Monitor Plugin (`cmd/prism-cli/app/plugin_monitor.go`)

**Current State**:
- `View()` at line 152: Three-panel horizontal layout using `lipgloss.JoinHorizontal`
- Panels: System Health, Execution History, Quality Gates
- Each panel uses `lipgloss.RoundedBorder()` with width/height
- Auto-refresh every 5 seconds

**Sidecar Reference**: No direct analog (Sidecar has `tdmonitor` which wraps external `td monitor` TUI)

**Gap**: Monitor is Prism-specific and its three-panel layout is reasonable. Not a port target.

## Common Sidecar Layout Patterns

All Sidecar plugins share these patterns (from reading source):

1. **`calculatePaneWidths()`**: 30/70 default split, clamped min/max, draggable via divider hit region
   - Default: `sidebarWidth = available * 30 / 100`
   - Min sidebar: 25, Max sidebar: `available - 40`
   - Diff/preview pane: `available - sidebarWidth`

2. **`styles.RenderPanel(content, width, height, active)`**: Gradient-bordered panels that change color on focus

3. **`ui.RenderDivider(height)`**: 1-char-wide vertical divider between panes

4. **`lipgloss.JoinHorizontal(lipgloss.Top, left, divider, right)`**: Standard pane join

5. **`ui.RenderScrollbar()`**: Scrollbar alongside content via `lipgloss.JoinHorizontal`

6. **Focus tracking**: `activePane` field, `PaneSidebar`/`PanePreview`/`PaneDiff` enum, `tab` to switch

7. **Panel overhead**: `const panelBorderWidth = 2; panelPaddingWidth = 2; panelOverhead = 4`

8. **Inner height**: `paneHeight = height; innerHeight = paneHeight - 2` (borders)

## Prism Plugin Interface

All Prism plugins implement:
```go
type Plugin interface {
    ID() string
    Name() string
    Icon() string
    Init(ctx *plugin.Context) error
    Start() tea.Cmd
    Stop()
    Update(msg tea.Msg) (Plugin, tea.Cmd)
    View(width, height int) string
    IsFocused() bool
    SetFocused(focused bool)
    KeyHints() []plugin.KeyHint
}
```

## Priority Order for Port

1. **Git** (highest gap - single column vs two-pane with diff)
2. **Workspaces** (high gap - single column vs two-pane with detail)
3. **Files** (medium gap - has two-pane but missing key features)
4. **Agent** (medium gap - has two-pane skeleton, needs real content rendering)
5. **Monitor** (no port needed - Prism-specific)

## Open Questions

- Should Prism port the Sidecar mouse/hit-region system or keep keyboard-only for now?
- Should the diff renderer (diff_parser.go, diff_renderer.go, syntax_highlight.go) be ported as a standalone package or inlined?
- How much of the workspace/agent backend (worktrees, tmux sessions, adapters) applies to Prism vs being Sidecar-specific?
