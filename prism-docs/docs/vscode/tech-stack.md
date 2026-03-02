---
title: Technology Stack
description: Full technology stack for the Prism VS Code Extension, activation flow, and CLI/Extension/Electron feature parity table.
outline: [2, 3]
---

# Extension Technology Stack

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     Prism VS Code Extension v2.3.0                          │
├──────────────┬──────────────┬──────────────┬───────────────┬────────────────┤
│  Extension   │  Sidebar     │  Bottom      │  Office       │  Build         │
│  Host        │  Webview     │  Panel       │  Webview      │  Tools         │
├──────────────┼──────────────┼──────────────┼───────────────┼────────────────┤
│ TypeScript   │ React 18     │ React 18     │ React 19.2.4  │ esbuild        │
│ VS Code API  │ Vite 6.4.1   │ Vite 6.4.1   │ Vite 6.4.1    │ TypeScript     │
│ Node.js      │ Tailwind v4  │ Tailwind v4  │ Tailwind v4   │ Jest           │
│ Anthropic SDK│ React        │ Canvas 2D    │ Port 5174     │ VS Code Test   │
│              │  Virtuoso    │ PNG.js       │               │  CLI           │
│              │ React        │              │               │                │
│              │  Markdown    │              │               │                │
├──────────────┴──────────────┴──────────────┴───────────────┴────────────────┤
│  @prism-core/* (packages/prism-core) │ @prism-ui/* (packages/prism-ui)      │
├─────────────────────────────────────────────────────────────────────────────┤
│  Claude CLI (child process — shared with Prism CLI)                         │
├─────────────────────────────────────────────────────────────────────────────┤
│  .prism/ Directory (shared — research, plans, stories, spectrum)            │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Activation Flow (`extension.ts`)

1. Create `VscodeWebviewProvider` → instantiates `PrismController`
2. Register tree view providers (Research, Plans, Stories)
3. Register status bar items
4. Register sidebar webview provider
5. Create `PrismPanelProvider` → register bottom panel webview
6. Register 40+ commands with handlers
7. Subscribe to file watcher changes → refresh trees
8. Subscribe to state changes → update UI

## CLI ↔ Extension ↔ Electron Feature Parity

| Feature | CLI Dashboard | VS Code Extension | Electron Desktop App |
|---------|--------------|-------------------|---------------------|
| 4-Phase Workflow | Tab-based navigation | Commands + sidebar chat | Chat-driven + native menu |
| Research Browser | Two-mode file viewer | Native tree view + markdown preview | Research discovery via `prism:getResearch` IPC |
| Plans Browser | Two-mode file viewer + decompose | Native tree view + context menu | Plans discovery via `prism:getPlans` IPC |
| Stories View | Paginated list in Spectrum | Native tree view with expandable steps | Shared React component + `StoriesPanel` |
| Spectrum Execution | Full-screen dashboard | Sidebar + bottom panel | Full React dashboard + `SpectrumPanel` |
| Chat / Agent | Compact TUI chat | Full chat with streaming markdown | Shared ChatView (streaming) |
| Git Integration | Two-pane staging + diff | Delegates to VS Code's built-in git | `GitPanel` + `GitGraphView` via `prism:gitStatus`/`prism:gitLog`/`prism:gitBranchInfo` IPC |
| File Browser | Two-pane with tabs + edit + blame | Delegates to VS Code's file explorer | `FilesPanel` + `FileContentView` via `prism:fileTree`/`prism:readFile` IPC |
| Monitor | Three-panel health dashboard | Bottom panel quality gates + history | `MonitorPanel` with `prism:executeGate`/`prism:cancelGate` IPC |
| Workspaces | Projects + worktrees + kanban | Bottom panel project browser | `WorkspacePanel` via `prism:discoverProjects`/`prism:listWorktrees`/`prism:createWorktree` IPC |
| Office | — | Pixel-art agent visualization | Full office subsystem (`ElectronAgentManager`, `ElectronOfficeProvider`, `electronOfficeTransport`) |
| Splash / 3D | Procedural 3D animation | — | — |
| Spring Animations | Harmonica physics | CSS transitions | CSS transitions |
| Window State | — | VS Code manages | Custom persistence (JSON) |
| CLI Arg Launch | `prism-cli path` | — | `prism-electron path` |
| Native Menu | — | VS Code menus | File → Open Project, Edit, View, Window |
