---
title: Diff System
description: Unified diff parsing and rendering with syntax highlighting, word-level diffs, and side-by-side view.
outline: [2, 3]
---

# Diff System

The diff system (`diff/`) provides parsing and rendering of unified diffs with syntax highlighting.

## Features

- **Unified and side-by-side** view modes
- **Word-level diffs** for consecutive add/remove pairs
- **Syntax highlighting** via Chroma (monokai theme)
- **Line numbers** with dual-gutter (old + new)
- **Horizontal scrolling** and **word wrapping** modes

## Diff Colors

| Element | Color | Background |
|---------|-------|------------|
| Added line | Green `#10B981` | Dark green `#1a3a2a` |
| Removed line | Red `#EF4444` | Dark red `#3a1a1a` |
| Context line | Gray `#6B7280` | — |
| Word diff (add) | Green, Bold | Dark green `#1a3a2a` |
| Word diff (remove) | Red, Bold | Dark red `#3a1a1a` |
| Hunk header | Blue `#3B82F6`, Bold | — |
| Line numbers | Gray `#6B7280` | — |
