---
title: Electron App Overview
description: Prism Electron desktop app — a standalone IDE-independent application sharing core business logic with the VS Code extension.
outline: [2, 3]
---

# Electron App Overview

The Prism Electron app is a standalone desktop application that runs the same React UI and business logic as the VS Code extension, but independent of any IDE. It uses Electron's IPC model as the transport layer instead of VS Code's `postMessage`, and replaces all VS Code API dependencies with pure Node.js equivalents.

The Electron app was built by wiring the existing platform-agnostic prism-vscode core + React UI into Electron's IPC model, then replacing the 8 VS Code-coupled files with Electron equivalents.

## What's Shared (from prism-vscode)

- All business logic: workflow state machine, spectrum engine, stories manager, signal parser
- All Claude CLI integration: runner, parser, events
- All React UI components: ChatView, SpectrumView, WelcomeView, and all sub-components
- The complete gRPC-over-postMessage protocol (unchanged)
- Service clients: StateService, ChatService, WorkflowService, PluginService, SpectrumService

## What Differs (platform shell)

| Concern | VS Code | Electron |
|---------|---------|----------|
| IPC transport | `webview.postMessage` / `onDidReceiveMessage` | `ipcMain.handle()` / `ipcRenderer.invoke()` |
| Workspace detection | `vscode.workspace.workspaceFolders` | `dialog.showOpenDialog` + stored project dir |
| File watching | `vscode.FileSystemWatcher` | `chokidar` |
| File I/O | `vscode.workspace.fs.stat()` | Node.js `fs/promises` |
| Config storage | VS Code settings API | Plain JSON file in `app.getPath('userData')` |
| Event system | `vscode.EventEmitter` | Node.js `EventEmitter` |
| Context keys | `vscode.commands.executeCommand('setContext', ...)` | Not applicable (no-op) |

## Key Features

- Full Prism chat interface with streaming Claude CLI responses
- Spectrum autonomous execution dashboard with real-time story updates
- Native OS menu bar (File → Open Project, standard Edit/View/Window)
- Window state persistence (bounds, last project directory)
- CLI argument support: `prism-electron /path/to/project`
- Context-isolated renderer with Electron Fuses security hardening
- Distributable installers via Electron Forge (Squirrel Windows, ZIP macOS, deb/rpm Linux)

## Technology Stack

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Prism Electron v1.0.0                            │
├──────────────┬──────────────┬──────────────┬────────────────────────┤
│  Electron 40 │ React 18.3.1 │   Vite 6.0   │   Tailwind CSS 4.2    │
│  (Chromium)  │   (UI)       │   (Build)    │   (Styling)           │
├──────────────┴──────────────┴──────────────┴────────────────────────┤
│  @prism-core/* — Shared business logic from packages/prism-core    │
│  @prism-ui/*  — Shared React components from packages/prism-ui     │
├─────────────────────────────────────────────────────────────────────┤
│  chokidar (file watching) │ uuid (request IDs) │ electron-forge     │
├─────────────────────────────────────────────────────────────────────┤
│  TypeScript 5.4.5 │ ESLint │ Prettier                              │
└─────────────────────────────────────────────────────────────────────┘
```

> **Note**: The root `package.json` declares React 19, but `webview-ui/package.json` pins React 18.3.1.
