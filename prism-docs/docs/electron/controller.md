---
title: ElectronPrismController
description: Thin platform shell extending BasePrismController, VS Code API replacements, services, and handler registry.
outline: [2, 3]
---

# ElectronPrismController

## `src/hosts/electron/ElectronPrismController.ts`

A thin platform shell (45 lines) that extends `BasePrismController` from `packages/prism-core/`. The bulk of orchestration logic (state management, services, handler routing) now lives in the base class. This file provides only Electron-specific overrides.

## VSCode API Replacements

| VSCode API | Electron Replacement |
|-----------|---------------------|
| `vscode.EventEmitter` | Node.js `EventEmitter` |
| `vscode.workspace.workspaceFolders` | Stored `_projectDir` string via `setProjectDir()` |
| `vscode.workspace.fs.stat()` | `fs.stat()` from `fs/promises` |
| `vscode.FileSystemWatcher` | `PrismWatcher` (chokidar) |
| `vscode.commands.executeCommand('setContext', ...)` | No-op (context keys not applicable) |
| `vscode.window.showInformationMessage` | Not needed (UI handles all messaging) |

## Services

| Service | Class | Purpose |
|---------|-------|---------|
| Workflow | `WorkflowStateMachine` | Research → Plan → Implement → Validate state machine |
| Stories | `StoriesManager` | Load/parse stories.json, track completion |
| Watcher | `PrismWatcher` | chokidar-based file system monitoring for `.prism/` |
| Chat | `ClaudeRunner` | Spawn Claude CLI for chat sessions |
| Skills | `ModeBridge` | Route `/skill-name` commands to Claude CLI |
| Spectrum | `SpectrumEngine` + `SpectrumRunner` | Autonomous story execution loop |

## Handler Registry

All handlers are registered in `_registerHandlers()` and dispatched via `handleGrpcRequest()`:

### StateService

| Handler | Type | Description |
|---------|------|-------------|
| `subscribeToState` | Streaming | Push state updates indefinitely to subscriber |
| `getState` | Unary | One-shot state fetch |

### UiService

| Handler | Type | Description |
|---------|------|-------------|
| `initializeWebview` | Unary | Trigger `.prism/` detection, push initial state |
| `initPrism` | Unary | Create `.prism/` directory structure |

### WorkflowService

| Handler | Type | Description |
|---------|------|-------------|
| `transition` | Unary | Move to next workflow phase |
| `getAvailableTransitions` | Unary | Query valid transitions from current state |

### ChatService

| Handler | Type | Description |
|---------|------|-------------|
| `sendMessage` | Unary | Route message to Claude CLI or plugin skill |
| `abortTask` | Unary | Terminate running chat session |
| `clearMessages` | Unary | Reset chat history |

### PluginService

| Handler | Type | Description |
|---------|------|-------------|
| `executeSkill` | Unary | Run `/skill-name` via ModeBridge → Claude CLI |
| `terminateSkill` | Unary | Stop running skill |
| `checkCli` | Unary | Verify Claude CLI is on PATH |
| `getSkills` | Unary | List available Prism plugin skills |

### SpectrumService

| Handler | Type | Description |
|---------|------|-------------|
| `start` | Unary | Begin autonomous story execution loop |
| `pause` | Unary | Pause execution |
| `resume` | Unary | Resume paused execution |
| `stop` | Unary | Stop execution |
| `skipStory` | Unary | Mark current story as SKIPPED, advance |
| `reset` | Unary | Reset execution state |

## State Management

The controller maintains a `PrismExtensionState` object and broadcasts changes to all subscribers:

```typescript
async updateState(partial: Partial<PrismExtensionState>): Promise<void> {
  Object.assign(this._state, partial);
  this._broadcastState();
}
```

Subscribers are tracked by `request_id`. Dead subscribers are auto-cleaned on send failure.

## Key Methods

| Method | Purpose |
|--------|---------|
| `setProjectDir(dir)` | Set active project, trigger `.prism/` re-detection, start watcher |
| `updateState(partial)` | Merge partial state, broadcast to all subscribers |
| `setPhase(phase)` | Force workflow phase transition |
| `_detectPrismDir()` | Check for `.prism/`, detect stories.json, start file watcher |
| `_onPrismFileChange(event)` | React to stories.json changes, reload stories |
| `_runChatSession(text)` | Spawn ClaudeRunner, stream text + tool events |
| `_startSpectrumLoop(config)` | Initialize SpectrumEngine, begin iteration loop |
| `dispose()` | Terminate all runners, close watchers, clean up subscribers |
