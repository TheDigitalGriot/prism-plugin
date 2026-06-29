---
title: Bottom Panel Webview
description: Unified React webview hosting Monitor, Office, and Workspaces views in the bottom panel area.
outline: [2, 3]
---

# Bottom Panel Webview

A unified React webview hosting three views in the bottom panel area.

## Monitor View (`MonitorView.tsx`)

| Feature | Description |
|---------|-------------|
| Quality Gates | Display gate status (pass/fail/pending/running), run individual or all gates |
| Execution History | Chronological list of story executions with duration, result, timestamp |
| Gate Results | Detailed output for each quality gate run |

## Office View (`OfficeApp.tsx`)

A pixel-art office visualization showing AI agent characters at work:

| Feature | Description |
|---------|-------------|
| Canvas rendering | 2D Canvas with game loop for smooth animation |
| Agent characters | Animated sprites representing active Claude sessions |
| Furniture placement | Editable layout with desk, chair, and equipment tiles |
| Agent status | Status icons (active, thinking, waiting, paused) synced with Spectrum |
| Layout persistence | Serialized to disk for cross-session consistency |

## Workspaces View (`WorkspacesView.tsx`)

| Feature | Description |
|---------|-------------|
| Project browser | Scan for `.prism/` directories in sibling folders |
| Branch detection | Show current git branch per project |
| Worktree management | Create/delete git worktrees |
| Epic tracking | Stories grouped by epic folder |

## Webview Loading (v3.7.0)

The panel loads its production bundle from `dist/webview-panel/`, or the Vite HMR dev server when one is live. As of **v3.7.0** the provider verifies the advertised dev-server port is actually listening before choosing HMR (shared `resolveLiveViteServer` helper), so a stale `.vite-panel-port` from a dead `vite dev` no longer renders the panel blank — it falls back to the production build. See [Sidebar → Webview Loading](/vscode/sidebar#webview-loading-v3-7-0) for the shared mechanism.
