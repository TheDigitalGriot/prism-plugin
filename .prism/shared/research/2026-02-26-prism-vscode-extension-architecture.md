---
date: 2026-02-26T00:00:00Z
researcher: Claude
repository: prism-plugin
branch: main
topic: "Prism VS Code Extension Architecture Research"
tags: [research, vscode, extension, cline, architecture, webview, react]
status: complete
last_updated: 2026-02-26
last_updated_by: Claude
---

# Prism VS Code Extension — Architecture Research

## Research Question

How should a Prism VS Code extension be architectured to deliver the same 4-phase workflow (Research → Plan → Implement → Validate), Spectrum autonomous execution, and rich UI experience currently provided by the Prism CLI TUI — using the forked Cline VS Code extension as the architectural reference?

**Target directory**: `cmd/prism-vscode/` (currently empty, alongside `cmd/prism-cli/` and `cmd/prism-electron/`)

---

## 1. Executive Summary

The Prism VS Code extension should be built at `cmd/prism-vscode/` by adapting the Cline fork's battle-tested architecture (gRPC-over-postMessage IPC, React 18 webview, plugin-per-proto-service pattern) while replacing Cline's general-purpose AI assistant UX with Prism's structured 4-phase workflow and Spectrum autonomous execution system. The CLI's 10-plugin system maps naturally to VS Code's multiple view container paradigm (sidebar panel, webview panels, tree views, status bar).

### Key Architectural Decisions

| Decision | Recommendation | Rationale |
|----------|---------------|-----------|
| Working directory | `cmd/prism-vscode/` | Parallel to `cmd/prism-cli/` and `cmd/prism-electron/` |
| Base framework | Adapt Cline patterns, build fresh | Reuse IPC/webview patterns without forking baggage |
| IPC protocol | gRPC-over-postMessage (from Cline) | Battle-tested, type-safe via protobuf, supports streaming |
| Webview framework | React 18 + Vite + Tailwind v4 | Already working in Cline, excellent VS Code theme integration |
| AI connection | Claude Agent SDK (Max subscription) | Aligns with existing Prism plugin architecture |
| State management | React Context + gRPC subscriptions | Proven pattern from Cline, no Redux overhead |
| CLI relationship | Complementary, not replacement | CLI for terminal-first users, VS Code for IDE-first users |

---

## 2. Cline Architecture Analysis

### 2.1 Extension Host Layer

The extension host follows a clean separation of concerns:

```
src/
├── extension.ts          # Activation: 5-phase lifecycle (750 lines)
├── common.ts             # Cross-platform init (173 lines)
├── core/
│   ├── controller/       # Central orchestrator (1,044 lines)
│   │   ├── index.ts      # Task lifecycle, state broadcast
│   │   ├── grpc-handler.ts # gRPC request dispatcher
│   │   └── state/        # State subscription handlers
│   ├── task/             # AI conversation loop (3,547 lines)
│   │   ├── index.ts      # Recursive request cycle
│   │   ├── ToolExecutor.ts # Tool coordination (625 lines)
│   │   └── tools/handlers/ # Per-tool handler classes
│   ├── webview/          # WebviewProvider base (242 lines)
│   └── api/              # Provider abstraction (487 lines, 42 providers)
├── hosts/vscode/         # VS Code-specific implementations
├── services/
│   ├── mcp/              # McpHub (1,670 lines)
│   └── ...               # Auth, telemetry, browser, tree-sitter
└── shared/               # Types shared between host and webview
```

**Key pattern**: `HostProvider` singleton provides dependency injection with factory functions, allowing the same core to run in VS Code, JetBrains, and CLI environments.

### 2.2 IPC Bridge (gRPC-over-postMessage)

The most sophisticated part of Cline's architecture:

- **Only 2 message types**: `grpc_request` (webview→host) and `grpc_response` (host→webview)
- **16 proto files** define all services: ui, state, task, models, mcp, account, etc.
- **Code generation**: `scripts/generate-protobus-setup.mjs` generates typed clients for webview and handler maps for host
- **Streaming support**: Persistent subscriptions where the host stores `responseStream` callbacks in Sets and broadcasts to all subscribers
- **State flow**: `subscribeToState` opens a streaming subscription; `Controller.postStateToWebview()` iterates all subscribers to push `ExtensionState` (60+ fields)

### 2.3 Webview UI Layer

```
webview-ui/
├── src/
│   ├── main.tsx          # React 18 createRoot
│   ├── App.tsx           # View switching (99 lines)
│   ├── Providers.tsx     # 5-layer provider hierarchy
│   ├── context/
│   │   └── ExtensionStateContext.tsx  # Central state (908 lines, 12+ subscriptions)
│   ├── components/
│   │   ├── chat/         # ChatView, ChatRow, ChatTextArea
│   │   ├── settings/     # SettingsView
│   │   ├── history/      # HistoryView
│   │   └── ui/           # shadcn/ui primitives
│   ├── services/
│   │   └── grpc-client-base.ts  # ProtoBusClient (118 lines)
│   └── theme.css         # 80+ VS Code CSS variable mappings
└── vite.config.ts        # Build config (141 lines)
```

**Theme integration**: Tailwind v4 `@theme` block maps color tokens directly to `var(--vscode-*)` CSS properties, providing automatic dark/light theme adaptation.

### 2.4 Tool System

- 26 built-in tools via `ClineDefaultTool` enum
- MCP tools auto-discovered via `McpHub.fetchToolsList()`
- Each handler implements `IFullyManagedTool` with `getDescription()`, `handlePartialBlock()`, `execute()`
- Approval flow: auto-approve check → user approval → preToolUse hook → execute → postToolUse hook
- Native tool calling supported alongside XML-based tool calling

### 2.5 Task Execution Pipeline

```
API Request → Stream Processing → Message Parsing → Tool Execution → Result → Next Request
     ↓              ↓                   ↓                ↓              ↓
createMessage   StreamResponse     parseAssistant    ToolExecutor   pushToolResult
(ApiStream)     Handler            MessageV2         Coordinator    (text/tool_result)
                                                          ↓
                                                     Per-tool Handler
                                                     (ReadFile, Execute, MCP...)
```

---

## 3. Prism CLI Feature Mapping

### 3.1 Plugin-to-VS-Code-View Mapping

| CLI Plugin | CLI Lines | VS Code Equivalent | Implementation |
|------------|-----------|-------------------|----------------|
| **Home** | 214 | Welcome tab in sidebar webview | React component in main webview |
| **Research** | 224 | Research tree view + markdown preview | TreeDataProvider + webview panel |
| **Plans** | 239 | Plans tree view + markdown preview | TreeDataProvider + webview panel |
| **Spectrum** | 1,218 | Spectrum dashboard webview panel | Dedicated webview with real-time updates |
| **Files** | 735 | VS Code's native file explorer | Leverage built-in, add tree decorations |
| **Git** | 884 | VS Code's native SCM + GitLens | Leverage built-in SCM API |
| **Agent** | 390 | Sidebar chat panel (Cline-style) | React chat UI in sidebar webview |
| **Monitor** | 547 | Status bar + output channel + webview | StatusBarItem + OutputChannel + panel |
| **Workspaces** | 1,082 | Workspace tree view | TreeDataProvider + commands |
| **Onboarding** | 501 | Walkthrough API | VS Code built-in walkthrough contribution |

### 3.2 Features That Map Directly to VS Code APIs

| CLI Feature | VS Code API |
|-------------|-------------|
| Tab bar navigation | `viewsContainers` with `activitybar` |
| Sidebar info panels | `TreeDataProvider` for structured data |
| Status bar indicators | `StatusBarItem` with color/priority |
| Modal dialogs | `window.showInformationMessage` with buttons, or webview modals |
| File editing | `workspace.applyEdit()` + `TextEditor` |
| Git operations | `extensions.getExtension('vscode.git')` or shell commands |
| Command palette | `commands.registerCommand()` |
| File watching | `workspace.createFileSystemWatcher()` |
| Keyboard shortcuts | `keybindings` in `package.json` |
| Terminal output | `window.createTerminal()` + `OutputChannel` |

### 3.3 Features Requiring Custom Webview Implementation

| Feature | Why Custom |
|---------|-----------|
| Spectrum execution dashboard | Real-time animations, progress bars, story lists |
| Agent chat interface | Rich message rendering, tool-use visualization |
| Research/Plans viewer | Custom markdown rendering with Prism metadata |
| Workflow phase navigator | 4-phase visual indicator with state transitions |
| Spring animations | Not possible with native VS Code APIs |

---

## 4. Architecture Proposal

### 4.1 High-Level Architecture

```
cmd/prism-vscode/
├── src/                              # Extension Host (Node.js/TypeScript)
│   ├── extension.ts                  # Activation, command registration
│   ├── core/
│   │   ├── controller/               # Central orchestrator (adapted from Cline)
│   │   │   ├── index.ts              # PrismController
│   │   │   ├── grpc-handler.ts       # gRPC bridge (from Cline pattern)
│   │   │   └── prism/                # Prism-specific handlers
│   │   │       ├── workflow.ts        # 4-phase workflow state machine
│   │   │       ├── spectrum.ts        # Spectrum execution engine
│   │   │       └── stories.ts         # stories.json management
│   │   ├── task/                     # AI conversation (adapted from Cline)
│   │   │   ├── index.ts              # PrismTask (Cline Task + phase awareness)
│   │   │   └── tools/                # Prism-specific tool handlers
│   │   │       ├── prism-research.ts  # Research phase tool
│   │   │       ├── prism-plan.ts      # Plan phase tool
│   │   │       └── prism-validate.ts  # Validate phase tool
│   │   ├── webview/                  # WebviewProvider (from Cline pattern)
│   │   └── api/                      # Claude Agent SDK provider
│   ├── providers/                    # VS Code view providers
│   │   ├── sidebar.ts                # Main sidebar webview
│   │   ├── research-tree.ts          # Research TreeDataProvider
│   │   ├── plans-tree.ts             # Plans TreeDataProvider
│   │   ├── stories-tree.ts           # Stories TreeDataProvider
│   │   ├── workflow-status.ts        # Status bar provider
│   │   └── spectrum-panel.ts         # Spectrum webview panel
│   ├── prism/                        # Core Prism integration
│   │   ├── config.ts                 # .prism/ directory detection
│   │   ├── stories.ts                # stories.json parser (from CLI domain/)
│   │   ├── signals.ts                # Signal protocol parser (from CLI domain/)
│   │   ├── progress.ts               # progress.md management
│   │   └── watcher.ts                # File watcher for story/plan state
│   ├── claude/                       # Claude CLI/SDK runner
│   │   ├── runner.ts                 # Process spawning (adapted from CLI claude/)
│   │   ├── parser.ts                 # Output parsing
│   │   └── events.ts                 # Stream event types
│   └── shared/                       # Types shared with webview
│       ├── proto/                    # Protobuf definitions
│       └── types.ts                  # Prism-specific types
├── webview-ui/                       # React Frontend (Vite)
│   ├── src/
│   │   ├── App.tsx                   # Main app with view routing
│   │   ├── Providers.tsx             # Provider hierarchy
│   │   ├── context/
│   │   │   └── PrismStateContext.tsx  # Prism workflow state
│   │   ├── views/
│   │   │   ├── ChatView.tsx          # Agent chat (adapted from Cline)
│   │   │   ├── SpectrumView.tsx      # Spectrum dashboard
│   │   │   ├── ResearchView.tsx      # Research browser
│   │   │   ├── PlansView.tsx         # Plans browser
│   │   │   ├── WorkflowView.tsx      # Phase navigator
│   │   │   └── WelcomeView.tsx       # Onboarding
│   │   ├── components/
│   │   │   ├── chat/                 # Chat components (from Cline patterns)
│   │   │   ├── spectrum/             # Spectrum components
│   │   │   │   ├── StoryList.tsx
│   │   │   │   ├── ProgressBar.tsx
│   │   │   │   ├── ActivityLog.tsx
│   │   │   │   └── SignalStatus.tsx
│   │   │   ├── workflow/             # Workflow phase components
│   │   │   │   ├── PhaseIndicator.tsx
│   │   │   │   └── PhaseTransition.tsx
│   │   │   └── ui/                   # shadcn/ui components
│   │   ├── theme/                    # Spectral color system
│   │   │   ├── spectral.css          # Prism gradient colors
│   │   │   └── theme.css             # VS Code variable mappings
│   │   └── services/
│   │       └── grpc-client.ts        # Generated gRPC clients
│   └── vite.config.ts
├── proto/                            # Protobuf definitions
│   └── prism/
│       ├── workflow.proto            # Workflow state service
│       ├── spectrum.proto            # Spectrum execution service
│       ├── stories.proto             # Stories management service
│       └── ui.proto                  # UI state service
└── package.json                      # Extension manifest
```

### 4.2 What to Reuse from Cline (Patterns, Not Fork)

| Component | Action | Rationale |
|-----------|--------|-----------|
| gRPC-over-postMessage IPC | **Adapt pattern** | Best-in-class webview communication |
| WebviewProvider base | **Adapt** | Solid HTML generation with CSP |
| ProtoBusClient | **Adapt** | Reliable unary + streaming |
| grpc-handler.ts | **Adapt** | Clean dispatch pattern |
| Webview build system (Vite) | **Reuse config** | Fast HMR, good DX |
| Theme CSS integration | **Reuse + extend** | Add Prism spectral colors |
| shadcn/ui components | **Reuse** | Good base components |
| React-virtuoso for chat | **Reuse** | Proven virtualized scrolling |
| react-markdown rendering | **Reuse** | Good markdown display |
| esbuild for extension | **Reuse config** | Fast bundling |

### 4.3 What to Replace from Cline

| Component | Replace With | Rationale |
|-----------|-------------|-----------|
| 42 API providers | Claude Agent SDK only | Prism is Claude-specific |
| General chat UX | Phase-aware chat | Chat shows current workflow phase |
| Account/auth system | Max subscription auth | Simpler auth model |
| Code actions | Prism commands | `/prism-research`, `/prism-plan`, etc. |
| Settings view | Prism settings | `.prism/` config, phase preferences |
| History view | Workflow history | Research/Plan/Validate artifacts |
| MCP view | Prism agents view | Agent status and management |
| Welcome/onboarding | Prism setup wizard | `.prism/` init, stories.json setup |

### 4.4 What to Add (New)

| Component | Purpose |
|-----------|---------|
| Workflow state machine | 4-phase tracking with transitions |
| Spectrum execution engine | Story loop with signal parsing |
| Phase-aware system prompt | Dynamic system prompt per phase |
| Research/Plans tree views | Native VS Code tree views for `.prism/` |
| Stories tree view | Visual story status with decorations |
| Spectral color theme | Prism's gradient color system |
| Progress file management | `progress.md` read/write |
| Quality gate runner | Run verification commands |
| Worktree management | Create/switch git worktrees |

---

## 5. Connection Layer: Claude Agent SDK

### 5.1 Replacing Cline's API Layer

Cline's `buildApiHandler()` with 42 provider switch cases gets replaced with a single Claude Agent SDK client:

```typescript
// Instead of Cline's provider abstraction:
import { ClaudeSDKClient } from './claude-sdk-client';

class PrismApiHandler implements ApiHandler {
  private client: ClaudeSDKClient;

  async createMessage(systemPrompt, messages, tools?): ApiStream {
    // Use Claude Agent SDK with Max subscription
    return this.client.stream(systemPrompt, messages, tools);
  }
}
```

### 5.2 Custom MCP Tools for Prism

The Prism plugin's custom MCP server concept translates directly:

```typescript
// Extension host registers Prism tools via MCP
const prismMcpServer = new PrismMcpServer({
  tools: [
    { name: 'prism_workflow_status', handler: getWorkflowStatus },
    { name: 'prism_read_stories', handler: readStories },
    { name: 'prism_update_story', handler: updateStory },
    { name: 'prism_read_plan', handler: readPlan },
    { name: 'prism_read_research', handler: readResearch },
  ]
});
```

---

## 6. Spectral Color System

The CLI's 4-stop gradient (Blue → Teal → Green → Amber) maps to CSS:

```css
:root {
  --prism-blue: #3B82F6;
  --prism-teal: #14B8A6;
  --prism-green: #22C55E;
  --prism-amber: #F59E0B;
  --prism-purple: #7C3AED;  /* Primary accent */

  /* Phase colors */
  --prism-phase-research: var(--prism-blue);
  --prism-phase-plan: var(--prism-teal);
  --prism-phase-implement: var(--prism-green);
  --prism-phase-validate: var(--prism-amber);
}
```

---

## 7. Key Patterns to Preserve from CLI

1. **Plugin architecture**: CLI's 10-plugin system → VS Code's view container + webview panels
2. **EventBus**: CLI's inter-plugin pub/sub → VS Code's `EventEmitter` pattern
3. **Signal protocol**: XML tags parsed from Claude output (keep exact same protocol)
4. **stories.json schema**: Same format for cross-tool compatibility
5. **progress.md**: Same format for shared learning
6. **Phase transitions**: Same state machine logic
7. **Quality gates**: Same verification command runner
8. **Documentarian principle**: Same agent behavior constraints

---

## 8. Relationship to Existing cmd/ Projects

```
cmd/
├── prism-cli/         # Go TUI dashboard (19,934 lines, 67 files)
│                      # Terminal-first experience, spring animations, 3D rendering
│                      # For users who prefer the terminal
│
├── prism-vscode/      # TypeScript VS Code extension (TARGET — currently empty)
│                      # IDE-first experience, webview panels, native VS Code integration
│                      # For users who prefer VS Code
│
└── prism-electron/    # Electron desktop app (supplementary)
                       # Standalone desktop experience
                       # For users who want a dedicated app
```

All three share:
- The same `.prism/` directory structure
- The same `stories.json` schema
- The same signal protocol
- The same Prism Claude Code plugin (skills, commands, agents)
- The same `progress.md` format

---

## Code References

- Cline extension entry: `.prism/shared/ref/cline/src/extension.ts`
- Cline controller: `.prism/shared/ref/cline/src/core/controller/index.ts`
- Cline task loop: `.prism/shared/ref/cline/src/core/task/index.ts`
- Cline IPC bridge: `.prism/shared/ref/cline/src/core/controller/grpc-handler.ts`
- Cline webview state: `.prism/shared/ref/cline/webview-ui/src/context/ExtensionStateContext.tsx`
- Cline theme integration: `.prism/shared/ref/cline/webview-ui/src/theme.css`
- Prism CLI architecture: `.prism/shared/research/2026-02-22-prism-plugin-architecture.md`
- Prism CLI full docs: `.prism/shared/docs/PRISM-CLI-DOCUMENTATION-2.1.md`
- Prism VS Code concept: `.prism/shared/docs/prism-vscode-concept.md`
