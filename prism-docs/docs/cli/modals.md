---
title: Modal & Dialog Systems
description: The layered modal and dialog overlay system — sections, focus cycling, command palette, confirmation dialogs, permission prompts, and all screen-specific modals.
outline: [2, 3]
---

# Modal & Dialog Systems

## Modal System

Modals are centered overlays with dimmed background. The compositing pipeline works row-by-row: rows within the modal's Y range use `compositeRow()` to insert modal content into a dimmed background; rows above/below are fully dimmed.

**Section types available:**
- `TextSection` — Static text, word-wrapped
- `SpacerSection` — Blank line
- `ButtonsSection` — Row of buttons (Normal/Primary/Danger variants)
- `InputSection` — Single-line text input
- `TextareaSection` — Multi-line text input
- `ListSection` — Scrollable selection list
- `CheckboxSection` — Toggleable checkbox
- `WhenSection` — Conditional section

**Modal variants:** Default (purple border), Danger (red), Warning (amber), Info (blue)

**Focus cycling:** Tab/Shift+Tab cycles through focusable elements using modular arithmetic.

## Command Palette

Activated with `Ctrl+P` or `:`. Provides fuzzy search across all plugin commands.

```
╭────────────────────── Command Palette ──────────────────────╮
│  [Search: sp                                               ]│
│                                                              │
│  > [Spectrum] Focus — Open Spectrum dashboard               │
│    [Spectrum] Start — Begin story execution                  │
│    [Spectrum] Stop — Stop execution                          │
│    [Spectrum] Next Story — Go to next story page             │
│    [Spectrum] Switch Epic — Switch to next epic              │
│                                                              │
│  ↑/↓ navigate • enter execute • esc close                   │
╰──────────────────────────────────────────────────────────────╯
```

## Dialog System

Dialogs are layered above modals in z-order. Two dialog types:

**Confirmation Dialog:**
- Two buttons: Confirm + Cancel
- Quick keys: `y` for confirm, `n` for cancel
- Variant-colored border

**Permission Dialog:**
- Three buttons: Allow + Allow Session + Deny
- Scrollable preview area (max 8 lines)
- Quick keys: `a` for allow, `s` for allow session, `d`/`n` for deny
- Amber border with "Permission Required" title

### Confirmation Dialog Layout

```
╭────────────────── Confirm ──────────────────╮
│                                              │
│  Are you sure you want to proceed?           │
│                                              │
│           [ Confirm ]  [ Cancel ]            │
│                                              │
│  y confirm • n cancel                        │
╰──────────────────────────────────────────────╯
```

Variant-colored border: Default (purple `#7C3AED`), Danger (red `#EF4444`), Warning (amber `#F59E0B`), Info (blue `#3B82F6`).

### Permission Dialog Layout

```
╭──────────────── Permission Required ────────────────╮
│                                                      │
│  Tool: Bash                                          │
│  Command: npm run typecheck                          │
│                                                      │
│  ┌────────────────────────────────────────────┐      │
│  │ $ npm run typecheck                        │      │
│  │                                            │      │
│  │ (scrollable preview — max 8 lines)         │      │
│  └────────────────────────────────────────────┘      │
│                                                      │
│  [ Allow ]  [ Allow Session ]  [ Deny ]              │
│                                                      │
│  a allow • s session • d deny                        │
╰──────────────────────────────────────────────────────╯
```

Amber border (`#F59E0B`). Preview area scrolls with `↑`/`k` when content exceeds 8 lines.

## Global Overlays

### File Finder (`Ctrl+D`)

Source: `file_finder.go:127-150` — `BuildModal()`, width 70.

```
╭───────────────────────── Find File ─────────────────────────╮
│  [Type to search files...: mod                             ]│
│                                                              │
│  > cmd/prism-cli/app/model.go                               │
│    cmd/prism-cli/app/model_test.go                          │
│    cmd/prism-cli/modal/modal.go                             │
│    go.mod                                                    │
│                                                              │
│  ↑/↓ navigate • enter open • esc close                      │
╰──────────────────────────────────────────────────────────────╯
```

File cache built asynchronously via `git ls-files` (or `filepath.Walk` fallback). Fuzzy scoring: +10 per character match, +5 consecutive, +8 separator boundary, +6 camelCase, +15 filename start, -2 per gap.

### Content Search (`Ctrl+S`)

Source: `content_search.go:152-188` — `BuildModal()`, width 80.

```
╭─────────────────────── Content Search ───────────────────────────╮
│  [Search content...: handleSubmit                               ]│
│                                                                   │
│  > src/components/Form.tsx:42  const handleSubmit = async () =>  │
│    src/utils/validation.ts:15  export function handleSubmit...   │
│    src/hooks/useForm.ts:28     return { handleSubmit, errors }   │
│    tests/form.test.ts:55       test("handleSubmit validates...   │
│                                                                   │
│  ↑/↓ navigate • enter open • esc close                           │
╰──────────────────────────────────────────────────────────────────╯
```

Powered by ripgrep (`rg --json --max-count 30`). If `rg` is not installed, displays install instructions instead of search results.

### Help Modal (`?`)

```
╭──────────────────────────── Help ────────────────────────────╮
│                                                               │
│  GLOBAL KEYS                                                  │
│  ──────────────────────────────────────────                  │
│  q / Ctrl+C     Quit application                             │
│  Ctrl+P / :     Command palette                              │
│  Ctrl+D         File finder                                  │
│  Ctrl+S         Content search                               │
│  ?              Toggle this help                             │
│  1-9            Switch to tab                                │
│  Tab            Next tab                                      │
│                                                               │
│  CURRENT SCREEN                                               │
│  ──────────────────────────────────────────                  │
│  (context-specific keys shown here)                          │
│                                                               │
│  esc close                                                    │
╰───────────────────────────────────────────────────────────────╯
```

Content is scrollable when key list exceeds available height. Shows both global and context-specific keys for the currently active screen.

## Git Screen Modals

### Commit Modal (`c`)

Source: `plugin_git.go:1053-1065` — `openCommitModal()`, width 60.

```
╭────────────────── Commit Changes ──────────────────╮
│                                                      │
│  Enter commit message:                               │
│                                                      │
│  ┌────────────────────────────────────────────┐      │
│  │ fix: resolve auth timeout on retry         │      │
│  │                                            │      │
│  │ Increased timeout from 5s to 30s for       │      │
│  │ OAuth token refresh.                       │      │
│  │                                            │      │
│  └────────────────────────────────────────────┘      │
│                                                      │
│         [ Commit ]  [ Cancel ]                       │
│                                                      │
│  tab cycle • enter confirm • esc cancel              │
╰──────────────────────────────────────────────────────╯
```

### Push Modal (`P`)

Source: `plugin_git.go:1069-1087` — `openPushModal()`, width 50.

```
╭──────────────────── Push ────────────────────╮
│                                               │
│  Branch: main (2 ahead)                       │
│                                               │
│  [ Push ]  [ Force Push ]  [ Set Upstream ]   │
│  [ Cancel ]                                   │
│                                               │
│  tab cycle • enter select • esc cancel        │
╰───────────────────────────────────────────────╯
```

"Force Push" button uses Danger variant (red text).

### Pull / Fetch Modal (`L`)

Source: `plugin_git.go:1090-1107` — `openPullModal()`, width 50.

```
╭──────────────── Pull / Fetch ────────────────╮
│                                               │
│  Branch: main (1 behind)                      │
│                                               │
│  [ Fetch ]  [ Pull ]  [ Pull (rebase) ]       │
│  [ Cancel ]                                   │
│                                               │
│  tab cycle • enter select • esc cancel        │
╰───────────────────────────────────────────────╯
```

"Pull" button uses Primary variant (highlighted).

### Branch Picker Modal (`b`)

Source: `plugin_git.go:1111-1133` — `openBranchPickerModal()`, width 60, max 10 visible.

```
╭──────────────── Switch Branch ───────────────────╮
│                                                    │
│  Select a branch to checkout:                      │
│                                                    │
│  * main                                            │
│    feature/auth-flow                               │
│    feature/dark-mode                               │
│    fix/timeout-issue                               │
│    develop                                         │
│    staging                                         │
│                                                    │
│        [ Checkout ]  [ Cancel ]                    │
│                                                    │
│  j/k navigate • enter select • esc cancel          │
╰────────────────────────────────────────────────────╯
```

Current branch marked with `*`. List scrolls when more than 10 branches.

### Stash Menu Modal (`S`)

Source: `plugin_git.go:1298-1311` — `openStashMenuModal()`, width 50.

```
╭──────────────────── Stash ───────────────────╮
│                                               │
│  Save or manage stashes:                      │
│                                               │
│  [ Stash ]  [ Stash (+untracked) ]            │
│  [ View Stashes ]  [ Cancel ]                 │
│                                               │
│  tab cycle • enter select • esc cancel        │
╰───────────────────────────────────────────────╯
```

"Stash" button uses Primary variant. "View Stashes" loads the stash list asynchronously before opening the Stash List modal.

### Stash List Modal

Source: `plugin_git.go:1350-1373` — `openStashListModal()`, width 70, max 8 visible.

```
╭─────────────────────── Stash List ────────────────────────╮
│                                                            │
│  Select a stash and choose an action:                      │
│                                                            │
│  > stash@{0} (main): WIP on auth refactor                 │
│    stash@{1} (develop): save before rebase                 │
│    stash@{2} (main): experiment with caching               │
│                                                            │
│  [ Apply ]  [ Pop ]  [ Drop ]  [ Cancel ]                  │
│                                                            │
│  j/k navigate • enter select • esc cancel                  │
╰────────────────────────────────────────────────────────────╯
```

"Apply" button Primary, "Drop" button Danger. List scrolls at 8+ stashes.

### Stash Drop Confirm

Source: `plugin_git.go:1376-1388` — `openStashDropConfirmModal()`, width 55, Danger variant.

```
╭──────────────────── Drop Stash ──────────────────╮  [red border]
│                                                    │
│  Are you sure you want to drop stash@{0}?          │
│                                                    │
│  WIP on auth refactor                              │
│                                                    │
│  This action cannot be undone.                     │
│                                                    │
│           [ Drop ]  [ Cancel ]                     │
│                                                    │
╰────────────────────────────────────────────────────╯
```

Red border (`#EF4444`). "Drop" button Danger variant.

### Discard Changes Dialog (`d`)

Source: `plugin_git.go:1443-1458` — `openDiscardConfirmModal()`, width 55, Danger variant.

```
╭──────────────── Discard Changes ─────────────────╮  [red border]
│                                                    │
│  Are you sure you want to discard changes to:      │
│                                                    │
│    model.go                                        │
│                                                    │
│  This action cannot be undone.                     │
│                                                    │
│          [ Discard ]  [ Cancel ]                   │
│                                                    │
╰────────────────────────────────────────────────────╯
```

For untracked files, text reads "delete untracked file" instead of "discard changes to".

### Git Error Modal

Source: `plugin_git.go:1136-1145` — `openErrorModal()`, width 60, Danger variant.

```
╭──────────────────── Git Error ───────────────────╮  [red border]
│                                                    │
│  fatal: Could not read from remote repository.     │
│                                                    │
│  Please make sure you have the correct access      │
│  rights and the repository exists.                 │
│                                                    │
│                    [ OK ]                           │
│                                                    │
╰────────────────────────────────────────────────────╯
```

## Workspaces Modals

### Create Worktree Modal (`n`)

Source: `plugin_workspaces.go:1848-1863` — `openCreateWorktreeModal()`, width 60.

```
╭──────────────── Create Worktree ─────────────────╮
│                                                    │
│  Create a new git worktree with a new branch.      │
│                                                    │
│  Branch name:                                      │
│  ┌──────────────────────────────────────────┐      │
│  │ feature/my-branch                        │      │
│  └──────────────────────────────────────────┘      │
│                                                    │
│          [ Create ]  [ Cancel ]                    │
│                                                    │
│  enter submit • tab cycle • esc cancel             │
╰────────────────────────────────────────────────────╯
```

Input field has purple border (`#7C3AED`). Enter in the input field triggers create directly.

### Delete Worktree Dialog (`d`)

Source: `plugin_workspaces.go:1866-1885` — `openDeleteWorktreeConfirm()`, width 60, Danger variant.

```
╭──────────────── Delete Worktree? ────────────────╮  [red border]
│                                                    │
│  This will remove the worktree at:                 │
│  ~/Developer/prism-plugin-fix                      │
│  Branch: fix/auth-bug                              │
│                                                    │
│  This action cannot be undone.                     │
│                                                    │
│          [ Delete ]  [ Cancel ]                    │
│                                                    │
╰────────────────────────────────────────────────────╯
```

Cannot delete the main worktree — the `d` key is ignored when the main worktree is selected.

### Workspaces Error Modal

Source: `plugin_workspaces.go:1888-1896` — `openErrorModal()`, width 50, Danger variant.

```
╭──────────────────── Error ───────────────────╮  [red border]
│                                               │
│  Failed to create worktree: branch already    │
│  exists.                                      │
│                                               │
│                  [ OK ]                       │
│                                               │
╰───────────────────────────────────────────────╯
```

## Monitor Modals

### Gate Output Modal (`o`)

Source: `plugin_monitor.go:840-878` — `openGateOutputModal()`, width 80. Variant: Info (blue) for pass, Danger (red) for fail.

```
╭─────────────────── Gate Output: npm test ────────────────────────╮
│                                                                   │
│  npm test — PASS                                                  │
│  Command: npm test                                                │
│  Last run: 45s ago                                                │
│                                                                   │
│  > prism@2.3.0 test                                               │
│  > jest --coverage                                                │
│                                                                   │
│  PASS  src/utils/validation.test.ts                               │
│  PASS  src/components/Form.test.tsx                               │
│  PASS  src/hooks/useAuth.test.ts                                  │
│                                                                   │
│  Test Suites: 3 passed, 3 total                                   │
│  Tests:       12 passed, 12 total                                 │
│  Coverage:    87.3%                                               │
│                                                                   │
│                         [ Close ]                                 │
│                                                                   │
╰───────────────────────────────────────────────────────────────────╯
```

Output is scrollable when it exceeds the modal height. If no output was captured, shows "(no output captured)".

### History Detail Modal (`Enter` on history entry)

Source: `plugin_monitor.go:881-910` — `openHistoryDetailModal()`. Variant: Info (blue) for success, Danger (red) for error, Warning (amber) for blocked.

```
╭────────────────── Execution Detail ──────────────────╮
│                                                       │
│  Story:     STORY-004                                 │
│  Name:      Build login page                         │
│  Result:    SUCCESS                                   │
│  Duration:  18.245s                                   │
│  Timestamp: 2026-02-28 14:32:05                       │
│                                                       │
│                    [ Close ]                          │
│                                                       │
╰───────────────────────────────────────────────────────╯
```

## Spectrum Permission Dialog

During Spectrum execution, when Claude requests tool use and `--dangerously-skip-permissions` is not set:

```
╭────────────── Permission Required ──────────────╮  [amber border]
│                                                   │
│  Tool: Bash                                       │
│  Command: npm run test                            │
│                                                   │
│  ┌─────────────────────────────────────────┐      │
│  │ $ npm run test                          │      │
│  │                                         │      │
│  │ (scrollable — ↑/k to scroll)            │      │
│  └─────────────────────────────────────────┘      │
│                                                   │
│  [ Allow ]  [ Allow Session ]  [ Deny ]           │
│                                                   │
│  a allow • s session • d deny                     │
╰───────────────────────────────────────────────────╯
```

Rendered via the Dialog system (`dialog/permissions.go`), layered above any active modal. Preview area scrolls when content exceeds 8 lines.
