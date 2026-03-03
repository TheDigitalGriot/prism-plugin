---
title: Git Screen
description: Full-featured two-pane git integration with staging, commit, push/pull, branches, stash, conflict resolution, and commit detail inspection.
outline: [2, 3]
---

# Git Screen

A full-featured two-pane git integration view with staging, commit, push/pull, branch management, stash, discard, conflict resolution, and commit detail inspection.

## Features

| ID | Feature | Description |
|----|---------|-------------|
| G-1 | Push Menu | Push to remote with branch selection via modal (`P`) |
| G-2 | Pull Menu | Pull from remote with branch selection via modal (`L`) |
| G-3 | Branch Picker | Load and switch branches via modal (`b`) |
| G-4 | Stash Management | Stash push/pop/list/apply/drop via modal (`S`) |
| G-5 | Conflict Resolution | Detect UU/AA/DD/AU/UA/DU/UD conflict markers; display "Conflicts" section at top of sidebar with `!` icon; `s` stages conflict files as resolved |
| G-6 | File Watcher | Auto-refresh on EventBus `"file.changed"` events; sets `needsRefresh` flag |
| G-7 | Commit Detail | `Enter` on a commit in the sidebar loads its full diff in the right pane |
| G-8 | Discard Changes | `d` on modified/untracked file opens confirmation dialog, then runs `git checkout --` or `rm` |

## UI Layout

```
╭───────────── 30% ───────────────╮╭──────────────── 70% ──────────────────────╮
│ GIT                              ││ DIFF                                      │
│ ──────────────────────────────  ││ ──────────────────────────────────────    │
│  main ↑0 ↓0                    ││ diff --git a/model.go b/model.go          │
│                                  ││ @@ -25,6 +25,8 @@                         │
│ ── Conflicts (2) ───────────    ││  25  type Model struct {                   │
│   ! package.json                 ││  26    Width  int                          │
│   ! config.go                    ││+ 27    Height int                          │
│                                  ││+ 28    Ready  bool                         │
│ ── Staged ──────────────────    ││  29  }                                     │
│   ● model.go                    ││                                            │
│   ● view.go                     ││                                            │
│                                  ││                                            │
│ ── Modified ────────────────    ││                                            │
│   ● sidebar.go                  ││ [CONFLICT] package.json                    │
│   ● footer.go                   ││  (staged = mark as resolved)               │
│                                  ││                                            │
│ ── Untracked ───────────────    ││                                            │
│   ● README.md                   ││                                            │
│                                  ││                                            │
│ ── Recent Commits ──────────    ││                                            │
│   dff2646 minor TUI fixes       ││                                            │
│   66277bc continue sidecar...   ││                                            │
╰──────────────────────────────────╯╰──────────────────────────────────────────╯
```

Sidebar sections appear in order: Conflicts (if any), Staged, Modified, Untracked, Recent Commits. The diff pane shows unified or side-by-side diffs with syntax highlighting, word-level change detection, and dual-gutter line numbers.

## UI Layout — Commit Detail View

When `Enter` is pressed on a commit in the Recent Commits section, the right pane switches from diff to commit detail:

```
╭───────────── 30% ───────────────╮╭──────────────── 70% ──────────────────────╮
│ GIT                              ││ COMMIT DETAIL                             │
│ ──────────────────────────────  ││ ──────────────────────────────────────    │
│  main ↑0 ↓0                    ││ Commit: dff2646a3b1c9e7f2d8a4b6e         │
│                                  ││ Author: John Doe <john@example.com>      │
│ ── Staged ──────────────────    ││ Date:   2026-02-28 14:32:05              │
│   ● model.go                    ││                                            │
│                                  ││ minor TUI fixes                           │
│ ── Modified ────────────────    ││                                            │
│   ● sidebar.go                  ││ ── Changed Files ─────────────────────    │
│                                  ││  M model.go          +12 -4              │
│ ── Recent Commits ──────────    ││  M view.go            +3  -1              │
│ > dff2646 minor TUI fixes       ││  A sidebar_test.go    +45 -0              │
│   66277bc continue sidecar...   ││                                            │
╰──────────────────────────────────╯╰──────────────────────────────────────────╯
```

## UI Layout — Side-by-Side Diff

Toggled with `v` from the diff pane. The right pane splits into old (left) and new (right) columns:

```
╭───────────── 30% ───────────────╮╭──────────────── 70% ──────────────────────╮
│ GIT                              ││ model.go — SIDE BY SIDE                   │
│ ──────────────────────────────  ││ ──────────────────────────────────────    │
│  main ↑0 ↓0                    ││ OLD                  │ NEW                 │
│                                  ││ ─────────────────── │ ──────────────────  │
│ ── Staged ──────────────────    ││ 25  type Model st…  │ 25  type Model st…  │
│   ● model.go                    ││ 26    Width  int     │ 26    Width  int    │
│                                  ││                      │+27    Height int    │
│ ── Modified ────────────────    ││                      │+28    Ready  bool   │
│   ● sidebar.go                  ││ 27  }                │ 29  }               │
│                                  ││                      │                     │
│ ── Recent Commits ──────────    ││                      │                     │
│   dff2646 minor TUI fixes       ││                      │                     │
│   66277bc continue sidecar...   ││                      │                     │
╰──────────────────────────────────╯╰──────────────────────────────────────────╯
```

## UI Layout — Full-Width Diff (Sidebar Hidden)

When sidebar is toggled off, the diff pane uses the full terminal width:

```
╭──────────────────────────────────────────────────────────────────────────────╮
│ model.go                                                                     │
│ ──────────────────────────────────────────────────────────────────────────── │
│ diff --git a/model.go b/model.go                                            │
│ @@ -25,6 +25,8 @@                                                           │
│  25  type Model struct {                                                     │
│  26    Width  int                                                            │
│+ 27    Height int                                                            │
│+ 28    Ready  bool                                                           │
│  29  }                                                                       │
│                                                                              │
╰──────────────────────────────────────────────────────────────────────────────╯
```

## Key Bindings

**Sidebar (left pane):**

| Key | Action |
|-----|--------|
| `j` / `↓` | Move cursor down through files/commits |
| `k` / `↑` | Move cursor up through files/commits |
| `s` | Stage/unstage file (or mark conflict as resolved) |
| `c` | Open commit modal |
| `d` | Discard changes for file at cursor (G-8) |
| `P` | Open push modal (G-1) |
| `L` | Open pull modal (G-2) |
| `b` | Open branch picker (G-3) |
| `S` | Open stash menu (G-4) |
| `r` | Refresh git status + commits |
| `Enter` | Load diff for file, or view commit detail (G-7) |
| `Tab` | Switch to diff pane |
| `Esc` / `Backspace` | Focus Home (or exit commit detail view) |

**Diff Pane (right pane):**

| Key | Action |
|-----|--------|
| `j` / `↓` | Scroll diff down |
| `k` / `↑` | Scroll diff up |
| `v` | Toggle unified/side-by-side diff view |
| `Tab` / `Esc` | Switch back to sidebar |
