---
title: Keyboard Reference
description: Complete keyboard reference — global keys, input priority chain, and per-screen key bindings.
outline: [2, 3]
---

# Keyboard Reference

## Global Keys (All Screens)

| Key | Action |
|-----|--------|
| `q` / `Ctrl+C` | Quit application |
| `?` | Toggle help modal |
| `Ctrl+P` / `:` | Open command palette |
| `Ctrl+D` | Open fuzzy file finder overlay (F-4) |
| `Ctrl+S` | Open content search overlay (F-5) |
| `1`–`9` | Switch to tab N |
| `Tab` | Next tab (unless Spectrum has multiple epics) |
| `Shift+Tab` | Previous tab (unless Spectrum has multiple epics) |

## Input Priority Chain

When a key is pressed, it is processed in this strict order:

1. **Splash skip** — Any key during splash ends it immediately
2. **Onboarding passthrough** — All keys go to onboarding plugin
3. **Quit** — `q` / `Ctrl+C` always quit
4. **Dialog** — If a dialog is open, keys route to dialog
5. **Modal** — If a modal is open, keys route to modal
6. **Global keys** — Help, command palette, file finder, content search, tab switching
7. **Active plugin** — Remaining keys delegated to the focused plugin

## Home Screen

| Key | Action |
|-----|--------|
| `j` / `↓` | Next menu item (wraps) |
| `k` / `↑` | Previous menu item (wraps) |
| `Enter` / `Space` | Navigate to selected screen |
| `1`–`3` | Jump to Research / Plans / Spectrum |

## Research / Plans — List Mode

| Key | Action |
|-----|--------|
| `j` / `↓` | Next file |
| `k` / `↑` | Previous file |
| `Enter` | Open file in viewport |
| `d` | **Plans only**: Decompose plan to epic |
| `Esc` / `Backspace` | Return to Home |

## Research / Plans — Viewer Mode

| Key | Action |
|-----|--------|
| `Esc` / `Backspace` | Close viewer, return to list |
| `j` / `k` / `↑` / `↓` | Scroll content |
| `PgUp` / `PgDn` | Page scroll |

## Spectrum Dashboard

| Key | State | Action |
|-----|-------|--------|
| `Enter` / `Space` | Idle | Start execution |
| `Space` | Running | Pause |
| `/` | Running | Skip current story |
| `Enter` / `Space` | Paused | Resume |
| `a` / `s` | Any | Stories page prev/next |
| `z` / `x` | Any | Logs page prev/next |
| `Tab` / `Shift+Tab` | Multi-epic | Switch epic |
| `Enter` / `Space` | Terminal state | Quit |

## Files Screen

| Key | Pane | Action |
|-----|------|--------|
| `j` / `k` | Tree | Navigate files |
| `Enter` / `Space` | Tree | Toggle expand / open in tab |
| `x` | Tree/Preview | Close active tab |
| `/` | Tree | Enter filter mode |
| `Ctrl+D` | Any | Open fuzzy file finder (F-4) |
| `Ctrl+S` | Any (not editing) | Open content search (F-5) |
| `Tab` | Any | Toggle tree/preview pane |
| `j` / `k` | Preview | Scroll content |
| `h` / `l` | Preview | Previous / next tab |
| `b` | Preview | Toggle git blame annotations |
| `e` | Preview | Enter edit mode |
| `Ctrl+S` | Edit mode | Save file |
| `Esc` | Edit mode | Cancel edit |
| `Esc` | Tree | Focus Home |
| `Esc` | Preview | Focus tree pane |

## Git Screen

| Key | Pane | Action |
|-----|------|--------|
| `Tab` | Any | Toggle sidebar/diff pane |
| `s` | Sidebar | Stage/unstage file (or resolve conflict) |
| `c` | Any | Open commit modal |
| `d` | Sidebar | Discard changes (G-8) |
| `P` | Any | Push modal (G-1) |
| `L` | Any | Pull modal (G-2) |
| `b` | Any | Branch picker (G-3) |
| `S` | Any | Stash menu (G-4) |
| `r` | Any | Refresh status + commits |
| `v` | Diff | Toggle unified/side-by-side |
| `j` / `k` | Both | Navigate / scroll |
| `Enter` | Sidebar | Load diff for file, or commit detail (G-7) |
| `Esc` | Sidebar | Focus Home (or exit commit detail) |
| `Esc` | Diff | Focus sidebar |

## Agent Screen

| Key | Action |
|-----|--------|
| `Ctrl+B` | Toggle wide/compact mode |
| `Ctrl+Enter` | Send message |
| `j` / `k` | Navigate conversations (sidebar) or scroll messages (chat) |
| `Enter` | Load selected conversation |
| `Esc` | Focus Home |

## Monitor Screen

| Key | Panel | Action |
|-----|-------|--------|
| `Tab` | Any | Cycle focus: Health → History → Gates |
| `Shift+Tab` | Any | Cycle focus backward |
| `r` | Any | Manual refresh |
| `R` | Gates | Run all quality gates (M-2) |
| `j` / `k` | History/Gates | Navigate entries (wraps) |
| `Enter` | History | Open detail modal (M-4) |
| `Enter` | Gates | Run selected gate (M-2) |
| `o` | Gates | View gate output (M-3) |
| `Esc` | Any | Focus Home |

## Browser Screen

| Key | Panel | Action |
|-----|-------|--------|
| `Tab` | Any | Cycle focus: Sessions → History → Artifacts |
| `Shift+Tab` | Any | Cycle focus backward |
| `j` / `k` | Any | Navigate items within panel |
| `Enter` | Sessions | View session details |
| `Enter` | History | View verification details |
| `Enter` | Artifacts | Open artifact preview |
| `r` | Any | Refresh panels |
| `Esc` | Any | Focus Home |

## Workspaces Screen

| Key | Mode | Action |
|-----|------|--------|
| `j` / `k` | Projects/Epics/Worktrees | Navigate items |
| `Enter` | Projects | Enter epics view |
| `Enter` | Epics | Switch to selected epic |
| `Enter` | Worktrees | Switch to worktree directory |
| `w` | Any sidebar | Toggle to projects view |
| `v` | List/Kanban | Toggle worktrees list ↔ kanban board |
| `n` | Worktrees | Create new worktree (W-2) |
| `d` | Worktrees | Delete selected worktree (W-3) |
| `h` / `l` | Kanban | Navigate columns |
| `j` / `k` | Kanban | Navigate cards within column |
| `Enter` | Kanban | Select card, show detail |
| `[` / `]` | Preview | Switch tabs (Info/Stories/Progress) |
| `j` / `k` | Preview | Scroll content |
| `Tab` | Any | Toggle sidebar/preview |
| `r` | Sidebar | Rescan / refresh |
| `Esc` | Projects | Focus Home |
| `Esc` | Epics | Return to projects |
