---
title: Spectrum Execution Dashboard
description: The primary operational screen — real-time Spectrum execution with 6 sub-panels, story list, activity panel, and log output.
outline: [2, 3]
---

# Spectrum Execution Dashboard

The primary operational screen. Displays real-time execution progress with 6 sub-panels arranged vertically.

## UI Layout — Full Dashboard

```
╭──────────────────────────────────────────────────────────────────────────────╮
│  user-auth (8/12)   dashboard (12/36)   notifications (0/9)   [tab] switch  │
╰──────────────────────────────────────────────────────────────────────────────╯
 PRISM TUI                                          Iteration: 3/50  [?] help
╭──────────────────────────────────────────────────────────────────────────────╮
│                                                                              │
│  ▀▀▄▄▀▀▄▄▀▀    '||''|.  '||''|.   '||'  .|'''.|  '||    ||'               │
│  ▄▄▀▀▄▄▀▀▄▄     ||   ||  ||   ||   ||   ||..  '   |||  |||                │
│  ▀▀▄▄▀▀▄▄▀▀     ||...|'  ||''|'    ||    ''|||.   |'|..'||                │
│  ▄▄▀▀▄▄▀▀▄▄     ||       ||   |.   ||  .     '||  | '|' ||               │
│  ▀▀▄▄▀▀▄▄▀▀    .||.     .||.  '|' .||. |'....|'  .|. | .||.              │
│                                                                              │
│  Plan: Feature Implementation  ████████████░░░░░░░░░░░░░░  12/36 (33%)      │
│                                                                              │
╰──────────────────────────────────────────────────────────────────────────────╯
╭────────────── 40% ──────────────╮╭───────────────── 60% ────────────────────╮
│ STORIES                         ││ CURRENT ACTIVITY                         │
│ ────────────────────────────    ││ ─────────────────────────────────────    │
│ ✓ DEMO-001 Initialize spri...  ││ ▸ DEMO-013: Implement auto-expandi...   │
│ ✓ DEMO-002 Implement progr...  ││                                          │
│ ✓ DEMO-003 Add story compl...  ││ Status: ⣾ Working...                    │
│ ✓ DEMO-004 Create active s...  ││                                          │
│ ✓ DEMO-005 Implement log e...  ││ Editing: .../services/user.ts           │
│ ✓ DEMO-006 Add prism logo ...  ││                                          │
│ ✓ DEMO-007 Optimize animat...  ││ Recent:                                  │
│ ✓ DEMO-008 Test all animat...  ││   Reading: .../components/Auth.tsx       │
│ ✓ DEMO-009 Create TipTap R...  ││   Bash: npm run typecheck               │
│ ✓ DEMO-010 Build FormatToo...  ││   Grep: Searching: handleSubmit         │
│ ✓ DEMO-011 Implement markd...  ││   Edit: .../utils/validation.ts         │
│ ✓ DEMO-012 Create NoteCard...  ││   Read: package.json                    │
│   ● ○ ○ [a/s]                  ││                                          │
╰─────────────────────────────────╯╰──────────────────────────────────────────╯
╭──────────────────────────────────────────────────────────────────────────────╮
│ LOG OUTPUT                                                    [z/x scroll]  │
│ ─────────────────────────────────────────────────────────────────────────── │
│ [14:32:05] INFO  Prism CLI v2.3.0                                          │
│ [14:32:05] INFO  Starting iteration 1                                      │
│ [14:32:15] OK    DEMO-009 completed (commit: abc123)                       │
│ [14:32:20] INFO  Starting iteration 2                                      │
│ [14:32:35] OK    Quality gates passed                                      │
│ [14:32:40] OK    DEMO-010 completed (commit: def456)                       │
│   ● ○                                                                       │
╰──────────────────────────────────────────────────────────────────────────────╯
 ▸ RUNNING               Elapsed: 2m 15s               [q]uit [p]ause [/]skip
```

## Panel Breakdown

**Panel 1: Epic Selector** (conditional — only shown when multiple epics exist)

- Selected epic: `CurrentStyle` (bold purple)
- Unselected: `DimStyle` (gray)
- Format: ` name (completed/total) `

**Panel 2: Header**

- Left: `TitleStyle("PRISM TUI")`
- Right: Iteration counter + help hint in `DimStyle`

**Panel 3: Progress Bar**

- 3D prism (left) + ASCII logo (right) joined horizontally
- Progress bar: spectrum gradient `█` (filled) + `░` in `#374151` (empty)
- Bar width: `termWidth - 20` (min 20)
- Progress driven by spring-animated position (not raw percentage)

**Panel 4: Story List** (40% width)

Story icons with animated states:

| Status | Icon | Style | Animation |
|--------|------|-------|-----------|
| Complete (settling) | `●` | Green | Scale < 0.7 during pop |
| Complete (overshoot) | `✔` | Green | Scale > 1.1 during pop |
| Complete (final) | `✓` | Green | Pop animation finished |
| Active (bright) | `▶` | Bold purple | Pulse brightness > 0.8 |
| Active (dim) | `▸` | Bold purple | Pulse brightness ≤ 0.8 |
| Blocked | `⊘` | Italic amber | Static |
| Pending | `○` | Gray | Static |

**Panel 5: Activity Panel** (60% width)

State-dependent content:

| State | Activity Panel Content |
|-------|----------------------|
| Idle | "Press Enter to start execution" (dim) |
| Running | Story info + spinner + tool activity + recent activities |
| Paused | Story info + "Paused" status |
| Complete | "All stories complete!" (green) |
| MaxIterations | "Iteration limit reached" (amber) |
| Error | "Error occurred" (red) + error message |

**Panel 6: Log Panel**

Log level formatting:

| Level | Badge | Style |
|-------|-------|-------|
| Info | `INFO ` | Blue `#3B82F6` |
| Success | `OK   ` | Green `#10B981` |
| Warning | `WARN ` | Amber `#F59E0B` |
| Error | `ERROR` | Bold red `#EF4444` |
| Claude Output | `     ` | Gray `#6B7280` |

Format: `[HH:MM:SS] LEVEL MESSAGE` — New entries slide in from the right via spring animation.

**Panel 7: Status Bar**

Three columns: State icon + name | Elapsed time | Control hints

| State | Icon | Color |
|-------|------|-------|
| Running | `▸` | Green `#10B981` |
| Paused | `⏸` | Amber `#F59E0B` |
| Complete | `▸` | Green `#10B981` |
| MaxIterations | `⏸` | Amber `#F59E0B` |
| Error | `▸` | Red `#EF4444` |
| Idle | `▸` | Gray `#6B7280` |

## UI Layout — Idle State

```
╭──────────────────────────────────────────────────────────────────────────────╮
│  user-auth (0/12)   dashboard (0/36)   notifications (0/9)   [tab] switch   │
╰──────────────────────────────────────────────────────────────────────────────╯
 PRISM TUI                                          Iteration: 0/50  [?] help
╭──────────────────────────────────────────────────────────────────────────────╮
│                                                                              │
│  ▀▀▄▄▀▀▄▄▀▀    '||''|.  '||''|.   '||'  .|'''.|  '||    ||'               │
│  ▄▄▀▀▄▄▀▀▄▄     ||   ||  ||   ||   ||   ||..  '   |||  |||                │
│  ▀▀▄▄▀▀▄▄▀▀     ||...|'  ||''|'    ||    ''|||.   |'|..'||                │
│  ▄▄▀▀▄▄▀▀▄▄     ||       ||   |.   ||  .     '||  | '|' ||               │
│  ▀▀▄▄▀▀▄▄▀▀    .||.     .||.  '|' .||. |'....|'  .|. | .||.              │
│                                                                              │
│  Plan: Feature Implementation  ░░░░░░░░░░░░░░░░░░░░░░░░░░  0/36 (0%)       │
│                                                                              │
╰──────────────────────────────────────────────────────────────────────────────╯
╭────────────── 40% ──────────────╮╭───────────────── 60% ────────────────────╮
│ STORIES                         ││ CURRENT ACTIVITY                         │
│ ────────────────────────────    ││ ─────────────────────────────────────    │
│ ○ DEMO-001 Initialize spri...  ││                                          │
│ ○ DEMO-002 Implement progr...  ││ Press Enter to start execution           │
│ ○ DEMO-003 Add story compl...  ││                                          │
│ ○ DEMO-004 Create active s...  ││                                          │
│ ○ DEMO-005 Implement log e...  ││                                          │
│ ○ DEMO-006 Add prism logo ...  ││                                          │
│ ○ DEMO-007 Optimize animat...  ││                                          │
│ ○ DEMO-008 Test all animat...  ││                                          │
│ ○ DEMO-009 Create TipTap R...  ││                                          │
│ ○ DEMO-010 Build FormatToo...  ││                                          │
│ ○ DEMO-011 Implement markd...  ││                                          │
│ ○ DEMO-012 Create NoteCard...  ││                                          │
│   ● ○ ○ [a/s]                  ││                                          │
╰─────────────────────────────────╯╰──────────────────────────────────────────╯
╭──────────────────────────────────────────────────────────────────────────────╮
│ LOG OUTPUT                                                    [z/x scroll]  │
│ ─────────────────────────────────────────────────────────────────────────── │
│                                                                              │
│                                                                              │
│                                                                              │
╰──────────────────────────────────────────────────────────────────────────────╯
 ▸ IDLE                                                    [enter] start [q]uit
```

## UI Layout — Paused State

```
╭────────────── 40% ──────────────╮╭───────────────── 60% ────────────────────╮
│ STORIES                         ││ CURRENT ACTIVITY                         │
│ ────────────────────────────    ││ ─────────────────────────────────────    │
│ ✓ DEMO-001 Initialize spri...  ││ ▸ DEMO-005: Implement log entry...      │
│ ✓ DEMO-002 Implement progr...  ││                                          │
│ ✓ DEMO-003 Add story compl...  ││ Status: ⣾ Paused                        │
│ ✓ DEMO-004 Create active s...  ││                                          │
│ ▸ DEMO-005 Implement log e...  ││                                          │
│ ○ DEMO-006 Add prism logo ...  ││ Recent:                                  │
│ ○ DEMO-007 Optimize animat...  ││   Reading: .../services/auth.ts          │
│ ○ DEMO-008 Test all animat...  ││   Bash: npm run typecheck                │
│   ● ○ ○ [a/s]                  ││                                          │
╰─────────────────────────────────╯╰──────────────────────────────────────────╯
╭──────────────────────────────────────────────────────────────────────────────╮
│ LOG OUTPUT                                                    [z/x scroll]  │
│ ─────────────────────────────────────────────────────────────────────────── │
│ [14:32:05] INFO  Prism CLI v2.3.0                                          │
│ [14:32:15] OK    DEMO-004 completed (commit: abc123)                       │
│ [14:32:20] INFO  Starting iteration 5                                      │
│   ● ○                                                                       │
╰──────────────────────────────────────────────────────────────────────────────╯
 ⏸ PAUSED                  Elapsed: 1m 45s                    [enter] resume
```

Note: Progress bar and header panels are identical to Running state but omitted for brevity. Status bar shows `⏸ PAUSED` in amber (`#F59E0B`) with frozen elapsed time.

## UI Layout — Complete State

```
╭────────────── 40% ──────────────╮╭───────────────── 60% ────────────────────╮
│ STORIES                         ││ CURRENT ACTIVITY                         │
│ ────────────────────────────    ││ ─────────────────────────────────────    │
│ ✓ DEMO-001 Initialize spri...  ││                                          │
│ ✓ DEMO-002 Implement progr...  ││ All stories complete!                    │
│ ✓ DEMO-003 Add story compl...  ││                                          │
│ ✓ DEMO-004 Create active s...  ││                                          │
│ ✓ DEMO-005 Implement log e...  ││                                          │
│ ✓ DEMO-006 Add prism logo ...  ││                                          │
│ ✓ DEMO-007 Optimize animat...  ││                                          │
│ ✓ DEMO-008 Test all animat...  ││                                          │
│ ✓ DEMO-009 Create TipTap R...  ││                                          │
│ ✓ DEMO-010 Build FormatToo...  ││                                          │
│ ✓ DEMO-011 Implement markd...  ││                                          │
│ ✓ DEMO-012 Create NoteCard...  ││                                          │
│   ● ○ ○ [a/s]                  ││                                          │
╰─────────────────────────────────╯╰──────────────────────────────────────────╯
╭──────────────────────────────────────────────────────────────────────────────╮
│ LOG OUTPUT                                                    [z/x scroll]  │
│ ─────────────────────────────────────────────────────────────────────────── │
│ [14:35:10] OK    DEMO-012 completed (commit: xyz789)                       │
│ [14:35:12] OK    All stories complete                                      │
│   ●                                                                         │
╰──────────────────────────────────────────────────────────────────────────────╯
 ✓ COMPLETE                 Elapsed: 5m 30s                       [enter] quit
```

Note: Progress bar shows 100% filled with spectrum gradient. "All stories complete!" renders in green (`#10B981`). Status bar shows `▸ COMPLETE` in green.

## UI Layout — Error State

```
╭────────────── 40% ──────────────╮╭───────────────── 60% ────────────────────╮
│ STORIES                         ││ CURRENT ACTIVITY                         │
│ ────────────────────────────    ││ ─────────────────────────────────────    │
│ ✓ DEMO-001 Initialize spri...  ││                                          │
│ ✓ DEMO-002 Implement progr...  ││ Error occurred                           │
│ ✓ DEMO-003 Add story compl...  ││ 3 consecutive errors on DEMO-004        │
│ ✓ DEMO-004 Create active s...  ││                                          │
│ ▸ DEMO-005 Implement log e...  ││                                          │
│ ○ DEMO-006 Add prism logo ...  ││                                          │
│   ● ○ ○ [a/s]                  ││                                          │
╰─────────────────────────────────╯╰──────────────────────────────────────────╯
╭──────────────────────────────────────────────────────────────────────────────╮
│ LOG OUTPUT                                                    [z/x scroll]  │
│ ─────────────────────────────────────────────────────────────────────────── │
│ [14:33:10] ERROR DEMO-005 failed: exit code 1                              │
│ [14:33:15] INFO  Retry 2/3 (backoff: 4s)                                   │
│ [14:33:20] ERROR DEMO-005 failed: exit code 1                              │
│ [14:33:25] ERROR Max consecutive errors reached (3)                        │
│   ●                                                                         │
╰──────────────────────────────────────────────────────────────────────────────╯
 ▸ ERROR                    Elapsed: 3m 10s                       [enter] quit
```

Note: "Error occurred" renders in red (`#EF4444`). Error detail message shown in dim text below. Status bar icon `▸` in red.

## UI Layout — Max Iterations State

```
╭────────────── 40% ──────────────╮╭───────────────── 60% ────────────────────╮
│ STORIES                         ││ CURRENT ACTIVITY                         │
│ ────────────────────────────    ││ ─────────────────────────────────────    │
│ ✓ DEMO-001 Initialize spri...  ││                                          │
│ ✓ DEMO-002 Implement progr...  ││ Iteration limit reached                  │
│ ✓ DEMO-003 Add story compl...  ││                                          │
│ ✓ DEMO-004 Create active s...  ││                                          │
│ ✓ DEMO-005 Implement log e...  ││                                          │
│ ○ DEMO-006 Add prism logo ...  ││                                          │
│ ○ DEMO-007 Optimize animat...  ││                                          │
│   ● ○ ○ [a/s]                  ││                                          │
╰─────────────────────────────────╯╰──────────────────────────────────────────╯
╭──────────────────────────────────────────────────────────────────────────────╮
│ LOG OUTPUT                                                    [z/x scroll]  │
│ ─────────────────────────────────────────────────────────────────────────── │
│ [15:02:00] INFO  Starting iteration 50                                     │
│ [15:02:30] OK    DEMO-005 completed (commit: mno345)                       │
│ [15:02:32] WARN  Max iterations reached (50/50)                            │
│   ●                                                                         │
╰──────────────────────────────────────────────────────────────────────────────╯
 ⏸ PAUSED                  Elapsed: 30m 00s                       [enter] quit
```

Note: "Iteration limit reached" renders in amber (`#F59E0B`). Some stories remain pending. MaxIterations state uses the same `String()` as Paused, hence `⏸ PAUSED` in the status bar.

## Key Bindings

| Key | Action | State Required |
|-----|--------|----------------|
| `a` | Stories previous page | Any |
| `s` | Stories next page | Any |
| `z` | Logs previous page | Any |
| `x` | Logs next page | Any |
| `Tab` | Next epic | Multi-epic only |
| `Shift+Tab` | Previous epic | Multi-epic only |
| `Enter` / `Space` | Start execution | Idle |
| `Space` | Pause execution | Running |
| `/` | Skip current story | Running |
| `Enter` / `Space` | Resume execution | Paused |
| `Enter` / `Space` | Quit | Complete / MaxIterations / Error |
