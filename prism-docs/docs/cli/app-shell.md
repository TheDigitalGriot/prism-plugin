---
title: App Shell
description: The tab bar, sidebar, and footer that wrap all non-splash views in the Prism CLI.
outline: [2, 3]
---

# App Shell

For all non-splash, non-onboarding views, content is wrapped in an "app shell" consisting of a tab bar, optional sidebar, and two-tier footer.

## Tab Bar

Two rendering modes depending on terminal width:

**Powerline Tab Bar** (3 lines, when terminal is wide enough):

```
 ╲  Home      ╲  Research  ╲  Spectrum  ╲  Files    ╲ ╲╲╲╲
  ╲  Home      ╲  Research  ╲  Spectrum  ╲  Files    ╲╲╲╲
   ╲  Home      ╲  Research  ╲  Spectrum  ╲  Files    ╲╲╲
```

- Active tab: white text on `Primary` (#7C3AED) background
- Inactive tabs: dim text on `#2c2d3a` background
- Diagonal slant separators create a distinctive visual edge
- Mouse clickable via `bubblezone` (zone IDs: `tab-0` through `tab-8`)

**Compact Tab Bar** (1 line, narrow terminals):

```
 1:Home │ 2:Research │ 3:Plans │ 4:Spectrum │ 5:Files │ 6:Git
─────────────────────────────────────────────────────────────────
```

## Sidebar

Fixed width: **38 characters**. Auto-shown when terminal width >= **120** characters. Toggled with `Ctrl+D`.

```
  ╲╲ ╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱
 ╲╲ ╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱
╲╲ ╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱
╭────────────────────────────────────╮
│  ██▀▀█▄ ██▀▀█▄ ▀██▀ ▄██▀▀ ██▄▀▄██│
│  ██▄▄█▀ ██▄▄█▀  ██  ▀██▄  ██ ▀ ██│
│  ██     ██  ██ ▄██▄ ▄▄██▀ ██   ██│
│  ──────────────────────────────── │
│                                    │
│  ▸ RUNNING                         │
│    Iteration 3/50                  │
│    67% (8/12)                      │
│                                    │
│  ├─ MODIFIED FILES ───────────    │
│    model.go              +12 -3   │
│    view.go               +45 -8   │
│    sidebar.go             mod      │
│                                    │
│  ├─ QUALITY GATES ────────────    │
│    ● Lint                 pass     │
│    ● Tests                pass     │
│    ● Build                pass     │
│                                    │
│  ├─ EPICS ────────────────────    │
│    ● user-auth           8/12     │
│    ○ dashboard          12/36     │
│    ○ notifications       0/9      │
╰────────────────────────────────────╯
```

**Sidebar sections:**

1. **Branded header**: 3-line gradient PRISM block logo
2. **Execution info**: State icon, iteration counter, story progress
3. **Modified Files**: From Git plugin (staged + modified files with diff stats)
4. **Quality Gates**: From Monitor plugin (pass/fail status icons)
5. **Epics**: From Spectrum plugin (active/inactive indicators with progress)

## Footer

Two-tier footer spanning full terminal width.

**Tier 1: Key Hints** (context-aware)

```
[1-9] switch tabs  [tab/shift+tab] cycle  [j/k] navigate  [ctrl+d] details  [?] help  [q] quit  ╲╲╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱
```

Key hints include view-specific hints from the active plugin's `KeyHints()` method. Right edge has decorative slash pattern matching sidebar width.

**Tier 2: Powerline Status Bar**

```
 IMPLEMENT ╲ ⚡ Spectrum ╲  main ╲ STORY-003 ╲                ╱ v2.3.0 ╱ 3✓ 0✗ ╱ 8/12 ╱ iter 3 ╱ 🕒 2m 15s
```

Left segments:
1. Workflow phase pill (Research=Blue, Plan=Teal, Implement=Green, Validate=Amber)
2. Active plugin icon + name
3. Git branch name (from Git plugin)
4. Current story ID (from Spectrum plugin, when width >= 100)

Right segments:
1. Version (`v2.3.0`)
2. Quality gate counts (pass/fail, when width >= 80)
3. Story progress (completed/total)
4. Iteration counter (when width >= 90)
5. Elapsed time (when Spectrum is running)
