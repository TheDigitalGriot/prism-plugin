---
title: Files Screen
description: Two-pane file tree browser with syntax highlighting, git status badges, multi-tab support, fuzzy search, inline editing, and git blame.
outline: [2, 3]
---

# Files Screen

A two-pane file tree browser with preview. Left pane shows an expandable directory tree with git status badges; right pane shows file content with line numbers, syntax highlighting, multi-tab support, inline editing, and git blame annotations.

## Features

- **Syntax highlighting** (F-1): Chroma-based highlighting for 100+ languages
- **Git status badges** (F-2): Modified (M/yellow), Added (A/green), Deleted (D/red), Untracked (?/gray) indicators on tree items
- **Multi-tab support** (F-3): Open multiple files in tabs, switch with `h`/`l`, close with `x`, max 10 tabs
- **Fuzzy file finder** (F-4): `Ctrl+D` opens a project-wide fuzzy file search overlay. File cache built asynchronously via `git ls-files` (or `filepath.Walk` fallback). Scoring: +10 per character match, +5 consecutive bonus, +8 separator boundary, +6 camelCase boundary, +15 filename start, -2 per gap. Shorter paths preferred as tiebreaker
- **Content search** (F-5): `Ctrl+S` opens a ripgrep-powered project-wide content search (`rg --json --max-count 30`). Results show file:line:text with navigation. Displays install instructions if `rg` binary not found
- **Inline file editing** (F-6): `e` opens a full textarea editor, `Ctrl+S` saves, `Esc` cancels
- **Git blame view** (F-7): `b` toggles blame annotations (short hash, author, relative age) alongside code

## UI Layout

```
╭───────────── 30% ───────────────╮╭──────────────── 70% ──────────────────────╮
│ FILES                            ││ [main.go] [view.go] [model.go]            │
│ ──────────────────────────────  ││ main.go [go]                              │
│ ▼ prism-plugin/                 ││ ──────────────────────────────────────    │
│   ▼ cmd/                        ││   1 │ package main                        │
│     ▼ prism-cli/                ││   2 │                                      │
│       ▶ app/                    ││   3 │ import (                             │
│       ▶ claude/                 ││   4 │   "fmt"                              │
│     > README.md             M   ││   5 │   "os"                               │
│   ▶ .prism/                     ││   6 │ )                                    │
│   > go.mod                  M   ││                                            │
│                                  ││                                            │
│                        ▐ (scroll)││                                            │
╰──────────────────────────────────╯╰──────────────────────────────────────────╯

Blame mode (`b` in preview pane):
╭──────────────── 70% ──────────────────────────────────────╮
│ abcdef12 JohnDoe   3d │    1 │ package main               │
│ abcdef12 JohnDoe   3d │    2 │                             │
│ 1234abcd Alice     2mo │    3 │ import (                    │
│ 1234abcd Alice     2mo │    4 │   "fmt"                     │
╰───────────────────────────────────────────────────────────╯
```

## UI Layout — Filter Mode

Activated with `/` in the tree pane. The tree header is replaced with a search input and the tree is filtered to matching files:

```
╭───────────── 30% ───────────────╮╭──────────────── 70% ──────────────────────╮
│ [Filter: mod                   ]││ [main.go] [view.go] [model.go]            │
│ ──────────────────────────────  ││ model.go [go]                             │
│   > model.go                M   ││ ──────────────────────────────────────    │
│   > go.mod                  M   ││   1 │ package main                        │
│                                  ││   2 │                                      │
│                                  ││   3 │ type Model struct {                 │
│                                  ││   4 │   Width  int                        │
│                                  ││   5 │   Height int                        │
│                                  ││   6 │ }                                   │
│                                  ││                                            │
╰──────────────────────────────────╯╰──────────────────────────────────────────╯
```

Footer hints change to: `esc cancel search • enter apply filter`

## UI Layout — Edit Mode

Activated with `e` in the preview pane. The preview content is replaced with an editable textarea:

```
╭───────────── 30% ───────────────╮╭──────────────── 70% ──────────────────────╮
│ FILES                            ││ [main.go] [view.go] [model.go]            │
│ ──────────────────────────────  ││ model.go [go] — EDITING                   │
│ ▼ prism-plugin/                 ││ ──────────────────────────────────────    │
│   ▼ cmd/                        ││ package main                              │
│     ▼ prism-cli/                ││                                            │
│       ▶ app/                    ││ type Model struct {                        │
│       ▶ claude/                 ││   Width  int                               │
│     > README.md             M   ││   Height int█                              │
│   ▶ .prism/                     ││   Ready  bool                              │
│   > go.mod                  M   ││ }                                          │
│                                  ││                                            │
╰──────────────────────────────────╯╰──────────────────────────────────────────╯
  ctrl+s save • esc cancel edit
```

The tree pane is dimmed (inactive border). Cursor (`█`) visible in textarea. Tab bar remains at top of preview pane.

## Key Bindings

**Tree Pane (left):**

| Key | Action |
|-----|--------|
| `j` / `↓` | Move cursor down, load preview |
| `k` / `↑` | Move cursor up, load preview |
| `Enter` / `Space` | Toggle directory expand/collapse, or open in tab |
| `x` | Close active tab |
| `/` | Enter filter mode (filename search) |
| `Tab` | Switch to preview pane |
| `Esc` / `Backspace` | Focus Home |

**Preview Pane (right):**

| Key | Action |
|-----|--------|
| `j` / `↓` | Scroll preview down |
| `k` / `↑` | Scroll preview up |
| `h` / `←` | Previous tab |
| `l` / `→` | Next tab |
| `b` | Toggle git blame annotations |
| `e` | Enter edit mode |
| `x` | Close active tab |
| `Esc` | Switch back to tree pane |

**Edit Mode** (`e` from preview pane):

| Key | Action |
|-----|--------|
| `Ctrl+S` | Save file to disk |
| `Esc` | Cancel editing, discard changes |

**Filter Mode:** Captures all keystrokes for search query. `Esc` cancels, `Enter` applies, `Backspace` deletes.

**Global overlays (from Files Screen):**

| Key | Action |
|-----|--------|
| `Ctrl+D` | Open fuzzy file finder overlay (F-4) |
| `Ctrl+S` | Open content search overlay (F-5) |
