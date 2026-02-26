# Pixel Agents → Prism VS Code Extension Integration Research

**Date**: 2026-02-26
**Status**: Complete
**Research Question**: How should Pixel Agents' "Office Mode" be integrated into the Prism VS Code extension?

## Summary

Pixel Agents is a self-contained VS Code extension (~3,500 LOC backend, ~5,000 LOC frontend) that watches Claude Code JSONL transcripts and renders animated pixel-art characters in a Canvas 2D office. The Prism VS Code extension is a sidebar app (~4,000 LOC backend, ~2,500 LOC frontend) providing a 4-phase workflow GUI and Spectrum autonomous execution via a gRPC-over-postMessage protocol. Both extensions use esbuild for the host and Vite for the webview, both use React, and both watch `~/.claude/` filesystem data. Integration follows Option A from the ideation doc: embed the pixel-agents office as an additional webview view within prism-vscode, sharing backend services.

---

## Files Discovered

### Pixel Agents Backend (`pixel-agents/src/`)

| File | Purpose | LOC (approx) |
|------|---------|---------------|
| `extension.ts` | Entry point, registers `PixelAgentsViewProvider` and 2 commands | ~30 |
| `PixelAgentsViewProvider.ts` | WebviewViewProvider, message hub, asset orchestration, lifecycle | ~350 |
| `agentManager.ts` | Terminal CRUD, agent persistence/restore, workspace state | ~320 |
| `fileWatcher.ts` | JSONL dual-mode watching (fs.watch + polling), project scanning | ~250 |
| `transcriptParser.ts` | JSONL record parsing, tool lifecycle tracking, sub-agent events | ~300 |
| `timerManager.ts` | Waiting/permission/activity timer management | ~125 |
| `assetLoader.ts` | PNG → SpriteData conversion, asset loading pipeline | ~450 |
| `layoutPersistence.ts` | Layout file I/O with atomic writes and cross-window sync | ~175 |
| `types.ts` | `AgentState`, `PersistedAgent` interfaces | ~25 |
| `constants.ts` | All magic numbers, timing, VS Code IDs | ~45 |

### Pixel Agents Frontend (`pixel-agents/webview-ui/src/`)

| File | Purpose | LOC (approx) |
|------|---------|---------------|
| `App.tsx` | Root React component, office canvas + editor + overlays | ~460 |
| `hooks/useExtensionMessages.ts` | Bidirectional message handler, all backend→webview dispatch | ~350 |
| `office/engine/officeState.ts` | Game world: characters, seats, pathfinding, furniture | ~680 |
| `office/engine/characters.ts` | Character FSM: TYPE→IDLE→WALK + sprite selection | ~300 |
| `office/engine/renderer.ts` | Canvas 2D rendering: Z-sort, tiles, furniture, bubbles, editor | ~610 |
| `office/engine/gameLoop.ts` | requestAnimationFrame loop, variable dt | ~40 |
| `office/engine/matrixEffect.ts` | Per-pixel spawn/despawn digital rain effect | ~130 |
| `office/sprites/spriteData.ts` | Pixel art data, palettes, character templates, caching | ~1120 |
| `office/sprites/spriteCache.ts` | SpriteData → HTMLCanvasElement bitmap caching per zoom | ~80 |
| `office/layout/furnitureCatalog.ts` | Furniture registry, rotation groups, on/off state pairs | ~305 |
| `office/layout/layoutSerializer.ts` | Layout ↔ tile maps, seats, blocked tiles, default layout | ~330 |
| `office/layout/tileMap.ts` | Tile type definitions, color constants, pathfinding BFS | — |
| `office/colorize.ts` | HSB adjustment for sprite colorization | — |
| `office/floorTiles.ts` | Floor pattern colorization | — |
| `office/wallTiles.ts` | Wall tile bitmask rendering | — |
| `office/types.ts` | Frontend types (Character, Seat, OfficeLayout, etc.) | — |
| `components/` | AgentLabels, BottomToolbar, DebugView, SettingsModal, ZoomControls | — |
| `office/editor/` | Full layout editor (paint, erase, place, eyedropper, undo/redo) | — |

### Prism VS Code Backend (`cmd/prism-vscode/src/`)

| File | Purpose | LOC (approx) |
|------|---------|---------------|
| `extension.ts` | Entry point, 21 commands, tree providers, status bar | ~270 |
| `hosts/vscode/VscodeWebviewProvider.ts` | WebviewViewProvider, HTML gen, gRPC message routing | ~190 |
| `core/webview/WebviewProvider.ts` | Abstract base class with nonce generation | ~25 |
| `core/controller/index.ts` | PrismController: state, gRPC handlers, chat, Spectrum | ~850 |
| `core/controller/grpc-handler.ts` | gRPC dispatch registry (unary + streaming) | — |
| `core/controller/prism/workflow.ts` | Workflow state machine (Idle→Research→Plan→Implement→Validate) | ~130 |
| `core/controller/prism/stories.ts` | StoriesManager: in-memory stories.json sync | ~70 |
| `core/controller/prism/spectrum-runner.ts` | Single-iteration Spectrum executor | ~210 |
| `core/controller/prism/spectrum.ts` | SpectrumEngine state machine | — |
| `core/controller/prism/plugin-bridge.ts` | Claude CLI process bridge | — |
| `core/controller/prism/mode-bridge.ts` | SDK/CLI mode switching | — |
| `shared/PrismMessage.ts` | gRPC-over-postMessage type system | ~40 |
| `shared/PrismState.ts` | `PrismExtensionState` with defaults | ~110 |
| `shared/types.ts` | WorkflowPhase enum, colors, labels | ~30 |
| `prism/watcher.ts` | `.prism/` directory filesystem watcher (5 patterns) | ~100 |
| `prism/stories.ts` | Domain model for stories.json (port of Go CLI) | ~155 |
| `prism/progress.ts` | Spectrum progress.md file management | ~190 |
| `prism/signals.ts` | Signal protocol parser (`<spectrum-*>` tags) | ~150 |
| `prism/config.ts` | `.prism/` path detection and resolution | ~90 |

### Prism VS Code Frontend (`cmd/prism-vscode/webview-ui/src/`)

| File | Purpose | LOC (approx) |
|------|---------|---------------|
| `App.tsx` | Root component, routes between Chat/Spectrum/Welcome | ~140 |
| `context/PrismStateContext.tsx` | State subscription via streaming gRPC | ~250 |
| `views/ChatView.tsx` | Chat interface with message list and input | — |
| `views/SpectrumView.tsx` | Spectrum dashboard with controls and story list | ~250 |
| `services/grpc-client.ts` | Typed gRPC service clients (State, Chat, Spectrum, etc.) | ~200 |
| `services/grpc-client-base.ts` | Transport layer: unary + streaming over postMessage | ~130 |
| `vscode.ts` | Singleton VS Code API accessor | ~50 |
| `components/` | ChatRow, ChatTextArea, ToolRow, MarkdownBlock, WelcomeView | — |
| `components/spectrum/` | ActivityLog, ProgressBar, SignalStatus, SpectrumControls, StoryList | — |
| `components/workflow/` | PhaseIndicator | — |
| `theme/` | spectral.css, theme.css | — |

---

## Component Analysis

### 1. Pixel Agents Message Protocol (Complete)

#### Webview → Backend

| Message Type | Fields | Purpose |
|---|---|---|
| `webviewReady` | — | Triggers full initialization cascade |
| `openClaude` | — | Launches new terminal + Claude session |
| `focusAgent` | `id: number` | Focuses agent's VS Code terminal |
| `closeAgent` | `id: number` | Disposes agent's terminal |
| `saveAgentSeats` | `seats: Record<string, {palette?, seatId?}>` | Persists seat/palette assignments |
| `saveLayout` | `layout: Record<string, unknown>` | Saves office layout to disk |
| `setSoundEnabled` | `enabled: boolean` | Toggle notification sound |
| `openSessionsFolder` | — | Opens project dir in OS file explorer |
| `exportLayout` | — | Save dialog for layout export |
| `importLayout` | — | Open dialog for layout import |

#### Backend → Webview

| Message Type | Fields | Purpose |
|---|---|---|
| `characterSpritesLoaded` | `characters: CharacterDirectionSprites[]` | 6 pre-colored character sprite sets |
| `floorTilesLoaded` | `sprites: string[][][]` | 7 floor tile patterns |
| `wallTilesLoaded` | `sprites: string[][][]` | 16 bitmask wall sprites |
| `furnitureAssetsLoaded` | `catalog: FurnitureAsset[], sprites: Record<string, string[][]>` | Furniture catalog + sprites |
| `layoutLoaded` | `layout: Record<string, unknown>` | Office layout (tiles, furniture, size) |
| `settingsLoaded` | `soundEnabled: boolean` | Persisted settings |
| `existingAgents` | `agents: number[], agentMeta: Record<string, {palette?, seatId?}>` | Restored agents on reconnect |
| `agentCreated` | `id: number` | New agent spawned |
| `agentClosed` | `id: number` | Agent's terminal closed |
| `agentSelected` | `id: number` | Terminal focus changed |
| `agentStatus` | `id: number, status: 'active'\|'waiting'` | Agent waiting/active state |
| `agentToolStart` | `id: number, toolId: string, status: string` | Tool execution started |
| `agentToolDone` | `id: number, toolId: string` | Tool execution completed |
| `agentToolsClear` | `id: number` | All tools cleared (turn end) |
| `agentToolPermission` | `id: number` | Tool may need permission |
| `agentToolPermissionClear` | `id: number` | Permission cleared |
| `subagentToolStart` | `id: number, parentToolId: string, toolId: string, status: string` | Sub-agent tool started |
| `subagentToolDone` | `id: number, parentToolId: string, toolId: string` | Sub-agent tool completed |
| `subagentClear` | `id: number, parentToolId: string` | Sub-agent finished |
| `subagentToolPermission` | `id: number, parentToolId: string` | Sub-agent may need permission |

### 2. Prism VS Code gRPC Service Registry (Complete)

| Service | Method | Type | Purpose |
|---------|--------|------|---------|
| `StateService` | `subscribeToState` | Stream | Push full state on every change |
| `StateService` | `getState` | Unary | Get current state once |
| `UiService` | `initializeWebview` | Unary | Trigger `.prism/` detection |
| `UiService` | `initPrism` | Unary | Create `.prism/` directory structure |
| `WorkflowService` | `transition` | Unary | Workflow phase transition |
| `WorkflowService` | `getAvailableTransitions` | Unary | Valid transitions from current phase |
| `ChatService` | `sendMessage` | Unary | Route message to CLI/plugin |
| `ChatService` | `abortTask` | Unary | Terminate active chat session |
| `ChatService` | `clearMessages` | Unary | Clear chat history |
| `ChatService` | `approveToolUse` | Unary | Approve tool execution |
| `ChatService` | `setApiKey` | Unary | No-op (uses CLI auth) |
| `PluginService` | `executeSkill` | Unary | Run Prism plugin skill |
| `PluginService` | `terminateSkill` | Unary | Kill running plugin |
| `PluginService` | `checkCli` | Unary | Check Claude CLI availability |
| `PluginService` | `getSkills` | Unary | Return SKILL_MAP |
| `SpectrumService` | `start` | Unary | Start Spectrum loop |
| `SpectrumService` | `pause` | Unary | Pause Spectrum |
| `SpectrumService` | `resume` | Unary | Resume Spectrum |
| `SpectrumService` | `stop` | Unary | Stop Spectrum |
| `SpectrumService` | `skipStory` | Unary | Skip current story |
| `SpectrumService` | `reset` | Unary | Reset to idle |

### 3. JSONL File Watching Architecture

Pixel Agents uses a three-layer watching system:

**Layer 1 — File appearance polling** (`agentManager.ts:86-97`):
- `setInterval` at 1000ms checks `fs.existsSync()` for expected JSONL file
- Transitions to Layer 2 once file appears

**Layer 2 — Per-file dual-mode watching** (`fileWatcher.ts:9-35`):
- Primary: `fs.watch()` on the specific JSONL file (event-driven)
- Backup: `setInterval` at 2000ms as reliability fallback
- Both call `readNewLines()` which reads incrementally from `fileOffset`

**Layer 3 — Project directory scanning** (`fileWatcher.ts:80-168`):
- `setInterval` at 1000ms scans `~/.claude/projects/<hash>/` for new `.jsonl` files
- Handles `/clear` (reassigns agent to new file) and terminal adoption (creates new agent)

**Prism VS Code uses VS Code's FileSystemWatcher API** (`prism/watcher.ts`):
- 5 `vscode.RelativePattern` watchers for `.prism/` subdirectories
- Fires typed events: `stories`, `research`, `plans`, `validation`, `spectrum`
- Does NOT currently watch `~/.claude/` JSONL files

### 4. Character State Machine

Three states with deterministic transitions:

```
TYPE (working at desk)
  │ Frame: 2 typing or reading frames at 0.3s/frame
  │ Transition: when !isActive and seatTimer expired → IDLE
  │
  ▼
IDLE (standing, wandering)
  │ Frame: static standing pose (walk frame 1)
  │ If isActive → pathfind to seat → WALK
  │ If wanderTimer expires:
  │   If wanderCount >= wanderLimit and has seat → pathfind home → WALK
  │   Else → pick random tile → pathfind → WALK (wanderCount++)
  │
  ▼
WALK (moving between tiles)
  │ Frame: 4 walk frames at 0.15s/frame, speed 48px/s (3 tiles/s)
  │ Reactive: if isActive while walking and not heading to seat → repath
  │ On arrival:
  │   If at seat and isActive → TYPE
  │   If at seat and !isActive → TYPE (rest 2-4 min) then → IDLE
  │   Else → IDLE
```

**Tool-to-animation mapping**: `Read`, `Grep`, `Glob`, `WebFetch`, `WebSearch` → reading animation. All others → typing animation.

### 5. Canvas Rendering Pipeline

Render order per frame (`renderer.ts:renderFrame()`, line 529):
1. Clear canvas
2. Compute viewport offsets (centered with pan, snapped to integer pixels)
3. Render tile grid (floor patterns + wall base colors)
4. Render seat indicators (colored overlays for hovered seats)
5. Build wall sprite instances (3D wall sprites from bitmask)
6. Z-sorted scene: merge furniture + wall sprites + characters, sort by Y, draw back-to-front
7. Speech bubbles (waiting/permission indicators above characters)
8. Editor overlays (grid, ghost border, ghost preview, selection, delete/rotate buttons)

**Key rendering patterns**:
- All sprites are `string[][]` hex arrays → pre-rendered to `HTMLCanvasElement` bitmaps per zoom level
- `WeakMap`-based caching keyed by SpriteData reference + zoom level
- Characters rendered at `zY = ch.y + TILE_SIZE/2 + 0.5` (in front of same-row furniture)
- Selection/hover outlines generated via 1px white outline algorithm
- Matrix effect (spawn/despawn) renders per-pixel instead of cached sprite

### 6. Build System Comparison

| Aspect | Pixel Agents | Prism VS Code |
|--------|-------------|---------------|
| **Host bundler** | esbuild (CJS, Node) | esbuild (CJS, Node) |
| **Host entry** | `src/extension.ts` → `dist/extension.js` | `src/extension.ts` → `dist/extension.js` |
| **Host external** | `vscode` | `vscode` |
| **Webview bundler** | esbuild (browser, ESM) | Vite (browser) |
| **Webview entry** | `webview-ui/src/main.tsx` | `webview-ui/src/main.tsx` |
| **Webview output** | `dist/webview/index.html` | `webview-ui/build/assets/main.js` |
| **Webview framework** | React 18 | React 18 |
| **Dev mode** | N/A (uses esbuild watch) | Vite HMR via `.vite-port` file |
| **TypeScript strictness** | `erasableSyntaxOnly`, `verbatimModuleSyntax`, `noUnusedLocals` | `strict: true` |
| **Dependencies** | `pngjs` (PNG parsing) | `uuid`, `@anthropic-ai/sdk` |
| **VS Code engine** | `^1.109.0` | `^1.84.0` |

### 7. Prism State Broadcasting

`PrismController` maintains a single `PrismExtensionState` object. On every `updateState(partial)`:
1. Shallow-merges partial into `_state`
2. Serializes to JSON, pushes to all active `subscribeToState` streaming subscribers
3. Fires `_onDidChangeState` event for tree providers and status bar
4. Dead subscribers auto-cleaned

The webview's `PrismStateContextProvider` receives pushes via `StateServiceClient.subscribeToState()` and updates React state.

### 8. Asset Loading Pipeline

On `webviewReady`, pixel-agents loads assets sequentially:
1. Default layout JSON from `assets/default-layout.json`
2. Character sprites: 6 PNGs (`char_0.png` – `char_5.png`), each 112x96 (7 frames × 16px, 3 directions × 32px)
3. Floor tiles: `floors.png` (112x16), 7 patterns of 16x16
4. Wall tiles: `walls.png` (64x128), 4x4 grid of 16x32 bitmask pieces
5. Furniture: `furniture-catalog.json` + individual PNGs

All PNG→SpriteData conversion: `pngjs` parses RGBA buffer, alpha ≥ 128 → `#RRGGBB`, else `''` (transparent).

---

## Integration Surface Analysis

### Shared Concepts

| Concept | Pixel Agents | Prism VS Code | Integration Opportunity |
|---------|-------------|---------------|------------------------|
| Session tracking | Watches `~/.claude/projects/<hash>/<session>.jsonl` | Spawns Claude CLI sessions, tracks via `PrismController` | Prism already knows active sessions; feed to office |
| Tool activity | Parses JSONL tool_use/tool_result events | Has `ToolActivity` type in Spectrum runner events | Unify: office characters show same tool activity |
| Workspace state persistence | `workspaceState` for agents, seats, palettes | `workspaceState` via VS Code API | Share same workspace state instance |
| File watching | `fs.watch` + polling on JSONL files | `vscode.FileSystemWatcher` on `.prism/` | Add JSONL watching to PrismWatcher or keep separate |
| WebviewViewProvider | `PixelAgentsViewProvider` | `VscodeWebviewProvider` | Add second webview or tab within existing |
| React 18 | Both webviews use React 18 | Same | Could share build pipeline |
| Message protocol | Custom postMessage types | gRPC-over-postMessage | Office can use either; simpler to keep its own protocol |

### Key Integration Points

**1. Agent ↔ Session Mapping**:
- Pixel Agents creates agents from terminal detection (name prefix `"Claude Code"`)
- Prism spawns Claude CLI via `PluginBridge`/`ClaudeRunner` which creates terminals
- Bridge: When Prism starts a chat/skill/spectrum session, notify the office that a new agent is active

**2. Story Context on Characters**:
- Prism knows which story is being executed (`spectrum.currentStoryId`)
- Office characters could display story ID/title as label
- Requires extending `agentCreated`/`agentStatus` messages or a new `agentStoryContext` message

**3. Shared Terminal Management**:
- Pixel Agents' `agentManager.ts` launches terminals with `claude --session-id <uuid>`
- Prism's `ClaudeRunner` launches Claude CLI with different args
- For integration: Prism's sessions should be registered as office agents
- The office doesn't need to launch its own terminals — it watches JSONL from whatever sessions Prism creates

**4. Webview Architecture Options**:

**Option A: Separate WebviewViewProvider (simplest)**
- Register `OfficeViewProvider` as a second `WebviewViewProvider` alongside `VscodeWebviewProvider`
- Add `prism.officeView` to `package.json` views
- Office has its own HTML, its own React app, its own message protocol
- Communicate between providers via shared `PrismController` methods

**Option B: Tab within existing webview**
- Add an "Office" tab/mode to the existing `App.tsx` (like the chat↔spectrum switch)
- Office React components render inline
- Shares gRPC transport, state context, styling
- More complex: must integrate Canvas 2D within React lifecycle

**Option A is strongly recommended** because:
- The office uses imperative Canvas 2D with its own game loop — mixing with React state-driven UI is complex
- Separate webview = separate render contexts, no performance interference
- The pixel-agents webview code can be ported with minimal changes
- Both webviews can share the same extension host services

### What Can Be Reused As-Is

| Component | Reuse Status | Notes |
|-----------|-------------|-------|
| `fileWatcher.ts` | **Direct** | Only needs import path changes. Same JSONL files. |
| `transcriptParser.ts` | **Direct** | Self-contained, no VS Code dependencies. |
| `timerManager.ts` | **Direct** | Pure logic with timer handles. |
| `assetLoader.ts` | **Direct** | Needs `pngjs` dependency added to prism-vscode. |
| `layoutPersistence.ts` | **Adapt** | Change path from `~/.pixel-agents/` to `~/.prism/office-layout.json`. |
| `constants.ts` | **Adapt** | Update VS Code IDs, layout paths. |
| `types.ts` | **Direct** | Core types unchanged. |
| `agentManager.ts` | **Adapt** | Remove terminal launching (Prism handles that). Keep restore/persist/adopt logic. |
| `webview-ui/src/office/` | **Direct** | Entire engine, renderer, state machine — self-contained. |
| `webview-ui/src/hooks/useExtensionMessages.ts` | **Adapt** | Add Prism-specific message types (story context, phase status). |
| `webview-ui/src/components/` | **Adapt** | Retheme to spectral palette. |

### What Needs New Code

| Component | Purpose |
|-----------|---------|
| `OfficeViewProvider.ts` | New WebviewViewProvider adapting PixelAgentsViewProvider for Prism context |
| `agentBridge.ts` | Maps Prism sessions (chat, skill, spectrum) to office agents |
| Office gRPC service | New `OfficeService` in PrismController for office-specific operations |
| Story overlay UI | React component showing story labels on characters |
| Spectral theming | CSS + sprite colorization for Prism brand colors |
| Build pipeline | Separate esbuild/Vite config for `webview-office/` |

---

## Architecture Decision: Separate WebviewViewProvider

```
prism-vscode/
├── src/
│   ├── extension.ts                 ← Register OfficeViewProvider + new commands
│   ├── hosts/vscode/
│   │   ├── VscodeWebviewProvider.ts ← Existing sidebar provider
│   │   └── OfficeViewProvider.ts    ← NEW: Adapts PixelAgentsViewProvider
│   ├── core/controller/
│   │   ├── index.ts                 ← Add OfficeService gRPC handlers
│   │   └── office/                  ← NEW: Office-specific controller logic
│   │       ├── agent-bridge.ts      ← Maps Prism sessions → office agents
│   │       └── office-watcher.ts    ← JSONL file watcher (from pixel-agents)
│   ├── office/                      ← NEW: Extracted from pixel-agents/src
│   │   ├── fileWatcher.ts
│   │   ├── transcriptParser.ts
│   │   ├── timerManager.ts
│   │   ├── assetLoader.ts
│   │   ├── layoutPersistence.ts
│   │   ├── types.ts
│   │   └── constants.ts
│   └── shared/
│       └── PrismState.ts            ← Add office state fields
│
├── webview-office/                   ← NEW: Pixel-agents webview, adapted
│   ├── src/
│   │   ├── App.tsx                  ← Adapted root component
│   │   ├── hooks/useExtensionMessages.ts ← Add Prism message types
│   │   ├── office/                  ← Engine code mostly untouched
│   │   │   ├── engine/
│   │   │   ├── sprites/
│   │   │   ├── layout/
│   │   │   └── editor/
│   │   └── components/              ← Rethermed for Prism
│   └── vite.config.ts               ← Output to dist/webview-office/
│
├── webview-ui/                       ← Existing Prism webview (unchanged)
├── package.json                      ← Add prism.officeView, new commands, pngjs dep
└── esbuild.mjs                       ← Unchanged (bundles all host code)
```

### package.json Changes Needed

```json
{
  "contributes": {
    "views": {
      "prism": [
        { "id": "prism.sidebar", "type": "webview" },
        { "id": "prism.officeView", "type": "webview", "name": "Office" },
        // ... existing tree views
      ]
    },
    "commands": [
      { "command": "prism.office.show", "title": "Show Office", "category": "Prism" },
      { "command": "prism.office.launchAgent", "title": "Launch Agent", "category": "Prism" },
      { "command": "prism.office.exportLayout", "title": "Export Office Layout", "category": "Prism" }
    ]
  },
  "devDependencies": {
    "pngjs": "^7.0.0"  // NEW: for asset loading
  }
}
```

### PrismState Extension

```typescript
interface OfficeState {
  officeEnabled: boolean;
  activeAgents: Array<{ id: number; sessionId?: string; storyId?: string; storyTitle?: string }>;
  layoutPath: string;
}

// Add to PrismExtensionState:
interface PrismExtensionState {
  // ... existing fields
  office: OfficeState;
}
```

---

## Open Questions

1. **Should the office webview use Prism's gRPC-over-postMessage protocol or keep pixel-agents' simpler direct postMessage?**
   - gRPC adds complexity but gives consistency with the rest of prism-vscode
   - Direct postMessage is simpler and matches the high-frequency nature of game messages (tool events fire rapidly)
   - **Recommendation**: Keep direct postMessage for the office — the gRPC pattern is designed for request/response, not event streams

2. **Where should office layout persist — `~/.prism/office-layout.json` or workspace-local?**
   - Pixel-agents uses `~/.pixel-agents/layout.json` (global)
   - Prism uses `.prism/local/` for per-workspace state
   - Layout is decorative/personal → global makes more sense (one office across all projects)
   - **Recommendation**: `~/.prism/office-layout.json` (global, in user's home dir)

3. **Should the office have its own "Launch Agent" button or only show Prism-managed sessions?**
   - Pixel-agents has "+ Agent" button that creates terminals
   - Prism manages sessions via chat/skill/spectrum
   - Having both could cause confusion
   - **Recommendation**: Support both — office can detect any Claude Code terminal, but Prism-launched sessions get story context labels

4. **How to handle the build pipeline for webview-office?**
   - Pixel-agents uses esbuild directly for webview (not Vite)
   - Prism uses Vite for webview-ui
   - **Recommendation**: Keep separate builds — add `build:office` script using esbuild (matching pixel-agents pattern), or migrate to Vite for consistency

5. **Asset bundling strategy?**
   - Pixel-agents loads PNG assets from `dist/assets/` at runtime
   - These are converted to SpriteData (hex arrays) and sent to webview via postMessage
   - Total asset size is small (~6 PNGs, <100KB total)
   - **Recommendation**: Bundle assets in `dist/assets/` alongside extension, load at activation time

---

## Key Architectural Patterns to Preserve

1. **Imperative game state outside React**: `OfficeState` and character updates happen outside React's render cycle. Only UI overlays (agent lists, toolbar) use React state. This is critical for 60fps performance.

2. **Ref-style mutation objects**: Pixel-agents passes `{ current: T }` objects by reference into pure functions across modules. This avoids class state but allows cross-module mutation. Preserve this pattern.

3. **Incremental byte-offset JSONL reading**: `readNewLines()` reads only new bytes since `fileOffset`, carries partial lines in `lineBuffer`. Never re-parses the entire file. Critical for performance with large sessions.

4. **Timer-based state inference**: Permission timer (7s) and text-idle timer (5s) infer states the JSONL protocol doesn't explicitly signal. These are the only way to detect "waiting for user permission" and "text-only turn ended".

5. **Lazy agent buffering**: `existingAgents` messages buffer agents until `layoutLoaded` arrives (seats aren't available until layout is parsed). The buffer is flushed inside the `layoutLoaded` handler.

6. **Sub-agent negative IDs**: Sub-agents use negative IDs (decrementing from -1) to avoid collision with parent agent IDs. Tracked via `subagentIdMap` and `subagentMeta` maps.

7. **Sprite caching with WeakMap per zoom level**: SpriteData → HTMLCanvasElement conversions are cached per zoom level using WeakMap so sprites are garbage-collected when no longer referenced.
