---
date: 2026-03-01T00:00:00Z
planner: Claude
repository: prism-plugin
branch: main
feature: "Option B — Three-Package Split: Shared Code + Full Feature Parity"
status: in_progress
phases: 20
estimated_files_changed: 120+
tags: [plan, architecture, monorepo, electron, vscode, office, spectrum]
research_doc: ".prism/shared/research/2026-03-01-three-package-split-architecture.md"
---

# Implementation Plan: Three-Package Split Architecture
## `packages/prism-core` + `packages/prism-ui` + Thin Platform Shells

---

## Goal

Transform the prism-plugin repository from two independent applications (`cmd/prism-vscode` and `cmd/prism-electron`) with fragile path aliases into a proper monorepo with shared packages. Achieve full feature parity: functional canvas office, real Spectrum integration, workspace discovery, worktree management, quality gate execution, research/plans browsing, and secure API key storage — all production-ready across both platforms.

---

## Success Criteria

#### Automated Verification
- [ ] `cd packages/prism-core && npm run build` succeeds
- [ ] `cd packages/prism-ui && npm run build` succeeds
- [ ] `cd cmd/prism-vscode && npm run compile` succeeds (esbuild)
- [ ] `cd cmd/prism-vscode/webview-ui && npm run build` succeeds (Vite)
- [ ] `cd cmd/prism-vscode/webview-office && npm run build` succeeds (Vite)
- [ ] `cd cmd/prism-vscode/webview-panel && npm run build` succeeds (Vite)
- [ ] `cd cmd/prism-electron && npm run make` succeeds (Forge)
- [ ] `cd cmd/prism-vscode && npm test` passes
- [ ] TypeScript strict mode passes across all packages
- [ ] No circular dependency warnings during build
- [ ] `npm install` from repo root installs all workspace dependencies

#### Manual Verification
- [ ] VSCode extension loads and all existing features work unchanged
- [ ] Electron app launches, chat works, Spectrum runs stories
- [ ] Canvas office renders in Electron with sprites, walking agents, furniture editor
- [ ] Agents appear in Electron office when Claude sessions start
- [ ] Spectrum stories in Electron show real agents in office with tool activity
- [ ] Workspace discovery shows sibling projects in Electron
- [ ] Worktree create/delete works in Electron
- [ ] Quality gates execute and show real output in Electron monitor
- [ ] Research/plans files are browsable in Electron stories panel
- [ ] API key can be stored and retrieved securely in Electron

---

## What We're NOT Doing

- **Not changing VSCode's existing UI layout** — VSCode keeps its sidebar+panel+tree architecture
- **Not porting Electron's V2 IDE shell to VSCode** — AppShell, TabBar, ContentRail stay Electron-only
- **Not building a shared component library** — packages/prism-ui contains shared source, not a published npm package
- **Not implementing Electron native menus or keyboard shortcuts** — those remain Electron-specific in `cmd/prism-electron`
- **Not adding a shared test suite** — each platform keeps its own test infrastructure
- **Not implementing command palette in Electron** — stays UI-button driven
- **Not porting VSCode tree view providers** — Electron uses React panels, not tree views
- **Not upgrading React 18 → 19 in webview-ui** — both webview-ui packages stay on React 18 for now; office/panel stay on React 19

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| npm workspaces hoisting breaks Electron Forge | Electron can't find dependencies | Use `nohoist` for electron-specific deps in root package.json |
| Circular dependencies between prism-core and prism-ui | Build failures | Core has zero UI imports; UI imports core types only |
| esbuild can't resolve workspace packages | VSCode build fails | Use path aliases in esbuild config pointing to packages/ source |
| Canvas office performance differs in Electron | Rendering issues | Same renderer code; test on low-end hardware |
| JSONL file path assumptions differ per OS | Office agents don't track | Use `os.homedir()` + `path.join` consistently (already done) |
| TypeScript strict mode upgrade breaks electron root | Compilation errors | Fix type errors incrementally; `noImplicitAny` already enabled |

---

## Phase Dependencies

```
Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5
                                    ↓
Phase 6 → Phase 7 → Phase 8
                        ↓
Phase 9 → Phase 10 → Phase 11 → Phase 12 → Phase 13 → Phase 14
                                                            ↓
Phase 15 → Phase 16 → Phase 17 → Phase 18 → Phase 19 → Phase 20
```

Phases within a group are sequential. Groups 2-3 (UI Package) can start after Phase 3. Groups 4-5 (Office) require Phase 5.

---

## Phase 1: Monorepo Foundation

**Goal**: Create root `package.json` with npm workspaces. Resolve TypeScript and Vite version conflicts. All existing builds must continue to work.

### Files to Create
- `package.json` (repo root)

### Files to Modify
- `cmd/prism-electron/package.json` — upgrade TypeScript `~4.5.4` → `^5.4.5`
- `cmd/prism-electron/tsconfig.json` — add `strict: true`, remove `allowJs`, align with shared config
- `cmd/prism-electron/package.json` — upgrade Vite `^5.4.21` → `^6.0.0` (align with all other packages)
- `cmd/prism-electron/vite.main.config.mts` — verify Vite 6 compatibility
- `cmd/prism-electron/forge.config.ts` — verify Forge compatibility with Vite 6

### Steps

1. Create root `package.json`:
   ```json
   {
     "name": "prism-plugin",
     "private": true,
     "workspaces": [
       "packages/*",
       "cmd/prism-vscode",
       "cmd/prism-vscode/webview-ui",
       "cmd/prism-vscode/webview-office",
       "cmd/prism-vscode/webview-panel",
       "cmd/prism-electron",
       "cmd/prism-electron/webview-ui"
     ]
   }
   ```

2. Upgrade `cmd/prism-electron/package.json`:
   - TypeScript: `~4.5.4` → `^5.4.5` (line 44)
   - Vite: `^5.4.21` → `^6.0.0` (line 45)

3. Update `cmd/prism-electron/tsconfig.json`:
   - Add `"strict": true` (currently absent — only `noImplicitAny` is set)
   - Remove `"allowJs": true` (line 5) — not needed with strict TS
   - Keep `"paths": { "@prism-core/*": ["../prism-vscode/src/*"] }` — will be updated in Phase 3

4. Fix any TypeScript strict-mode errors in `cmd/prism-electron/src/`:
   - Expected issues: missing type annotations, possible null checks
   - Files to check: `main.ts`, `preload.ts`, `ElectronPrismController.ts`, `ElectronIPCBridge.ts`, `window-state.ts`, `prism/init.ts`, `prism/watcher.ts`, `prism/config.ts`

5. Verify Vite 6 + Electron Forge compatibility:
   - Run `cd cmd/prism-electron && npm run make`
   - Update `forge.config.ts` if needed for Vite 6 API changes

6. Run `npm install` from repo root — verify all workspaces resolve

### Verification
#### Automated
- [x] `npm install` from root completes without errors
- [x] `cd cmd/prism-vscode && npm run compile` succeeds
- [x] `cd cmd/prism-vscode/webview-ui && npm run build` succeeds
- [x] `cd cmd/prism-electron && npm run make` succeeds
- [x] `cd cmd/prism-electron/webview-ui && npm run build` succeeds

#### Manual
- [ ] VSCode extension loads and chat works
- [ ] Electron app launches and chat works

---

## Phase 2: Create `packages/prism-core`

**Goal**: Create the shared core package structure with proper TypeScript configuration. Move the 12 fully-agnostic files that have zero platform imports.

### Files to Create
- `packages/prism-core/package.json`
- `packages/prism-core/tsconfig.json`
- `packages/prism-core/src/shared/types.ts` (moved from `cmd/prism-vscode/src/shared/types.ts`)
- `packages/prism-core/src/shared/PrismMessage.ts` (moved)
- `packages/prism-core/src/shared/PrismState.ts` (moved)
- `packages/prism-core/src/core/api/types.ts` (moved)
- `packages/prism-core/src/core/controller/grpc-handler.ts` (moved)
- `packages/prism-core/src/core/controller/prism/spectrum.ts` (moved — SpectrumEngine)
- `packages/prism-core/src/core/controller/prism/workflow.ts` (moved — WorkflowStateMachine)
- `packages/prism-core/src/claude/events.ts` (moved)
- `packages/prism-core/src/claude/parser.ts` (moved)
- `packages/prism-core/src/prism/signals.ts` (moved)
- `packages/prism-core/src/office/agentBridge.ts` (moved)
- `packages/prism-core/src/office/constants.ts` (moved)

### Files to Modify
- `cmd/prism-vscode/src/core/controller/index.ts` — update imports to `@prism-core/*`
- `cmd/prism-vscode/src/core/controller/prism/spectrum-runner.ts` — update imports
- `cmd/prism-vscode/src/core/controller/prism/mode-bridge.ts` — update imports
- `cmd/prism-vscode/src/core/controller/prism/plugin-bridge.ts` — update imports
- `cmd/prism-vscode/src/core/controller/prism/stories.ts` — update imports
- `cmd/prism-vscode/src/core/controller/state/subscribeToState.ts` — update imports
- `cmd/prism-vscode/src/claude/runner.ts` — update imports
- `cmd/prism-vscode/src/prism/progress.ts` — update imports
- `cmd/prism-vscode/src/hosts/vscode/VscodeWebviewProvider.ts` — update imports
- `cmd/prism-vscode/src/hosts/vscode/OfficeViewProvider.ts` — update imports
- `cmd/prism-vscode/src/hosts/vscode/PrismPanelProvider.ts` — update imports
- `cmd/prism-vscode/src/providers/*.ts` — update imports
- `cmd/prism-vscode/src/extension.ts` — update imports
- `cmd/prism-vscode/esbuild.mjs` — add alias for `@prism-core`
- `cmd/prism-vscode/tsconfig.json` — add `@prism-core/*` path alias
- `cmd/prism-electron/tsconfig.json` — update `@prism-core/*` to `../../packages/prism-core/src/*`
- `cmd/prism-electron/vite.main.config.mts` — update alias to `../../packages/prism-core/src`
- `cmd/prism-electron/src/hosts/electron/ElectronPrismController.ts` — imports already use `@prism-core/*`, no changes needed

### Files to Delete
- `cmd/prism-vscode/src/shared/types.ts` (moved)
- `cmd/prism-vscode/src/shared/PrismMessage.ts` (moved)
- `cmd/prism-vscode/src/shared/PrismState.ts` (moved)
- `cmd/prism-vscode/src/core/api/types.ts` (moved)
- `cmd/prism-vscode/src/core/controller/grpc-handler.ts` (moved)
- `cmd/prism-vscode/src/core/controller/prism/spectrum.ts` (moved)
- `cmd/prism-vscode/src/core/controller/prism/workflow.ts` (moved)
- `cmd/prism-vscode/src/claude/events.ts` (moved)
- `cmd/prism-vscode/src/claude/parser.ts` (moved)
- `cmd/prism-vscode/src/prism/signals.ts` (moved)
- `cmd/prism-vscode/src/office/agentBridge.ts` (moved)
- `cmd/prism-vscode/src/office/constants.ts` (moved)

### Steps

1. Create `packages/prism-core/package.json`:
   ```json
   {
     "name": "@prism/core",
     "version": "0.1.0",
     "private": true,
     "main": "src/index.ts",
     "types": "src/index.ts",
     "scripts": {
       "build": "tsc --noEmit",
       "typecheck": "tsc --noEmit"
     },
     "devDependencies": {
       "typescript": "^5.4.5"
     },
     "dependencies": {
       "uuid": "^11.0.5"
     }
   }
   ```

2. Create `packages/prism-core/tsconfig.json`:
   ```json
   {
     "compilerOptions": {
       "target": "ES2022",
       "module": "CommonJS",
       "moduleResolution": "Node",
       "strict": true,
       "esModuleInterop": true,
       "skipLibCheck": true,
       "resolveJsonModule": true,
       "declaration": true,
       "declarationMap": true,
       "sourceMap": true,
       "outDir": "./dist",
       "rootDir": "./src",
       "noEmit": true
     },
     "include": ["src/**/*"]
   }
   ```

3. Move all 12 fully-agnostic files preserving directory structure:
   - `src/shared/types.ts` → `packages/prism-core/src/shared/types.ts`
   - `src/shared/PrismMessage.ts` → `packages/prism-core/src/shared/PrismMessage.ts`
   - `src/shared/PrismState.ts` → `packages/prism-core/src/shared/PrismState.ts`
   - `src/core/api/types.ts` → `packages/prism-core/src/core/api/types.ts`
   - `src/core/controller/grpc-handler.ts` → `packages/prism-core/src/core/controller/grpc-handler.ts`
   - `src/core/controller/prism/spectrum.ts` → `packages/prism-core/src/core/controller/prism/spectrum.ts`
   - `src/core/controller/prism/workflow.ts` → `packages/prism-core/src/core/controller/prism/workflow.ts`
   - `src/claude/events.ts` → `packages/prism-core/src/claude/events.ts`
   - `src/claude/parser.ts` → `packages/prism-core/src/claude/parser.ts`
   - `src/prism/signals.ts` → `packages/prism-core/src/prism/signals.ts`
   - `src/office/agentBridge.ts` → `packages/prism-core/src/office/agentBridge.ts`
   - `src/office/constants.ts` → `packages/prism-core/src/office/constants.ts`

4. Add `@prism-core/*` path alias to `cmd/prism-vscode/tsconfig.json`:
   ```json
   "paths": {
     "@shared/*": ["./src/shared/*"],
     "@prism-core/*": ["../../packages/prism-core/src/*"]
   }
   ```

5. Add alias to `cmd/prism-vscode/esbuild.mjs`:
   ```javascript
   alias: {
     '@prism-core': path.resolve(__dirname, '../../packages/prism-core/src'),
   }
   ```

6. Update `cmd/prism-electron/tsconfig.json` paths (line 15-17):
   ```json
   "@prism-core/*": ["../../packages/prism-core/src/*"]
   ```

7. Update `cmd/prism-electron/vite.main.config.mts` alias (line 11):
   ```typescript
   '@prism-core': path.resolve(__dirname, '../../packages/prism-core/src')
   ```

8. Update ALL import statements in `cmd/prism-vscode/src/` files that reference moved files:
   - `../../shared/types` → `@prism-core/shared/types`
   - `../../shared/PrismMessage` → `@prism-core/shared/PrismMessage`
   - `../../shared/PrismState` → `@prism-core/shared/PrismState`
   - `./grpc-handler` → `@prism-core/core/controller/grpc-handler` (from controller/index.ts)
   - `./prism/spectrum` → `@prism-core/core/controller/prism/spectrum` (from controller/index.ts)
   - `./prism/workflow` → `@prism-core/core/controller/prism/workflow` (from controller/index.ts)
   - `../../claude/events` → `@prism-core/claude/events`
   - `../../claude/parser` → `@prism-core/claude/parser` (from runner.ts)
   - `../../prism/signals` → `@prism-core/prism/signals`
   - `../../office/agentBridge` → `@prism-core/office/agentBridge`
   - `../../office/constants` → `@prism-core/office/constants`

   Note: ElectronPrismController imports already use `@prism-core/*` syntax — these will now resolve to the new packages/prism-core location automatically.

9. Delete the original files from `cmd/prism-vscode/src/`

### Verification
#### Automated
- [x] `cd packages/prism-core && npm run typecheck` passes
- [x] `cd cmd/prism-vscode && npm run compile` succeeds
- [ ] `cd cmd/prism-electron && npm run make` succeeds

#### Manual
- [ ] VSCode extension loads, chat + Spectrum work
- [ ] Electron app launches, chat + Spectrum work

---

## Phase 3: Extract Remaining Core Files

**Goal**: Move the 7 platform-agnostic files (stories.ts, progress.ts, runner.ts, StoriesManager, plugin-bridge.ts, spectrum-runner.ts, mode-bridge.ts) plus the system-prompt module to `packages/prism-core`. Consolidate the Electron local copies (init.ts, watcher.ts, config.ts) into the shared package with platform-injected parameters.

### Files to Move to `packages/prism-core/src/`
- `cmd/prism-vscode/src/prism/stories.ts` → `packages/prism-core/src/prism/stories.ts`
- `cmd/prism-vscode/src/prism/progress.ts` → `packages/prism-core/src/prism/progress.ts`
- `cmd/prism-vscode/src/claude/runner.ts` → `packages/prism-core/src/claude/runner.ts`
- `cmd/prism-vscode/src/core/controller/prism/stories.ts` → `packages/prism-core/src/core/controller/prism/stories.ts`
- `cmd/prism-vscode/src/core/controller/prism/plugin-bridge.ts` → `packages/prism-core/src/core/controller/prism/plugin-bridge.ts`
- `cmd/prism-vscode/src/core/controller/prism/spectrum-runner.ts` → `packages/prism-core/src/core/controller/prism/spectrum-runner.ts`
- `cmd/prism-vscode/src/core/controller/prism/mode-bridge.ts` → `packages/prism-core/src/core/controller/prism/mode-bridge.ts`
- `cmd/prism-vscode/src/core/prompts/system-prompt.ts` → `packages/prism-core/src/core/prompts/system-prompt.ts`

### Files to Create in `packages/prism-core/src/`
- `packages/prism-core/src/prism/init.ts` — merged from VSCode's `initPrismDir()` function (without the `initPrismDirInWorkspace()` wrapper)
- `packages/prism-core/src/prism/config.ts` — platform-agnostic version taking `projectDir: string` parameter
- `packages/prism-core/src/prism/watcher.ts` — Node.js-native version using chokidar (based on Electron's existing local copy)

### Files to Modify
- `cmd/prism-vscode/src/core/controller/index.ts` — update imports for moved files
- `cmd/prism-vscode/src/prism/init.ts` — keep only `initPrismDirInWorkspace()` as a thin VSCode wrapper calling `@prism-core/prism/init`
- `cmd/prism-vscode/src/prism/watcher.ts` — thin wrapper around shared watcher or keep as-is (uses vscode.FileSystemWatcher)
- `cmd/prism-vscode/src/prism/config.ts` — thin wrapper calling shared config with `vscode.workspace.workspaceFolders`

### Files to Delete
- `cmd/prism-electron/src/prism/init.ts` — replaced by shared version
- `cmd/prism-electron/src/prism/watcher.ts` — replaced by shared version
- `cmd/prism-electron/src/prism/config.ts` — replaced by shared version

### Steps

1. Move all 8 platform-agnostic files preserving directory structure
2. Create shared `prism/init.ts` containing only the `initPrismDir(prismDirPath: string)` function (pure fs.mkdir + fs.writeFile)
3. Create shared `prism/config.ts` with `detectPrismDir(projectDir: string)` and `detectStoriesPath(projectDir: string)` — parameter-injected instead of reading `vscode.workspace.workspaceFolders`
4. Create shared `prism/watcher.ts` using chokidar + Node.js EventEmitter (based on Electron's existing implementation at `cmd/prism-electron/src/prism/watcher.ts`)
5. Refactor `cmd/prism-vscode/src/prism/init.ts` to become a thin wrapper:
   ```typescript
   import * as vscode from 'vscode';
   import { initPrismDir } from '@prism-core/prism/init';

   export async function initPrismDirInWorkspace(): Promise<void> {
     const folders = vscode.workspace.workspaceFolders;
     if (!folders) { vscode.window.showErrorMessage('No workspace'); return; }
     const prismDir = path.join(folders[0].uri.fsPath, '.prism');
     try { await initPrismDir(prismDir); vscode.window.showInformationMessage('Done'); }
     catch (e) { vscode.window.showErrorMessage(`Failed: ${e}`); }
   }
   ```
6. Keep `cmd/prism-vscode/src/prism/watcher.ts` as-is (it wraps `vscode.FileSystemWatcher` which is needed for proper VSCode integration) — but import shared types
7. Delete Electron's 3 local replacement files (`init.ts`, `watcher.ts`, `config.ts`)
8. Update `ElectronPrismController` imports from `../../prism/init` → `@prism-core/prism/init`, etc.
9. Update all VSCode imports for moved files
10. Add new dependencies to `packages/prism-core/package.json`: `chokidar`, `@anthropic-ai/sdk` (if needed by runner.ts)

### Verification
#### Automated
- [x] `cd packages/prism-core && npm run typecheck` passes
- [x] `cd cmd/prism-vscode && npm run compile` succeeds
- [x] `cd cmd/prism-electron && npm run make` succeeds

#### Manual
- [ ] VSCode: file watcher detects `.prism/` changes correctly
- [ ] Electron: file watcher detects `.prism/` changes correctly
- [ ] Both: Spectrum can run stories end-to-end

---

## Phase 4: Create `BasePrismController`

**Goal**: Extract the shared controller logic from `PrismController` into an abstract `BasePrismController` in `packages/prism-core` using Node.js `EventEmitter`. Define the `IPrismController` interface.

### Files to Create
- `packages/prism-core/src/core/controller/BasePrismController.ts`
- `packages/prism-core/src/core/controller/types.ts` — `IPrismController` interface, `PostMessageFn` type

### Files to Modify
- `cmd/prism-vscode/src/core/controller/index.ts` — refactor `PrismController` to extend `BasePrismController`
- `cmd/prism-electron/src/hosts/electron/ElectronPrismController.ts` — refactor to extend `BasePrismController`

### Steps

1. Create `packages/prism-core/src/core/controller/types.ts`:
   ```typescript
   import { PrismExtensionState } from '../../shared/PrismState';

   export type PostMessageFn = (msg: unknown) => Promise<void> | void;

   export interface AgentSessionData {
     sessionId: string;
     storyId?: string;
     storyTitle?: string;
     isSpectrum?: boolean;
   }

   export interface UpdatedStoryData {
     storyId: string;
     storyTitle: string;
   }
   ```

2. Create `BasePrismController` with:
   - Extends Node.js `EventEmitter`
   - Contains all 20 identical gRPC handler registrations (extracted from both controllers)
   - Contains all shared state management (`_state`, `_postMessageFn`, `_subscribers`)
   - Contains `_loadStories()`, `_checkClaudeCli()`, `_getOrCreateModeBridge()`, `_runChatSession()`, `_buildChatPrompt()`, `_runSpectrumLoop()`, `_broadcastState()`
   - Declares `abstract _getWorkspaceRoot(): string | undefined`
   - Declares `abstract _detectPrismDir(): Promise<void>`
   - Emits typed events: `'fileChange'`, `'stateChange'`, `'sessionStart'`, `'storyUpdate'`, `'spectrumStoryEnd'`
   - Contains `agentBridge: AgentBridge` instance
   - Registers AgentBridge calls in `sendMessage`, `executeSkill`, and spectrum `story_started` handler
   - Fires events in `updateState()`, `_onPrismFileChange()`, and spectrum handlers

3. Refactor `PrismController` to extend `BasePrismController`:
   - Constructor takes `vscode.ExtensionContext`, passes workspace root to super
   - Implements `_getWorkspaceRoot()` → reads `vscode.workspace.workspaceFolders`
   - Implements `_detectPrismDir()` → calls `vscode.commands.executeCommand('setContext', ...)`
   - Wraps Node.js EventEmitter events into `vscode.EventEmitter` for tree/status providers:
     ```typescript
     constructor(context: vscode.ExtensionContext) {
       super();
       // Wrap Node.js events → vscode.EventEmitter
       this.on('fileChange', (data) => this._onDidChangeFile.fire(data));
       this.on('stateChange', () => this._onDidChangeState.fire());
       this.on('sessionStart', (data) => this._onDidStartSession.fire(data));
       // ...
     }
     ```

4. Refactor `ElectronPrismController` to extend `BasePrismController`:
   - Constructor takes no args, calls `super()`
   - Implements `_getWorkspaceRoot()` → returns `this._projectDir`
   - Implements `_detectPrismDir()` → no-op (no context keys needed)
   - Now gains AgentBridge + all 5 event types for free

### Verification
#### Automated
- [x] `cd packages/prism-core && npm run typecheck` passes
- [x] `cd cmd/prism-vscode && npm run compile` succeeds
- [x] `cd cmd/prism-electron && npm run make` succeeds

#### Manual
- [ ] VSCode: tree views still refresh on file changes
- [ ] VSCode: status bar still updates on state changes
- [ ] Both: chat sessions work, Spectrum runs stories

---

## Phase 5: Upgrade ElectronPrismController

**Goal**: With `BasePrismController` providing the 5 events and AgentBridge integration, verify ElectronPrismController now has full event support. Add any Electron-specific wiring needed for future office integration.

### Files to Modify
- `cmd/prism-electron/src/hosts/electron/ElectronPrismController.ts` — verify events work, add `setProjectDir` override
- `cmd/prism-electron/src/hosts/electron/ElectronIPCBridge.ts` — subscribe to new events, forward to renderer

### Steps

1. Verify `ElectronPrismController` now emits all 5 events via `BasePrismController`:
   - `'fileChange'` when `.prism/` files change
   - `'stateChange'` on every `updateState()`
   - `'sessionStart'` on chat/skill/spectrum sessions
   - `'storyUpdate'` on spectrum story started
   - `'spectrumStoryEnd'` on spectrum story complete/blocked/error

2. In `ElectronIPCBridge`, subscribe to controller events and forward to renderer:
   ```typescript
   controller.on('stateChange', () => {
     win.webContents.send('prism:stateChange', controller.state);
   });
   controller.on('sessionStart', (data) => {
     win.webContents.send('prism:sessionStart', data);
   });
   controller.on('spectrumStoryEnd', (data) => {
     win.webContents.send('prism:spectrumStoryEnd', data);
   });
   ```

3. Add `controller.agentBridge` access from `ElectronIPCBridge` (needed in Phase 12 for office)

4. Clean up `ElectronPrismController.dispose()` — remove manual `_chatRunner` cleanup if `BasePrismController.dispose()` handles it

### Verification
#### Automated
- [x] `cd cmd/prism-electron && npm run make` succeeds

#### Manual
- [ ] Electron: start a Spectrum run, verify `sessionStart` and `spectrumStoryEnd` events fire (add console.log temporarily)
- [ ] Electron: chat session creates a sessionId visible in logs

---

## Phase 6: Create `packages/prism-ui`

**Goal**: Create the shared UI package with the CSS variable bridge layer that eliminates the 13-file divergence.

### Files to Create
- `packages/prism-ui/package.json`
- `packages/prism-ui/tsconfig.json`
- `packages/prism-ui/src/styles/bridge.css` — CSS variable bridge mapping `--prism-*` tokens
- `packages/prism-ui/src/styles/tokens.ts` — exported token reference constants (if needed)
- `packages/prism-ui/src/transport/types.ts` — `WebviewTransport` interface

### Steps

1. Create `packages/prism-ui/package.json`:
   ```json
   {
     "name": "@prism/ui",
     "version": "0.1.0",
     "private": true,
     "main": "src/index.ts",
     "types": "src/index.ts",
     "scripts": {
       "typecheck": "tsc --noEmit"
     },
     "peerDependencies": {
       "react": "^18.0.0 || ^19.0.0",
       "react-dom": "^18.0.0 || ^19.0.0"
     },
     "dependencies": {
       "react-markdown": "^9.0.1",
       "react-virtuoso": "^4.12.3",
       "rehype-highlight": "^7.0.1",
       "remark-gfm": "^4.0.1",
       "highlight.js": "^11.10.0",
       "class-variance-authority": "^0.7.1",
       "clsx": "^2.1.1",
       "lucide-react": "^0.511.0",
       "tailwind-merge": "^2.3.0",
       "uuid": "^11.0.5"
     },
     "devDependencies": {
       "typescript": "^5.4.5",
       "@types/react": "^18.3.3",
       "@types/react-dom": "^18.3.0",
       "@types/uuid": "^10.0.0"
     }
   }
   ```

2. Create `packages/prism-ui/tsconfig.json`:
   ```json
   {
     "compilerOptions": {
       "target": "ES2020",
       "module": "ESNext",
       "moduleResolution": "Bundler",
       "jsx": "react-jsx",
       "strict": true,
       "noEmit": true,
       "skipLibCheck": true,
       "allowImportingTsExtensions": true,
       "resolveJsonModule": true,
       "isolatedModules": true,
       "paths": {
         "@prism-core/*": ["../prism-core/src/*"]
       }
     },
     "include": ["src"]
   }
   ```

3. Create `packages/prism-ui/src/styles/bridge.css` with full variable mapping:
   - Map every `--vscode-*` variable used across the 13 CSS-var files to `--prism-*` equivalents
   - Provide two rulesets: `[data-platform="vscode"]` (maps to `var(--vscode-*)`) and `[data-platform="electron"]` (hardcoded hex values from Electron's `theme.css`)

4. Create `packages/prism-ui/src/transport/types.ts`:
   ```typescript
   export interface WebviewTransport {
     postMessage(msg: unknown): void;
     getState<T>(): T | undefined;
     setState<T>(state: T): void;
   }
   ```

### Verification
#### Automated
- [x] `cd packages/prism-ui && npm run typecheck` passes
- [x] CSS bridge file contains all variable mappings

---

## Phase 7: Move Shared Webview Components

**Goal**: Move the 5 identical + 13 CSS-var-only webview-ui files into `packages/prism-ui`. Refactor CSS variables to use `--prism-*` tokens.

### Files to Move to `packages/prism-ui/src/`
- `context/PrismStateContext.tsx` (identical)
- `services/grpc-client-base.ts` (refactor to use `WebviewTransport` interface)
- `components/views/ChatView.tsx` (identical)
- `components/views/WelcomeView.tsx` (merge minor diffs)
- `components/spectrum/SpectrumPanel.tsx` (identical)
- `components/chat/ChatInput.tsx` (refactor CSS vars → `--prism-*`)
- `components/chat/ChatMessage.tsx` (refactor CSS vars)
- `components/chat/ChatScrollButton.tsx` (refactor CSS vars)
- `components/chat/FloatingSpectrumPill.tsx` (refactor CSS vars)
- `components/spectrum/PhaseProgress.tsx` (refactor CSS vars)
- `components/spectrum/SpectrumStatus.tsx` (refactor CSS vars)
- `components/spectrum/StoryCard.tsx` (refactor CSS vars)
- `components/spectrum/StoryItem.tsx` (refactor CSS vars)
- `components/spectrum/StoryList.tsx` (refactor CSS vars)
- `components/views/ResearchView.tsx` (refactor CSS vars)
- `components/views/PlansView.tsx` (refactor CSS vars)
- `hooks/useGrpcClient.ts` (refactor)
- `hooks/useMessages.ts` (refactor)

### Steps

1. For each of the 13 CSS-var files: replace all `--vscode-*` references with `--prism-*` equivalents
2. Refactor `grpc-client-base.ts` to accept a `WebviewTransport` via context or module-level setter:
   ```typescript
   let transport: WebviewTransport;
   export function setTransport(t: WebviewTransport) { transport = t; }
   ```
3. Move all 18 files to `packages/prism-ui/src/`
4. Delete originals from both `cmd/prism-vscode/webview-ui/src/` and `cmd/prism-electron/webview-ui/src/`
5. Update `WelcomeView.tsx` to accept platform-specific content via props or conditional rendering

### Verification
#### Automated
- [x] `cd packages/prism-ui && npm run typecheck` passes
- [x] No `--vscode-` or `--prism-editor-` CSS variables remain in moved files (only `--prism-*`)

**Checkpoint**: [x] Phase 7 complete

### Phase 7 Session Notes — 2026-03-01
- **Adaptation**: Plan file names didn't match actual codebase. Mapped to actual files:
  - `ChatInput.tsx` → `ChatTextArea.tsx`, `ChatMessage.tsx` → `ChatRow.tsx`, `SpectrumPanel.tsx` → `SpectrumView.tsx` + spectrum sub-components
  - `ResearchView.tsx`, `PlansView.tsx`, `hooks/useGrpcClient.ts`, `hooks/useMessages.ts` do not exist — skipped
- **Files created** in `packages/prism-ui/src/`:
  - `services/grpc-client-base.ts` (WebviewTransport pattern), `services/grpc-client.ts`
  - `context/PrismStateContext.tsx`
  - `views/ChatView.tsx`, `views/SpectrumView.tsx`
  - `components/WelcomeView.tsx` (merged with optional `onOpenProject` prop)
  - `components/common/MarkdownBlock.tsx` (merged with optional `onLinkClick` prop)
  - `components/chat/ChatRow.tsx`, `ChatTextArea.tsx`, `ToolRow.tsx`
  - `components/workflow/PhaseIndicator.tsx`
  - `components/spectrum/SpectrumControls.tsx`, `ProgressBar.tsx`, `StoryList.tsx`, `ActivityLog.tsx`, `SignalStatus.tsx`
- **Deletion deferred**: Original files remain in both platform webview-ui dirs to keep builds working; deletion happens in Phase 8 after imports are wired

---

## Phase 8: Wire Platform Shells to `@prism-ui/*`

**Goal**: Update both platform webview-ui packages to import shared components from `packages/prism-ui`. Add `data-platform` attribute for CSS bridge.

### Files to Modify
- `cmd/prism-vscode/webview-ui/tsconfig.json` — add `@prism-ui/*` path alias
- `cmd/prism-vscode/webview-ui/vite.config.ts` — add `@prism-ui` resolve alias
- `cmd/prism-vscode/webview-ui/src/App.tsx` — import from `@prism-ui/*`, set `data-platform="vscode"`
- `cmd/prism-vscode/webview-ui/src/vscode.ts` — register as transport adapter
- `cmd/prism-electron/webview-ui/tsconfig.json` — add `@prism-ui/*` path alias
- `cmd/prism-electron/webview-ui/vite.config.ts` — add `@prism-ui` resolve alias (or use vite.renderer.config.mts)
- `cmd/prism-electron/vite.renderer.config.mts` — add `@prism-ui` alias
- `cmd/prism-electron/webview-ui/src/App.tsx` — import from `@prism-ui/*`, set `data-platform="electron"`
- `cmd/prism-electron/webview-ui/src/electron.ts` — register as transport adapter
- Both `webview-ui/src/index.html` or root `<div>` — add `data-platform` attribute
- Both `webview-ui/src/main.tsx` — import `@prism-ui/styles/bridge.css`

### Steps

1. Add path aliases to both webview-ui tsconfigs:
   ```json
   "@prism-ui/*": ["../../../packages/prism-ui/src/*"]
   ```

2. Add Vite resolve aliases:
   ```typescript
   resolve: {
     alias: {
       '@prism-ui': path.resolve(__dirname, '../../../packages/prism-ui/src'),
     }
   }
   ```

3. In each platform's `main.tsx`, import the bridge CSS and set transport:
   ```typescript
   import '@prism-ui/styles/bridge.css';
   import { setTransport } from '@prism-ui/services/grpc-client-base';
   import { vscodeApi } from './vscode'; // or electronApi
   setTransport(vscodeApi);
   ```

4. Add `data-platform="vscode"` or `data-platform="electron"` to the root element

5. Update all imports in `App.tsx` and remaining platform-specific files to reference `@prism-ui/*` for shared components

6. Verify that platform-specific files (`App.tsx`, `theme.css`, transport adapters, layout components) remain in their respective `cmd/*/webview-ui/src/` directories

### Verification
#### Automated
- [x] `cd cmd/prism-vscode/webview-ui && npm run build` succeeds
- [x] `cd cmd/prism-electron && npm run make` succeeds
- [x] No duplicate component files exist in both webview-ui directories

#### Manual
- [ ] VSCode: all views render with correct colors (CSS bridge maps --prism-* → --vscode-*)
- [ ] Electron: all views render with correct colors (CSS bridge uses hardcoded hex)
- [ ] Both: chat, Spectrum panel, research/plans views all work

**Checkpoint**: [x] Phase 8 complete

### Phase 8 Session Notes — 2026-03-01
- Added `@prism-ui/*` alias to both webview-ui tsconfigs and vite configs
- Added `@prism-ui` alias to `cmd/prism-electron/vite.renderer.config.mts` (Forge renderer config)
- Added `data-platform="vscode"` / `data-platform="electron"` to both index.html #root elements
- Updated both `main.tsx` files to import bridge.css + call `setTransport()` before render
- Updated VSCode `App.tsx`: all shared imports → `@prism-ui/*`, outerStyle CSS vars → `--prism-*`
- Updated Electron `App.tsx`: WelcomeView + context → `@prism-ui/*`
- Updated both `Providers.tsx`: `PrismStateContextProvider` → `@prism-ui/context/PrismStateContext`
- Updated electron-specific files: AppShell, HeaderBar, BottomStatusBar, SpectrumPanel, MonitorPanel, WorkspacePanel, StoriesPanel, StoryDetailView — all shared imports → `@prism-ui/*`
- Deleted 16 duplicate files from each webview-ui/src directory (32 total deletions)
- Both builds succeeded: VSCode (529 modules) and Electron (549 modules + Forge make)

---

## Phase 9: Move Canvas Office to `packages/prism-ui`

**Goal**: Move the entire canvas-based office game engine from `cmd/prism-vscode/webview-office/src/office/` into `packages/prism-ui/src/office/`. This is the renderer + sprites + engine + editor — all of which have zero VSCode imports.

### Files to Move to `packages/prism-ui/src/office/`

From `cmd/prism-vscode/webview-office/src/office/`:
- `types.ts`, `colorize.ts`, `floorTiles.ts`, `wallTiles.ts`, `toolUtils.ts`
- `components/OfficeCanvas.tsx`, `components/ToolOverlay.tsx`, `components/index.ts`
- `engine/gameLoop.ts`, `engine/characters.ts`, `engine/renderer.ts`, `engine/officeState.ts`, `engine/matrixEffect.ts`, `engine/index.ts`
- `sprites/spriteData.ts`, `sprites/spriteCache.ts`, `sprites/index.ts`
- `layout/furnitureCatalog.ts`, `layout/layoutSerializer.ts`, `layout/tileMap.ts`, `layout/index.ts`
- `editor/editorState.ts`, `editor/editorActions.ts`, `editor/EditorToolbar.tsx`, `editor/index.ts`

From `cmd/prism-vscode/webview-office/src/`:
- `office-constants.ts` → `packages/prism-ui/src/office/office-constants.ts`
- `OfficeApp.tsx` → `packages/prism-ui/src/office/OfficeApp.tsx`
- `fonts/FSPixelSansUnicode-Regular.ttf` → `packages/prism-ui/src/office/fonts/`

From `cmd/prism-vscode/webview-office/src/hooks/`:
- `useExtensionMessages.ts` → `packages/prism-ui/src/office/hooks/useExtensionMessages.ts`
- `useEditorActions.ts` → `packages/prism-ui/src/office/hooks/useEditorActions.ts`
- `useEditorKeyboard.ts` → `packages/prism-ui/src/office/hooks/useEditorKeyboard.ts`

From `cmd/prism-vscode/webview-office/src/components/`:
- `AgentLabels.tsx`, `StoryLabels.tsx`, `BottomToolbar.tsx`, `SettingsModal.tsx`, `ZoomControls.tsx`, `DebugView.tsx`
→ `packages/prism-ui/src/office/components/ui/`

### Files to Create
- `packages/prism-ui/src/office/transport.ts` — abstract transport interface replacing `vscodeApi.ts`:
  ```typescript
  export interface OfficeTransport {
    postMessage(msg: unknown): void;
    onMessage(handler: (msg: unknown) => void): () => void; // returns unsubscribe fn
  }
  let _transport: OfficeTransport;
  export function setOfficeTransport(t: OfficeTransport) { _transport = t; }
  export function getOfficeTransport(): OfficeTransport { return _transport; }
  ```

### Files to Modify
- `useExtensionMessages.ts` — replace `vscodeApi.postMessage(...)` with `getOfficeTransport().postMessage(...)`
- `useExtensionMessages.ts` — replace `window.addEventListener('message', ...)` with `getOfficeTransport().onMessage(...)`
- `useEditorActions.ts` — same transport replacement for `saveLayout` and `openClaude` messages
- `OfficeApp.tsx` — remove `vscodeApi` import, use transport
- `cmd/prism-vscode/webview-office/src/main.tsx` — set office transport from `vscodeApi`
- `cmd/prism-vscode/webview-panel/src/views/OfficeApp.tsx` — import office from `@prism-ui/office/`
- `cmd/prism-vscode/webview-panel/src/office/` — delete duplicated office code, import from `@prism-ui`

### Steps

1. Create the `OfficeTransport` interface in `packages/prism-ui/src/office/transport.ts`
2. Move all office files preserving directory structure
3. Refactor `useExtensionMessages.ts` and `useEditorActions.ts` to use `getOfficeTransport()`
4. In `cmd/prism-vscode/webview-office/src/main.tsx`, add:
   ```typescript
   import { setOfficeTransport } from '@prism-ui/office/transport';
   import { vscodeApi } from './vscodeApi';
   setOfficeTransport({
     postMessage: (msg) => vscodeApi.postMessage(msg),
     onMessage: (handler) => {
       const listener = (e: MessageEvent) => handler(e.data);
       window.addEventListener('message', listener);
       return () => window.removeEventListener('message', listener);
     }
   });
   ```
5. Update `cmd/prism-vscode/webview-panel/` to import from `@prism-ui/office/` instead of its local copy
6. Add `@prism-ui/*` path alias to `webview-office/tsconfig.app.json` and `webview-panel/tsconfig.app.json`
7. Add Vite alias for `@prism-ui` in `webview-office/vite.config.ts` and `webview-panel/vite.config.ts`

### Verification
#### Automated
- [x] `cd packages/prism-ui && npm run typecheck` passes
- [x] `cd cmd/prism-vscode/webview-office && npm run build` succeeds
- [x] `cd cmd/prism-vscode/webview-panel && npm run build` succeeds

#### Manual
- [ ] VSCode: office renders in sidebar with sprites, agents walk, furniture editor works
- [ ] VSCode: office renders in bottom panel identically

**Checkpoint**: [x] Phase 9 complete

---

## Phase 10: Create Shared Office Host Module

**Goal**: Extract the office host-side files (transcript parser, timer manager, asset loader, layout persistence, types) into `packages/prism-core/src/office/` with a generic `PostMessageFn` interface replacing `vscode.Webview`.

### Files to Create/Move to `packages/prism-core/src/office/`
- `types.ts` — refactor `AgentState.terminalRef: vscode.Terminal` → `terminalRef: unknown | null` (generic handle)
- `timerManager.ts` — replace `vscode.Webview | undefined` params with `PostMessageFn | undefined`
- `transcriptParser.ts` — replace `vscode.Webview | undefined` params with `PostMessageFn | undefined`
- `assetLoader.ts` — split into `assetLoader.ts` (pure loading, no vscode) and move `sendTo*` functions to accept `PostMessageFn`
- `layoutPersistence.ts` — remove `ExtensionContext` parameter from `migrateAndLoadLayout`, make it pure file-based

### Files to Modify
- `cmd/prism-vscode/src/hosts/vscode/OfficeViewProvider.ts` — wrap `vscode.Webview.postMessage` as `PostMessageFn`
- `cmd/prism-vscode/src/hosts/vscode/PrismPanelProvider.ts` — same wrapping

### Steps

1. Define `PostMessageFn` type in `packages/prism-core/src/office/types.ts`:
   ```typescript
   export type PostMessageFn = (msg: unknown) => void;
   ```

2. Replace all `webview: vscode.Webview | undefined` parameters with `postMessage: PostMessageFn | undefined`

3. Replace all `webview?.postMessage(msg)` calls with `postMessage?.(msg)`

4. In `assetLoader.ts`, the 4 `sendTo*Webview` functions become:
   ```typescript
   export function sendWallTiles(postMessage: PostMessageFn, wallTiles: SpriteData[]): void {
     postMessage({ type: 'wallTilesLoaded', sprites: wallTiles });
   }
   ```

5. In `layoutPersistence.ts`, remove the `migrateAndLoadLayout(context)` variant — make it `loadLayout(defaultLayout?)` using only file I/O. VSCode-specific migration stays in `OfficeViewProvider.ts`.

6. In `types.ts`, replace `vscode.Terminal` with a generic handle:
   ```typescript
   export interface AgentState {
     id: number;
     terminalRef: unknown | null;  // platform-specific handle
     // ... rest unchanged
   }
   ```

7. Update VSCode providers to create wrapper functions:
   ```typescript
   const postMessage: PostMessageFn = (msg) => this._webview?.postMessage(msg);
   ```

### Verification
#### Automated
- [x] `cd packages/prism-core && npm run typecheck` passes
- [x] `cd cmd/prism-vscode && npm run compile` succeeds
- [x] Zero `import * as vscode` in `packages/prism-core/`

#### Manual
- [ ] VSCode: office agents still track correctly, tools display, permissions show

**Checkpoint**: [x] Phase 10 complete

---

## Phase 11: Create ElectronAgentManager

**Goal**: Build the Electron equivalent of `agentManager.ts` — spawning Claude CLI processes, watching JSONL transcripts, and forwarding activity to the renderer.

### Files to Create
- `cmd/prism-electron/src/office/ElectronAgentManager.ts`

### Steps

1. Create `ElectronAgentManager` class that:
   - Spawns Claude CLI using `child_process.spawn('claude', ['--session-id', uuid], { cwd })`:
     ```typescript
     import { spawn, ChildProcess } from 'child_process';
     ```
   - Tracks agents in `Map<number, AgentState>` (using types from `@prism-core/office/types`)
   - Watches JSONL files using `chokidar.watch()` or `fs.watch()` + polling (same dual strategy as VSCode's `fileWatcher.ts`)
   - Processes transcript lines using `processTranscriptLine()` from `@prism-core/office/transcriptParser`
   - Manages timers using functions from `@prism-core/office/timerManager`
   - Sends messages to renderer via `win.webContents.send('office:message', msg)`

2. Implement `launchAgent(cwd: string)`:
   - Generate session UUID
   - Spawn `claude --session-id <uuid>` process
   - Create `AgentState` with PID as terminal ref
   - Start JSONL file polling for `~/.claude/projects/<dir>/<uuid>.jsonl`
   - Return agent ID

3. Implement `removeAgent(agentId: number)`:
   - Kill child process if still running
   - Stop file watcher and timers
   - Delete from agents map

4. Implement `createHeadlessAgent(sessionId: string)`:
   - For Spectrum: no process spawning, just JSONL watching
   - The CLI is spawned by `SpectrumRunner` — agent manager only watches

5. Implement `dispose()`:
   - Kill all child processes
   - Stop all watchers and timers

### Verification
#### Automated
- [x] `cd cmd/prism-electron && npm run make` succeeds
- [x] TypeScript compiles without errors

#### Manual
- [ ] Electron: can spawn a Claude CLI process (temporarily test with a button)
- [ ] Electron: JSONL file is detected and first lines parsed

**Checkpoint**: [x] Phase 11 complete

### Phase 11 Session Notes — 2026-03-01
- Created `cmd/prism-electron/src/office/ElectronAgentManager.ts` as a class (holds BrowserWindow reference)
- `PostMessageFn` wraps `win.webContents.send('office:message', msg)`
- Uses `child_process.spawn('claude', ['--session-id', sessionId], { cwd, stdio: 'ignore' })` instead of VSCode terminals
- Dual JSONL watching: `fs.watch` (primary) + polling every 2s (backup), identical to VSCode's fileWatcher.ts
- All transcript parsing via `processTranscriptLine` from `@prism-core/office/transcriptParser`
- `createHeadlessAgent(sessionId, projectDir)` for Spectrum — no process spawning, watches JSONL only
- `getProjectDirPath(cwd)` uses same encoding as VSCode: `cwd.replace(/[:\\/]/g, '-')`
- TypeScript passes cleanly; `npm run make` succeeds

---

## Phase 12: Create ElectronOfficeProvider

**Goal**: Build the main-process office orchestrator for Electron — asset loading, agent lifecycle management, message dispatch to renderer.

### Files to Create
- `cmd/prism-electron/src/office/ElectronOfficeProvider.ts`

### Files to Modify
- `cmd/prism-electron/src/hosts/electron/ElectronIPCBridge.ts` — register office IPC handlers
- `cmd/prism-electron/src/preload.ts` — expose office IPC channels

### Steps

1. Create `ElectronOfficeProvider` that:
   - Holds reference to `BrowserWindow` for `webContents.send()`
   - Creates `ElectronAgentManager` instance
   - Subscribes to `ElectronPrismController` events:
     - `'sessionStart'` → create headless agent for Spectrum sessions
     - `'spectrumStoryEnd'` → remove Spectrum agents
     - `'storyUpdate'` → forward story context to renderer
   - Loads assets from bundled `assets/` directory:
     - Characters: `loadCharacterSprites(assetsRoot)` from `@prism-core/office/assetLoader`
     - Floors: `loadFloorTiles(assetsRoot)` from same
     - Walls: `loadWallTiles(assetsRoot)` from same
     - Furniture: `loadFurnitureAssets(assetsRoot)` from same
   - Sends assets to renderer via `win.webContents.send('office:message', { type: 'characterSpritesLoaded', ... })`
   - Handles renderer messages via `ipcMain.on('office:action', handler)`

2. Register IPC handlers in `ElectronIPCBridge`:
   ```typescript
   ipcMain.on('office:action', (event, msg) => {
     officeProvider.handleRendererMessage(msg);
   });
   ```

3. Update `preload.ts` to expose office channels:
   ```typescript
   officeMessage: (callback: (msg: unknown) => void) => {
     ipcRenderer.on('office:message', (_, msg) => callback(msg));
   },
   officeAction: (msg: unknown) => {
     ipcRenderer.send('office:action', msg);
   }
   ```

4. Handle renderer messages:
   - `'webviewReady'` → load assets, send layout, send existing agents
   - `'openClaude'` → call `agentManager.launchAgent()`
   - `'focusAgent'` → no-op in Electron (no terminal to focus) or bring window to front
   - `'closeAgent'` → call `agentManager.removeAgent()`
   - `'saveAgentSeats'` → persist to `~/.prism/office-agent-seats.json`
   - `'saveLayout'` → call `writeLayoutToFile()` from `@prism-core/office/layoutPersistence`

5. Bundle office assets:
   - Copy `cmd/prism-vscode/assets/` directory (characters, floors, walls, furniture) into Electron's build output
   - Update `forge.config.ts` to include assets in asar

### Verification
#### Automated
- [x] `cd cmd/prism-electron && npm run make` succeeds

#### Manual
- [ ] Electron: assets load on startup (console.log confirms sprite data)
- [ ] Electron: IPC channels respond to office:action messages

**Checkpoint**: [x] Phase 12 complete

### Phase 12 Session Notes — 2026-03-01
- Created `cmd/prism-electron/src/office/ElectronOfficeProvider.ts`:
  - Holds `BrowserWindow`, `ElectronPrismController`, and `ElectronAgentManager` references
  - `PostMessageFn` wraps `win.webContents.send('office:message', msg)`
  - Subscribes to controller events: `sessionStart` → creates headless agent for Spectrum; `spectrumStoryEnd` → removes agent by sessionId; `storyUpdate` → forwards story context to all active Spectrum agents
  - `_spectrumAgents: Map<string, number>` tracks sessionId → agentId for clean lifecycle management
  - On `webviewReady`: loads all assets in parallel (characters, floors, walls, furniture), loads layout (file or default), sends existing agents
  - `_getAssetsRoot()`: dev = `app.getAppPath()/../prism-vscode`; packaged = `process.resourcesPath`
  - Saves agent seats to `~/.prism/office-agent-seats.json`
  - Watches `~/.prism/office-layout.json` for external changes
  - `_officeActionHandler` stored as bound reference for precise removal in `dispose()`
- Updated `ElectronIPCBridge.ts`: imports and instantiates `ElectronOfficeProvider` after controller creation; calls `_officeProvider.dispose()` in `dispose()`
- Updated `preload.ts`: added `officeMessage(callback) → unsubscribe` and `officeAction(msg)` to contextBridge; updated Window TypeScript declaration
- Updated `forge.config.ts`: added `extraResource: ['../prism-vscode/assets']` so assets are bundled into `resources/assets/` in packaged builds
- `npm run make` passes cleanly (Squirrel distributable for win32/x64)

---

## Phase 13: Integrate Canvas Office into Electron Renderer

**Goal**: Replace the CSS `PixelOffice.tsx` with the full canvas office from `packages/prism-ui`. Wire the Electron-specific transport adapter.

### Files to Create
- `cmd/prism-electron/webview-ui/src/office/electronOfficeTransport.ts`

### Files to Modify
- `cmd/prism-electron/webview-ui/src/components/layout/BottomPanel.tsx` — replace `<PixelOffice />` with `<OfficeApp />`
- `cmd/prism-electron/webview-ui/src/App.tsx` or `main.tsx` — initialize office transport

### Files to Delete
- `cmd/prism-electron/webview-ui/src/components/office/PixelOffice.tsx`

### Steps

1. Create `electronOfficeTransport.ts`:
   ```typescript
   import { OfficeTransport } from '@prism-ui/office/transport';

   export const electronOfficeTransport: OfficeTransport = {
     postMessage: (msg) => {
       window.electronAPI.officeAction(msg);
     },
     onMessage: (handler) => {
       const cleanup = window.electronAPI.officeMessage((msg: unknown) => handler(msg));
       return cleanup; // or return () => { /* cleanup */ }
     }
   };
   ```

2. In `main.tsx` or `App.tsx`, initialize:
   ```typescript
   import { setOfficeTransport } from '@prism-ui/office/transport';
   import { electronOfficeTransport } from './office/electronOfficeTransport';
   setOfficeTransport(electronOfficeTransport);
   ```

3. Update `BottomPanel.tsx` to render the canvas office:
   ```typescript
   import { OfficeApp } from '@prism-ui/office/OfficeApp';
   // Replace <PixelOffice /> with <OfficeApp />
   ```

4. Delete `PixelOffice.tsx` (331-line CSS mockup)

5. Add `@prism-ui` path aliases to Electron webview-ui tsconfig and vite config

6. Ensure `pngjs` is available as a dependency in `cmd/prism-electron/` (needed for asset loading in main process)

### Verification
#### Automated
- [x] `cd cmd/prism-electron && npm run make` succeeds
- [x] `PixelOffice.tsx` no longer exists

#### Manual
- [ ] Electron: bottom panel "Office" tab shows the canvas office with tiles, furniture, walls
- [ ] Electron: furniture editor opens and allows painting/placing
- [ ] Electron: zoom controls work
- [ ] Electron: pan via middle mouse / scroll works

**Checkpoint**: [x] Phase 13 complete

### Phase 13 Session Notes — 2026-03-01
- Created `cmd/prism-electron/webview-ui/src/office/electronOfficeTransport.ts`:
  - Implements `OfficeTransport` interface from `@prism-ui/office/transport`
  - `postMessage(msg)` → `window.electronAPI.officeAction(msg)` (fire-and-forget to main process)
  - `onMessage(handler)` → `window.electronAPI.officeMessage(handler)` (returns unsubscribe fn)
  - Dev fallback with console.log when running outside Electron
- Updated `electron.ts`: added `officeMessage` and `officeAction` to Window.electronAPI type declaration
- Updated `main.tsx`: imports `setOfficeTransport` + `electronOfficeTransport`; calls `setOfficeTransport(electronOfficeTransport)` before render alongside existing gRPC transport setup
- Updated `BottomPanel.tsx`: replaced `import { PixelOffice } from "../office/PixelOffice"` → `import { OfficeApp } from "@prism-ui/office/OfficeApp"`; replaced `<PixelOffice />` → `<OfficeApp />`
- Deleted `cmd/prism-electron/webview-ui/src/components/office/PixelOffice.tsx` (331-line CSS mockup)
- `@prism-ui` alias already present from Phase 8 in both tsconfig.json and vite.config.ts
- `pngjs` already available via npm workspaces hoisting from packages/prism-core
- `npm run make` passes cleanly (Squirrel distributable for win32/x64)

---

## Phase 14: Wire Spectrum → Office Pipeline

**Goal**: Connect `ElectronPrismController` events to `ElectronOfficeProvider` so that real agent characters appear in the office during Spectrum runs and chat sessions.

### Files to Modify
- `cmd/prism-electron/src/office/ElectronOfficeProvider.ts` — subscribe to controller events
- `cmd/prism-electron/src/hosts/electron/ElectronIPCBridge.ts` — wire provider to controller

### Steps

1. When `ElectronPrismController` fires `'sessionStart'`:
   - If `isSpectrum`: create headless agent with `storyId`/`storyTitle` context
   - If chat/skill: create agent (optionally with process if `openClaude` triggered)
   - Send `agentCreated` message to renderer
   - Start JSONL file watching for the session

2. When JSONL watcher detects tool activity:
   - Call `processTranscriptLine()` with the `PostMessageFn` that sends to renderer
   - Agent character in office will start typing, show tool names, etc.

3. When `ElectronPrismController` fires `'spectrumStoryEnd'`:
   - Remove the Spectrum agent from office
   - Send `agentClosed` message to renderer
   - Character does despawn matrix effect

4. When `ElectronPrismController` fires `'storyUpdate'`:
   - Forward story context to renderer via `agentStoryContext` message
   - Story labels appear above the agent character

5. Wire up the `openClaude` renderer message:
   - Call `ElectronAgentManager.launchAgent(projectDir)`
   - This spawns a real `claude` CLI process
   - Agent appears in office, starts tracking JSONL

### Verification
#### Automated
- [x] `cd cmd/prism-electron && npm run make` succeeds

#### Manual
- [ ] Electron: start Spectrum → agent character appears in office, walks to desk
- [ ] Electron: agent shows tool names as Spectrum runs (typing animation)
- [ ] Electron: when story completes, agent does matrix despawn effect
- [ ] Electron: click "Launch Claude" → new agent appears in office
- [ ] Electron: agent tracks real tool activity from Claude CLI

**Checkpoint**: [x] Phase 14 complete

### Phase 14 Session Notes — 2026-03-01
- Added `sessionEnd` typed event overloads to `BasePrismController` (`emit` + `on`)
- Added `sessionId?: string` parameter to `_runChatSession` — emits `sessionEnd` in the `finally` block
- In `sendMessage` skill path: chained `.finally(() => emit('sessionEnd', ...))` on `runPluginSkill` promise
- In `executeSkill` handler: same `.finally()` pattern
- Passed `chatSessionId` through to `_runChatSession` call
- **`ElectronOfficeProvider`**: added `_chatSkillAgents: Map<string, number>` field
- Extended `_onSessionStart` to handle non-Spectrum sessions: creates headless agent, stores in `_chatSkillAgents`
  - JSONL poll starts immediately; graceful no-op for SDK chat (file never appears); works for CLI skill sessions
- Added `_onSessionEnd(sessionId)` — looks up agent in `_chatSkillAgents`, removes it, sends `agentClosed` to renderer
- Added `controller.on('sessionEnd', ...)` subscription in constructor
- Updated `dispose()` to clear `_chatSkillAgents`
- `prism-core typecheck` and `npm run make` both pass cleanly (Squirrel distributable for win32/x64)

---

## Phase 15: Port Workspace Discovery

**Goal**: Implement real workspace discovery in Electron's `WorkspacePanel` — scan sibling directories for `.prism/` folders, read `~/.prism/workspaces.json`, show real project info with git branches and story counts.

### Files to Create
- `packages/prism-core/src/workspace/discovery.ts` — platform-agnostic workspace discovery logic
- `packages/prism-core/src/workspace/types.ts` — `ProjectInfo`, `WorktreeInfo`, `WorkspacesState` types

### Files to Modify
- `cmd/prism-electron/src/hosts/electron/ElectronIPCBridge.ts` — add workspace IPC handlers
- `cmd/prism-electron/webview-ui/src/components/panels/WorkspacePanel.tsx` — replace mock data with real data
- `cmd/prism-vscode/src/hosts/vscode/PrismPanelProvider.ts` — import shared types/logic

### Steps

1. Extract workspace discovery logic from `PrismPanelProvider.ts` lines 837-965 into `packages/prism-core/src/workspace/discovery.ts`:
   - `discoverProjects(workspaceRoot: string): Promise<ProjectInfo[]>` — sibling scan + workspaces.json
   - `buildProjectInfo(projectPath: string, currentWorkspace: string): Promise<ProjectInfo>` — git branch + stories
   - `parseStoriesJson(filePath: string): { total: number; complete: number } | null`
   - `addToGlobalWorkspaces(projectPath: string): Promise<void>`
   - All pure Node.js (fs, child_process for git commands)

2. Extract types from `PrismPanelProvider.ts` lines 73-107 into `packages/prism-core/src/workspace/types.ts`

3. Add IPC handlers in `ElectronIPCBridge.ts`:
   ```typescript
   ipcMain.handle('prism:discoverProjects', async () => {
     return discoverProjects(controller._projectDir);
   });
   ipcMain.handle('prism:addWorkspace', async (_, path) => {
     await addToGlobalWorkspaces(path);
   });
   ```

4. Update `WorkspacePanel.tsx` to:
   - Call `window.electronAPI.invoke('prism:discoverProjects')` on mount
   - Display real `ProjectInfo[]` with name, branch, story counts, epics
   - Add "Add Workspace" button calling `prism:addWorkspace`
   - Add "Open Project" button for each project

5. Set up file watcher for `~/.prism/workspaces.json` in main process to push updates

### Verification
#### Automated
- [x] `cd packages/prism-core && npm run typecheck` passes
- [x] `cd cmd/prism-electron && npm run make` succeeds

#### Manual
- [ ] Electron: workspace panel shows current project with real branch name
- [ ] Electron: sibling projects with `.prism/` appear in the list
- [ ] Electron: story counts are accurate
- [ ] Electron: "Add Workspace" adds a folder to the list

**Checkpoint**: [x] Phase 15 complete

### Phase 15 Session Notes — 2026-03-01
- Created `packages/prism-core/src/workspace/types.ts`: `EpicInfo`, `ProjectInfo`, `WorktreeInfo`, `WorkspacesState` interfaces extracted from `PrismPanelProvider.ts` lines 73-107
- Created `packages/prism-core/src/workspace/discovery.ts`: pure Node.js implementation of:
  - `parseStoriesJson(filePath)` — reads stories.json, counts total/complete
  - `parsePorcelainWorktrees(output)` — parses `git worktree list --porcelain` output
  - `buildProjectInfo(projectPath, currentResolved)` — git branch + stories + epics aggregation
  - `discoverProjects(workspaceRoot)` — sibling dir scan + global workspaces.json
  - `addToGlobalWorkspaces(projectPath)` — writes to `~/.prism/workspaces.json`
  - `listWorktrees(workspaceRoot)` — git worktree list via exec
- Updated `ElectronIPCBridge.ts`: added 4 IPC handlers using `@prism-core/workspace/discovery`:
  - `prism:discoverProjects` → returns `ProjectInfo[]`
  - `prism:addWorkspace` → adds path to global registry
  - `prism:browseAndAddWorkspace` → dialog + add to registry
  - `prism:listWorktrees` → returns `WorktreeInfo[]`
  - All handlers added to `dispose()` cleanup
- Rewrote `WorkspacePanel.tsx`: replaced mock data with live IPC calls:
  - Projects section: shows all discovered projects with branch, progress bar, epics, current badge
  - "Add Workspace" button: opens native dir dialog via `prism:browseAndAddWorkspace`
  - Worktrees section: shows real git worktrees with branch, HEAD hash, MAIN/PRUNABLE badges
  - Auto-refreshes when `prismDir` changes (new project opened) and on `prism:fileChange` events
  - Refresh buttons for both sections
- `prism-core typecheck` and `npm run make` both pass cleanly

---

## Phase 16: Port Quality Gate Execution

**Goal**: Make quality gates actually execute in Electron's MonitorPanel instead of just displaying them.

### Files to Create
- `packages/prism-core/src/workspace/qualityGates.ts` — shared gate execution logic

### Files to Modify
- `cmd/prism-electron/src/hosts/electron/ElectronIPCBridge.ts` — add gate execution IPC
- `cmd/prism-electron/webview-ui/src/components/panels/MonitorPanel.tsx` — add "Run" button, show real output

### Steps

1. Extract quality gate execution from `PrismPanelProvider.ts` lines 774-806 into `packages/prism-core/src/workspace/qualityGates.ts`:
   ```typescript
   export async function executeGate(command: string, cwd: string): Promise<{
     success: boolean;
     output: string;
     duration: number;
   }> {
     const start = Date.now();
     try {
       const { stdout, stderr } = await execAsync(command, { cwd, timeout: 60000 });
       return { success: true, output: stdout + stderr, duration: Date.now() - start };
     } catch (e) {
       return { success: false, output: e.message, duration: Date.now() - start };
     }
   }
   ```

2. Add IPC handler:
   ```typescript
   ipcMain.handle('prism:executeGate', async (_, command) => {
     return executeGate(command, controller._projectDir);
   });
   ```

3. Update `MonitorPanel.tsx`:
   - Add "Run" button next to each quality gate
   - Call `window.electronAPI.invoke('prism:executeGate', gateCommand)` on click
   - Show spinner during execution
   - Display output + pass/fail status + duration

### Verification
#### Automated
- [x] `cd cmd/prism-electron && npm run make` succeeds

#### Manual
- [ ] Electron: quality gate "Run" button appears
- [ ] Electron: running `npm test` or similar gate shows real output
- [ ] Electron: pass/fail status and duration display correctly

**Checkpoint**: [x] Phase 16 complete

### Phase 16 Session Notes — 2026-03-01
- Created `packages/prism-core/src/workspace/qualityGates.ts`:
  - `executeGate(command, cwd)` — runs via `child_process.exec` with 60s timeout; returns `{ success, output, duration }`
  - `gateLabel(command)` — derives human-readable name from command string
  - `truncateOutput()` — keeps last 50 lines (same as PrismPanelProvider logic)
- Updated `ElectronIPCBridge.ts`: added `prism:executeGate` handler importing from `@prism-core/workspace/qualityGates`; added to `dispose()` cleanup
- Rewrote `MonitorPanel.tsx`:
  - Per-gate local state: `idle | running | pass | fail` with output and duration
  - "Run" button per gate + "Run All" button
  - Braille spinner animation (10-frame, 80ms) while gate executes
  - ✓ (green) / ✗ (red) status indicators
  - Duration display in seconds
  - Expand/collapse output panel with ▼/▲ toggle
  - Auto-expands output on failure
  - Quality Gates section badge shows `passed/total` count
- `prism-core typecheck` and `npm run make` both pass cleanly

---

## Phase 17: Port Research & Plans Browsing

**Goal**: Replace the placeholder text in Electron's StoriesPanel with real research and plans file listings, parsed from `.prism/shared/research/` and `.prism/shared/plans/`.

### Files to Create
- `packages/prism-core/src/workspace/research.ts` — research file discovery + frontmatter parsing
- `packages/prism-core/src/workspace/plans.ts` — plans file discovery + frontmatter parsing

### Files to Modify
- `cmd/prism-electron/src/hosts/electron/ElectronIPCBridge.ts` — add research/plans IPC handlers
- `cmd/prism-electron/webview-ui/src/components/panels/StoriesPanel.tsx` — replace placeholders with real data
- `cmd/prism-vscode/src/providers/research-tree.ts` — optionally import shared parsing logic
- `cmd/prism-vscode/src/providers/plans-tree.ts` — optionally import shared parsing logic

### Steps

1. Extract frontmatter parsing from `research-tree.ts` lines 54-101 and `plans-tree.ts` lines 64-93 into shared modules:
   ```typescript
   // packages/prism-core/src/workspace/research.ts
   export interface ResearchItem {
     filename: string;
     date: string;
     topic: string;
     tags: string[];
     status: string;
     filePath: string;
   }
   export async function discoverResearch(prismDir: string): Promise<ResearchItem[]>
   ```

2. Add IPC handlers:
   ```typescript
   ipcMain.handle('prism:getResearch', async () => {
     const prismDir = path.join(controller._projectDir, '.prism');
     return discoverResearch(prismDir);
   });
   ipcMain.handle('prism:getPlans', async () => {
     const prismDir = path.join(controller._projectDir, '.prism');
     return discoverPlans(prismDir);
   });
   ```

3. Update `StoriesPanel.tsx`:
   - Call `window.electronAPI.invoke('prism:getResearch')` on mount
   - Display research items with date, topic, tags, status
   - Clicking opens the file in `FileContentView` via `layout.openTab()`
   - Same for plans section
   - Add story step expansion (show individual steps, not just count)

### Verification
#### Automated
- [x] `cd packages/prism-core && npm run typecheck` passes
- [x] `cd cmd/prism-electron && npm run make` succeeds

#### Manual
- [ ] Electron: research section shows real `.md` files from `.prism/shared/research/`
- [ ] Electron: plans section shows real `.md` files from `.prism/shared/plans/`
- [ ] Electron: clicking opens the file in center pane
- [ ] Electron: stories show expandable steps

**Checkpoint**: [x] Phase 17 complete

### Phase 17 Session Notes — 2026-03-01
- Created `packages/prism-core/src/workspace/research.ts`: pure Node.js `discoverResearch(prismDir)` — reads `.prism/shared/research/*.md`, parses frontmatter (date, topic, tags, status), derives topic from filename if missing, returns newest-first
- Created `packages/prism-core/src/workspace/plans.ts`: pure Node.js `discoverPlans(prismDir)` — reads `.prism/shared/plans/*.md`, parses frontmatter (date, feature, status, phases), returns newest-first
- Updated `ElectronIPCBridge.ts`: added `prism:getResearch` and `prism:getPlans` handlers importing from `@prism-core/workspace/research` and `@prism-core/workspace/plans`; both added to `dispose()` cleanup
- Rewrote `StoriesPanel.tsx`:
  - Added `useState` for `research: ResearchItem[]`, `plans: PlanItem[]`, and `expandedStories: Set<string>`
  - `loadResearchAndPlans()` calls both IPC handlers in parallel on mount
  - Subscribes to `prism:fileChange` events to refresh when `.prism/` changes
  - Stories section: stories with steps are now expandable (click toggles steps list) with ✓/○ per step and strikethrough for done steps
  - Research section: real items with topic, date, tag chips; clicking opens FileContentView tab via `layout.openTab({ id: "file:" + filePath, type: "file" })`
  - Plans section: real items with status icon (✓/◐/✔/○), colored by status, date, status label, phases count
- VSCode tree providers not modified (plan notes this as optional)
- `prism-core typecheck` and `npm run make` both pass cleanly

---

## Phase 18: Port Git Worktree Management

**Goal**: Implement real git worktree CRUD operations in Electron's WorkspacePanel.

### Files to Create
- `packages/prism-core/src/workspace/worktrees.ts` — shared worktree management logic

### Files to Modify
- `cmd/prism-electron/src/hosts/electron/ElectronIPCBridge.ts` — add worktree IPC handlers
- `cmd/prism-electron/webview-ui/src/components/panels/WorkspacePanel.tsx` — add worktree UI
- `cmd/prism-vscode/src/hosts/vscode/PrismPanelProvider.ts` — optionally use shared logic

### Steps

1. Extract worktree logic from `PrismPanelProvider.ts` into `packages/prism-core/src/workspace/worktrees.ts`:
   ```typescript
   export async function listWorktrees(workspaceRoot: string): Promise<WorktreeInfo[]>
   export async function createWorktree(workspaceRoot: string, branchName: string): Promise<void>
   export async function deleteWorktree(workspaceRoot: string, worktreePath: string, deleteBranch: boolean, branchName: string): Promise<void>
   export function parsePorcelainWorktrees(output: string): WorktreeInfo[]
   ```

2. Git commands (all executed via `child_process.exec`):
   - `git rev-parse --show-toplevel` — find repo root
   - `git worktree list --porcelain` — list worktrees
   - `git -C <root> rev-parse --verify <branch>` — check if branch exists
   - `git -C <root> worktree add <path> <branch>` — create for existing branch
   - `git -C <root> worktree add -b <branch> <path>` — create with new branch
   - `git -C <root> worktree remove <path>` — remove worktree
   - `git -C <root> branch -D <branch>` — delete branch (optional)

3. Worktree path convention: `<repoParent>/<repoName>-<safeBranch>` (slashes replaced with hyphens)

4. Add IPC handlers:
   ```typescript
   ipcMain.handle('prism:listWorktrees', async () => listWorktrees(controller._projectDir));
   ipcMain.handle('prism:createWorktree', async (_, branch) => createWorktree(controller._projectDir, branch));
   ipcMain.handle('prism:deleteWorktree', async (_, path, deleteBranch, branch) => deleteWorktree(controller._projectDir, path, deleteBranch, branch));
   ```

5. Update `WorkspacePanel.tsx`:
   - Add "Worktrees" section with real worktree list
   - Show: path, branch, HEAD (7 chars), isMain, prunable
   - "New Worktree" button → input for branch name → call `prism:createWorktree`
   - Delete button per worktree → confirmation → call `prism:deleteWorktree`
   - "Open" button → IPC to open worktree directory (or switch project)

### Verification
#### Automated
- [ ] `cd packages/prism-core && npm run typecheck` passes
- [ ] `cd cmd/prism-electron && npm run make` succeeds

#### Manual
- [ ] Electron: worktree list shows real git worktrees
- [ ] Electron: creating a worktree creates the directory and branch
- [ ] Electron: deleting a worktree removes it
- [ ] Electron: "Open" button opens worktree in new Electron window

---

## Phase 19: Port Secure API Key Storage

**Goal**: Implement secure API key storage in Electron using Electron's `safeStorage` API, with the same interface as VSCode's `SecretStorage`.

### Files to Create
- `packages/prism-core/src/core/api/auth.ts` — shared auth interface + validation logic
- `cmd/prism-electron/src/auth/ElectronSecretStorage.ts` — Electron safeStorage implementation

### Files to Modify
- `cmd/prism-vscode/src/core/api/auth.ts` — refactor to use shared interface
- `cmd/prism-electron/src/hosts/electron/ElectronIPCBridge.ts` — add auth IPC handlers
- `cmd/prism-electron/webview-ui/src/components/layout/HeaderBar.tsx` or settings — add API key input

### Steps

1. Create shared auth interface in `packages/prism-core/src/core/api/auth.ts`:
   ```typescript
   export interface SecretStore {
     get(key: string): Promise<string | undefined>;
     set(key: string, value: string): Promise<void>;
     delete(key: string): Promise<void>;
   }

   export const API_KEY_SECRET = 'prism.anthropicApiKey';

   export function isValidApiKey(key: string): boolean {
     return key.startsWith('sk-ant-') && key.length > 20;
   }

   export async function getApiKey(store: SecretStore): Promise<string | undefined> {
     return store.get(API_KEY_SECRET);
   }
   export async function setApiKey(store: SecretStore, key: string): Promise<void> {
     return store.set(API_KEY_SECRET, key);
   }
   export async function deleteApiKey(store: SecretStore): Promise<void> {
     return store.delete(API_KEY_SECRET);
   }
   ```

2. Create Electron implementation using `safeStorage`:
   ```typescript
   import { safeStorage } from 'electron';
   import * as fs from 'fs';
   import * as path from 'path';
   import { app } from 'electron';

   export class ElectronSecretStorage implements SecretStore {
     private _filePath = path.join(app.getPath('userData'), 'secrets.enc');

     async get(key: string): Promise<string | undefined> {
       // Read encrypted file, decrypt with safeStorage.decryptString()
     }
     async set(key: string, value: string): Promise<void> {
       // Encrypt with safeStorage.encryptString(), write to file
     }
     async delete(key: string): Promise<void> {
       // Remove key from encrypted store
     }
   }
   ```

3. Add IPC handlers:
   ```typescript
   ipcMain.handle('prism:getApiKey', async () => getApiKey(secretStorage));
   ipcMain.handle('prism:setApiKey', async (_, key) => setApiKey(secretStorage, key));
   ipcMain.handle('prism:deleteApiKey', async () => deleteApiKey(secretStorage));
   ipcMain.handle('prism:validateApiKey', (_, key) => isValidApiKey(key));
   ```

4. Add API key management UI in Electron (settings modal or HeaderBar dropdown):
   - Input field with password masking
   - Inline validation (must start with `sk-ant-`, length > 20)
   - Save/Delete buttons
   - Status indicator (key set / not set)

5. Refactor VSCode `auth.ts` to use the shared interface:
   ```typescript
   const vscodeStore: SecretStore = {
     get: (key) => context.secrets.get(key),
     set: (key, value) => context.secrets.store(key, value),
     delete: (key) => context.secrets.delete(key),
   };
   ```

### Verification
#### Automated
- [ ] `cd packages/prism-core && npm run typecheck` passes
- [ ] `cd cmd/prism-electron && npm run make` succeeds

#### Manual
- [ ] Electron: can enter an API key and it persists across restarts
- [ ] Electron: key is encrypted on disk (not plaintext)
- [ ] Electron: deleting the key works
- [ ] Electron: validation rejects malformed keys
- [ ] VSCode: existing API key functionality still works

---

## Phase 20: Production Hardening

**Goal**: Add error boundaries, reconnection logic, cross-platform edge case handling, and performance validation. Ensure everything works together as a production-ready system.

### Files to Modify
- Various files across all packages — error handling, edge cases, performance

### Steps

1. **Error boundaries in office renderer**:
   - Add React error boundary around `<OfficeApp />` in both platforms
   - Graceful fallback UI if canvas crashes
   - Auto-reconnect office transport on disconnection

2. **Process management hardening in ElectronAgentManager**:
   - Handle `claude` CLI not found (show helpful error)
   - Handle process crash/exit (clean up agent state)
   - Handle orphaned JSONL files (agent removed but file still being written)
   - Timeout for JSONL detection (if file doesn't appear within 10s, show warning)

3. **Layout persistence edge cases**:
   - Handle corrupted layout files (fall back to default)
   - Handle concurrent writes from multiple windows
   - Cross-window sync via `fs.watch` on `~/.prism/office-layout.json`

4. **Workspace discovery hardening**:
   - Handle permission errors when scanning sibling dirs
   - Handle very large directories (cap at 50 entries)
   - Handle `git` not installed
   - Timeout on git commands (already 5s/10s/15s in implementation)

5. **Quality gate hardening**:
   - Maximum execution time (60s timeout)
   - Cancel button during execution
   - Sanitize command output for display

6. **Performance audit**:
   - Profile canvas office rendering at different zoom levels
   - Profile sprite cache memory usage with many agents
   - Test with 10+ simultaneous agents in office
   - Verify no memory leaks in message handlers

7. **Cross-platform testing**:
   - Windows: verify path handling (backslashes, UNC paths)
   - macOS: verify `claude` CLI detection in both `/usr/local/bin` and homebrew paths
   - Linux: verify terminal spawning

8. **Build system validation**:
   - Verify `npm install` from root works with all 9 workspaces
   - Verify `vsce package` still produces valid `.vsix`
   - Verify `npm run make` produces valid Electron distributables
   - Verify dev server HMR works for all webview sub-apps

9. **Documentation update**:
   - Update `.prism/shared/docs/PRISM-DOCUMENTATION-2.3.0.md` → `2.4.0` with monorepo structure
   - Document the `packages/` directory and how to develop shared code
   - Document the office transport adapter pattern

### Verification
#### Automated
- [ ] All 7 builds pass (prism-core, prism-ui, vscode extension, 3 webviews, electron)
- [ ] `vsce package` produces a valid `.vsix` file
- [ ] `npm run make` in electron produces platform distributables

#### Manual
- [ ] Full end-to-end: VSCode research → plan → implement → validate cycle works
- [ ] Full end-to-end: Electron Spectrum run with office agents, monitoring, workspace
- [ ] Kill Claude CLI mid-run → agent gracefully removed from office
- [ ] Open Electron with no `.prism/` directory → graceful empty states
- [ ] Open Electron with no git → worktree section shows appropriate message
- [ ] Resize Electron window → office canvas resizes properly
- [ ] Open 5+ agents → office performance stays smooth

---

## Summary

| Group | Phases | Focus |
|-------|--------|-------|
| Foundation | 1-2 | Monorepo setup, version alignment, prism-core package |
| Core Extraction | 3-5 | Move all shared files, BasePrismController, ElectronPrismController upgrade |
| UI Package | 6-8 | prism-ui package, CSS bridge, wire platform shells |
| Office Engine | 9-11 | Move canvas office, shared host module, ElectronAgentManager |
| Office Integration | 12-14 | ElectronOfficeProvider, canvas in Electron, Spectrum→Office pipeline |
| Feature Parity | 15-20 | Workspaces, quality gates, research/plans, worktrees, auth, hardening |

**Total files created**: ~30 new files
**Total files moved**: ~50 files (from cmd/prism-vscode to packages/)
**Total files deleted**: ~25 files (duplicates, old Electron local copies, PixelOffice mock)
**Total files modified**: ~40 files (import updates, refactoring)
