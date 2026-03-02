---
title: Electron Architecture
description: High-level architecture diagram and complete data flow for the Prism Electron desktop app.
outline: [2, 3]
---

# Electron Architecture

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Electron Main Process                       │
│                                                                     │
│  ┌─────────────┐    ┌──────────────────────────────────────────┐   │
│  │   main.ts   │───▶│         ElectronIPCBridge                │   │
│  │  (window +  │    │  ┌────────────────────────────────────┐  │   │
│  │   menu +    │    │  │    ElectronPrismController         │  │   │
│  │   lifecycle)│    │  │                                    │  │   │
│  └─────────────┘    │  │  WorkflowStateMachine              │  │   │
│                     │  │  StoriesManager                    │  │   │
│  ┌─────────────┐    │  │  PrismWatcher (chokidar)           │  │   │
│  │ preload.ts  │    │  │  ClaudeRunner                      │  │   │
│  │ (context    │    │  │  ModeBridge                         │  │   │
│  │  bridge)    │    │  │  SpectrumEngine + SpectrumRunner    │  │   │
│  └──────┬──────┘    │  └────────────────────────────────────┘  │   │
│         │           └──────────────────────────────────────────┘   │
│         │                          │                                │
│─────────┼──────────────────────────┼────────────────────────────────│
│         │    contextBridge         │  ipcMain ↕ ipcRenderer        │
│─────────┼──────────────────────────┼────────────────────────────────│
│         ▼                          ▼                                │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    Renderer Process (React SPA)              │   │
│  │                                                             │   │
│  │  ┌──────────┐   ┌───────────────┐   ┌──────────────────┐   │   │
│  │  │electron.ts│──▶│grpc-client-   │──▶│  PrismState      │   │   │
│  │  │(transport)│   │base.ts        │   │  Context         │   │   │
│  │  └──────────┘   └───────────────┘   └────────┬─────────┘   │   │
│  │                                               │             │   │
│  │  ┌────────────────────────────────────────────┴──────────┐  │   │
│  │  │              React Component Tree                      │  │   │
│  │  │  WelcomeView │ ChatView │ SpectrumView                │  │   │
│  │  └────────────────────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

## Data Flow

```
User types message in ChatView
         │
         ▼
ChatServiceClient.sendMessage(text)    [webview-ui/src/services/grpc-client.ts]
         │
         ▼
ProtoBusClient.makeUnaryRequest()      [webview-ui/src/services/grpc-client-base.ts]
         │  Generate UUID4 request_id
         │  Post via electronApi.postMessage()
         ▼
window.electronAPI.invoke('grpc_request', payload)    [webview-ui/src/electron.ts]
         │
    ═══════════════  IPC boundary (contextBridge)  ═══════════════
         │
         ▼
ipcMain.handle('grpc_request')         [src/hosts/electron/ElectronIPCBridge.ts]
         │
         ▼
handleGrpcRequest() → route to handler [src/hosts/electron/ElectronPrismController.ts]
         │  'ChatService.sendMessage' handler
         ▼
ClaudeRunner.runStreaming()             [@prism-core/claude/runner.ts]
         │  Spawns claude CLI process
         │  Streams text + tool events
         ▼
controller.updateState() → _broadcastState()
         │
         ▼
mainWindow.webContents.send('grpc_response', msg)
         │
    ═══════════════  IPC boundary (contextBridge)  ═══════════════
         │
         ▼
window.electronAPI.on('grpc_response') [webview-ui/src/electron.ts]
         │  Re-dispatch as window MessageEvent
         ▼
grpc-client-base.ts listener           [matching request_id]
         │
         ▼
PrismStateContext re-renders → ChatView updates
```
