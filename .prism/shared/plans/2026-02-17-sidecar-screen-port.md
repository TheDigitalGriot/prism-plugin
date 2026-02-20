---
date: 2026-02-17
author: Claude
repository: prism-plugin
branch: feat/sidecar-screen-port
ticket: N/A
status: draft
research: .prism/shared/research/2026-02-17-sidecar-port-screen-audit.md
---

# Plan: Port Sidecar TUI Screen Layouts to Prism

## Overview

**Goal**: Upgrade the Git, Workspaces, and Files plugin screens from simplified scaffolds to the full two-pane layouts from the Sidecar reference implementation at `ref/sidecar/`.

**Research**: [.prism/shared/research/2026-02-17-sidecar-port-screen-audit.md](.prism/shared/research/2026-02-17-sidecar-port-screen-audit.md)

**Complexity**: High

**Estimated Phases**: 5

## Scope

### In Scope
- Shared layout utilities (RenderPanel, RenderDivider, RenderScrollbar, pane width calculation)
- Standalone diff parser and renderer package with syntax highlighting (using chroma)
- Git plugin: structural refactor to persistent two-pane layout with diff, commits, scrollbar
- Workspaces plugin: add two-pane layout with detail/preview pane
- Files plugin: upgrade to 30/70 split with bordered panels, line numbers, search, focus tracking
- Mouse support for divider dragging (ported from Sidecar's hit-region system)
- Focus tracking (activePane, tab-to-switch) across all three screens

### Out of Scope
- Agent/Conversations plugin (deferred — data source TBD)
- Monitor plugin (Prism-specific, no Sidecar analog)
- Kanban view for Workspaces (defer to follow-up)
- Inline editor for Files (defer to follow-up)
- Blame view for Files (defer to follow-up)

## Success Criteria

### Automated (CI/Scripts)
- [ ] `cd cmd/prism-cli && make build` — Build succeeds
- [ ] `cd cmd/prism-cli && make test` — All tests pass
- [ ] `cd cmd/prism-cli && make lint` — No lint errors

### Manual Verification
- [ ] Git screen shows persistent 30/70 two-pane (sidebar + diff) — selecting a file shows inline diff without replacing the view
- [ ] Git sidebar shows Staged/Modified/Untracked sections with scrollbar and recent commits
- [ ] Git diff pane renders unified diff with line numbers and syntax highlighting
- [ ] Workspaces screen shows 40/60 two-pane (project list + detail preview)
- [ ] Files screen shows 30/70 two-pane with bordered panels, line numbers in preview
- [ ] Tab key switches focus between panes on all three screens (active pane border changes color)
- [ ] Mouse click on divider allows drag to resize panes
- [ ] All screens render correctly at terminal widths 80, 120, and 200 columns
- [ ] No regressions on Home or Monitor screens

---

## Phases

### Phase 1: Shared Layout Foundation

**Goal**: Port Sidecar's shared layout primitives into Prism so all plugin screens can use them.

**Files to create**:
| File | Purpose |
|------|---------|
| `cmd/prism-cli/ui/divider.go` | Vertical pane divider renderer |
| `cmd/prism-cli/ui/scrollbar.go` | Proportional scrollbar renderer |
| `cmd/prism-cli/ui/pane.go` | `CalculatePaneWidths()` helper and `FocusPane` type |

**Files to modify**:
| File | Change |
|------|--------|
| `cmd/prism-cli/styles/theme.go` | Add `ScrollbarTrackColor`, `ScrollbarThumbColor`, `BorderNormal`, `BorderActive` vars |
| `cmd/prism-cli/styles/borders.go` | Port `RenderPanel()`, `RenderPanelWithGradient()`, `RenderGradientBorder()` from `ref/sidecar/internal/styles/borders.go` |
| `cmd/prism-cli/styles/gradient.go` | Port `Gradient`, `RGB`, `GradientStop` types and `NewGradient()`, `GetActiveGradient()`, `GetNormalGradient()` from `ref/sidecar/internal/styles/gradient.go` |

**Steps**:
1. [x] Create `cmd/prism-cli/ui/` package directory
2. [x] Port `RenderDivider()` from `ref/sidecar/internal/ui/divider.go` into `cmd/prism-cli/ui/divider.go` — adapt import paths to use Prism's styles package
3. [x] Port `ScrollbarParams` and `RenderScrollbar()` from `ref/sidecar/internal/ui/scrollbar.go` into `cmd/prism-cli/ui/scrollbar.go` — adapt color references to Prism's styles
4. [x] Create `cmd/prism-cli/ui/pane.go` with:
   - `FocusPane` type (`int`) with `PaneLeft`/`PaneRight` constants
   - `PaneWidths` struct with `Left`, `Right`, `Divider`, `Available` fields
   - `CalculatePaneWidths(available, ratio, minLeft, minRight int) PaneWidths` — generic 2-pane calculator based on Sidecar's `calculatePaneWidths()` pattern (default 30/70 split, clamped bounds)
5. [x] Port Sidecar's `RGB`, `Gradient`, `GradientStop` types into `cmd/prism-cli/styles/gradient.go` — extend existing file with `HexToRGB()`, `RGBToHex()`, `LerpRGB()`, `NewGradient()`, `ColorAt()`, `PositionAt()` from `ref/sidecar/internal/styles/gradient.go`
6. [x] Add `GetActiveGradient()`, `GetNormalGradient()`, `GetFlashGradient()` to `cmd/prism-cli/styles/gradient.go` — use Prism's existing `Primary` and `Info` colors for active gradient, `Dim` for normal
7. [x] Create `cmd/prism-cli/styles/borders.go` with `RenderPanel()`, `RenderPanelWithGradient()`, `RenderGradientBorder()` ported from `ref/sidecar/internal/styles/borders.go:27-309` — includes `truncateString()`, `decodeRune()`, `runeWidth()` helpers
8. [x] Add `ScrollbarTrackColor`, `ScrollbarThumbColor` vars to `cmd/prism-cli/styles/theme.go` (default to existing `Dim` color)
9. [x] Write unit tests for `CalculatePaneWidths()`, `RenderScrollbar()`, `RenderDivider()`, `RenderPanel()`

**Key references**:
- `ref/sidecar/internal/ui/divider.go:15-30` — RenderDivider implementation
- `ref/sidecar/internal/ui/scrollbar.go:10-75` — RenderScrollbar implementation
- `ref/sidecar/internal/styles/borders.go:27-309` — RenderGradientBorder + RenderPanel
- `ref/sidecar/internal/styles/gradient.go:1-254` — Gradient types and math
- `ref/sidecar/internal/plugins/gitstatus/sidebar_view.go:15-49` — calculatePaneWidths pattern

**Verification**:
```bash
cd cmd/prism-cli && go build ./...
cd cmd/prism-cli && go test ./ui/... ./styles/...
```

**Checkpoint**: ✅ Phase 1 complete — shared layout utilities build and pass tests

---

### Phase 2: Diff Parser & Renderer Package

**Goal**: Port the diff parsing, rendering, and syntax highlighting as a standalone package usable by the Git plugin (and eventually Files blame).

**Files to create**:
| File | Purpose |
|------|---------|
| `cmd/prism-cli/diff/parser.go` | `ParseUnifiedDiff()`, `ParseMultiFileDiff()`, types (`ParsedDiff`, `Hunk`, `DiffLine`, `LineType`) |
| `cmd/prism-cli/diff/renderer.go` | `RenderLineDiff()`, `RenderSideBySide()`, `RenderFileHeader()`, `RenderMultiFileDiff()` |
| `cmd/prism-cli/diff/highlight.go` | `SyntaxHighlighter` using chroma, `HighlightLine()`, `blendSyntaxWithDiff()` |
| `cmd/prism-cli/diff/parser_test.go` | Tests for ParseUnifiedDiff with edge cases |
| `cmd/prism-cli/diff/renderer_test.go` | Tests for RenderLineDiff output |

**Steps**:
1. [x] Create `cmd/prism-cli/diff/` package directory
2. [x] Port types from `ref/sidecar/internal/plugins/gitstatus/diff_parser.go:9-58` into `cmd/prism-cli/diff/parser.go`:
   - `LineType` (LineContext, LineAdd, LineRemove)
   - `WordSegment{Text, IsChange}`
   - `DiffLine{Type, OldLineNo, NewLineNo, Content, WordDiff}`
   - `Hunk{OldStart, OldCount, NewStart, NewCount, Header, Lines}`
   - `ParsedDiff{OldFile, NewFile, Binary, Hunks}`
   - `FileDiffInfo{Diff, StartLine, EndLine, Additions, Deletions}`
   - `MultiFileDiff{Files}`
3. [x] Port `ParseUnifiedDiff()` from `ref/sidecar/internal/plugins/gitstatus/diff_parser.go:164-291` — includes `computeWordDiffs()`, `tokenize()`, `computeWordSegments()`
4. [x] Port `ParseMultiFileDiff()` and `splitIntoFileDiffs()` from `diff_parser.go:66-129`
5. [x] Port `RenderLineDiff()` from `ref/sidecar/internal/plugins/gitstatus/diff_renderer.go:49-174` — adapt style references to Prism
6. [x] Port `RenderSideBySide()` from `diff_renderer.go:179-335` — includes `groupLinesForSideBySide()`, `linePair`
7. [x] Port `RenderMultiFileDiff()` and `RenderFileHeader()` from `diff_renderer.go:650-787`
8. [x] Port `SyntaxHighlighter` from `ref/sidecar/internal/plugins/gitstatus/syntax_highlight.go:14-107` — uses `github.com/alecthomas/chroma/v2`
9. [x] Add `chroma` dependency: `go get github.com/alecthomas/chroma/v2`
10. [x] Port helper functions: `truncateLine()`, `padRight()`, `padToWidth()`, `renderDiffContent()`, `blendSyntaxWithDiff()` from `diff_renderer.go:400-573`
11. [x] Write parser tests covering: standard unified diff, binary files, multi-file diff, empty diff, word-level diff computation
12. [x] Write renderer tests covering: unified output with line numbers, side-by-side pairing

**Key references**:
- `ref/sidecar/internal/plugins/gitstatus/diff_parser.go` — Full parser (392 lines)
- `ref/sidecar/internal/plugins/gitstatus/diff_renderer.go` — Full renderer (787 lines)
- `ref/sidecar/internal/plugins/gitstatus/syntax_highlight.go` — Chroma integration (107 lines)

**Verification**:
```bash
cd cmd/prism-cli && go build ./diff/...
cd cmd/prism-cli && go test ./diff/... -v
```

**Checkpoint**: ✅ Phase 2 complete — diff package builds, parses real `git diff` output, renders correctly

---

### Phase 3: Git Plugin Refactor

**Goal**: Rewrite the Git plugin from 3-path single-column to persistent two-pane layout with sidebar (files + commits) and diff pane.

**Files to modify**:
| File | Change |
|------|--------|
| `cmd/prism-cli/app/plugin_git.go` | Structural refactor: add `FocusPane`, `activePane`, `sidebarWidth`, `diffPaneWidth` state; replace 3-path `View()` with `renderTwoPane()`; add `calculatePaneWidths()`; wire diff package; add scrollbar; add commit history |

**Steps**:
1. [x] Add state fields to `GitState` struct (`plugin_git.go:23-35`):
   - `activePane ui.FocusPane` (default `ui.PaneLeft`)
   - `sidebarWidth int`, `diffPaneWidth int`
   - `scrollOff int` (file list scroll offset)
   - `commitScrollOff int` (commit list scroll offset)
   - `recentCommits []CommitInfo` (recent commit data)
   - `diffParsedDiff *diff.ParsedDiff` (parsed diff for right pane)
   - `selectedDiffFile string` (which file's diff is showing)
   - `diffViewMode diff.DiffViewMode` (unified/split)
   - `sidebarVisible bool` (default `true`)
   - `highlighter *diff.SyntaxHighlighter`
2. [x] Replace `View()` with new two-pane layout via `renderTwoPane(width, height)` using `ui.CalculatePaneWidths(width, 30, 25, 40)`, `styles.RenderPanel()`, `ui.RenderDivider()`, `lipgloss.JoinHorizontal()`
3. [x] Implement `renderSidebar(innerHeight)`:
   - Branch header with ahead/behind status
   - File sections (Staged/Modified/Untracked) with status icons
   - Scrollbar alongside file list via `ui.RenderScrollbar()`
   - Separator line
   - Recent commits section with scrollbar
4. [x] Implement `renderDiffPane(innerHeight)`:
   - Header with filename and view mode
   - Call `diff.RenderLineDiff()` / `diff.RenderSideBySide()` based on mode
   - "Select a file to view diff" placeholder when no file selected
5. [x] Pane widths calculated inline in `renderTwoPane()` using `ui.CalculatePaneWidths(width, 30, 25, 40)`
6. [x] Refactor `handleKeyPress()`:
   - `tab` — switch `activePane` between `PaneLeft` and `PaneRight`
   - When in sidebar (`PaneLeft`): j/k navigate files + commits; enter loads diff into right pane
   - When in diff pane (`PaneRight`): j/k scroll diff viewport; `v` toggle unified/split mode; `esc` returns to sidebar
   - `s`/`c`/`r` — stage/commit/refresh (work regardless of pane)
7. [x] Update `loadDiffCmd()` to return raw diff via `GitDiffLoadedMsg{Raw, File}`; Update handler parses via `diff.ParseUnifiedDiff()` and creates `SyntaxHighlighter`
8. [x] Add `loadCommitsCmd()` — runs `git log --oneline -20` and parses into `CommitInfo` structs; `RecentCommitsLoadedMsg` handler stores them
9. [x] Handle `PluginResizeMsg` to update `p.width` / `p.height` (pane widths recalculated in `View()`)
10. [ ] Add mouse support: register hit regions for sidebar, divider, diff pane; handle divider drag to resize (deferred — out of scope for this phase)

**Key references**:
- `ref/sidecar/internal/plugins/gitstatus/sidebar_view.go:51-112` — renderThreePaneView (canonical two-pane assembly)
- `ref/sidecar/internal/plugins/gitstatus/sidebar_view.go:115-268` — renderSidebar
- `ref/sidecar/internal/plugins/gitstatus/sidebar_view.go:610-698` — renderDiffPane
- `ref/sidecar/internal/plugins/gitstatus/plugin.go:46-52` — FocusPane type

**Verification**:
```bash
cd cmd/prism-cli && go build ./...
cd cmd/prism-cli && go test ./... -v
# Manual: run TUI, navigate to Git screen, verify two-pane layout
```

**Checkpoint**: ✅ Phase 3 complete — Git screen shows persistent two-pane with sidebar and inline diff

---

### Phase 4: Workspaces Plugin Upgrade

**Goal**: Convert the Workspaces plugin from single-column to two-pane layout with project detail/preview pane.

**Files to modify**:
| File | Change |
|------|--------|
| `cmd/prism-cli/app/plugin_workspaces.go` | Add two-pane layout, detail preview pane, focus tracking, scrollbar, richer item rendering |

**Steps**:
1. [x] Add state fields to `WorkspacesState` (`plugin_workspaces.go:28-34`):
   - `activePane ui.FocusPane`
   - `sidebarWidth int`, `previewWidth int`
   - `scrollOff int` (project/epic list scroll)
   - `previewTab int` (0=Info, 1=Stories, 2=Progress)
2. [x] Replace `View()` at `plugin_workspaces.go:104-126` with two-pane layout:
   - Left pane (40%): Project/epic list using `styles.RenderPanel()`
   - Right pane (60%): Preview content with tabs
   - Use `ui.CalculatePaneWidths(width, 40, 25, 40)` for 40/60 split
3. [x] Implement `renderProjectList(innerHeight)`:
   - Richer project items: name, branch, story progress bar, last activity
   - Scrollbar via `ui.RenderScrollbar()`
   - Selected item styling via `styles.CurrentStyle` (Prism equivalent)
4. [x] Implement `renderPreviewPane(innerHeight)`:
   - Tab bar: [Info] [Stories] [Progress]
   - Info tab: Project path, branch, epic count, total stories, completion percentage
   - Stories tab: Story list with status icons
   - Progress tab: Phase completion summary
5. [x] Add focus tracking:
   - `tab` switches between project list and preview
   - Active pane gets `RenderPanel(..., active=true)` gradient border
6. [x] Refactor `handleKeyPress()` (`plugin_workspaces.go:156-229`):
   - When in sidebar: j/k navigate, enter selects, `tab` switches to preview
   - When in preview: `[`/`]` cycle preview tabs, j/k scroll, `esc` switches back to sidebar
7. [x] Handle `PluginResizeMsg` to recalculate pane widths
8. [ ] Add mouse support: hit regions for project list, preview pane, divider (deferred)

**Key references**:
- `ref/sidecar/internal/plugins/workspace/view_list.go:90-209` — renderListView two-pane pattern
- `ref/sidecar/internal/plugins/workspace/view_list.go:136-149` — pane width calculation (40/60 ratio)

**Verification**:
```bash
cd cmd/prism-cli && go build ./...
cd cmd/prism-cli && go test ./... -v
# Manual: run TUI, navigate to Workspaces, verify two-pane with project detail
```

**Checkpoint**: ✅ Phase 4 complete — Workspaces shows two-pane with project list and detail preview

---

### Phase 5: Files Plugin Upgrade

**Goal**: Upgrade the Files plugin from 50/50 manual join to 30/70 bordered two-pane with line numbers, focus tracking, and search.

**Files to modify**:
| File | Change |
|------|--------|
| `cmd/prism-cli/app/plugin_files.go` | Replace manual line-by-line join with `lipgloss.JoinHorizontal` + `RenderPanel()`; add line numbers, scrollbar, focus tracking, filename search |

**Steps**:
1. [x] Add state fields to `FilesState` (`plugin_files.go:29-38`):
   - `activePane ui.FocusPane`
   - `treeWidth int`, `previewWidth int`
   - `treeScrollOff int` (tree scroll offset for scrollbar)
   - `previewScrollOff int` (preview scroll offset)
   - `FilterMode bool`, `FilterQuery string` (filename search — existing fields kept)
2. [x] Replace `View()` at `plugin_files.go:173-218`:
   - Remove manual `[]string` zip pattern (lines 203-215)
   - Use `ui.CalculatePaneWidths(width, 30, 20, 40)` for 30/70 split
   - Wrap tree and preview in `styles.RenderPanel(content, width, height, active)`
   - Join with `ui.RenderDivider()` + `lipgloss.JoinHorizontal(lipgloss.Top, ...)`
3. [x] Upgrade `renderTree()` (`plugin_files.go:324-376`):
   - Add scrollbar via `ui.RenderScrollbar()` alongside tree content
   - Replace emoji icons (📄/📂/📁) with text icons (▶/▼ for dirs)
   - Auto-scroll to keep cursor visible; rune-safe truncation
4. [x] Upgrade `renderPreview()` (`plugin_files.go:379-402`):
   - Add line numbers using `styles.FileBrowserLineNumber` style (right-aligned, 5-char width)
   - Format: `  42 │ content here`
   - Show file type in header: `filename.go [go]`
5. [x] Add focus tracking:
   - `tab` switches between `PaneLeft` (tree) and `PaneRight` (preview)
   - Active pane gets gradient border via `RenderPanel(..., active=true)`
6. [x] Add filename search mode:
   - `/` enters search mode (filter tree by query)
   - `esc` exits search, `enter` applies filter
   - Search bar at top of tree pane when active
7. [x] Refactor `handleKeyPress()` (`plugin_files.go:251-321`):
   - When in tree (`PaneLeft`): j/k navigate, enter expand/select, `/` search, `tab` to preview
   - When in preview (`PaneRight`): j/k scroll content, `esc/tab` back to tree
8. [x] Handle `PluginResizeMsg` to recalculate pane widths — store `p.width`/`p.height`
9. [x] Preserve existing mouse support (bubblezone zones) — zone marks use original list indices

**Key references**:
- `ref/sidecar/internal/plugins/filebrowser/view.go:27-55` — calculatePaneWidths (treeWidth)
- `ref/sidecar/internal/plugins/filebrowser/view.go:58-275` — renderNormalPanes two-pane assembly
- Current `plugin_files.go:203-215` — manual join to replace

**Verification**:
```bash
cd cmd/prism-cli && go build ./...
cd cmd/prism-cli && go test ./... -v
# Manual: run TUI, navigate to Files, verify bordered 30/70 layout with line numbers
```

**Checkpoint**: ✅ Phase 5 complete — Files shows bordered two-pane with line numbers, search, scrollbar

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Sidecar styles package has deep Sidecar-specific dependencies | Medium | Medium | Port incrementally; start with the core functions (RenderPanel, RenderDivider) that have minimal deps; adapt import paths |
| Git plugin refactor breaks existing keybindings | Medium | Medium | Keep all existing key bindings working (s/u/c/enter/esc); add new ones (tab, v) without removing old ones |
| chroma dependency conflicts with existing go.mod | Low | High | Check `go.mod` for existing chroma or conflicting dependencies before adding |
| Gradient border rendering is slow on large terminals | Low | Low | Sidecar already runs this in production; profile if issues arise |
| Panel overhead math errors cause layout overflow | Medium | Medium | Use Sidecar's exact constants (panelOverhead=4, innerHeight=height-2); test at multiple terminal sizes |
| Workspaces data model (Projects/Epics) doesn't map cleanly to two-pane preview | Medium | Low | Preview pane is informational only; any project data can be shown without backend changes |

## Edge Cases

| Case | Handling |
|------|----------|
| Terminal width < 80 columns | `CalculatePaneWidths` min bounds prevent negative widths; degrade to single-column if width < 65 |
| Empty git repo (no files, no commits) | Show "Working tree clean" in sidebar, "No diff content" in diff pane |
| Binary file selected for diff | diff.ParsedDiff.Binary flag → show "Binary file differs" message |
| Very long file paths | Truncate with `…` prefix (show end of path) as Sidecar does |
| No chroma lexer for file type | SyntaxHighlighter returns nil → fall back to plain diff coloring |
| Sidebar hidden (collapsed) | Show full-width diff/preview with RenderPanel(..., true) |

## Rollback Plan

Each phase is independently useful and each plugin retains its existing interface. If issues arise:

```bash
git revert HEAD~N..HEAD  # Revert commits from problematic phase
cd cmd/prism-cli && make build && make test  # Verify rollback
```

Phases can also be deployed independently:
- Phase 1 (shared utils) has zero risk — only adds new files
- Phase 2 (diff package) has zero risk — only adds new files
- Phases 3-5 each modify one plugin file — reverting one doesn't affect others

## Dependencies

**Must complete first**:
- [ ] Phase 1 (shared layout) must complete before Phases 3, 4, 5
- [ ] Phase 2 (diff package) must complete before Phase 3 (Git plugin)

**Can parallelize**:
- [ ] Phase 4 (Workspaces) and Phase 5 (Files) are independent of each other
- [ ] Both can start once Phase 1 is complete

## Progress Log

| Phase | Status | Started | Completed | Notes |
|-------|--------|---------|-----------|-------|
| Phase 1: Shared Layout Foundation | ✅ Complete | 2026-02-17 | 2026-02-18 | All 21 tests pass, `go build ./...` clean |
| Phase 2: Diff Parser & Renderer | ✅ Complete | 2026-02-18 | 2026-02-18 | 34 tests pass, chroma v2.23.1 added |
| Phase 3: Git Plugin Refactor | ✅ Complete | 2026-02-18 | 2026-02-18 | Build clean, all tests pass; two-pane layout with sidebar+diff, tab switching, v toggle, commit history |
| Phase 4: Workspaces Plugin Upgrade | ✅ Complete | 2026-02-18 | 2026-02-18 | Build clean, all tests pass; two-pane 40/60 layout with project list + tabbed preview (Info/Stories/Progress), tab switching, [/] tab cycling, progress bars |
| Phase 5: Files Plugin Upgrade | ✅ Complete | 2026-02-18 | 2026-02-18 | Build clean, all tests pass; 30/70 two-pane with bordered panels, line numbers, scrollbar, tab focus switching, / search mode |

---

## Session Notes

[Space for implementation notes, discoveries, blockers]
