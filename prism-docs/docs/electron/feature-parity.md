---
title: Three-Platform Feature Parity
description: Architecture comparison and code sharing breakdown between CLI Dashboard, VS Code Extension, and Electron Desktop App.
outline: [2, 3]
---

# Three-Platform Feature Parity

## Architecture Comparison

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Shared (.prism/ directory)                           │
│                                                                             │
│  stories.json │ research/ │ plans/ │ validation/ │ spectrum/ │ handoffs/    │
└─────────────────────────────────────────────────────────────────────────────┘
        │                    │                    │
        ▼                    ▼                    ▼
┌──────────────┐   ┌──────────────────┐   ┌──────────────────┐
│  CLI (Go)    │   │  VS Code (TS)    │   │  Electron (TS)   │
│              │   │                  │   │                  │
│  Bubble Tea  │   │  webview.postMsg │   │  ipcMain/Render  │
│  TUI         │   │  + VSCode APIs   │   │  + Node.js APIs  │
│              │   │                  │   │                  │
│  Terminal    │   │  IDE-embedded    │   │  Standalone      │
│  rendering   │   │  panels         │   │  window          │
└──────────────┘   └──────────────────┘   └──────────────────┘
```

## Code Sharing Between VS Code and Electron

The Electron app shares approximately 90% of its codebase with the VS Code extension:

| Layer | Shared? | Notes |
|-------|---------|-------|
| Workflow state machine | Yes | Imported via `@prism-core/core/controller/prism/workflow` |
| Stories manager | Yes | Imported via `@prism-core/core/controller/prism/stories` |
| Signal parser | Yes | Imported via `@prism-core/prism/signals` |
| Claude runner | Yes | Imported via `@prism-core/claude/runner` |
| gRPC handler | Yes | Imported via `@prism-core/core/controller/grpc-handler` |
| Base controller | Yes | Imported via `@prism-core/core/controller/BasePrismController` |
| Spectrum engine/runner | Yes | Imported via `@prism-core/core/controller/prism/spectrum*` |
| ModeBridge (skills) | Yes | Imported via `@prism-core/core/controller/prism/mode-bridge` |
| React components | Yes | Imported via `@prism-ui/*` (ChatView, SpectrumView, all sub-components) |
| gRPC clients | Yes | Imported via `@prism-ui/services/*` |
| State context | Yes | Imported via `@prism-ui/context/PrismStateContext` |
| Office engine | Yes | Imported via `@prism-ui/office/*` |
| CSS bridge | Yes | `@prism-ui/styles/bridge.css` maps `--prism-*` tokens per platform |
| Platform shell | New | `ElectronIPCBridge` (511 lines), `ElectronPrismController` (45 lines) |
| Auth | New | `ElectronSecretStorage` (102 lines, OS-level encryption via safeStorage) |
| Office subsystem | New | `ElectronAgentManager` (386 lines), `ElectronOfficeProvider` (306 lines) |
| IDE shell | New | Layout components (8 files), panel components (6 files), view components (3 files) |
| Theme CSS | Thin shell | `webview-ui/src/theme/` with `--prism-*` custom properties |
