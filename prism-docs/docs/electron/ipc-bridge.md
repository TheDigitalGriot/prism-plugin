---
title: IPC Bridge
description: ElectronIPCBridge — all registered IPC handlers, bidirectional communication, and project management.
outline: [2, 3]
---

# IPC Bridge — Electron Transport

## `src/hosts/electron/ElectronIPCBridge.ts`

The IPC Bridge does what `VscodeWebviewProvider.ts` does in the VS Code extension: instantiates the controller, registers IPC handlers, and wires bidirectional communication.

## Registered IPC Handlers

**Core handlers:**

| Channel | Method | Purpose |
|---------|--------|---------|
| `grpc_request` | `handle` | Routes gRPC requests to `handleGrpcRequest()` → controller handlers |
| `grpc_request_cancel` | `handle` | Removes streaming subscriber by `request_id` |
| `prism:openProject` | `handle` | Opens native folder picker → `setProjectDir()` |
| `shell:openExternal` | `handle` | Opens external URLs in system browser |

**File and Git handlers:**

| Channel | Method | Purpose |
|---------|--------|---------|
| `prism:readFile` | `handle` | Read file content (with path traversal protection) |
| `prism:fileTree` | `handle` | Recursive file tree (depth-limited) |
| `prism:gitStatus` | `handle` | Git status via child_process |
| `prism:gitLog` | `handle` | Git log with formatted output |
| `prism:gitBranchInfo` | `handle` | Branch + ahead/behind info |

**Workspace and project handlers:**

| Channel | Method | Purpose |
|---------|--------|---------|
| `prism:discoverProjects` | `handle` | Workspace discovery (50-entry cap) |
| `prism:addWorkspace` | `handle` | Add workspace directory |
| `prism:browseAndAddWorkspace` | `handle` | Browse + add workspace |
| `prism:switchProject` | `handle` | Switch active project directory |
| `prism:listWorktrees` | `handle` | List git worktrees |
| `prism:createWorktree` | `handle` | Create git worktree |
| `prism:deleteWorktree` | `handle` | Delete git worktree |

**Quality gate handlers:**

| Channel | Method | Purpose |
|---------|--------|---------|
| `prism:executeGate` | `handle` | Quality gate execution with AbortController |
| `prism:cancelGate` | `handle` | Cancel running quality gate |

**Research and plans handlers:**

| Channel | Method | Purpose |
|---------|--------|---------|
| `prism:getResearch` | `handle` | Research file discovery |
| `prism:getPlans` | `handle` | Plans file discovery |

**API key management handlers:**

| Channel | Method | Purpose |
|---------|--------|---------|
| `prism:getApiKey` | `handle` | Retrieve stored API key |
| `prism:setApiKey` | `handle` | Store API key (via ElectronSecretStorage) |
| `prism:deleteApiKey` | `handle` | Remove stored API key |
| `prism:validateApiKey` | `handle` | Validate API key with Anthropic |

**Layout persistence handlers:**

| Channel | Method | Purpose |
|---------|--------|---------|
| `prism:saveLayoutState` | `handle` | Persist IDE layout state |
| `prism:loadLayoutState` | `handle` | Restore IDE layout state |

## Bidirectional Communication

```
Renderer → Main:  ipcRenderer.invoke('grpc_request', payload)
                  → ipcMain.handle('grpc_request', handler)

Main → Renderer:  mainWindow.webContents.send('grpc_response', msg)
                  → ipcRenderer.on('grpc_response', callback)
```

## Response Routing

The bridge creates a `postMessage` function that routes all responses through the Electron IPC channel:

```typescript
this.controller.setPostMessageFn(async (msg) => {
  mainWindow.webContents.send('grpc_response', msg);
});
```

This replaces `webview.postMessage(msg)` from the VS Code extension with an equivalent Electron pattern.

## Project Management

The bridge tracks the current project directory and exposes:
- `openProject()`: Show native folder picker → set project dir
- `setProjectDir(dir)`: Directly set project dir (used by CLI args and saved state)
- `currentProjectDir`: Getter for current project path
