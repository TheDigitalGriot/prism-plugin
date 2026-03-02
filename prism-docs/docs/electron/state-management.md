---
title: State Management
description: PrismExtensionState schema, state flow diagram, and hydration protocol.
outline: [2, 3]
---

# State Management (Electron)

## PrismExtensionState

The global state object mirrors the VS Code extension's state model exactly:

```typescript
interface PrismExtensionState {
  // Config
  version: string;
  didHydrateState: boolean;
  hasClaudeCli: boolean;

  // Project
  hasPrismDir: boolean;
  hasStoriesJson: boolean;
  prismDir?: string;
  storiesPath?: string;

  // Workflow
  workflowPhase: 'idle' | 'research' | 'plan' | 'implement' | 'validate';
  defaultModel: string;
  planningModel: string;

  // Stories
  stories: PrismStory[];
  plan?: PrismPlan;
  completedCount: number;
  remainingCount: number;

  // Chat
  chatMessages: PrismChatMessage[];
  isChatStreaming: boolean;
  hasActiveTask: boolean;
  pendingApprovalToolUseId?: string;

  // CLI Mode
  chatMode: 'sdk' | 'plugin';
  activePluginSkill: string | null;

  // Spectrum
  spectrum: PrismSpectrumState;
}
```

## State Flow

```
ElectronPrismController
    │
    ├── updateState({ chatMessages: [...] })
    │       │
    │       ▼
    │   Object.assign(this._state, partial)
    │       │
    │       ▼
    │   _broadcastState()
    │       │
    │       ▼
    │   for each subscriber (by request_id):
    │       mainWindow.webContents.send('grpc_response', {
    │         request_id,
    │         service: 'StateService',
    │         method: 'subscribeToState',
    │         payload: this._state,
    │         is_streaming: true
    │       })
    │
    ▼
PrismStateContext (React)
    │
    ├── onResponse callback updates state ref
    │       │
    │       ▼
    │   setState(newState)  →  React re-render
    │       │
    │       ▼
    │   ChatView / SpectrumView / WelcomeView re-render
```

## Hydration

The `didHydrateState` flag prevents a flash of default state on startup:

1. Renderer mounts → calls `UiServiceClient.initializeWebview()`
2. Main process detects `.prism/`, loads stories, resolves Claude CLI
3. Main pushes full state with `didHydrateState: true`
4. React components show loading state until `didHydrateState` is `true`
