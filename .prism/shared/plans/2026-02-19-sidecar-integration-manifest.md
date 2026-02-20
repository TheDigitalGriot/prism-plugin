# Sidecar → Prism CLI Integration Manifest

> **Date**: 2026-02-19
> **Scope**: Full integration of Sidecar functionality into 5 Prism CLI plugins
> **Source**: `ref/sidecar/` (Go, Bubble Tea, ~100+ files)
> **Target**: `cmd/prism-cli/` (Go, Bubble Tea, ~67 files, ~19,900 LOC)

---

## Table of Contents

1. [Concept Mapping](#1-concept-mapping)
2. [Gap Analysis](#2-gap-analysis)
3. [Decomposition Plan](#3-decomposition-plan)
4. [Dependency Order](#4-dependency-order)
5. [Shared Infrastructure](#5-shared-infrastructure)

---

## 1. Concept Mapping

### Legend

| Tag | Meaning |
|-----|---------|
| **SAME** | Prism already has this feature with equivalent capability |
| **EXTEND** | Prism has the feature but it needs enhancement |
| **ADAPT** | Sidecar has the feature; needs adaptation to Prism's architecture |
| **BUILD** | Feature doesn't exist in either — must be built from scratch |
| **SKIP** | Feature is Sidecar-specific and not relevant to Prism |

---

### 1.1 FILES Plugin

| Sidecar Feature | Prism Equivalent | Tag | Notes |
|----------------|-----------------|-----|-------|
| Two-pane tree + preview | `plugin_files.go` two-pane (30/70) | **SAME** | Uses `ui.CalculatePaneWidths()` already |
| Collapsible directory tree | `FileNode` with `Expanded` bool | **SAME** | Depth-first flat list, expand/collapse works |
| File preview with line numbers | `renderPreview()` with line numbers | **SAME** | Already implemented |
| Syntax highlighting (Chroma) | `diff/highlight.go` exists for diffs | **EXTEND** | Chroma is a dependency; need to add preview highlighting |
| Git status indicators (M/A/D/?) | Not present | **BUILD** | Need to call `git status --porcelain` and annotate tree nodes |
| Multi-tab file support | Not present | **BUILD** | Sidecar `tabs.go` has TabManager; need to build tab bar + multi-file state |
| Fuzzy file search (ctrl+p) | `/` filter mode (simple substring) | **EXTEND** | Need fuzzy scoring algorithm + full-project file cache (50K files) |
| Content search (ripgrep) | Not present | **BUILD** | Sidecar `project_search.go` runs `rg`; need search input + results list |
| Edit mode (textarea) | Not present | **BUILD** | Sidecar has Bubbles textarea; Prism has `modal/input.go` TextareaSection |
| Blame view | Not present | **BUILD** | Sidecar `blame.go` runs `git blame`; need blame pane rendering |
| Markdown rendering toggle | Not present | **BUILD** | Sidecar uses Glamour; can add as optional dependency |
| Gitignore respect | Hardcoded exclusions (`.git`, `node_modules`) | **EXTEND** | Parse `.gitignore` files for proper filtering |
| File watcher (fsnotify) | Not present | **BUILD** | Shared infra — multiple plugins need this |
| Mouse support (click to select) | `bubblezone` click on tree items | **SAME** | Already uses zone.Mark |
| Scrollbar on tree/preview | `ui/scrollbar.go` exists | **SAME** | Already available |
| Draggable pane width | Not present | **BUILD** | Sidecar persists sidebar width; need mouse drag handler |
| Image preview (Sixel/Kitty) | Not present | **SKIP** | Low priority, terminal-specific |
| Inline tmux editor | Not present | **SKIP** | Prism doesn't use tmux |
| File operations (rename/delete/create) | Not present | **ADAPT** | Sidecar `operations.go`; add with confirmation dialogs |

---

### 1.2 GIT Plugin

| Sidecar Feature | Prism Equivalent | Tag | Notes |
|----------------|-----------------|-----|-------|
| Two-pane sidebar + diff | `plugin_git.go` two-pane (30/70) | **SAME** | Already implemented |
| Branch info (ahead/behind) | `GitState.BranchName/Ahead/Behind` | **SAME** | Already shows in sidebar |
| Staged/Modified/Untracked sections | Three section lists in sidebar | **SAME** | Already renders all three |
| Syntax-highlighted diffs | `diff/` package with Chroma | **SAME** | Full unified + side-by-side with word-level diffs |
| Unified + side-by-side toggle | `diffViewMode` with `v` key | **SAME** | Already implemented |
| Stage/unstage files | `toggleStageCmd()` runs `git add`/`git reset` | **SAME** | Works |
| Commit textarea modal | `openCommitModal()` with TextareaSection | **SAME** | Already builds modal |
| Recent commits list | `recentCommits []CommitInfo` | **SAME** | Shows last 20 via `git log` |
| Push modal/menu | Not present | **BUILD** | Sidecar `push.go` has menu for push/push-force/push-upstream |
| Pull modal/menu | Not present | **BUILD** | Sidecar `pull_menu.go` has fetch/pull/pull-rebase options |
| Branch picker with search | Not present | **BUILD** | Sidecar `branch_picker.go` — filterable branch list modal |
| Stash management | Not present | **BUILD** | Sidecar `stash_view.go` — stash list, apply, pop, drop |
| Conflict resolution UI | Not present | **BUILD** | Sidecar `pull_menu.go` shows conflict list |
| Auto-refresh on filesystem changes | Not present | **BUILD** | Shared infra — fsnotify watcher triggers `GitStatusLoadedMsg` |
| Draggable sidebar width | Not present | **BUILD** | Same shared infra as Files plugin |
| Git graph visualization | Not present | **ADAPT** | Sidecar `graph.go` renders ASCII git graph |
| Commit detail view (expand) | Not present | **BUILD** | Sidecar `commit_view.go` shows full commit diff |
| Discard changes confirmation | Not present | **BUILD** | Sidecar `confirm_discard.go` — danger modal |
| Stash pop confirmation | Not present | **BUILD** | Sidecar `confirm_stash_pop.go` |
| GitHub integration (PR) | Not present | **SKIP** | Low priority for MVP |
| Clipboard (copy hash/path) | Not present | **ADAPT** | Sidecar `clipboard.go` — nice to have |
| History search | Not present | **BUILD** | Sidecar `history_search.go` — search commits |
| Horizontal diff scrolling | Not present (word wrap only) | **EXTEND** | `diff/renderer.go` already has `horizontalOffset` param |
| Error modal | Not present | **BUILD** | Sidecar `error_modal.go` for git operation failures |

---

### 1.3 AGENT Plugin (Conversations)

| Sidecar Feature | Prism Equivalent | Tag | Notes |
|----------------|-----------------|-----|-------|
| Two-pane sidebar + chat | `plugin_agent.go` two-pane layout | **SAME** | Has sidebar + chat column |
| Session list grouped by date | Hardcoded 4-entry list | **BUILD** | Need adapter system to scan real session files |
| Multi-adapter support (10 agents) | Not present | **BUILD** | Core feature — scan Claude Code, Codex, Cursor, Gemini, etc. |
| Message rendering (user/assistant/tool) | `chat/renderer.go` with 3 types | **SAME** | Already renders user, assistant, tool messages |
| Content search with highlighting | Not present | **BUILD** | Sidecar `content_search.go` — full-text search within messages |
| Session search/filter | Not present | **BUILD** | Sidecar `search.go` — filter sessions by name |
| Token usage analytics | Not present | **BUILD** | Sidecar `analytics.go` — token counts, cost breakdown |
| Markdown rendering | Not present | **BUILD** | Sidecar `markdown.go` uses Glamour for message rendering |
| Export conversations | Not present | **BUILD** | Sidecar `export.go` — markdown export |
| Real-time updates (file watching) | Not present | **BUILD** | Watch conversation files for new messages |
| Resume modal (launch in agent) | Not present | **ADAPT** | Sidecar `resume_modal.go` |
| Turn-based view (coalesced) | Not present | **ADAPT** | Sidecar `turns.go` + `coalescer.go` |
| Summary generation | Not present | **ADAPT** | Sidecar `summary.go` — first-line extraction |
| Conversation sidebar navigation | Not wired (no j/k on sidebar) | **EXTEND** | Need keyboard nav for conversation list |
| Claude CLI live integration | Placeholder `sendMessage()` | **BUILD** | Connect to Claude CLI for live chat |
| Wide/Compact mode toggle | `WideMode` with `ctrl+b` | **SAME** | Already toggles |
| Tool collapse/expand | `ToolsCollapsed map[int]bool` | **SAME** | Already tracks collapsed state |

---

### 1.4 MONITOR Plugin

| Sidecar Feature | Prism Equivalent | Tag | Notes |
|----------------|-----------------|-----|-------|
| Three-panel dashboard | Three-panel layout (health/history/gates) | **SAME** | Already renders 3 panels |
| System health (goroutines/memory) | `runtime.MemStats` monitoring | **SAME** | Real metrics, 5s auto-refresh |
| Execution history table | `History []ExecutionRecord` | **SAME** | EventBus subscription works |
| Quality gate display | `QualityGates []QualityGate` | **SAME** | Renders pass/fail/pending/unknown |
| Quality gate execution | Not present (display-only) | **BUILD** | Need to actually run gate commands |
| Auto-refresh timer | 5s ticker loop | **SAME** | Already implemented |
| Gate keyboard navigation | `GatesSelected` field exists | **EXTEND** | Field exists but no j/k handler for gates panel |
| History row selection/detail | `SelectedRow` with highlight | **EXTEND** | Need to show detail view on enter |
| Multi-panel focus switching | Not present | **BUILD** | Need panel-level focus (health/history/gates) |
| Gate output display | `QualityGate.Output` field exists | **EXTEND** | Need expansion/modal to show output |
| Agent health monitoring | Not present | **BUILD** | Monitor running agents (from Workspaces) |
| Filesystem watcher stats | Not present | **BUILD** | Show watcher activity if fsnotify is added |

---

### 1.5 WORKSPACES Plugin

| Sidecar Feature | Prism Equivalent | Tag | Notes |
|----------------|-----------------|-----|-------|
| Two-pane list + preview | Two-pane (40/60) with 3 tabs | **SAME** | Already has Info/Stories/Progress tabs |
| Project scanning (sibling dirs) | `scanProjects()` scans parent dir | **SAME** | Scans for `.prism/` directories |
| Git worktree scanning | Not present | **BUILD** | Sidecar scans `git worktree list`; Prism scans sibling dirs |
| List view | Project list with progress | **SAME** | Already renders |
| Kanban board view | Not present | **BUILD** | Sidecar `ViewModeKanban` — columns by status |
| Agent launching per workspace | Not present | **BUILD** | Sidecar spawns agents in worktrees |
| Live agent output | Not present | **BUILD** | Sidecar `tmux capture-pane` streaming |
| Interactive tmux passthrough | Not present | **SKIP** | Requires tmux; not cross-platform |
| Merge workflow | Not present | **BUILD** | Sidecar multi-step merge with conflict detection |
| TD task linking | Not present | **ADAPT** | Link worktrees to `.prism/stories/` stories |
| Shell session management | Not present | **SKIP** | Requires tmux |
| Worktree creation modal | Not present | **BUILD** | Create new branch + worktree |
| Worktree deletion | Not present | **BUILD** | Remove worktree + optional branch delete |
| Agent choice modal (attach/restart) | Not present | **BUILD** | When worktree already has agent |
| Status icons (Active/Thinking/Done) | Not present | **BUILD** | Sidecar status detection system |
| Preview tabs (Output/Diff/Task) | Info/Stories/Progress tabs | **ADAPT** | Replace with Sidecar-style Output/Diff/Task |
| Epic navigation within project | `EpicsView` within project | **SAME** | Already supports epic drilling |
| Project/Epic switching | `switchToProject()`/`switchToEpic()` | **SAME** | Emits `SwitchProjectMsg` |

---

## 2. Gap Analysis

### 2.1 FILES Plugin

**Already has (reusable):**
- Two-pane layout with `ui.CalculatePaneWidths()` (30/70 split)
- `FileNode` tree data structure with expand/collapse
- Flat list navigation with scroll offset
- File content preview with line numbers
- Filter mode (simple substring match)
- Mouse click selection via `bubblezone`
- `ui/scrollbar.go` for both panes
- `ui/divider.go` for pane separator
- Demo mode with hardcoded content

**Missing (must build):**
1. Syntax highlighting for preview (Chroma integration — `diff/highlight.go` has Chroma already)
2. Git status indicators on tree nodes (call `git status --porcelain`, annotate `FileNode`)
3. Multi-tab system (TabManager, tab bar rendering, per-tab state)
4. Fuzzy file search (ctrl+p) with project-wide file cache and scoring
5. Content search via ripgrep subprocess with results list
6. Edit mode (Bubbles textarea in preview pane)
7. Blame view (`git blame` output parsed + rendered alongside code)
8. Markdown rendering toggle (Glamour integration)
9. `.gitignore` parsing (replace hardcoded exclusions)
10. File watcher (fsnotify) for auto-refresh

**Reusable Prism infrastructure:**
- `modal/` system for fuzzy search overlay (ctrl+p)
- `diff/highlight.go` Chroma dependency for syntax highlighting
- `styles/` color palette for all new UI elements
- `dialog/confirm.go` for file operation confirmations

---

### 2.2 GIT Plugin

**Already has (reusable):**
- Two-pane sidebar + diff layout
- Branch name, ahead/behind display
- Staged/Modified/Untracked file sections with cursor navigation
- `diff/` package: unified + side-by-side rendering with word-level diffs
- `diff/highlight.go`: Chroma syntax highlighting for diffs
- Stage/unstage via `git add`/`git reset HEAD`
- Commit modal with `TextareaSection`
- Recent commits list (20 via `git log --oneline`)
- `BranchChangedEvent` publishing via EventBus
- Diff view mode toggle (`v` key)

**Missing (must build):**
1. Push menu/modal (push, push --force, push -u origin)
2. Pull menu/modal (fetch, pull, pull --rebase)
3. Branch picker with search filter
4. Stash management (list, apply, pop, drop)
5. Conflict resolution UI
6. Filesystem watcher auto-refresh (shared infra)
7. Draggable sidebar width (mouse-based, persisted)
8. Commit detail view (expand commit → show full diff)
9. Discard changes confirmation (danger dialog)
10. Error modal for failed git operations
11. History search (search commits)
12. Horizontal diff scrolling (parameter exists, need key bindings)

**Reusable Prism infrastructure:**
- `modal/` for push/pull/branch picker/stash modals
- `modal/list.go` `ListSection` for branch picker, stash list
- `modal/input.go` `InputSection` for search within modals
- `dialog/confirm.go` for discard/stash-pop confirmations
- `diff/parser.go` for commit detail diff parsing

---

### 2.3 AGENT Plugin

**Already has (reusable):**
- Two-pane layout (sidebar + chat)
- Chat message rendering (`chat/renderer.go`) for user/assistant/tool types
- Scrollable message viewport (`viewport.Model`)
- Text input with `textinput.Model`
- Wide/Compact mode toggle
- Tool collapse/expand tracking

**Missing (must build):**
1. Adapter system (scan real conversation files from Claude Code, Codex, Cursor, etc.)
2. Session list with date grouping and metadata (tokens, cost, duration)
3. Session search/filter
4. Content search with match highlighting
5. Token analytics view
6. Markdown rendering for assistant messages (Glamour)
7. Export to markdown
8. Real-time file watching for new conversation data
9. Sidebar keyboard navigation (j/k to switch conversations)
10. Claude CLI live integration (replace placeholder `sendMessage()`)
11. Turn coalescing (merge adjacent same-role messages)

**Reusable Prism infrastructure:**
- `chat/renderer.go` for message rendering (extend, don't replace)
- `modal/` for export dialog, resume modal
- `styles/` color palette for adapter-specific styling

---

### 2.4 MONITOR Plugin

**Already has (reusable):**
- Three-panel layout (health/history/gates)
- Real `runtime.MemStats` monitoring with goroutine count
- Execution history via EventBus subscription (`story.completed`)
- Quality gate display with pass/fail/pending/unknown icons
- 5-second auto-refresh timer
- `AddExecutionRecord()` and `UpdateQualityGate()` public API

**Missing (must build):**
1. Quality gate execution (actually run commands, parse exit code)
2. Gate keyboard navigation (j/k within gates panel)
3. Multi-panel focus switching (tab between health/history/gates)
4. History detail view (expand record → show log/output)
5. Gate output expansion (show command output on enter)
6. Agent health monitoring (integrate with Workspaces agent status)

**Reusable Prism infrastructure:**
- `modal/` for gate output display
- `dialog/confirm.go` for gate re-run confirmation
- `styles/` panel styling already in use

---

### 2.5 WORKSPACES Plugin

**Already has (reusable):**
- Two-pane layout (40/60 split)
- Project scanning from sibling directories
- Git branch detection per project
- Epic navigation within projects
- Three-tab preview (Info/Stories/Progress)
- Progress bars for stories completion
- Project/Epic switching with `SwitchProjectMsg`
- Stories loading via `domain.LoadStoriesFile()`

**Missing (must build):**
1. Git worktree scanning (`git worktree list` integration)
2. Kanban board view (columns by worktree status)
3. Agent launching per workspace (spawn Claude Code in worktree)
4. Live agent output streaming
5. Merge workflow (multi-step with conflict detection)
6. Story/task linking to worktrees
7. Worktree creation modal (branch name + base)
8. Worktree deletion with confirmation
9. Status detection (Active/Thinking/Waiting/Done/Paused/Error)
10. Preview tab overhaul (Output/Diff/Task replacing Info/Stories/Progress)

**Reusable Prism infrastructure:**
- `modal/` for worktree creation, agent choice, merge confirmation
- `modal/input.go` for branch name input
- `modal/list.go` for agent type selection
- `dialog/confirm.go` for deletion confirmation
- `domain/story.go` for story loading (task linking)
- `claude/runner.go` for agent process management (adapt for worktree context)

---

## 3. Decomposition Plan

Each slice is a complete vertical feature: data → state → update → view → keyboard.

### 3.1 FILES Plugin — 8 Slices

#### F-1: Syntax-Highlighted Preview
**Description**: Add Chroma syntax highlighting to the file preview pane.
**Steps**: Create `highlight.go` in files context (or reuse `diff/highlight.go`), detect language from extension, apply highlighting to preview lines.
**Acceptance Criteria**:
- Opening a `.go`, `.ts`, `.py`, `.json` file shows syntax-colored output
- Unknown extensions fall back to plain text with line numbers
- Performance: files up to 10K lines render without visible lag

#### F-2: Git Status Indicators
**Description**: Annotate the file tree with git status (M/A/D/?).
**Steps**: Run `git status --porcelain` on tree load, parse output into path→status map, render status badges next to filenames.
**Acceptance Criteria**:
- Modified files show `M` in yellow, Added `A` in green, Untracked `?` in gray
- Status refreshes when tree reloads
- Status indicators appear in the tree pane, right-aligned

#### F-3: Multi-Tab Support
**Description**: Open multiple files in tabs, switch between them, close tabs.
**Steps**: Add `TabManager` struct with `[]TabInfo`, render tab bar above preview, `x` to close, click or hotkey to switch.
**Acceptance Criteria**:
- `Enter` on a file opens it in a new tab (or switches to existing)
- Tab bar shows all open files, active tab highlighted
- `x` closes current tab, falls back to previous
- Max 10 tabs, oldest closed when exceeded

#### F-4: Fuzzy File Search (ctrl+p)
**Description**: Project-wide fuzzy file finder overlay.
**Steps**: Build file cache on init (walk project, respect gitignore), implement fuzzy scoring, render modal with search input + results list, enter opens file.
**Acceptance Criteria**:
- `ctrl+p` opens search overlay
- Typing filters files with fuzzy matching (e.g., "mgo" matches `model.go`)
- Results sorted by score, top 20 shown
- `Enter` opens selected file in preview, `Esc` cancels
- File cache built async on plugin start

#### F-5: Content Search (Ripgrep)
**Description**: Full-text search across project files using ripgrep.
**Steps**: Detect `rg` binary, build search input modal, run `rg --json` subprocess, parse results, render result list, navigate to file+line.
**Acceptance Criteria**:
- `ctrl+s` opens search modal with text input
- Results show file:line with matching text highlighted
- `Enter` on result opens file at that line
- Graceful fallback message if `rg` not installed

#### F-6: Edit Mode
**Description**: In-place file editing via Bubbles textarea.
**Steps**: Add `EditMode` view state, load file into textarea, handle save (write to disk), handle cancel.
**Acceptance Criteria**:
- `e` enters edit mode for current file
- Textarea shows file content, cursor is navigable
- `ctrl+s` saves to disk and exits edit mode
- `Esc` cancels without saving
- Publishes `FileChangedEvent` on save

#### F-7: Blame View
**Description**: Git blame annotations alongside file content.
**Steps**: Run `git blame --porcelain`, parse output into per-line annotations, render blame column + code side by side.
**Acceptance Criteria**:
- `b` toggles blame view for current file
- Each line shows: short hash, author, age on left; code on right
- Scrolling is synchronized between blame and code
- Non-git files show "Not in git" message

#### F-8: Markdown Rendering Toggle
**Description**: Toggle between raw and rendered markdown preview.
**Steps**: Add Glamour dependency, detect `.md` extension, `m` key toggles between raw and rendered.
**Acceptance Criteria**:
- `.md` files default to rendered view
- `m` toggles to raw markdown (with syntax highlighting)
- Headers, lists, code blocks, links render correctly
- Non-markdown files ignore `m` key

---

### 3.2 GIT Plugin — 9 Slices

#### G-1: Push Menu Modal
**Description**: Modal with push options (push, push --force, push -u origin).
**Steps**: Build modal with 3 buttons, execute selected git command, show result/error.
**Acceptance Criteria**:
- `P` opens push modal
- Options: "Push", "Push (force)", "Push & set upstream"
- Success shows toast/notification
- Error shows error modal with git output
- Modal closes after operation

#### G-2: Pull Menu Modal
**Description**: Modal with pull options (fetch, pull, pull --rebase).
**Steps**: Build modal with 3 options, execute command, handle conflicts.
**Acceptance Criteria**:
- `L` opens pull modal
- Options: "Fetch", "Pull", "Pull (rebase)"
- On conflict, transitions to conflict view
- Success refreshes git status automatically

#### G-3: Branch Picker with Search
**Description**: Filterable branch list for switching branches.
**Steps**: Run `git branch -a`, build modal with `ListSection` + `InputSection`, filter as user types, checkout on enter.
**Acceptance Criteria**:
- `b` opens branch picker
- Shows local and remote branches
- Typing filters list (case-insensitive substring)
- `Enter` checks out selected branch
- Current branch marked with `*`

#### G-4: Stash Management
**Description**: List, apply, pop, and drop stashes.
**Steps**: Run `git stash list`, build stash modal with list and action buttons, execute stash operations.
**Acceptance Criteria**:
- `S` opens stash menu
- Options: "Stash", "Stash (include untracked)"
- Stash list shows all stashes with message
- Actions on selected stash: Apply, Pop, Drop
- Drop requires confirmation dialog

#### G-5: Conflict Resolution View
**Description**: Display and navigate merge conflicts.
**Steps**: Detect conflicted files from `git status`, render conflict list, show conflict markers in diff pane.
**Acceptance Criteria**:
- After failed pull/merge, conflict files are highlighted
- Selecting a conflict file shows the conflict markers
- After manual resolution, `s` stages the file
- All conflicts resolved → can commit

#### G-6: Auto-Refresh via File Watcher
**Description**: Automatically refresh git status when files change.
**Steps**: Integrate shared fsnotify watcher, debounce events (500ms), trigger `loadGitStatusCmd()` on change.
**Acceptance Criteria**:
- Editing files externally triggers status refresh
- Debounced to prevent excessive refreshes
- Watcher respects `.gitignore` (don't watch ignored dirs)
- Watcher starts on plugin `Start()`, stops on `Stop()`

#### G-7: Commit Detail View
**Description**: Expand a recent commit to see its full diff.
**Steps**: `Enter` on a commit in the history section runs `git show <hash>`, parses as unified diff, displays in diff pane.
**Acceptance Criteria**:
- `Enter` on a commit in history shows its diff
- Diff uses existing `diff/` package rendering
- Breadcrumb shows: `Back > <hash> > filename`
- `Esc` returns to status view

#### G-8: Error Modal + Discard Confirmation
**Description**: Proper error handling and dangerous operation confirmation.
**Steps**: Build error modal (variant=Danger) for failed git ops, build discard confirmation dialog.
**Acceptance Criteria**:
- Failed git operations show error modal with full output
- `d` on a modified file shows "Discard changes?" confirmation
- Confirmation uses `dialog/confirm.go` with Danger variant
- Discarded files trigger status refresh

#### G-9: Horizontal Diff Scrolling + Draggable Width
**Description**: Arrow keys scroll diffs horizontally; mouse drag resizes sidebar.
**Steps**: Add `h`/`l` bindings for horizontal offset, track mouse drag on divider for width, persist width.
**Acceptance Criteria**:
- `h`/`l` (or left/right arrows) scroll diff horizontally
- Mouse drag on divider resizes sidebar
- Width persists across view switches (project-scoped state)
- Minimum sidebar width: 20 chars

---

### 3.3 AGENT Plugin — 8 Slices

#### A-1: Claude Code Adapter
**Description**: Scan and parse Claude Code conversation files.
**Steps**: Define `Adapter` interface, implement Claude Code adapter reading `~/.claude/projects/*/conversations/*.jsonl`, parse messages, extract metadata.
**Acceptance Criteria**:
- Adapter scans Claude Code conversation directory
- Returns list of sessions with: title, date, message count, token count
- Parses JSONL messages into `chat.Message` format
- Handles missing/corrupted files gracefully

#### A-2: Session List with Date Grouping
**Description**: Replace hardcoded sidebar with real session list grouped by date.
**Steps**: Load sessions from adapter, group by date (Today/Yesterday/This Week/Older), render in sidebar with metadata.
**Acceptance Criteria**:
- Sidebar shows real conversations from Claude Code
- Sessions grouped under date headers
- Each entry shows: title/summary, agent type, time ago, token count
- `j`/`k` navigates sessions, `Enter` loads conversation

#### A-3: Multi-Adapter Support
**Description**: Add adapters for Codex, Cursor, Gemini CLI.
**Steps**: Implement adapters following the interface from A-1, auto-detect which adapters have data, show adapter filter in sidebar.
**Acceptance Criteria**:
- At least 3 adapters: Claude Code, Codex, Cursor
- Sidebar shows filter chips: [All] [Claude] [Codex] [Cursor]
- Filtering shows only sessions from selected adapter
- Unknown adapters silently skipped

#### A-4: Content Search with Highlighting
**Description**: Full-text search within conversation messages.
**Steps**: Build search input, scan all messages for matches, highlight matching text in rendered messages.
**Acceptance Criteria**:
- `/` enters search mode
- Typing filters messages containing the search term
- Matching text highlighted in cyan in the message viewport
- `n`/`N` navigates between matches
- `Esc` clears search

#### A-5: Token Analytics View
**Description**: Token usage and cost breakdown view.
**Steps**: Aggregate token counts from adapter sessions, build analytics panel showing totals, averages, and per-adapter breakdown.
**Acceptance Criteria**:
- Analytics toggle (e.g., `a` key) switches to analytics view
- Shows: total tokens, total cost, average per session
- Breakdown by adapter type (bar chart or table)
- Date range: today, this week, all time

#### A-6: Markdown Rendering for Messages
**Description**: Render assistant messages with Glamour markdown.
**Steps**: Detect markdown content in assistant messages, render via Glamour, toggle raw/rendered.
**Acceptance Criteria**:
- Assistant messages render markdown (headers, code blocks, lists)
- Code blocks have syntax highlighting
- `m` toggles between rendered and raw view
- User messages remain plain text

#### A-7: Export and Session Details
**Description**: Export conversations to markdown files.
**Steps**: Build export modal (choose format, output path), write conversation to file.
**Acceptance Criteria**:
- `e` opens export modal
- Exports selected conversation as markdown
- Output saved to `.prism/shared/conversations/` or custom path
- Export includes: title, date, all messages, tool invocations

#### A-8: Real-Time File Watching
**Description**: Watch conversation files for new messages.
**Steps**: Integrate shared fsnotify watcher on adapter directories, trigger reload on file change.
**Acceptance Criteria**:
- New messages appear automatically when another agent writes to conversation files
- Session list updates when new sessions are created
- Debounced to prevent excessive reloads (1s)
- File watching starts on `Start()`, stops on `Stop()`

---

### 3.4 MONITOR Plugin — 5 Slices

#### M-1: Multi-Panel Focus + Navigation
**Description**: Tab between health/history/gates panels, navigate within each.
**Steps**: Add `focusedPanel` enum, `Tab` cycles panels, `j`/`k` navigates within focused panel.
**Acceptance Criteria**:
- `Tab` cycles focus: Health → History → Gates → Health
- Focused panel has highlighted border
- `j`/`k` navigates rows in History and Gates
- `Enter` on a history row shows detail (future slice)

#### M-2: Quality Gate Execution
**Description**: Actually run quality gate commands and capture results.
**Steps**: On `Enter` or `r` with gate focused, spawn command subprocess, capture stdout/stderr, update gate status.
**Acceptance Criteria**:
- `Enter` on a quality gate runs its command
- Gate shows spinner while running
- Pass (exit 0) → green check, Fail (non-zero) → red X
- Gate output stored for expansion
- All gates can be run with `R` (run all)

#### M-3: Gate Output Expansion
**Description**: Show command output when a gate is selected.
**Steps**: On `Enter` with gate focused (after execution), show output in a modal or expanded panel.
**Acceptance Criteria**:
- `Enter` on an executed gate shows its output
- Output shown in scrollable modal
- Failed gates show stderr in red
- `Esc` closes output view

#### M-4: History Detail View
**Description**: Expand execution history record to show details.
**Steps**: On `Enter` with history row focused, show detail modal with story info, duration breakdown, log output.
**Acceptance Criteria**:
- `Enter` on a history row opens detail modal
- Shows: Story ID, Title, Result, Duration, Timestamp
- Shows associated log output if available
- `Esc` closes modal

#### M-5: Agent Health Integration
**Description**: Show running agent status from Workspaces plugin.
**Steps**: Subscribe to EventBus for agent status events, display in health panel.
**Acceptance Criteria**:
- Health panel shows count of active agents
- Shows agent type and worktree for each
- Updates in real-time via EventBus
- Empty state when no agents running

---

### 3.5 WORKSPACES Plugin — 8 Slices

#### W-1: Git Worktree Scanning
**Description**: Replace sibling-directory scanning with `git worktree list`.
**Steps**: Run `git worktree list --porcelain`, parse output, populate workspace list alongside existing project scan.
**Acceptance Criteria**:
- `git worktree list` output parsed into workspace entries
- Each worktree shows: branch, path, HEAD hash
- Bare worktree (main) distinguished from linked worktrees
- Falls back to existing project scan if not in a git repo

#### W-2: Worktree Creation Modal
**Description**: Create new git worktree via modal.
**Steps**: Build modal with branch name input + base branch picker, run `git worktree add`.
**Acceptance Criteria**:
- `n` opens create worktree modal
- Input: branch name, base branch (default: current)
- Creates worktree as sibling directory: `../<repo>-<branch>`
- Refreshes workspace list after creation
- Error shown if branch name already exists

#### W-3: Worktree Deletion
**Description**: Remove worktree with confirmation.
**Steps**: Confirmation dialog (Danger variant), run `git worktree remove`, optionally delete branch.
**Acceptance Criteria**:
- `d` on a worktree shows deletion confirmation
- Checkbox: "Also delete branch?"
- Runs `git worktree remove <path>`
- Refreshes list after deletion
- Cannot delete main worktree

#### W-4: Kanban Board View
**Description**: Columns organized by worktree/agent status.
**Steps**: Add `ViewModeKanban`, group workspaces by status, render columns with cards.
**Acceptance Criteria**:
- `v` toggles between List and Kanban views
- Columns: Active, Thinking, Waiting, Done, Paused
- Each card shows: branch name, agent type, status icon
- Arrow keys navigate between columns and cards
- `Enter` on card shows detail

#### W-5: Agent Launching per Workspace
**Description**: Spawn Claude Code (or other agents) in a worktree.
**Steps**: Build agent choice modal, spawn process in worktree directory, track PID and status.
**Acceptance Criteria**:
- `Enter` on a worktree prompts agent selection
- Options: Claude Code, Codex, Cursor (detected from PATH)
- Agent launched as subprocess in worktree directory
- Status updates to "Active" with agent type displayed
- Agent PID tracked for lifecycle management

#### W-6: Live Agent Output Streaming
**Description**: Show real-time agent output in preview pane.
**Steps**: Capture agent stdout/stderr via pipe, stream to preview Output tab, parse tool activity.
**Acceptance Criteria**:
- Preview "Output" tab shows streaming agent output
- Tool activities formatted (Reading, Writing, Searching, etc.)
- Output scrolls automatically (tail mode)
- Manual scroll pauses auto-scroll, spacebar resumes
- Output buffer limited to 10K lines

#### W-7: Merge Workflow
**Description**: Multi-step merge from worktree back to main branch.
**Steps**: Build merge modal (select target branch), run merge, handle conflicts.
**Acceptance Criteria**:
- `m` on a worktree starts merge workflow
- Step 1: Confirm merge (source → target branch)
- Step 2: Execute merge (fast-forward or merge commit)
- Step 3: Handle conflicts (show conflict list) or success
- After merge, option to delete worktree

#### W-8: Story/Task Linking
**Description**: Link worktrees to stories from `stories.json`.
**Steps**: Build linking modal (select from open stories), persist link, show in preview Task tab.
**Acceptance Criteria**:
- `t` on a worktree opens task linking modal
- Shows list of open stories from current `stories.json`
- Selected story linked to worktree (persisted in state file)
- Preview "Task" tab shows linked story details
- Completing story updates worktree status

---

## 4. Dependency Order

### 4.1 Build Order (by plugin)

```
Phase 0: Shared Infrastructure (must come first)
         ├── SI-1: Filesystem Watcher
         ├── SI-2: Context Upgrades (WorkDir, ConfigDir, Epoch)
         ├── SI-3: Custom Modal Section
         ├── SI-4: Project-Scoped State Persistence
         └── SI-5: Glamour Dependency

Phase 1: FILES plugin (foundation for other plugins)
         ├── F-1: Syntax highlighting (shared by Git, Agent)
         ├── F-2: Git status indicators
         └── F-3: Multi-tab support

Phase 2: GIT plugin (depends on F-1 highlight, SI-1 watcher)
         ├── G-1: Push modal
         ├── G-2: Pull modal
         ├── G-3: Branch picker
         └── G-6: Auto-refresh (depends on SI-1)

Phase 3: AGENT plugin (depends on SI-1 watcher, SI-5 Glamour)
         ├── A-1: Claude Code adapter
         ├── A-2: Session list
         └── A-6: Markdown rendering (depends on SI-5)

Phase 4: Remaining slices (can parallelize)
         ├── FILES: F-4 through F-8
         ├── GIT: G-4 through G-9
         ├── AGENT: A-3 through A-8
         ├── MONITOR: M-1 through M-5
         └── WORKSPACES: W-1 through W-8
```

### 4.2 Cross-Plugin Dependencies

```
                    ┌───────────────────────────────────────┐
                    │      SHARED INFRASTRUCTURE            │
                    │  SI-1: fsnotify watcher               │
                    │  SI-2: Context upgrades                │
                    │  SI-3: Custom modal section            │
                    │  SI-4: State persistence               │
                    │  SI-5: Glamour dependency              │
                    └──────────┬─────────────┬──────────────┘
                               │             │
              ┌────────────────┤             │
              │                │             │
              ▼                ▼             ▼
         ┌─────────┐    ┌──────────┐   ┌─────────┐
         │  FILES   │    │   GIT    │   │  AGENT  │
         │ F-1 high │───▶│ uses F-1 │   │ uses    │
         │ lighting │    │ highlight│   │ SI-5    │
         └────┬────┘    └────┬─────┘   └────┬────┘
              │              │              │
              │         ┌────┴────┐         │
              │         │MONITOR  │         │
              │         │ M-5     │◀────────┘
              │         │ agent   │    (agent health from
              │         │ health  │     workspaces events)
              │         └─────────┘
              │              ▲
              │              │
         ┌────▼────┐         │
         │WORKSPACES│────────┘
         │ W-5 agent│  (publishes agent events
         │ launching│   consumed by Monitor)
         └─────────┘
```

### 4.3 Shared Infrastructure Consumers

| Infrastructure | Consumed By |
|---------------|-------------|
| **SI-1: fsnotify watcher** | FILES (tree refresh), GIT (status refresh), AGENT (session refresh) |
| **SI-2: Context upgrades** | All plugins (WorkDir), WORKSPACES (Epoch for project switch) |
| **SI-3: Custom modal section** | GIT (push/pull menus), WORKSPACES (agent choice), MONITOR (gate output) |
| **SI-4: State persistence** | FILES (open tabs, expanded dirs), GIT (sidebar width, diff mode), WORKSPACES (linked tasks) |
| **SI-5: Glamour dependency** | AGENT (message rendering), FILES (markdown preview) |

### 4.4 Recommended Implementation Sequence

| Order | Slice(s) | Rationale |
|-------|----------|-----------|
| 1 | SI-1, SI-2, SI-5 | Unblocks most plugins |
| 2 | F-1 (highlight) | Shared by Git diff + Files preview |
| 3 | F-2 (git indicators), F-3 (tabs) | Core Files features |
| 4 | G-1 (push), G-2 (pull), G-3 (branch) | Core Git operations |
| 5 | A-1 (Claude adapter), A-2 (session list) | Core Agent features |
| 6 | SI-3, SI-4 | Needed for advanced modals + state |
| 7 | G-6 (auto-refresh), F-4 (fuzzy), F-5 (search) | Depends on SI-1 |
| 8 | M-1 (panel focus), M-2 (gate exec) | Standalone, no deps |
| 9 | W-1 (worktree scan), W-2 (create), W-4 (kanban) | Standalone |
| 10 | All remaining slices | Parallelize freely |

---

## 5. Shared Infrastructure

### SI-1: Filesystem Watcher

**Purpose**: Real-time file change detection for auto-refresh across plugins.

**Design**:
```go
// New package: cmd/prism-cli/watcher/
type Watcher struct {
    fsWatcher  *fsnotify.Watcher
    debounce   time.Duration        // 500ms default
    eventBus   *plugin.EventBus
    ignoreFunc func(string) bool    // gitignore-aware filter
}

func New(projectDir string, eventBus *plugin.EventBus) (*Watcher, error)
func (w *Watcher) Start() error     // Begin watching
func (w *Watcher) Stop()            // Stop watching
func (w *Watcher) AddPath(path string)  // Watch additional paths
```

**Events Published**:
- `FileChangedEvent{FilePath, Action}` — for Files and Git plugins
- `ConversationChangedEvent{AdapterType, SessionPath}` — for Agent plugin

**Consumers**:
- FILES: Rebuilds tree on file create/delete/rename
- GIT: Reloads status on any file change in project
- AGENT: Reloads session list on conversation file change

**Dependencies**: `github.com/fsnotify/fsnotify` (add to go.mod)

---

### SI-2: Context Upgrades

**Purpose**: Extend `plugin.Context` with fields needed by Sidecar-style plugins.

**Changes to `plugin/context.go`**:
```go
type Context struct {
    // Existing fields (no changes)
    PrismDir      string
    ProjectDir    string
    StoriesPath   string
    Width         int
    Height        int
    DemoMode      bool
    PrismStyle    string
    MaxIterations int
    Pause         int
    HasNerdFont   bool
    EventBus      *EventBus

    // New fields
    WorkDir       string            // Current working directory (may differ from ProjectDir)
    ConfigDir     string            // ~/.config/prism-cli/ for global state
    GitRoot       string            // Git repository root (result of git rev-parse --show-toplevel)
    Epoch         uint64            // Project switch counter (invalidates stale async messages)
    Adapters      map[string]bool   // Available AI agent adapters (detected at startup)
}
```

**Epoch Pattern**: Each async command stores `ctx.Epoch` at creation time. When the response arrives, compare with current epoch — if different, the project was switched and the message is stale (discard it).

```go
// Example usage in an async command:
func loadDataCmd(epoch uint64) tea.Cmd {
    return func() tea.Msg {
        // ... do work ...
        return DataLoadedMsg{Data: data, Epoch: epoch}
    }
}

// In Update():
case DataLoadedMsg:
    if msg.Epoch != p.ctx.Epoch {
        return p, nil // Stale, discard
    }
    // Process data...
```

**Registry changes**: `Reinit()` should increment `Epoch` before re-initializing plugins.

---

### SI-3: Custom Modal Section

**Purpose**: Add a `CustomSection` to `modal/section.go` for rich, plugin-specific modal content.

**Design**:
```go
// CustomSection allows plugins to render arbitrary content within a modal
type CustomSection struct {
    renderFn  func(width int, focusID string) RenderedSection
    updateFn  func(msg tea.KeyMsg, focusID string) (string, tea.Cmd)
    focusable bool
    focusID   string
}

func Custom(id string, render func(int, string) RenderedSection, update func(tea.KeyMsg, string) (string, tea.Cmd)) *CustomSection
```

**Use Cases**:
- GIT push/pull menus with dynamic option state
- WORKSPACES agent choice with detected-agent list
- MONITOR gate output with scrolling

This already partially exists via `WhenSection`; `CustomSection` extends the escape hatch pattern from Sidecar's modal system.

---

### SI-4: Project-Scoped State Persistence

**Purpose**: Save and restore plugin UI state per project.

**Design**:
```go
// New package: cmd/prism-cli/state/
type Store struct {
    configDir string          // ~/.config/prism-cli/state/
}

type ProjectState struct {
    ActivePlugin   string            `json:"activePlugin"`
    FilesState     FilesPersistedState     `json:"files,omitempty"`
    GitState       GitPersistedState       `json:"git,omitempty"`
    WorkspacesState WorkspacesPersistedState `json:"workspaces,omitempty"`
}

type FilesPersistedState struct {
    OpenTabs      []string `json:"openTabs"`
    ExpandedDirs  []string `json:"expandedDirs"`
    SidebarWidth  int      `json:"sidebarWidth"`
}

type GitPersistedState struct {
    SidebarWidth  int    `json:"sidebarWidth"`
    DiffViewMode  string `json:"diffViewMode"`
}

type WorkspacesPersistedState struct {
    LinkedTasks   map[string]string `json:"linkedTasks"` // worktree path → story ID
}

func NewStore(configDir string) *Store
func (s *Store) Load(projectHash string) (*ProjectState, error)
func (s *Store) Save(projectHash string, state *ProjectState) error
```

**Storage Location**: `~/.config/prism-cli/state/<project-hash>.json`
**Project Hash**: SHA256 of `ProjectDir` path, truncated to 12 chars.

---

### SI-5: Glamour Dependency

**Purpose**: Markdown rendering for Agent messages and Files preview.

**Steps**:
1. Add `github.com/charmbracelet/glamour` to `go.mod`
2. Create `cmd/prism-cli/markdown/renderer.go` with:
   ```go
   func Render(content string, width int) (string, error)
   func RenderDark(content string, width int) (string, error) // Dark theme
   ```
3. Consumed by Agent plugin (A-6) and Files plugin (F-8)

**Configuration**: Use `glamour.DarkStyleConfig` matching Prism's color palette.

---

### SI-6: EventBus Expansion (New Event Types)

**Purpose**: Additional events needed by the new plugin features.

**New events to add to `plugin/events.go`**:
```go
// AgentStatusEvent - published by Workspaces when agent status changes
type AgentStatusEvent struct {
    WorktreePath string
    AgentType    string
    Status       string // "active", "thinking", "waiting", "done", "paused", "error"
}

// ConversationChangedEvent - published by watcher when conversation files change
type ConversationChangedEvent struct {
    AdapterType string
    SessionPath string
}

// QualityGateResultEvent - published by Monitor when a gate finishes
type QualityGateResultEvent struct {
    GateName string
    Status   string // "pass", "fail"
    Output   string
    Duration int64
}

// WorktreeChangedEvent - published when worktrees are created/deleted
type WorktreeChangedEvent struct {
    Action string // "created", "deleted"
    Path   string
    Branch string
}
```

---

## Summary

### Total Slices by Plugin

| Plugin | Slices | Estimated New LOC |
|--------|--------|-------------------|
| Shared Infrastructure | 6 | ~800 |
| FILES | 8 | ~1,500 |
| GIT | 9 | ~1,800 |
| AGENT | 8 | ~2,000 |
| MONITOR | 5 | ~600 |
| WORKSPACES | 8 | ~1,800 |
| **Total** | **44** | **~8,500** |

### Critical Path

```
SI-1/SI-2/SI-5 → F-1 → G-1/G-2/G-3 → A-1/A-2 → Everything else (parallel)
```

The first 3 infrastructure items plus 6 foundation slices unblock all remaining work. After that, the 35 remaining slices can be developed in any order with minimal cross-dependencies.

---

*Manifest generated 2026-02-19. Review and adjust before implementation begins.*
