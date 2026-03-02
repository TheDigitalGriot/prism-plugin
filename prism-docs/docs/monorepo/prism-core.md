---
title: packages/prism-core
description: Platform-agnostic business logic — zero vscode/electron imports. Contents, infrastructure notes, and key patterns.
outline: [2, 3]
---

# packages/prism-core

**Package name**: `@prism/core`
**Purpose**: Platform-agnostic business logic — zero vscode or electron imports.

**TypeScript path alias**: `@prism-core/*` → `../../packages/prism-core/src/*`

## Contents

| Directory | Files | Description |
|-----------|-------|-------------|
| `src/shared/` | `types.ts`, `PrismMessage.ts`, `PrismState.ts` | `WorkflowPhase` enum, `WORKFLOW_PHASE_COLORS`, `WORKFLOW_PHASE_LABELS`, GrpcRequest/Response types, `PrismExtensionState`, `DEFAULT_PRISM_STATE` |
| `src/core/api/` | `types.ts`, `auth.ts` | Stream chunk types, conversation message types, tool definitions, UI chat types; `SecretStore` interface, API key helpers |
| `src/core/controller/` | `BasePrismController.ts`, `grpc-handler.ts`, `types.ts` | Abstract base controller (866 lines, extends EventEmitter), transport-agnostic gRPC handler with `registerUnary`/`registerStream`/`clearHandlers`, `PostMessageFn`/`AgentSessionData`/`UpdatedStoryData` types |
| `src/core/controller/prism/` | `workflow.ts`, `spectrum.ts`, `spectrum-runner.ts`, `stories.ts`, `plugin-bridge.ts`, `mode-bridge.ts` | `WorkflowStateMachine`, `SpectrumEngine`, `SpectrumRunner`, `StoriesManager`, `PluginBridge` (with `SKILL_MAP`, `WORKFLOW_SKILLS`), `ModeBridge` (with `detectSkillTrigger()`) |
| `src/core/prompts/` | `system-prompt.ts`, `phase-research.ts`, `phase-plan.ts`, `phase-implement.ts`, `phase-validate.ts` | `buildSystemPrompt()` function, per-phase instruction constants |
| `src/claude/` | `events.ts`, `parser.ts`, `runner.ts` | Stream event types, `OutputParser` class with signal/tool/phase detection, `ClaudeRunner` class (443 lines — CLI process spawner, prompt builders, `checkClaudeCli()`) |
| `src/prism/` | `signals.ts`, `types.ts`, `stories.ts`, `progress.ts`, `config.ts`, `init.ts`, `watcher.ts` | Signal parsing (`parseSignal`, `containsSignal`), domain model (`Plan`, `Story`, `StoriesFile`), story file I/O + queries, `ProgressFile` class, `PrismConfig` + directory detection, `.prism/` initialization, `PrismWatcher` (chokidar) |
| `src/office/` | `agentBridge.ts`, `assetLoader.ts`, `layoutPersistence.ts`, `transcriptParser.ts`, `timerManager.ts`, `types.ts`, `constants.ts` | `AgentBridge`, asset loading functions, layout read/write/watch, JSONL transcript processing, agent timer management, `PostMessageFn`/`AgentState`/`PersistedAgent` types, 31 timing/display/parsing constants |
| `src/workspace/` | `types.ts`, `discovery.ts`, `worktrees.ts`, `qualityGates.ts`, `research.ts`, `plans.ts` | `ProjectInfo`/`WorktreeInfo`/`EpicInfo` types, project discovery (50-entry cap, git timeouts), worktree create/delete, gate execution with `AbortSignal`, research/plans file discovery with frontmatter parsing |

## Infrastructure Notes

- `package.json` declares `"main": "src/index.ts"` and `"types": "src/index.ts"` but **`src/index.ts` does not exist** — this should be created or the declarations removed
- `tsconfig.json` has `noEmit: true` — no compiled output is produced, no `dist/` directory exists
- Dependencies: `uuid`, `chokidar`, `pngjs`
- DevDependencies: `typescript`, `@types/node`, `@types/uuid`, `@types/pngjs`
- Scripts: `build` and `typecheck` both run `tsc --noEmit`
- Zero test files across 42 source files

## Key Patterns

**BasePrismController** uses Node.js `EventEmitter` as drop-in for `vscode.EventEmitter`:
```typescript
controller.on('stateChange', (state) => ...)
controller.on('sessionStart', (data) => ...)
controller.on('storyUpdate', (data) => ...)
controller.on('spectrumStoryEnd', (data) => ...)
controller.on('fileChange', (path) => ...)
```

**Transport-agnostic gRPC handler**:
```typescript
handleGrpcRequest(
  postMessage: (msg: unknown) => Promise<void>,  // injected by platform
  request: GrpcRequest
)
```
