---
title: Workspaces Screen
description: Multi-project workspace manager with Projects, Worktrees, and Kanban view modes.
outline: [2, 3]
---

# Workspaces Screen

A multi-project workspace manager with three view modes: **Projects** (`.prism/` scanning), **Worktrees** (git worktree management), and **Kanban** (agent status board). Two-pane layout with tabbed preview (Info/Stories/Progress).

## Features

| ID | Feature | Description |
|----|---------|-------------|
| W-1 | Worktree List | `w` toggles to worktree view showing `git worktree list --porcelain` output with path, branch, HEAD hash, bare/main/prunable flags |
| W-2 | Create Worktree | `n` in worktree view opens modal to create a new worktree (branch name + path input) |
| W-3 | Delete Worktree | `d` in worktree view opens confirmation dialog; cannot delete main worktree; optional branch deletion |
| W-4 | Kanban Board | `v` toggles to kanban view showing worktrees grouped by agent status in 5 vertical columns (Active, Thinking, Waiting, Done, Paused). Subscribes to EventBus `"agent.status"` events |

## UI Layout — Projects View

```
╭───────────── 40% ───────────────╮╭──────────────── 60% ──────────────────────╮
│ WORKSPACES                       ││  [Info]  Stories  Progress                 │
│ ──────────────────────────────  ││ ──────────────────────────────────────    │
│ ● prism-plugin                  ││ Project: prism-plugin                      │
│   main ↑0 ↓0                    ││ Path: ~/Developer/prism-plugin             │
│                                  ││ Branch: main                               │
│ ○ sidecar                       ││                                            │
│   feat/new-feature               ││ Progress: ████████████░░░░  67%           │
│                                  ││                                            │
│ ○ client-app                    ││ Epics: 3                                   │
│   main                           ││   user-auth (8/12)                         │
│                                  ││   dashboard (12/36)                        │
│                                  ││   notifications (0/9)                      │
╰──────────────────────────────────╯╰──────────────────────────────────────────╯
```

## UI Layout — Worktrees View

```
╭───────────── 40% ───────────────╮╭──────────────── 60% ──────────────────────╮
│ WORKTREES                        ││ Worktree Detail                            │
│ ──────────────────────────────  ││ ──────────────────────────────────────    │
│ > ~/Developer/prism-plugin       ││ Path: ~/Developer/prism-plugin             │
│   main [main]                    ││ Branch: main                               │
│                                  ││ HEAD: d6b2723                              │
│   ~/Developer/prism-plugin-fix   ││ Type: Main worktree                        │
│   fix/auth-bug                   ││                                            │
│                                  ││                                            │
│   ~/Developer/prism-plugin-feat  ││                                            │
│   feat/kanban                    ││                                            │
╰──────────────────────────────────╯╰──────────────────────────────────────────╯
```

## UI Layout — Kanban Board View

```
╭────────────────────────────────────────────────────────────────────────────╮
│ KANBAN                                                                      │
│ ────────────────────────────────────────────────────────────────────────── │
│                                                                              │
│ ── Active ─────────  ── Thinking ──────  ── Waiting ───────               │
│ ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │
│ │ ● feat/kanban    │  │ ◉ fix/auth-bug  │  │ ○ feat/ui-theme │             │
│ │   implement      │  │   research      │  │   (no agent)    │             │
│ └─────────────────┘  └─────────────────┘  └─────────────────┘             │
│                                                                              │
│ ── Done ───────────  ── Paused ────────                                   │
│ ┌─────────────────┐  (empty)                                               │
│ │ ✓ fix/css-bug    │                                                        │
│ │   validate       │                                                        │
│ └─────────────────┘                                                        │
╰────────────────────────────────────────────────────────────────────────────╯
```

Cards show status icon (● active, ◉ thinking, ○ waiting, ✓ done, ⏸ paused), branch name, and agent type. Columns are rendered vertically with h/l navigation between columns and j/k within.

## Key Bindings

**Projects View** (left pane):

| Key | Action |
|-----|--------|
| `j`/`k` | Navigate projects |
| `Enter` | Enter epics view (if project has epics) |
| `w` | Switch to worktrees view (W-1) |
| `Tab` | Switch to preview pane |
| `r` | Rescan projects |
| `Esc` | Focus Home |

**Epics View** (left pane, within a project):

| Key | Action |
|-----|--------|
| `j`/`k` | Navigate epics |
| `Enter` | Switch to selected epic |
| `Tab` | Switch to preview pane |
| `Esc` | Return to projects view |

**Worktrees View** (left pane):

| Key | Action |
|-----|--------|
| `j`/`k` | Navigate worktrees |
| `n` | Create new worktree (W-2) |
| `d` | Delete selected worktree (W-3) |
| `Enter` | Switch to worktree directory |
| `v` | Switch to kanban view (W-4) |
| `w` | Switch to projects view |
| `Tab` | Switch to preview pane |
| `r` | Refresh worktree list |
| `Esc` | Focus Home |

**Kanban View:**

| Key | Action |
|-----|--------|
| `h` / `←` | Move to previous column |
| `l` / `→` | Move to next column |
| `j` / `↓` | Move down within column |
| `k` / `↑` | Move up within column |
| `Enter` | Select card, show detail in preview pane |
| `v` | Switch to list (worktrees) view |
| `w` | Switch to projects view |

**Preview Pane** (right):

| Key | Action |
|-----|--------|
| `[` / `]` | Switch tabs (Info/Stories/Progress) |
| `j`/`k` | Scroll content |
| `Tab` | Toggle sidebar/preview focus |
| `Esc` | Return to sidebar |

Scans parent directory siblings for `.prism/` directories to discover projects.
