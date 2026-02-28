---
date: 2026-02-28T00:00:00Z
researcher: Claude
repository: prism-plugin
branch: main
topic: "Shared Architecture: prism-core + prism-webview across VSCode and Electron"
tags: [research, architecture, electron, vscode, shared-packages, ipc, grpc, claude-sdk]
status: complete
last_updated: 2026-02-28
last_updated_by: Claude
---

# Prism Shared Architecture Research
## VSCode Extension → Electron App: Code Sharing Strategy

---

## Research Question

What is the exact boundary between platform-agnostic and platform-specific code in the prism-vscode extension, and what is the minimal surface area that must change to run the same core logic and React UI in a prism-electron application?

---

## Summary

The prism-vscode extension (`cmd/prism-vscode/`) has a clean natural split: all business logic under `src/core/controller/prism/`, the domain model under `src/prism/`, the Claude CLI integration under `src/claude/`, and all React UI under `webview-ui/src/` are **fully platform-agnostic** (zero `vscode` imports). Only 8 files use the VSCode API directly. The IPC protocol (`gRPC-over-postMessage`) is transport-agnostic by design — the `grpc-handler.ts` dispatch layer accepts a generic `postMessage` callback, meaning the only changes needed for Electron are swapping the transport adapters at the edges. The Windows `.cmd` → `cli.js` fix required for the Claude Agent SDK in Electron is documented and proven in `.prism/shared/ref/claude-electron-sdk-fix/`.

---

## Files Discovered

### cmd/prism-vscode/src/ — Extension Host (61 files)

| Path | vscode? | Description |
|------|---------|-------------|
| `src/extension.ts` | YES | Entry point: registers all commands, providers, tree views |
| `src/shared/types.ts` | NO | `WorkflowPhase` enum + styling helpers |
| `src/shared/PrismMessage.ts` | NO | All IPC message types (gRPC wire format) |
| `src/shared/PrismState.ts` | NO | Full extension state shape (`PrismExtensionState`) |
| `src/core/controller/index.ts` | YES | `PrismController` — central orchestrator + all handler registration |
| `src/core/controller/grpc-handler.ts` | NO | gRPC dispatch registry (fully transport-agnostic) |
| `src/core/controller/state/subscribeToState.ts` | NO | State subscription handler |
| `src/core/controller/prism/workflow.ts` | NO | `WorkflowStateMachine` — 4-phase state machine |
| `src/core/controller/prism/spectrum.ts` | NO | `SpectrumEngine` — execution state machine |
| `src/core/controller/prism/spectrum-runner.ts` | NO | `SpectrumRunner` — per-iteration Claude CLI spawner |
| `src/core/controller/prism/mode-bridge.ts` | NO | `ModeBridge` — SDK↔CLI mode switching |
| `src/core/controller/prism/plugin-bridge.ts` | NO | `PluginBridge` — maps command IDs to Prism skills |
| `src/core/controller/prism/stories.ts` | NO | `StoriesManager` — stories.json cache wrapper |
| `src/core/webview/WebviewProvider.ts` | YES | Abstract webview contract (uses `vscode.Webview` type) |
| `src/hosts/vscode/VscodeWebviewProvider.ts` | YES | VSCode sidebar webview provider |
| `src/hosts/vscode/PrismPanelProvider.ts` | YES | VSCode bottom panel (Monitor + Workspaces + Office) |
| `src/hosts/vscode/OfficeViewProvider.ts` | YES | Office pixel-art visualization provider |
| `src/prism/config.ts` | YES | `.prism/` directory detection (uses `vscode.workspace`) |
| `src/prism/stories.ts` | NO | `Story`/`Plan` types + `fs/promises` file I/O |
| `src/prism/signals.ts` | NO | Signal XML parser (`<spectrum-continue>` etc.) |
| `src/prism/watcher.ts` | YES | `.prism/` file watcher (uses `vscode.FileSystemWatcher`) |
| `src/prism/progress.ts` | NO | `ProgressFile` — `progress.md` read/write |
| `src/prism/init.ts` | unknown | `.prism/` directory initializer |
| `src/claude/runner.ts` | NO | `ClaudeRunner` — spawns `claude` CLI, streams events |
| `src/claude/events.ts` | NO | `ClaudeRunnerEvent` discriminated union type definitions |
| `src/claude/parser.ts` | NO | `OutputParser` + `extractToolActivity` + `detectPhase` |
| `src/core/api/claude-sdk.ts` | NO | `PrismApiHandler` — Anthropic SDK wrapper (async generator) |
| `src/core/api/auth.ts` | YES | API key via `vscode.SecretStorage` |
| `src/core/api/types.ts` | NO | `ApiStreamChunk`, `PrismChatMessage` type definitions |
| `src/core/task/index.ts` | NO | Task execution module |
| `src/core/prompts/*.ts` | NO | Phase-specific system prompt builders |
| `src/providers/research-tree.ts` | YES | Research documents tree view provider |
| `src/providers/plans-tree.ts` | YES | Plans documents tree view provider |
| `src/providers/stories-tree.ts` | YES | Spectrum stories tree view provider |
| `src/providers/workflow-status.ts` | YES | Status bar widget |
| `src/office/*.ts` | YES | Office pixel-art integration (8 files) |

### cmd/prism-vscode/webview-ui/src/ — React SPA (23 files)

| Path | Platform-coupled? | Description |
|------|------------------|-------------|
| `vscode.ts` | YES (acquireVsCodeApi) | Transport adapter — ONLY file coupling webview to VSCode |
| `services/grpc-client-base.ts` | NO (postMessage) | `ProtoBusClient` — unary + streaming request machinery |
| `services/grpc-client.ts` | NO | 6 service clients (State, UI, Workflow, Chat, Plugin, Spectrum) |
| `context/PrismStateContext.tsx` | NO | React context + `usePrismState()` hook |
| `App.tsx` | PARTIAL (vscode CSS vars) | View router (chat/spectrum/welcome) + command listener |
| `Providers.tsx` | NO | Provider hierarchy wrapper |
| `views/ChatView.tsx` | NO | Chat UI — messages + input |
| `views/SpectrumView.tsx` | NO | Spectrum execution dashboard |
| `components/WelcomeView.tsx` | NO | First-run onboarding |
| `components/chat/ChatRow.tsx` | NO | Message renderer (user/assistant/tool) |
| `components/chat/ChatTextArea.tsx` | NO | Input field |
| `components/chat/ToolRow.tsx` | NO | Tool use + result display |
| `components/spectrum/SpectrumControls.tsx` | NO | Start/Pause/Stop buttons |
| `components/spectrum/ProgressBar.tsx` | NO | Spectral gradient progress bar |
| `components/spectrum/StoryList.tsx` | NO | Scrollable story list with status badges |
| `components/spectrum/ActivityLog.tsx` | NO | Tool execution log |
| `components/spectrum/SignalStatus.tsx` | NO | Signal type badge |
| `components/workflow/PhaseIndicator.tsx` | NO | Phase transition UI |
| `components/common/MarkdownBlock.tsx` | NO | Markdown renderer |
| `theme/theme.css` | NO | Tailwind + CSS custom properties |
| `theme/spectral.css` | NO | Spectral gradient theme |

### cmd/prism-electron/src/ — Electron App (5 files, boilerplate)

| Path | Description |
|------|-------------|
| `src/main.ts` | Boilerplate Electron main — no Prism integration, no IPC handlers |
| `src/preload.ts` | Empty — no contextBridge exposures |
| `src/renderer.tsx` | React DOM mount |
| `src/App.tsx` | "Hello World" placeholder |
| `src/index.css` | Basic system font layout |

### .prism/shared/ref/claude-electron-sdk-fix/ — Reference Implementation

| Path | Description |
|------|-------------|
| `CLAUDE-AGENT-SDK-ELECTRON.md` | Guide: Windows `.cmd` → `cli.js` fix for Claude Agent SDK |
| `claude-electron-test/src/main.ts` | Working Electron main with `findClaudeCodeExecutable()` + `query()` |
| `claude-electron-test/src/preload.ts` | contextBridge exposing `claude.*` methods |
| `claude-electron-test/src/App.tsx` | React UI for testing SDK connection |

---

## Component Analysis

### 1. Platform-Agnostic / vscode-Free Layer

The following modules have **zero** `vscode` imports and use only Node.js built-ins or npm packages:

#### `src/core/controller/grpc-handler.ts`
The dispatch core of the IPC protocol. Maintains two global Maps:
```
_unaryRegistry   = Map<"ServiceName.methodName", UnaryHandlerFn>
_streamRegistry  = Map<"ServiceName.methodName", StreamHandlerFn>
```
`handleGrpcRequest(postMessage, request)` routes incoming messages to registered handlers. The `postMessage` parameter is a **plain function `(msg: unknown) => Promise<void>`** — entirely decoupled from any IPC mechanism. This is the key architectural decision that makes the transport swappable.

**Registration functions:** `registerUnary(service, method, fn)`, `registerStream(service, method, fn)`, `clearHandlers()`

#### `src/core/controller/prism/workflow.ts`
Pure state machine. Zero imports except `WorkflowPhase` from shared types.
- `VALID_TRANSITIONS` table: 6 transition keys × allowed source phases
- `TRANSITION_TARGET` map: transition → target phase
- `WorkflowStateMachine.transition(t)` returns `TransitionResult`
- File comment explicitly states: "pure TypeScript class with no VS Code API dependencies"

#### `src/core/controller/prism/spectrum.ts`
Pure state machine. Zero imports entirely.
- States: `idle | running | paused | complete | maxIterations | error`
- Communicates via constructor-injected callback: `onStateChange: (state: SpectrumState) => void`
- Uses `setInterval`/`clearInterval` for elapsed time tracking (browser/Node.js API)
- Tracks: iteration count, progress %, elapsed time, consecutive errors, last 50 tool activities, last 200 log entries

#### `src/core/controller/prism/spectrum-runner.ts`
Extends Node.js `EventEmitter` (not VSCode EventEmitter). Orchestrates a single Spectrum iteration:
1. Gets next pending story from `StoriesManager`
2. Spawns Claude CLI via `PluginBridge.executeSpectrum()`
3. Parses `BridgeEvent` stream for signals
4. Updates story status on disk

#### `src/core/controller/prism/mode-bridge.ts`
Switches between `sdk` and `plugin` chat modes. Uses `uuid` + Node.js EventEmitter.
- `SKILL_TRIGGERS[]` — array of `{ pattern: RegExp, skill: string }` for detecting slash commands
- `detectSkillTrigger(text)` — scans text against trigger patterns
- Converts `BridgeEvent` objects → `PrismChatMessage` objects for the chat UI

#### `src/core/controller/prism/plugin-bridge.ts`
Maps VS Code command ID strings to Prism skill names, spawns `ClaudeRunner` sessions.
- `SKILL_MAP: Record<string, string>` — e.g., `"prism.research"` → `"prism-research"`
- `executeSkill(skillName, args?)` — builds skill prompt, runs `ClaudeRunner.runStreaming()`
- `executeSpectrum(storiesPath, sessionId)` — builds spectrum prompt, runs streaming

#### `src/prism/stories.ts`
Pure domain model + file I/O via `fs/promises`:
- Types: `Plan`, `Story`, `StoriesFile`, `StoryFile`, `Step`
- `loadStoriesFile(path)` → `JSON.parse(fs.readFile(...))`
- `saveStoriesFile(sf, path)` → `fs.writeFile(JSON.stringify(sf, null, 2))`
- `getNextStory(sf)` — filters non-complete/non-blocked, sorts by priority
- `markStoryComplete()`, `markStoryInProgress()`, `isBlocked()`

#### `src/prism/signals.ts`
Zero imports. Pure regex parsing of the spectrum XML signal protocol:
- `parseSignal(output)` → `Signal` (priority: complete > error > retry > blocked > continue)
- `parseStoryAnnouncement(output)` → `StoryAnnouncement | null`
- Signal regex patterns for: `<promise>COMPLETE</promise>`, `<spectrum-continue>`, `<spectrum-retry>`, `<spectrum-blocked>`, `<spectrum-error>`

#### `src/prism/progress.ts`
Node.js `fs/promises` only. `ProgressFile` class manages `.prism/shared/spectrum/progress.md`:
- `progressPathFromStories(storiesPath)` — derives progress path (epic-scoped or flat)
- `initialize(planName)` — creates file with YAML frontmatter
- `appendEntry(entry)` — appends story completion markdown section
- `readPatterns()` — extracts codebase pattern bullets

#### `src/claude/runner.ts`
Node.js `child_process.spawn` only. `ClaudeRunner` extends Node.js `EventEmitter`:
- `runStreaming(prompt, options)` — spawns `claude --dangerously-skip-permissions --print --output-format stream-json --verbose`
- `runSession(prompt, options)` — spawns same, collects full output (no streaming events)
- `terminate()` — platform-aware: `taskkill /F /T /PID` on Windows, `SIGTERM`→`SIGKILL` on Unix
- `_buildArgs()` — constructs CLI arguments array
- `_processLine()` — pipeline: `→ output event → parseStreamEvent → stream_event → extractToolActivity → _parser.parseLine → phase/signal/story events`

#### `src/claude/parser.ts`
Pure parsing. `OutputParser` stateful class:
- `parseLine(line)` — emits: `story_announced`, `phase_changed`, `quality_gate`, `commit_created`, `signal_detected`
- `formatToolUse(toolName, input)` — humanizes tool calls for activity log

#### `src/core/api/claude-sdk.ts`
`@anthropic-ai/sdk` only. `PrismApiHandler` async generator:
- `createMessage(messages, systemPrompt, tools?)` — streams text/tool chunks
- Model IDs: `claude-opus-4-6`, `claude-sonnet-4-6`, `claude-haiku-4-5-20251001`

---

### 2. VSCode-Coupled Layer (8 files)

| File | VSCode APIs Used | What Must Change for Electron |
|------|-----------------|-------------------------------|
| `extension.ts` | `registerCommand`, `registerTreeDataProvider`, `registerWebviewViewProvider`, `workspace.onDidChangeWorkspaceFolders` | Replace with Electron menu + IPC handler registration |
| `core/controller/index.ts` | `vscode.EventEmitter`, `Disposable`, `workspace.workspaceFolders`, `commands.executeCommand` | Replace EventEmitter with Node.js `EventEmitter`; replace workspace detection with `dialog.showOpenDialog` or cwd; remove context key setting |
| `core/webview/WebviewProvider.ts` | `vscode.Webview` type in abstract method signature | Drop or replace abstract class (Electron doesn't need this abstraction) |
| `hosts/vscode/VscodeWebviewProvider.ts` | `WebviewViewProvider`, `Webview`, `Uri.joinPath`, `asWebviewUri`, CSP nonce | Replace entirely with Electron `BrowserWindow` + `ipcMain.handle` wiring |
| `hosts/vscode/PrismPanelProvider.ts` | Terminal API, `showWarningMessage`, `showOpenDialog`, `FileSystemWatcher`, `workspace.fs` | Replace with Electron equivalents: `dialog.showOpenDialog`, `BrowserWindow`, `fs.watch` |
| `prism/config.ts` | `workspace.workspaceFolders`, `workspace.fs.stat`, `Uri.joinPath` | Replace with `process.cwd()` + `fs.stat` (Node.js) |
| `prism/watcher.ts` | `FileSystemWatcher`, `RelativePattern`, `EventEmitter<T>` | Replace with `chokidar` or Node.js `fs.watch` |
| `core/api/auth.ts` | `SecretStorage`, `window.showInputBox`, `window.showInformationMessage` | Replace with `electron-store` with encryption, or `keytar` (system keychain) |

---

### 3. IPC Protocol — gRPC-over-postMessage

#### Message Wire Format (`src/shared/PrismMessage.ts`)

```typescript
// Webview → Extension Host
{ type: "grpc_request";        grpc_request: { service, method, message, request_id, is_streaming } }
{ type: "grpc_request_cancel"; grpc_request_cancel: { request_id } }

// Extension Host → Webview
{ type: "grpc_response"; grpc_response: { message?, request_id, error?, is_streaming } }
{ type: "command";       command: string; payload?: unknown }
```

`is_streaming: true` on a response = more chunks coming. `is_streaming: false` = stream complete.

#### Registered Services (21 handler registrations in `src/core/controller/index.ts:131-489`)

| Service | Method | Mode | Primary Action |
|---------|--------|------|----------------|
| StateService | subscribeToState | **streaming** | Store respond fn in `_stateSubscribers` Map; push full state JSON on every `updateState()` |
| StateService | getState | unary | Return `JSON.stringify(this._state)` |
| UiService | initializeWebview | unary | Trigger `_detectPrismDir()` |
| UiService | initPrism | unary | Create `.prism/` directory |
| WorkflowService | transition | unary | `workflowMachine.transition(t)` |
| WorkflowService | getAvailableTransitions | unary | Return valid transitions for current phase |
| ChatService | sendMessage | unary | Route to `ModeBridge.runPluginSkill()` or SDK chat |
| ChatService | abortTask | unary | `activeRunner.terminate()` |
| ChatService | clearMessages | unary | Reset `chatMessages` in state |
| ChatService | approveToolUse | unary | No-op in CLI mode |
| PluginService | executeSkill | unary | `modeBridge.runPluginSkill(text)` |
| PluginService | terminateSkill | unary | `modeBridge.terminate()` |
| PluginService | checkCli | unary | `checkClaudeCli()` (which/where) |
| PluginService | getSkills | unary | Return `SKILL_MAP` |
| SpectrumService | start | unary | Initialize `SpectrumEngine`, begin iteration loop |
| SpectrumService | pause | unary | `spectrumEngine.pause()` |
| SpectrumService | resume | unary | `spectrumEngine.start(...)` |
| SpectrumService | stop | unary | `spectrumRunner.terminate()`, `spectrumEngine.stop()` |
| SpectrumService | skipStory | unary | `spectrumRunner.terminate()` (current iteration) |
| SpectrumService | reset | unary | `spectrumEngine.stop()`, reset state |

#### State Broadcast Mechanism
Every call to `controller.updateState(partial)` at `index.ts:841`:
1. Shallow-merges `partial` into `this._state`
2. JSON-serializes full state
3. Iterates `_stateSubscribers` Map → calls each subscriber's `respond({ stateJson })` with `is_streaming: true`
4. Fires `_onDidChangeState` VSCode EventEmitter (for tree views + status bar)

The state is **never diffed** — full serialization on every update.

#### Transport Coupling Points (minimal — 4 locations)

| Location | VSCode mechanism | Electron equivalent |
|----------|-----------------|---------------------|
| `webview-ui/src/vscode.ts:35` | `acquireVsCodeApi().postMessage(msg)` | `contextBridge`-exposed `window.electronAPI.send(msg)` |
| `webview-ui/src/services/grpc-client-base.ts:42, 92` | `window.addEventListener("message", e => e.data)` | `ipcRenderer.on("grpc_response", (_, data) => data)` |
| `hosts/vscode/VscodeWebviewProvider.ts:70` | `webview.onDidReceiveMessage(handler)` | `ipcMain.on("grpc_request", (e, msg) => handler(msg))` |
| `hosts/vscode/VscodeWebviewProvider.ts:91` | `webview.postMessage(msg)` | `mainWindow.webContents.send("grpc_response", msg)` |

The `grpc-handler.ts` module and all 21 registered handlers are **untouched** — they operate on the abstract `postMessage` callback parameter.

---

### 4. Claude Agent SDK — Windows Electron Fix

Source: `.prism/shared/ref/claude-electron-sdk-fix/CLAUDE-AGENT-SDK-ELECTRON.md`
Working implementation: `.prism/shared/ref/claude-electron-sdk-fix/claude-electron-test/src/main.ts`

**Root cause:** On Windows, `npm install -g @anthropic-ai/claude-code` installs a `claude.cmd` wrapper. Node.js `child_process.spawn()` cannot spawn `.cmd` files directly without `shell: true`. The Claude Agent SDK uses `spawn()` without `shell: true`.

**Fix:** Resolve the `.cmd` path to the underlying `cli.js` and pass `executable: 'node'` to `query()`:

```typescript
// Step 1: Find executable (claude-electron-test/src/main.ts:19-87)
function findClaudeCodeExecutable(): string | undefined {
  if (process.platform === 'win32') {
    // Try: where claude.cmd, where claude, common APPDATA paths
    const cmdResult = execSync('where claude.cmd', { encoding: 'utf-8' }).trim().split('\n')[0];
    return cmdResult; // returns e.g. C:\Users\...\AppData\Roaming\npm\claude.cmd
  } else {
    return execSync('which claude', { encoding: 'utf-8' }).trim();
  }
}

// Step 2: Convert .cmd path to cli.js path (main.ts:147-159)
const isCmd = claudeCodePath.endsWith('.cmd');
if (isCmd) {
  const npmDir = path.dirname(claudeCodePath);
  cliJsPath = path.join(npmDir, 'node_modules', '@anthropic-ai', 'claude-code', 'cli.js');
}

// Step 3: Query with node executable (main.ts:162-169)
const result = query({
  prompt: 'Your prompt',
  options: {
    maxTurns: 1,
    pathToClaudeCodeExecutable: cliJsPath,
    ...(isCmd && { executable: 'node' as const }),
  },
});
```

**IPC pattern for Electron** (`preload.ts:1-28`):
```typescript
contextBridge.exposeInMainWorld('claude', {
  getDebugInfo: () => ipcRenderer.invoke('claude:debug-info'),
  testQuery:    () => ipcRenderer.invoke('claude:test-query'),
  setPath:   (p) => ipcRenderer.invoke('claude:set-path', p),
});
```

**SDK options reference** (`@anthropic-ai/claude-agent-sdk`):
```typescript
interface QueryOptions {
  pathToClaudeCodeExecutable?: string; // Path to Claude CLI
  executable?: 'node' | 'bun';        // Runtime to use (KEY for Windows)
  executableArgs?: string[];
  env?: Record<string, string>;
  maxTurns?: number;
  systemPrompt?: string;
  permissionMode?: PermissionMode;
}
```

**Tested environment:** Windows 11, Node.js v24.11.1, Electron 40.0.0, `@anthropic-ai/claude-agent-sdk ^0.2.23`

---

### 5. Existing Architecture Diagrams

The three-tier separation already exists in the codebase by naming convention:

```
cmd/prism-vscode/src/
│
├── core/                          ← Intended to be platform-agnostic business logic
│   ├── controller/
│   │   ├── grpc-handler.ts        ← ✓ Truly agnostic
│   │   ├── index.ts               ← ✗ Has vscode imports (EventEmitter, workspace)
│   │   └── prism/                 ← ✓ All 6 files truly agnostic
│   ├── api/
│   │   ├── claude-sdk.ts          ← ✓ Truly agnostic
│   │   ├── types.ts               ← ✓ Truly agnostic
│   │   └── auth.ts                ← ✗ Uses vscode.SecretStorage
│   └── webview/
│       └── WebviewProvider.ts     ← ✗ Uses vscode.Webview type
│
├── hosts/                         ← Platform shell (explicitly named for multi-platform)
│   └── vscode/                    ← ✓ All 3 files correctly identified as VSCode-specific
│       ├── VscodeWebviewProvider.ts
│       ├── PrismPanelProvider.ts
│       └── OfficeViewProvider.ts
│
├── prism/                         ← Domain model (mixed)
│   ├── stories.ts                 ← ✓ Agnostic (fs/promises)
│   ├── signals.ts                 ← ✓ Agnostic (zero imports)
│   ├── progress.ts                ← ✓ Agnostic (fs/promises)
│   ├── config.ts                  ← ✗ Uses vscode.workspace
│   └── watcher.ts                 ← ✗ Uses vscode.FileSystemWatcher
│
├── claude/                        ← ✓ All 3 files fully agnostic
│   ├── runner.ts
│   ├── events.ts
│   └── parser.ts
│
└── providers/                     ← VSCode tree view providers (all VSCode-specific)
    ├── research-tree.ts
    ├── plans-tree.ts
    ├── stories-tree.ts
    └── workflow-status.ts
```

The `hosts/vscode/` naming convention signals the intended multi-platform architecture — a `hosts/electron/` directory would mirror it.

---

## Patterns Found

### Pattern 1: Abstract Callback Injection (grpc-handler.ts)
The `handleGrpcRequest(postMessage, request)` function signature at `src/core/controller/grpc-handler.ts:45` is the canonical pattern for transport decoupling. The `postMessage` parameter is typed as `(msg: unknown) => Promise<void>` — no platform types. This exact pattern should be replicated for the Electron IPC adapter.

### Pattern 2: Constructor-Injected State Callbacks (spectrum.ts)
`SpectrumEngine` constructor at `src/core/controller/prism/spectrum.ts:118` accepts `onStateChange: (state: SpectrumState) => void`. No event emitters, no imports. This pattern (inject callbacks, don't emit) should be the model for other platform-agnostic components.

### Pattern 3: Platform-Specific Transport Adapter (vscode.ts)
`webview-ui/src/vscode.ts` is a **single file** that acts as the sole adapter between the webview and its host platform. The file exports a `vscodeApi` singleton with a `postMessage(msg)` method. An equivalent `electronApi.ts` file would expose the same interface using `ipcRenderer.send()` / `ipcRenderer.on()` — allowing all `grpc-client-base.ts` code to remain unchanged.

### Pattern 4: Hosts Directory Convention (VscodeWebviewProvider.ts)
The `src/hosts/vscode/` directory is already named for multi-platform support. All three files in it implement VSCode-specific interfaces (`vscode.WebviewViewProvider`). The parallel Electron directory `src/hosts/electron/` would contain `ElectronMainProcess.ts` implementing the equivalent `ipcMain.handle()` registrations.

### Pattern 5: Windows Process Kill (runner.ts:247-264)
`ClaudeRunner.terminate()` has explicit platform branching: Windows uses `taskkill /F /T /PID` for process tree kill; Unix uses `SIGTERM` → delayed `SIGKILL`. This pattern exists at `cmd/prism-vscode/src/claude/runner.ts:247`.

---

## Open Questions

1. **Office visualization in Electron**: `PrismPanelProvider.ts` manages the Office pixel-art feature using VSCode's Terminal API (`vscode.window.createTerminal`). In Electron, terminals would be `node-pty` pseudo-terminals. Does the user want to include the Office feature in the Electron app, or start without it?

2. **Multi-window vs single-window**: Electron supports native multi-window (e.g., Office view in a separate `BrowserWindow`). VSCode forces everything into webview panels. Does the Electron design use separate windows for Chat + Spectrum + Monitor?

3. **Credential storage**: `core/api/auth.ts` uses `vscode.SecretStorage`. The direct Claude Agent SDK path (used via the CLI) doesn't need an API key since auth is handled by `claude login` (OAuth). Does the Electron app use the SDK path, the CLI path, or both?

4. **File watcher replacement**: `prism/watcher.ts` uses `vscode.workspace.createFileSystemWatcher`. The replacement in Electron should use `chokidar` (already a common Electron dependency) or Node.js 20.4+ `fs.watch` with recursive option. Which is preferred?

5. **Workspace detection**: VSCode exposes `workspace.workspaceFolders`. In Electron, the working directory must come from either an `--open` CLI argument, `dialog.showOpenDialog`, or a persistent recent projects list. What is the UX model for the Electron app opening a project?

6. **React component theming**: `App.tsx:82-86` uses VSCode CSS custom properties (`--vscode-sideBar-background`, `--vscode-foreground`). For Electron, these must be replaced with either hardcoded theme colors or a custom CSS variable layer. Does the user want system-native dark/light mode detection?

---

## Code References

- Platform boundary — `core/` vs `hosts/`: `cmd/prism-vscode/src/core/` vs `cmd/prism-vscode/src/hosts/vscode/`
- gRPC dispatch core: [grpc-handler.ts](cmd/prism-vscode/src/core/controller/grpc-handler.ts)
- Transport coupling point (webview): [vscode.ts](cmd/prism-vscode/webview-ui/src/vscode.ts)
- Transport coupling point (host): [VscodeWebviewProvider.ts:70-94](cmd/prism-vscode/src/hosts/vscode/VscodeWebviewProvider.ts)
- Pure workflow state machine: [workflow.ts](cmd/prism-vscode/src/core/controller/prism/workflow.ts)
- Pure spectrum engine: [spectrum.ts](cmd/prism-vscode/src/core/controller/prism/spectrum.ts)
- Windows SDK fix guide: [CLAUDE-AGENT-SDK-ELECTRON.md](.prism/shared/ref/claude-electron-sdk-fix/CLAUDE-AGENT-SDK-ELECTRON.md)
- Windows SDK fix implementation: [claude-electron-test/src/main.ts](.prism/shared/ref/claude-electron-sdk-fix/claude-electron-test/src/main.ts)
- Electron app (current state): [cmd/prism-electron/src/main.ts](cmd/prism-electron/src/main.ts)
- VSCode extension entry: [cmd/prism-vscode/src/extension.ts](cmd/prism-vscode/src/extension.ts)
- Central controller: [cmd/prism-vscode/src/core/controller/index.ts](cmd/prism-vscode/src/core/controller/index.ts)
- State shape definition: [cmd/prism-vscode/src/shared/PrismState.ts](cmd/prism-vscode/src/shared/PrismState.ts)
- Message protocol: [cmd/prism-vscode/src/shared/PrismMessage.ts](cmd/prism-vscode/src/shared/PrismMessage.ts)
- React state context: [cmd/prism-vscode/webview-ui/src/context/PrismStateContext.tsx](cmd/prism-vscode/webview-ui/src/context/PrismStateContext.tsx)
- gRPC client base: [cmd/prism-vscode/webview-ui/src/services/grpc-client-base.ts](cmd/prism-vscode/webview-ui/src/services/grpc-client-base.ts)
