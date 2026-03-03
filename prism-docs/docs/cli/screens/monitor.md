---
title: Monitor Screen
description: Three-panel system health dashboard with quality gate execution, execution history, and agent health tracking.
outline: [2, 3]
---

# Monitor Screen

Three-panel system health dashboard with multi-panel focus navigation, quality gate execution, output inspection, execution history detail, and agent health tracking.

## Features

| ID | Feature | Description |
|----|---------|-------------|
| M-1 | Multi-Panel Focus | `Tab`/`Shift+Tab` cycles focus: Health → History → Gates → Health. Focused panel gets purple highlight border. `j`/`k` navigate within focused panel |
| M-2 | Quality Gate Execution | `Enter` runs selected gate; `R` runs all gates. Gate status: pass/fail/pending/running/unknown |
| M-3 | Gate Output Modal | `o` opens modal showing full command output for selected gate |
| M-4 | History Detail Modal | `Enter` on a history entry opens a detail modal with story info, duration, result, and timestamp |
| M-5 | Agent Health | Subscribes to EventBus `"agent.status"` events. Shows active agents in health panel with status icons (● active, ◉ thinking, ○ waiting, ⏸ paused), agent type, and worktree basename |

## UI Layout

```
╭──────── 1/3 ────────╮╭──────── 1/3 ─────────╮╭──────── 1/3 ────────────────╮
│ SYSTEM HEALTH        ││ EXECUTION HISTORY     ││ QUALITY GATES               │
│ ────────────────    ││ ──────────────────    ││ ───────────────────────    │
│                      ││                       ││                             │
│ Goroutines: 12       ││ ✓ STORY-001  15s  2m ││ ● Lint       pass           │
│ Memory: 24MB / 48MB  ││ ✓ STORY-002  22s  5m ││ ● Tests      pass           │
│ GC Count: 8          ││ ✗ STORY-003  10s  8m ││ ● Build      pass           │
│ GC Pause: 1.2ms      ││ ✓ STORY-004  18s 12m ││                             │
│                      ││ ⊘ STORY-005  5s  15m ││                             │
│ Status: ● Healthy    ││                       ││                             │
│                      ││                       ││                             │
│ ── Agents ────────  ││                       ││                             │
│ ● implement (feat…)  ││                       ││                             │
│ ◉ research  (fix…)   ││                       ││                             │
╰──────────────────────╯╰───────────────────────╯╰─────────────────────────────╯

  Last refresh: 14:32:05
```

Auto-refreshes every 5 seconds. Subscribes to `"story.completed"`, `"agent.status"`, and `"browser.verification"` EventBus events. When terminal width is narrow, panels stack vertically instead of side-by-side.

## UI Layout — Stacked Mode (< 85 cols)

```
╭──────────────────────────────────────────────────────────╮
│ SYSTEM HEALTH                                            │
│ ─────────────────────────────────────────────────────── │
│ Goroutines: 12     Memory: 24MB / 48MB                  │
│ GC Count: 8        GC Pause: 1.2ms                      │
│ Status: ● Healthy                                        │
│ ── Agents ────                                           │
│ ● implement (feat…)   ◉ research (fix…)                 │
╰──────────────────────────────────────────────────────────╯
╭──────────────────────────────────────────────────────────╮
│ EXECUTION HISTORY                                        │
│ ─────────────────────────────────────────────────────── │
│ ✓ STORY-001  15s  2m ago                                │
│ ✓ STORY-002  22s  5m ago                                │
│ ✗ STORY-003  10s  8m ago                                │
╰──────────────────────────────────────────────────────────╯
╭──────────────────────────────────────────────────────────╮
│ QUALITY GATES                                            │
│ ─────────────────────────────────────────────────────── │
│ ● Lint       pass                                        │
│ ● Tests      pass                                        │
│ ● Build      pass                                        │
╰──────────────────────────────────────────────────────────╯

  Last refresh: 14:32:05 │ Panel: Health │ Tab to switch panels
```

Each panel takes full terminal width. Panel height = `(contentHeight - 2) / 3`. Focused panel has purple border (`#7C3AED`).

## Key Bindings

| Key | Panel | Action |
|-----|-------|--------|
| `Tab` | Any | Cycle focus forward: Health → History → Gates |
| `Shift+Tab` | Any | Cycle focus backward |
| `r` | Any | Manual refresh (system stats) |
| `R` | Gates | Run all quality gates (M-2) |
| `j` / `↓` | History | Navigate execution entries (wraps) |
| `k` / `↑` | History | Navigate execution entries (wraps) |
| `Enter` | History | Open history detail modal (M-4) |
| `j` / `↓` | Gates | Navigate quality gates (wraps) |
| `k` / `↑` | Gates | Navigate quality gates (wraps) |
| `Enter` | Gates | Run selected gate (M-2) |
| `o` | Gates | View gate output modal (M-3) |
| `Esc` / `Backspace` | Any | Focus Home |
