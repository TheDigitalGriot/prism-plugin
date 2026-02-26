# Implementation Plan: Pixel Agents Office Integration into Prism VS Code

**Date**: 2026-02-26
**Status**: Phase 1 Complete
**Research**: `.prism/shared/research/2026-02-26-pixel-agents-integration-research.md`
**Ideation**: `.prism/shared/docs/pixel-agents-integration-analysis.md`

---

## Goal

Integrate Pixel Agents' animated pixel-art office visualization into the Prism VS Code extension as an "Office" panel view. Claude Code sessions appear as characters that walk, sit, type, and read in a tile-based virtual office. Prism-managed sessions (chat, skills, Spectrum) display story context labels on their characters. The office uses Prism spectral brand colors for character palettes and UI.

## Key Architectural Decisions

1. **Separate WebviewViewProvider** — Canvas 2D game loop gets its own render context
2. **Direct postMessage** — High-frequency game events, not gRPC request/response
3. **Vite build** for `webview-office/` — Matches prism-vscode's webview-ui, provides HMR
4. **Event emitter** from `PrismController` → `OfficeViewProvider` for story/session context
5. **Layout at `~/.prism/office-layout.json`** — Global, shared across workspaces
6. **Full spectral theming** — New character palettes in Prism brand colors
7. **VS Code engine `^1.109.0`** — Required by pixel-agents API usage

## What We're NOT Doing

- Not merging the two webviews into one (separate render contexts)
- Not porting to gRPC-over-postMessage (direct postMessage is better for game events)
- Not replacing the character state machine or rendering engine (proven, self-contained)
- Not adding new furniture types (use existing catalog + paid tileset if purchased)
- Not implementing epic-based rooms (future enhancement)
- Not creating a custom sprite editor or asset pipeline
- Not modifying the prism-cli Go codebase

---

## Success Criteria

### Automated Verification
- [ ] Extension compiles: `cd cmd/prism-vscode && npm run compile`
- [ ] TypeScript checks pass: `cd cmd/prism-vscode && npx tsc --noEmit`
- [ ] Office webview builds: `cd cmd/prism-vscode/webview-office && npm run build`
- [ ] Full package builds: `cd cmd/prism-vscode && npm run package`
- [ ] Existing tests still pass: `cd cmd/prism-vscode && npm test`

### Manual Verification
- [ ] "Office" view appears in Prism activity bar panel
- [ ] Default office layout renders with floor tiles, walls, and furniture
- [ ] "+ Agent" button launches Claude Code terminal and spawns animated character
- [ ] Character walks to seat, types when Claude is working, wanders when idle
- [ ] Tool activity shows correct labels (typing vs reading animation)
- [ ] Sub-agents spawn near parent with matrix effect
- [ ] Layout editor works (paint tiles, place furniture, undo/redo)
- [ ] Characters display Prism spectral color palettes
- [ ] Prism-managed sessions (via chat/spectrum) appear as office agents
- [ ] Spectrum-running stories show story ID label on character
- [ ] Layout persists at `~/.prism/office-layout.json` across sessions
- [ ] Office panel works correctly when hidden and re-shown (retainContextWhenHidden)

---

## Phase 1: Backend Port

**Goal**: Extract pixel-agents backend modules into `src/office/`, create `OfficeViewProvider`, register in extension. Office panel appears but shows empty HTML.

### Step 1.1: Update `package.json`

**File**: `cmd/prism-vscode/package.json`

**Changes**:
- Bump `engines.vscode` from `"^1.84.0"` to `"^1.109.0"`
- Add `pngjs` to `devDependencies` (for PNG→SpriteData conversion in `assetLoader.ts`)
- Add office view to `contributes.views.prism`:
  ```json
  { "id": "prism.officeView", "type": "webview", "name": "Office" }
  ```
- Add 3 new commands to `contributes.commands`:
  - `prism.office.show` — "Show Office"
  - `prism.office.launchAgent` — "Launch Agent"
  - `prism.office.exportLayout` — "Export Office Layout"
- Add `build:office` to scripts: `"cd webview-office && npm run build"`
- Update `compile` script to include office build
- Update `package` script to include office build

### Step 1.2: Port Backend Modules

Copy from `.prism/shared/ref/pixel-agents/src/` to `cmd/prism-vscode/src/office/`:

| Source File | Target File | Adaptation Needed |
|-------------|-------------|-------------------|
| `types.ts` | `src/office/types.ts` | Direct copy |
| `constants.ts` | `src/office/constants.ts` | Update `LAYOUT_FILE_DIR` to `'.prism'`, `LAYOUT_FILE_NAME` to `'office-layout.json'`, update VS Code IDs to `prism.office.*`, update `WORKSPACE_KEY_*` prefixes to `prism.office.*` |
| `fileWatcher.ts` | `src/office/fileWatcher.ts` | Update imports to reference local modules |
| `transcriptParser.ts` | `src/office/transcriptParser.ts` | Update imports |
| `timerManager.ts` | `src/office/timerManager.ts` | Update imports |
| `assetLoader.ts` | `src/office/assetLoader.ts` | Update imports. Verify `pngjs` import works with esbuild bundling |
| `layoutPersistence.ts` | `src/office/layoutPersistence.ts` | Change `getLayoutFilePath()` to return `path.join(os.homedir(), '.prism', 'office-layout.json')` |
| `agentManager.ts` | `src/office/agentManager.ts` | Update imports, update workspace state keys |
| `timerManager.ts` | `src/office/timerManager.ts` | Update imports |

### Step 1.3: Create `OfficeViewProvider`

**New file**: `cmd/prism-vscode/src/hosts/vscode/OfficeViewProvider.ts`

Adapt from `PixelAgentsViewProvider.ts`. Key differences:
- Class name: `OfficeViewProvider`
- View ID: `prism.officeView`
- Webview HTML loads from `dist/webview-office/index.html` (production) or Vite dev server (development)
- Constructor receives `PrismController` reference for story context events
- Uses same asset-loading pipeline and message routing as pixel-agents
- `getWebviewContent()` rewrites relative paths to webview URIs (same pattern as `VscodeWebviewProvider`)
- All `pixel-agents.*` workspace state keys become `prism.office.*`

Core structure:
```typescript
export class OfficeViewProvider implements vscode.WebviewViewProvider {
  static readonly VIEW_ID = 'prism.officeView';

  private _controller: PrismController;
  // ... same fields as PixelAgentsViewProvider but namespaced

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    // Same lifecycle as PixelAgentsViewProvider:
    // 1. Set webview options (enableScripts, localResourceRoots)
    // 2. Set HTML content
    // 3. Register message handler (direct postMessage, NOT gRPC)
    // 4. Register terminal event handlers
    // 5. Register dispose handler
  }
}
```

### Step 1.4: Register in Extension

**File**: `cmd/prism-vscode/src/extension.ts`

**Changes**:
- Import `OfficeViewProvider`
- In `activate()`, create `OfficeViewProvider` instance (passing controller)
- Register as webview view provider with `retainContextWhenHidden: true`
- Register 3 new commands:
  - `prism.office.show`: Focus the office view
  - `prism.office.launchAgent`: Call `officeProvider.launchNewTerminal()`
  - `prism.office.exportLayout`: Call `officeProvider.exportDefaultLayout()`

### Step 1.5: Extend PrismState (minimal)

**File**: `cmd/prism-vscode/src/shared/PrismState.ts`

Add to `PrismExtensionState`:
```typescript
office: {
  enabled: boolean;
  agentCount: number;
};
```

Add defaults to `DEFAULT_PRISM_STATE`:
```typescript
office: { enabled: false, agentCount: 0 }
```

### Phase 1 Verification

```bash
cd cmd/prism-vscode && npx tsc --noEmit  # Types check
cd cmd/prism-vscode && npm run compile    # Builds (may warn about missing webview-office)
```

Manual: Open VS Code, verify "Office" appears in Prism panel container (shows empty/loading state).

---

## Phase 2: Webview Port

**Goal**: Create `webview-office/` with Vite, port the full pixel-agents webview. Office renders the default layout with tiles, walls, and furniture. No agents yet.

### Step 2.1: Initialize Vite Project

**New directory**: `cmd/prism-vscode/webview-office/`

Create project structure:
```
webview-office/
├── index.html           ← Vite entry HTML
├── package.json         ← React 18, Vite, TypeScript
├── tsconfig.json        ← Browser target, jsx: react-jsx
├── tsconfig.app.json    ← App-specific config matching pixel-agents strictness
├── vite.config.ts       ← Output to ../dist/webview-office/
└── src/
    ├── main.tsx         ← React root mount
    ├── App.tsx          ← Root component
    ├── index.css        ← Base styles
    ├── vscodeApi.ts     ← VS Code postMessage bridge
    ├── constants.ts     ← Grid, animation, rendering constants
    ├── notificationSound.ts ← Sound playback
    ├── hooks/
    │   ├── useExtensionMessages.ts
    │   ├── useEditorActions.ts
    │   └── useEditorKeyboard.ts
    ├── office/
    │   ├── types.ts
    │   ├── colorize.ts
    │   ├── floorTiles.ts
    │   ├── wallTiles.ts
    │   ├── toolUtils.ts
    │   ├── engine/
    │   │   ├── index.ts
    │   │   ├── officeState.ts
    │   │   ├── characters.ts
    │   │   ├── renderer.ts
    │   │   ├── gameLoop.ts
    │   │   └── matrixEffect.ts
    │   ├── sprites/
    │   │   ├── index.ts
    │   │   ├── spriteData.ts
    │   │   └── spriteCache.ts
    │   ├── layout/
    │   │   ├── index.ts
    │   │   ├── furnitureCatalog.ts
    │   │   ├── layoutSerializer.ts
    │   │   └── tileMap.ts
    │   └── editor/
    │       ├── index.ts
    │       ├── editorState.ts
    │       ├── editorActions.ts
    │       └── EditorToolbar.tsx
    ├── components/
    │   ├── AgentLabels.tsx
    │   ├── BottomToolbar.tsx
    │   ├── DebugView.tsx
    │   ├── SettingsModal.tsx
    │   ├── ZoomControls.tsx
    │   └── OfficeCanvas.tsx   ← from office/components/
    └── fonts/
        └── FSPixelSansUnicode-Regular.ttf
```

### Step 2.2: Configure Vite

**File**: `cmd/prism-vscode/webview-office/vite.config.ts`

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: '../dist/webview-office',
    emptyDirBeforeWrite: true,
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]',
      }
    }
  },
  base: './',
});
```

### Step 2.3: Port All Webview Source Files

Copy from `.prism/shared/ref/pixel-agents/webview-ui/src/` to `cmd/prism-vscode/webview-office/src/`:

**Direct copies** (no changes needed):
- `office/engine/officeState.ts`
- `office/engine/characters.ts`
- `office/engine/renderer.ts`
- `office/engine/gameLoop.ts`
- `office/engine/matrixEffect.ts`
- `office/sprites/spriteCache.ts`
- `office/sprites/spriteData.ts`
- `office/layout/tileMap.ts`
- `office/layout/layoutSerializer.ts`
- `office/layout/furnitureCatalog.ts`
- `office/colorize.ts`
- `office/floorTiles.ts`
- `office/wallTiles.ts`
- `office/toolUtils.ts`
- `office/types.ts`
- `office/editor/*`
- `office/components/OfficeCanvas.tsx`
- `office/components/ToolOverlay.tsx`
- `vscodeApi.ts`
- `notificationSound.ts`
- `constants.ts`
- `fonts/FSPixelSansUnicode-Regular.ttf`

**Adapted copies** (minor changes):
- `App.tsx` — Keep same structure, will add Prism overlays in Phase 4
- `hooks/useExtensionMessages.ts` — Keep same, will add Prism messages in Phase 4
- `hooks/useEditorActions.ts` — Direct copy
- `hooks/useEditorKeyboard.ts` — Direct copy
- `components/AgentLabels.tsx` — Direct copy, will theme in Phase 5
- `components/BottomToolbar.tsx` — Direct copy, will theme in Phase 5
- `components/DebugView.tsx` — Direct copy
- `components/SettingsModal.tsx` — Direct copy
- `components/ZoomControls.tsx` — Direct copy

### Step 2.4: Configure TypeScript

**File**: `cmd/prism-vscode/webview-office/tsconfig.json`

Match pixel-agents' webview tsconfig:
- `target: "ES2022"`, `module: "ESNext"`, `moduleResolution: "bundler"`
- `jsx: "react-jsx"`
- `verbatimModuleSyntax: true`, `erasableSyntaxOnly: true`
- `strict: true`, `noUnusedLocals: true`, `noUnusedParameters: true`

### Step 2.5: Wire Build Pipeline

**File**: `cmd/prism-vscode/package.json` (update scripts)

```json
{
  "scripts": {
    "build:office": "cd webview-office && npm run build",
    "compile": "npm run typecheck && node esbuild.mjs && npm run build:office",
    "package": "npm run typecheck && npm run build:office && npm run build:webview && node esbuild.mjs --production"
  }
}
```

### Step 2.6: Asset Copy

**File**: `cmd/prism-vscode/esbuild.mjs` (add asset copy)

Add `copyAssets()` function (modeled after pixel-agents' `esbuild.js:11-27`) that copies:
- `.prism/shared/ref/pixel-agents/webview-ui/public/assets/characters/` → `dist/assets/characters/`
- `.prism/shared/ref/pixel-agents/webview-ui/public/assets/furniture/` → `dist/assets/furniture/`
- `.prism/shared/ref/pixel-agents/webview-ui/public/assets/floors.png` → `dist/assets/floors.png`
- `.prism/shared/ref/pixel-agents/webview-ui/public/assets/walls.png` → `dist/assets/walls.png`
- `.prism/shared/ref/pixel-agents/webview-ui/public/assets/default-layout.json` → `dist/assets/default-layout.json`

For the actual integration, copy these assets into `cmd/prism-vscode/assets/` (checked into repo) and update the esbuild script to copy from there to `dist/assets/`.

### Step 2.7: Update `OfficeViewProvider` HTML Generation

Wire `getWebviewContent()` to load from `dist/webview-office/index.html` (production) or Vite dev server (development, detect via `.vite-office-port` file).

CSP policy:
```
default-src 'none';
style-src ${webview.cspSource} 'unsafe-inline';
script-src 'nonce-${nonce}';
img-src ${webview.cspSource};
font-src ${webview.cspSource};
```

### Phase 2 Verification

```bash
cd cmd/prism-vscode/webview-office && npm install && npm run build  # Webview builds
cd cmd/prism-vscode && npm run compile                               # Full build
```

Manual: Open Office panel → default layout renders with floor tiles, walls, furniture, editor toolbar. No agents visible yet.

---

## Phase 3: Agent Bridge & JSONL Integration

**Goal**: Wire the JSONL file watcher and transcript parser to the office. Claude Code sessions appear as animated characters with tool tracking.

### Step 3.1: Wire File Watcher in `OfficeViewProvider`

Connect the `webviewReady` message handler to:
1. Call `restoreAgents()` to rehydrate from workspace state
2. Load and send assets (characters, floors, walls, furniture, layout)
3. Call `ensureProjectScan()` to start scanning for JSONL files
4. Send `existingAgents` with restored agent data

This follows the exact same initialization sequence from `PixelAgentsViewProvider.ts:92-216`.

### Step 3.2: Wire Terminal Events

In `resolveWebviewView()`:
- Subscribe to `vscode.window.onDidChangeActiveTerminal` → send `agentSelected`
- Subscribe to `vscode.window.onDidCloseTerminal` → call `removeAgent()`, send `agentClosed`

### Step 3.3: Wire `openClaude` Message Handler

When webview sends `openClaude`:
1. Create VS Code terminal named `"Claude Code #N"`
2. Generate `crypto.randomUUID()` session ID
3. Send `claude --session-id <uuid>` to terminal
4. Create `AgentState`, start JSONL file watching
5. Send `agentCreated` to webview

This reuses `launchNewTerminal()` from the ported `agentManager.ts`.

### Step 3.4: Wire All Message Handlers

Implement the full message dispatch in `OfficeViewProvider.resolveWebviewView()`:

| Message | Handler |
|---------|---------|
| `webviewReady` | Full initialization sequence |
| `openClaude` | `launchNewTerminal()` |
| `focusAgent` | `agent.terminalRef.show()` |
| `closeAgent` | `agent.terminalRef.dispose()` |
| `saveAgentSeats` | Store in workspaceState |
| `saveLayout` | `writeLayoutToFile()` |
| `setSoundEnabled` | Store in globalState |
| `openSessionsFolder` | Open project dir in explorer |
| `exportLayout` | Show save dialog |
| `importLayout` | Show open dialog, validate, send `layoutLoaded` |

### Step 3.5: Create Agent Bridge

**New file**: `cmd/prism-vscode/src/office/agentBridge.ts`

```typescript
export interface PrismAgentContext {
  sessionId: string;
  storyId?: string;
  storyTitle?: string;
  workflowPhase?: string;
}

export class AgentBridge {
  private _contextMap = new Map<number, PrismAgentContext>();

  // Called when PrismController starts a session
  setAgentContext(agentId: number, context: PrismAgentContext): void;

  // Called when office detects a new JSONL file — checks if it belongs to a Prism session
  matchSessionToAgent(jsonlPath: string): PrismAgentContext | undefined;

  // Called when Spectrum starts a story
  updateStoryContext(agentId: number, storyId: string, storyTitle: string): void;

  // Called when agent is removed
  clearContext(agentId: number): void;
}
```

Wire `PrismController` to call `AgentBridge` methods when:
- A chat session starts (`ChatService.sendMessage`)
- A spectrum story starts (`SpectrumRunner.story_started` event)
- A skill executes (`PluginService.executeSkill`)

### Step 3.6: Update PrismState

**File**: `cmd/prism-vscode/src/shared/PrismState.ts`

Update office state to reflect live agent data:
```typescript
office: {
  enabled: boolean;
  agentCount: number;
  activeAgents: Array<{
    id: number;
    sessionId?: string;
    storyId?: string;
    storyTitle?: string;
  }>;
}
```

### Phase 3 Verification

```bash
cd cmd/prism-vscode && npm run compile  # Builds clean
cd cmd/prism-vscode && npm test         # Existing tests pass
```

Manual:
- Open Office panel → default layout renders
- Click "+ Agent" → terminal opens, character spawns with matrix effect
- Claude runs a tool → character walks to seat, typing animation plays
- Claude finishes → character goes idle, wanders
- Close terminal → character despawns with matrix effect
- Multiple agents → each gets different palette, different seat
- Sub-agents (Task tool) → smaller character spawns near parent

---

## Phase 4: Prism Integration

**Goal**: Prism-managed sessions appear in the office with story context. Characters show story labels during Spectrum execution.

### Step 4.1: Event Emitter Bridge

**File**: `cmd/prism-vscode/src/core/controller/index.ts`

Add events to `PrismController`:
```typescript
private _onDidStartSession = new vscode.EventEmitter<{ sessionId: string; storyId?: string; storyTitle?: string }>();
readonly onDidStartSession = this._onDidStartSession.event;

private _onDidUpdateStory = new vscode.EventEmitter<{ storyId: string; storyTitle: string }>();
readonly onDidUpdateStory = this._onDidUpdateStory.event;
```

Fire `_onDidStartSession` when:
- `ChatService.sendMessage` starts a CLI session
- `PluginService.executeSkill` starts a plugin
- `SpectrumRunner.runIteration()` starts a story

Fire `_onDidUpdateStory` when:
- Spectrum story changes (story_started, story_complete)

### Step 4.2: Wire `OfficeViewProvider` to Controller Events

In `OfficeViewProvider` constructor, subscribe to controller events:
```typescript
controller.onDidStartSession(({ sessionId, storyId, storyTitle }) => {
  this._agentBridge.setSessionContext(sessionId, { storyId, storyTitle });
});

controller.onDidUpdateStory(({ storyId, storyTitle }) => {
  // Find agent with matching story, send agentStoryContext to webview
});
```

### Step 4.3: Add `agentStoryContext` Message

**New backend→webview message**:
```typescript
{ type: 'agentStoryContext', id: number, storyId: string, storyTitle: string }
```

Sent when:
- Agent bridge matches a new JSONL file to a Prism session with story context
- Spectrum story status changes

### Step 4.4: Handle Story Context in Webview

**File**: `cmd/prism-vscode/webview-office/src/hooks/useExtensionMessages.ts`

Add new state:
```typescript
const [agentStories, setAgentStories] = useState<Record<number, { storyId: string; storyTitle: string }>>({});
```

Handle `agentStoryContext` message:
```typescript
case 'agentStoryContext':
  setAgentStories(prev => ({ ...prev, [msg.id]: { storyId: msg.storyId, storyTitle: msg.storyTitle } }));
  break;
```

### Step 4.5: Story Label UI Component

**New file**: `cmd/prism-vscode/webview-office/src/components/StoryLabels.tsx`

React overlay component (similar to `AgentLabels`) that renders story ID/title tags above Prism-managed characters. Position: canvas coordinates from character position, offset above the agent label.

Style: Small pill badge with story ID (e.g., "STORY-003") in spectral teal color.

### Step 4.6: Integrate Story Labels in `App.tsx`

Add `<StoryLabels>` component alongside existing `<ToolOverlay>`:
```tsx
<StoryLabels
  officeState={officeState}
  agentStories={agentStories}
  zoom={zoom}
  pan={pan}
/>
```

### Phase 4 Verification

```bash
cd cmd/prism-vscode && npm run compile
cd cmd/prism-vscode && npm test
```

Manual:
- Start a chat session → character appears in office
- Start Spectrum execution → character shows story ID label
- Story completes, next story starts → label updates
- Close Prism session → character disappears from office

---

## Phase 5: Spectral Theming

**Goal**: Office uses Prism brand colors for character palettes, UI overlays, and visual effects.

### Step 5.1: Create Spectral Character Palettes

**File**: `cmd/prism-vscode/webview-office/src/office/sprites/spriteData.ts`

Replace the 6 default `CHARACTER_PALETTES` with spectral-themed palettes:

```typescript
export const CHARACTER_PALETTES: Palette[] = [
  // Blue primary (Prism blue #3B82F6)
  { skin: '#F5D6C3', shirt: '#3B82F6', pants: '#1E40AF', hair: '#1E293B', shoes: '#334155' },
  // Teal secondary (Prism teal #14B8A6)
  { skin: '#E8C4A8', shirt: '#14B8A6', pants: '#0F766E', hair: '#44403C', shoes: '#292524' },
  // Green success (Prism green #22C55E)
  { skin: '#D4A574', shirt: '#22C55E', pants: '#15803D', hair: '#1C1917', shoes: '#1C1917' },
  // Amber accent (Prism amber #F59E0B)
  { skin: '#F5D6C3', shirt: '#F59E0B', pants: '#B45309', hair: '#78350F', shoes: '#451A03' },
  // Indigo (complementary)
  { skin: '#E8C4A8', shirt: '#6366F1', pants: '#4338CA', hair: '#27272A', shoes: '#18181B' },
  // Rose (complementary)
  { skin: '#D4A574', shirt: '#F43F5E', pants: '#BE123C', hair: '#292524', shoes: '#1C1917' },
];
```

### Step 5.2: Spectral Matrix Effect Colors

**File**: `cmd/prism-vscode/webview-office/src/constants.ts`

Update matrix effect colors from green to spectral blue:
```typescript
export const MATRIX_HEAD_COLOR = '#93C5FD';       // Light blue (was '#ccffcc')
export const MATRIX_TRAIL_BRIGHT = '#3B82F6';     // Prism blue (was '#00ff00')
export const MATRIX_TRAIL_MID = '#1D4ED8';        // Mid blue (was '#00aa00')
export const MATRIX_TRAIL_DIM = '#1E3A5F';        // Dark blue (was '#004400')
```

**File**: `cmd/prism-vscode/webview-office/src/office/engine/matrixEffect.ts`

Update the hardcoded color values to use the new constants.

### Step 5.3: Spectral Speech Bubbles

**File**: `cmd/prism-vscode/webview-office/src/office/sprites/spriteData.ts`

Update `BUBBLE_PERMISSION_SPRITE` dots from amber to Prism amber `#F59E0B`.
Update `BUBBLE_WAITING_SPRITE` checkmark from green to Prism teal `#14B8A6`.

### Step 5.4: CSS Theming for UI Overlays

**New file**: `cmd/prism-vscode/webview-office/src/theme/spectral-office.css`

Apply spectral colors to toolbar, buttons, settings modal, agent labels, editor toolbar:

```css
:root {
  --prism-blue: #3B82F6;
  --prism-teal: #14B8A6;
  --prism-green: #22C55E;
  --prism-amber: #F59E0B;
  --prism-bg: #0F172A;
  --prism-surface: #1E293B;
  --prism-text: #E2E8F0;
  --prism-text-dim: #94A3B8;
  --prism-border: #334155;
}
```

Style all toolbar buttons, modals, labels, and overlays with these CSS variables.

### Step 5.5: Vignette in Spectral Colors

**File**: `cmd/prism-vscode/webview-office/src/App.tsx`

Update the vignette overlay gradient from black to a subtle deep indigo (`#0F172A` at 40% opacity).

### Phase 5 Verification

Manual:
- Characters display new spectral color palettes (blue, teal, green, amber, indigo, rose)
- Spawn/despawn matrix effect uses blue instead of green
- Speech bubbles use Prism amber (permission) and teal (waiting)
- Toolbar, buttons, and labels match spectral dark theme
- Vignette has subtle indigo tint
- Overall visual impression is cohesive with Prism brand

---

## Phase 6: Build Pipeline & Polish

**Goal**: Complete build integration, dev workflow, asset management, final testing.

### Step 6.1: Asset Management

Move pixel-agents assets into the prism-vscode repo:
```
cmd/prism-vscode/assets/
├── characters/
│   ├── char_0.png through char_5.png
├── furniture/
│   ├── furniture-catalog.json
│   └── [individual furniture PNGs]
├── floors.png
├── walls.png
└── default-layout.json
```

### Step 6.2: Asset Copy in Build

**File**: `cmd/prism-vscode/esbuild.mjs`

Add `copyOfficeAssets()` function:
```javascript
function copyOfficeAssets() {
  const src = path.join(__dirname, 'assets');
  const dest = path.join(__dirname, 'dist', 'assets');
  fs.cpSync(src, dest, { recursive: true });
}
```

Call after build completes.

### Step 6.3: Dev Mode HMR

**File**: `cmd/prism-vscode/webview-office/vite.config.ts`

Add dev server config:
```typescript
server: {
  port: 5174,  // Different from webview-ui's port
}
```

**File**: `cmd/prism-vscode/src/hosts/vscode/OfficeViewProvider.ts`

In `getWebviewContent()`, check for `.vite-office-port` file in `webview-office/` directory. If found and `IS_PRODUCTION !== "true"`, load from `http://localhost:{port}` with React Refresh.

### Step 6.4: Update Watch Script

**File**: `cmd/prism-vscode/package.json`

Update `watch` script to include office webview:
```json
"watch": "concurrently \"node esbuild.mjs --watch\" \"cd webview-ui && npm run dev\" \"cd webview-office && npm run dev\""
```

### Step 6.5: Package Script

Verify `npm run package` produces a complete build:
1. TypeScript type-check
2. Build webview-ui (Vite)
3. Build webview-office (Vite)
4. Build extension host (esbuild, production)
5. Copy assets to dist/

### Step 6.6: Final Integration Testing

Test matrix:
- [ ] Fresh install: No layout file → default layout renders
- [ ] Layout persistence: Edit layout → close → reopen → layout preserved
- [ ] Agent persistence: Create agent → close panel → reopen → agent restored
- [ ] Multiple agents: 3+ agents with different palettes and seats
- [ ] Sub-agents: Task tool spawns sub-agent near parent
- [ ] Permission detection: Tool waits >7s → permission bubble appears
- [ ] Waiting detection: Turn ends → waiting bubble + sound
- [ ] Layout editor: Paint tiles, place furniture, undo, redo, save, reset
- [ ] Terminal management: Focus agent → VS Code focuses terminal
- [ ] Zoom/pan: Scroll to zoom, drag to pan, controls work
- [ ] Import/export layout: Export to file, import from file
- [ ] Prism chat: Start chat → agent appears in office
- [ ] Spectrum: Run spectrum → story labels on characters
- [ ] Hidden panel: Hide office → re-show → state preserved
- [ ] Clean build: `npm run package` succeeds from clean state

### Phase 6 Verification

```bash
cd cmd/prism-vscode && rm -rf dist node_modules webview-ui/node_modules webview-office/node_modules
cd cmd/prism-vscode && npm install
cd cmd/prism-vscode/webview-ui && npm install
cd cmd/prism-vscode/webview-office && npm install
cd cmd/prism-vscode && npm run package  # Full clean build succeeds
```

---

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| `pngjs` bundling issues with esbuild | Medium | Blocks asset loading | `pngjs` is pure JS, no native deps. Test early in Phase 1. |
| Two webview memory overhead | Low | Performance | Both are lightweight React apps. Canvas 2D game loop pauses when hidden (no `requestAnimationFrame` when not visible). |
| VS Code engine bump breaks users | Low | User complaints | `^1.109.0` is July 2024. By Feb 2026, virtually all users are past this. |
| Vite + pixel-agents TypeScript strictness conflicts | Medium | Build errors | The webview has its own tsconfig. `erasableSyntaxOnly` means no `enum` — pixel-agents already follows this. |
| JSONL session matching between Prism and office | Medium | Missing agents | The `agentBridge` uses JSONL file path matching. If Prism and office disagree on project hash, agents won't get story labels (but still function as generic agents). |
| Layout file race conditions (multiple windows) | Low | Corrupted layout | Pixel-agents already handles this with atomic writes + own-write suppression. Preserved in port. |

## Edge Cases

- **No `.prism/` directory**: Office still works — layout file created at `~/.prism/office-layout.json` independent of workspace .prism dir
- **No Claude CLI installed**: "+ Agent" button fails gracefully (terminal opens but `claude` command not found)
- **JSONL file deleted mid-session**: File watcher handles `ENOENT` errors, agent stays in last known state
- **Panel hidden during Spectrum**: Canvas `requestAnimationFrame` pauses when webview not visible, no CPU waste
- **Layout with more seats than agents**: Empty seats visible, characters assigned to subset
- **Layout with fewer seats than agents**: Extra characters wander without assigned seats
- **Terminal renamed by user**: Agent detection relies on terminal name prefix `"Claude Code"`. Renamed terminals lose tracking.

---

## File Summary

### New Files (estimated ~35 files)

**Backend** (10 files):
- `src/hosts/vscode/OfficeViewProvider.ts` (~350 LOC)
- `src/office/agentBridge.ts` (~100 LOC)
- `src/office/fileWatcher.ts` (~250 LOC, ported)
- `src/office/transcriptParser.ts` (~300 LOC, ported)
- `src/office/timerManager.ts` (~125 LOC, ported)
- `src/office/assetLoader.ts` (~450 LOC, ported)
- `src/office/layoutPersistence.ts` (~175 LOC, adapted)
- `src/office/agentManager.ts` (~320 LOC, adapted)
- `src/office/types.ts` (~25 LOC, ported)
- `src/office/constants.ts` (~45 LOC, adapted)

**Webview** (~25 files):
- Full port of `webview-ui/src/` from pixel-agents
- Plus `StoryLabels.tsx` (~80 LOC, new)
- Plus `theme/spectral-office.css` (~100 LOC, new)

### Modified Files (5 files)

- `src/extension.ts` — Register OfficeViewProvider, 3 commands
- `src/shared/PrismState.ts` — Add office state fields
- `src/core/controller/index.ts` — Add session/story events
- `package.json` — Views, commands, deps, scripts, engine
- `esbuild.mjs` — Asset copy step

### Total Estimated New Code

- Backend: ~2,140 LOC (mostly ported from pixel-agents)
- Webview: ~5,500 LOC (mostly ported from pixel-agents)
- New Prism-specific code: ~600 LOC
- Modified existing code: ~150 LOC changes
- **Total: ~8,400 LOC** (of which ~7,000 are direct ports)
