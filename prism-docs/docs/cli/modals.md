---
title: Modal & Dialog Systems
description: The layered modal and dialog overlay system — sections, focus cycling, command palette, confirmation dialogs, and permission prompts.
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
