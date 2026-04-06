---
title: Source Structure
description: Complete file tree for the Prism VS Code Extension, including webview apps, task subsystem, and shared package references.
outline: [2, 3]
---

# Source Structure

```
apps/prism-vscode/
├── package.json                          # Extension manifest, commands, views, settings
├── tsconfig.json                         # TypeScript configuration
├── esbuild.mjs                           # Build script (aliases @prism-core → ../../packages/prism-core/src)
├── jest.config.js                        # Test config (note: some collectCoverageFrom paths are stale)
├── dist/                                 # Compiled extension bundle
├── media/                                # Icons and assets
├── assets/                               # Office game assets (copied to dist/assets/ via esbuild)
│   ├── char_0.png – char_5.png          # Character sprite PNGs
│   ├── floors.png                       # Floor tile sheet
│   ├── walls.png                        # Wall tile sheet
│   ├── default-layout.json             # Default office layout
│   └── furniture/                       # 33 furniture PNGs + furniture-catalog.json
│
├── src/
│   ├── extension.ts                      # Main entry point — activation, registration
│   │
│   ├── hosts/vscode/                     # VS Code integration layer
│   │   ├── VscodeWebviewProvider.ts      # Sidebar webview provider
│   │   ├── PrismPanelProvider.ts         # Bottom panel provider (Monitor/Office/Workspaces)
│   │   └── OfficeViewProvider.ts         # Office-specific logic
│   │
│   ├── providers/                        # Native tree view providers
│   │   ├── research-tree.ts             # Research documents tree
│   │   ├── plans-tree.ts                # Plans tree with context menus
│   │   ├── stories-tree.ts              # Stories tree with color-coded status
│   │   └── workflow-status.ts           # Status bar items
│   │
│   ├── core/                             # Core business logic
│   │   ├── controller/
│   │   │   └── index.ts                 # PrismController (central orchestrator, extends BasePrismController from @prism-core)
│   │   ├── api/                         # API types and Claude SDK
│   │   ├── task/                        # Task execution subsystem (see below)
│   │   └── webview/                     # Webview provider base class
│   │
│   ├── office/                           # Office agent management (VSCode-specific)
│   │   ├── agentManager.ts             # Agent lifecycle
│   │   └── fileWatcher.ts              # JSONL file watcher for Office agent terminals (249 lines)
│   │
│   ├── prism/                            # .prism/ directory handling (VSCode-specific tests only)
│   │   └── __tests__/
│   │       ├── signals.test.ts          # Imports from @prism-core
│   │       ├── stories.test.ts
│   │       └── progress.test.ts
│   │
│   └── core/controller/prism/__tests__/
│       └── workflow.test.ts              # Workflow state machine tests (imports @prism-core)
│
│   # NOTE: The following directories moved to packages/prism-core/:
│   #   src/core/controller/prism/   → packages/prism-core/src/core/controller/prism/
│   #   src/core/prompts/            → packages/prism-core/src/core/prompts/
│   #   src/claude/                  → packages/prism-core/src/claude/
│   #   src/office/agentBridge.ts    → packages/prism-core/src/office/agentBridge.ts
│   #   src/office/assetLoader.ts    → packages/prism-core/src/office/assetLoader.ts
│   #   src/office/layoutPersistence.ts → packages/prism-core/src/office/layoutPersistence.ts
│   #   src/prism/                   → packages/prism-core/src/prism/
│   #   src/shared/                  → packages/prism-core/src/shared/
│   # All consumed via @prism-core/* path aliases.
│
├── webview-ui/                           # Sidebar React webview (thin shell)
│   ├── src/
│   │   ├── main.tsx                     # React root
│   │   ├── App.tsx                      # View switcher (imports from @prism-ui)
│   │   ├── Providers.tsx                # PrismStateContextProvider wrapper
│   │   ├── vscode.ts                    # VSCode postMessage transport adapter
│   │   ├── lib/utils.ts                # Utilities
│   │   ├── index.css
│   │   └── theme/
│   │       ├── spectral.css
│   │       └── theme.css
│   └── vite.config.ts
│
│   # NOTE: The following moved to packages/prism-ui/:
│   #   ChatView.tsx          → packages/prism-ui/src/views/ChatView.tsx
│   #   SpectrumView.tsx      → packages/prism-ui/src/views/SpectrumView.tsx
│   #   WelcomeView.tsx       → packages/prism-ui/src/components/WelcomeView.tsx
│   #   PhaseIndicator.tsx    → packages/prism-ui/src/components/workflow/PhaseIndicator.tsx
│   #   ChatRow.tsx/ToolRow.tsx → packages/prism-ui/src/components/chat/
│   #   MarkdownBlock.tsx     → packages/prism-ui/src/components/common/MarkdownBlock.tsx
│   #   SpectrumControls.tsx  → packages/prism-ui/src/components/spectrum/
│   #   StoryList.tsx         → packages/prism-ui/src/components/spectrum/StoryList.tsx
│   #   PrismStateContext.tsx → packages/prism-ui/src/context/PrismStateContext.tsx
│   #   services/grpc-client*.ts → packages/prism-ui/src/services/
│   # All consumed via @prism-ui/* path aliases.
│
├── webview-panel/                        # Bottom panel React webview
│   ├── src/
│   │   ├── MonitorView.tsx              # Quality gates, execution history
│   │   └── WorkspacesView.tsx           # Project browser, worktrees
│   └── vite.config.ts
│
│   # NOTE: Office components moved to packages/prism-ui/src/office/:
│   #   OfficeCanvas.tsx   → packages/prism-ui/src/office/components/OfficeCanvas.tsx
│   #   engine/            → packages/prism-ui/src/office/engine/
│   #   office/editor/     → packages/prism-ui/src/office/editor/
│   #   sprites/           → packages/prism-ui/src/office/sprites/
│   #   layout/            → packages/prism-ui/src/office/layout/
│
└── webview-office/                       # Standalone Office webview app (NEW)
    ├── package.json                     # React 19.2.4, Vite 6.4.1
    ├── vite.config.ts                   # Dev port 5174
    ├── tsconfig.json
    └── src/
        └── main.tsx                     # Sets up OfficeApp via @prism-ui with VSCode postMessage transport
```

## `src/core/task/` — Task Execution Subsystem

The task subsystem handles tool execution during chat sessions:

```
src/core/task/
├── index.ts              # Task module entry
├── task-state.ts         # Task state management
├── message-state.ts      # Message state management
└── tools/
    ├── coordinator.ts    # Tool coordinator
    ├── types.ts          # Tool type definitions
    └── handlers/
        ├── read-file.ts
        ├── write-file.ts
        ├── edit-file.ts
        ├── execute-command.ts
        ├── search-files.ts
        ├── list-files.ts
        ├── ask-followup.ts
        └── attempt-completion.ts
```

## Walkthroughs

The extension defines a walkthrough `prism.gettingStarted` in `package.json` with 4 steps:

| Step | Description |
|------|-------------|
| `welcome` | Welcome to Prism |
| `init-prism` | Initialize `.prism/` directory |
| `configure-claude` | Configure Claude CLI |
| `first-research` | Run your first research |
