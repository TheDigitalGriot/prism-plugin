---
title: Native Tree Views & Status Bar
description: Research, Plans, and Stories tree providers plus status bar items.
outline: [2, 3]
---

# Native Tree Views & Status Bar

## Research Tree (`research-tree.ts`)

- Lists `.prism/shared/research/` markdown files
- Shows date, topic name parsed from filename
- Context menu: Open, Delete, Refresh
- Auto-refreshes on `onDidChangeFile` events

## Plans Tree (`plans-tree.ts`)

- Lists `.prism/shared/plans/` markdown files
- Context menu: Open, Decompose to stories, Implement, Delete, Refresh
- Decompose action generates `.prism/stories/<name>/stories.json`

## Stories Tree (`stories-tree.ts`)

- Displays `stories.json` entries with color-coded status icons
- Expandable items show individual steps with done/pending markers
- Context menu: Execute story, Mark complete, Refresh
- Status colors match CLI conventions (green=complete, purple=active, gray=pending, amber=blocked)

## Status Bar Items

| Item | Position | Content |
|------|----------|---------|
| Workflow Phase | Left | Current phase with color-coded icon |
| Story Progress | Left | `N/M stories` completion counter |
| Spectrum Status | Right | Running/Paused/Complete indicator |
