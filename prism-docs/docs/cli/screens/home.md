---
title: Home Screen
description: Landing screen with ASCII PRISM logo, spectral gradient, and 3-item navigation menu.
outline: [2, 3]
---

# Home Screen

The landing screen after splash/onboarding. Features a static ASCII PRISM logo with a 4-stop spectrum gradient and a 3-item navigation menu.

## UI Layout

```
╭──────────────────────────────────────────────────────────────────────────────╮
│                                                                              │
│  '||''|.  '||''|.   '||'  .|'''.|  '||    ||'                              │
│   ||   ||  ||   ||   ||   ||..  '   |||  |||                               │
│   ||...|'  ||''|'    ||    ''|||.   |'|..'||                               │
│   ||       ||   |.   ||  .     '||  | '|' ||                              │
│  .||.     .||.  '|' .||. |'....|'  .|. | .||.                             │
│                                                                              │
│  [Spectrum Gradient — Blue → Teal → Green → Amber]                          │
│                                                                              │
╰──────────────────────────────────────────────────────────────────────────────╯

  >  [1]  Research      Browse and create research documents

     [2]  Plans         View and decompose implementation plans

     [3]  Spectrum      Execute stories autonomously


      j/k navigate   enter select   q quit
```

## Key Bindings

| Key | Action |
|-----|--------|
| `j` / `↓` | Next menu item (wraps around) |
| `k` / `↑` | Previous menu item (wraps around) |
| `Enter` / `Space` | Navigate to selected screen |
| `1` | Jump to Research |
| `2` | Jump to Plans |
| `3` | Jump to Spectrum |

## Mouse Support

- Scroll wheel cycles menu items
- Left-click on a menu item navigates to it (zone IDs: `home:menu-0`, `home:menu-1`, `home:menu-2`)
