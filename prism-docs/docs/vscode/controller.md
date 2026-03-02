---
title: PrismController
description: The central orchestrator — responsibilities, extension state model, and events.
outline: [2, 3]
---

# Core Orchestrator — PrismController

The `PrismController` is the central hub that ties together all extension functionality.

## Responsibilities

| Area | Components | Description |
|------|-----------|-------------|
| **State** | `updateState()`, `PrismExtensionState` | Atomic state updates, broadcast to all webview subscribers via gRPC streams |
| **Workflow** | `WorkflowStateMachine` | Phase transitions with validation (Idle → Research → Plan → Implement → Validate) |
| **Stories** | `StoriesManager` | Load/save `stories.json`, resolve dependencies, track progress |
| **Chat** | `ClaudeRunner`, tool handlers | Spawn Claude CLI with `--output-format stream-json`, handle tool use recursively |
| **Spectrum** | `SpectrumEngine`, `SpectrumRunner` | Execution loop state machine, per-iteration CLI subprocess management |
| **Skills** | `ModeBridge`, `PluginBridge` | Switch between SDK chat and CLI plugin mode, route skill invocations |
| **Files** | `PrismWatcher` | Monitor `.prism/` directory for changes, fire `onDidChangeFile` events |
| **Office** | `AgentBridge` | Connect Spectrum sessions to Office agent characters |

## Extension State Model (`PrismExtensionState`)

The full state is broadcast to all webview subscribers on every update:

| Category | Fields | Description |
|----------|--------|-------------|
| **Workspace** | `hasPrismDir`, `hasStoriesJson`, `prismDir`, `storiesPath` | `.prism/` detection |
| **Workflow** | `workflowPhase`, `workflowContext` | Current phase + active document/story |
| **Stories** | `stories[]`, `plan`, `completedCount`, `remainingCount` | Story data + progress |
| **Chat** | `chatMessages[]`, `isChatStreaming`, `hasActiveTask`, `pendingApprovalToolUseId` | Conversation state |
| **CLI** | `chatMode` (`sdk`/`plugin`), `activePluginSkill`, `hasClaudeCli` | CLI bridge state |
| **Spectrum** | `executionState`, `currentIteration`, `currentStoryId`, `progress`, `elapsedMs`, `consecutiveErrors`, `lastSignalType`, `recentActivities[]`, `logs[]` | Full execution state |
| **Office** | `office.enabled`, `office.agentCount`, `office.activeAgents[]` | Agent tracking |
| **Config** | `defaultModel`, `planningModel` | Model selections |

## Events

| Event | Trigger | Consumers |
|-------|---------|-----------|
| `onDidChangeFile` | `.prism/` file added/changed/deleted | Tree providers |
| `onDidChangeState` | Any state update | Status bar, webviews |
| `onDidStartSession` | Claude session begins | AgentBridge |
| `onDidUpdateStory` | Story status changes | Stories tree |
| `onDidEndSpectrumStory` | Story iteration completes | Monitor history |
