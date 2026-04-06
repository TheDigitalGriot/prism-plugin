---
title: Source Structure
description: Complete file tree for the Electron desktop app, including main process, preload, office subsystem, and React SPA.
outline: [2, 3]
---

# Electron Source Structure

```
apps/prism-electron/
├── src/                               # Main process (Node.js + TypeScript)
│   ├── main.ts                        # App lifecycle, window, menu, CLI args (111 lines)
│   ├── preload.ts                     # contextBridge: electronAPI + office IPC (62 lines)
│   ├── window-state.ts                # Window bounds + lastProjectDir persistence (58 lines)
│   ├── renderer.tsx                   # Renderer entry (minimal, unused — webview-ui is root)
│   ├── App.tsx                        # Placeholder (webview-ui/src/App.tsx is real app)
│   │
│   ├── hosts/electron/                # Platform shell (mirrors hosts/vscode/)
│   │   ├── ElectronIPCBridge.ts      # ipcMain handler registration + controller wiring (511 lines)
│   │   └── ElectronPrismController.ts # VSCode-free controller (thin — extends BasePrismController, 45 lines)
│   │
│   ├── auth/                          # Authentication (NEW)
│   │   └── ElectronSecretStorage.ts  # SecretStore via Electron safeStorage API (102 lines)
│   │
│   ├── office/                        # Office subsystem (NEW — 692 lines combined)
│   │   ├── ElectronAgentManager.ts   # Spawns Claude CLI, watches JSONL transcripts (386 lines)
│   │   └── ElectronOfficeProvider.ts # Orchestrates office: assets, agents, messages, layout (306 lines)
│   │
│   └── prism/                         # Electron-specific Prism domain modules
│       │   # NOTE: config.ts (79 lines), watcher.ts (72 lines), init.ts (50 lines)
│       │   # have moved to packages/prism-core/src/prism/ and are consumed via @prism-core/*.
│       │   # This directory may be empty or contain thin wrappers.
│
├── webview-ui/                        # React SPA (separate Vite build root, dev port 5174)
│   ├── src/
│   │   ├── main.tsx                   # React root entry
│   │   ├── App.tsx                    # Top-level IDE shell (AppShell + view switcher)
│   │   ├── Providers.tsx              # PrismStateContextProvider
│   │   ├── electron.ts               # Transport adapter (replaces vscode.ts)
│   │   │
│   │   ├── services/                  # gRPC clients (imported from @prism-ui or local)
│   │   │   ├── grpc-client-base.ts
│   │   │   └── grpc-client.ts
│   │   │
│   │   ├── context/
│   │   │   ├── PrismStateContext.tsx  # Global state (hydrated from main process)
│   │   │   └── LayoutContext.tsx      # IDE shell layout state management (233 lines, NEW)
│   │   │
│   │   ├── views/                     # View components (NEW)
│   │   │   ├── FileContentView.tsx   # File content viewer with syntax highlighting (215 lines)
│   │   │   ├── GitGraphView.tsx      # Visual git commit graph (309 lines)
│   │   │   └── StoryDetailView.tsx   # Story details with progress bars + file lists (291 lines)
│   │   │
│   │   ├── components/
│   │   │   ├── layout/               # IDE shell layout components (NEW — 8 files)
│   │   │   │   ├── ActivityBar.tsx   # Vertical icon bar, left rail (200 lines)
│   │   │   │   ├── AppShell.tsx      # Top-level IDE layout shell (178 lines)
│   │   │   │   ├── BottomPanel.tsx   # Collapsible bottom panel area (211 lines)
│   │   │   │   ├── BottomStatusBar.tsx # Status bar at bottom (101 lines)
│   │   │   │   ├── ContentRail.tsx   # Content panel for tree views (138 lines)
│   │   │   │   ├── FloatingChatPill.tsx # Floating chat trigger button (63 lines)
│   │   │   │   ├── HeaderBar.tsx     # Top header with phase buttons (392 lines)
│   │   │   │   └── TabBar.tsx        # Tab bar for editor area (164 lines)
│   │   │   │
│   │   │   ├── panels/               # Panel components (NEW — 6 files)
│   │   │   │   ├── FilesPanel.tsx    # File tree panel
│   │   │   │   ├── GitPanel.tsx      # Git status panel
│   │   │   │   ├── MonitorPanel.tsx  # Quality gates panel
│   │   │   │   ├── SpectrumPanel.tsx # Spectrum execution panel
│   │   │   │   ├── StoriesPanel.tsx  # Stories list panel
│   │   │   │   └── WorkspacePanel.tsx # Workspace management panel
│   │   │   │
│   │   │   ├── chat/                  # ChatRow, ChatTextArea, ToolRow (via @prism-ui)
│   │   │   ├── spectrum/             # ActivityLog, ProgressBar, StoryList, Controls (via @prism-ui)
│   │   │   ├── workflow/             # PhaseIndicator (via @prism-ui)
│   │   │   └── common/               # MarkdownBlock, shared UI (via @prism-ui)
│   │   │
│   │   ├── office/                    # Office transport (NEW)
│   │   │   └── electronOfficeTransport.ts  # Wires canvas office to Electron IPC (36 lines)
│   │   │
│   │   ├── lib/                       # Utilities (cn, formatters)
│   │   └── theme/                     # theme.css (--prism-* vars), spectral.css
│   │
│   ├── package.json                   # React SPA dependencies
│   ├── vite.config.ts                 # Vite SPA config (port 5174, @prism-ui alias)
│   └── tsconfig.json                  # React/JSX TypeScript config (@prism-ui/* alias)
│
├── package.json                       # Main app dependencies + scripts
├── forge.config.ts                    # Electron Forge config (extraResource: ['../prism-vscode/assets'])
├── tsconfig.json                      # Main process config (paths: @prism-core/* dual fallback)
├── vite.main.config.mts               # Vite config for main process (prismCoreAliasPlugin)
├── vite.preload.config.mts            # Vite config for preload script
└── vite.renderer.config.mts           # Vite config for renderer (root: webview-ui/, @prism-ui alias)
```

## Import Strategy

The Electron app imports shared business logic using TypeScript path aliases with a **dual-path fallback** — it checks `packages/prism-core/src` first, then falls back to `../prism-vscode/src`:

```json
// tsconfig.json
{
  "paths": {
    "@prism-core/*": ["../../packages/prism-core/src/*", "../prism-vscode/src/*"]
  }
}
```

```typescript
// vite.main.config.mts — custom plugin with dual resolution
function prismCoreAliasPlugin() {
  // Checks packages/prism-core/src first, falls back to ../prism-vscode/src
}
```

Additionally, a **`@prism-ui/*` alias** provides access to shared React components:

```json
// webview-ui/tsconfig.json
{
  "paths": {
    "@prism-ui/*": ["../../../packages/prism-ui/src/*"]
  }
}
```

Both `webview-ui/vite.config.ts` and `vite.renderer.config.mts` set up the same `@prism-ui` alias. This means both apps remain independently buildable while sharing all platform-agnostic code.
