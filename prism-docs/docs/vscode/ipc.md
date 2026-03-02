---
title: IPC Architecture
description: gRPC-over-postMessage protocol — services, patterns, and complete method reference.
outline: [2, 3]
---

# IPC Architecture — gRPC-over-postMessage

Communication between the extension host and webviews uses a gRPC-inspired protocol over VS Code's `postMessage` API.

## Pattern

1. Extension host defines gRPC service interfaces
2. Webview sends binary-like requests via `postMessage`
3. Host responds with serialized state objects
4. Streaming RPCs push state updates on every `updateState()` call

## Services

| Service | Methods | Type | Description |
|---------|---------|------|-------------|
| **StateService** | `subscribeToState()` | Streaming | Push state on init + every update |
| | `getState()` | Unary | Get current state once |
| **UiService** | `initializeWebview()` | Unary | Called on webview mount |
| | `initPrism()` | Unary | Initialize `.prism/` from UI |
| **WorkflowService** | `transition()` | Unary | Attempt phase change |
| | `getAvailableTransitions()` | Unary | List allowed next phases |
| **ChatService** | `sendMessage()` | Unary | Send user text, start streaming |
| | `abortTask()` | Unary | Stop active chat/plugin |
| | `clearMessages()` | Unary | Reset chat history |
| | `approveToolUse()` | Unary | Approve pending tool use |
| | `setApiKey()` | Unary | No-op (using CLI) |
| **PluginService** | `executeSkill()` | Unary | Run Prism plugin skill via CLI |
| **SpectrumService** | `start()` | Unary | Begin autonomous execution |
| | `pause()` / `resume()` | Unary | Pause/resume loop |
| | `stop()` | Unary | Halt execution |
| | `skipStory()` | Unary | Skip current story |
| | `reset()` | Unary | Reset Spectrum state |
| **TaskService** | `readFile()`, `writeFile()`, `editFile()` | Unary | File operations during chat |
| | `executeCommand()`, `searchFiles()`, `listFiles()` | Unary | Tool operations |
| | `askFollowup()`, `attemptCompletion()` | Unary | Task lifecycle |
