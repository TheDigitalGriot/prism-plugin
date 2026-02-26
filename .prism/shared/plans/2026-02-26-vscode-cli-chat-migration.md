---
title: "VS Code Extension: Replace Anthropic SDK with Claude CLI for Interactive Chat"
date: 2026-02-26
type: plan
status: IMPLEMENTED
research: .prism/shared/research/2026-02-26-vscode-extension-cli-migration.md
tags: [vscode-extension, claude-cli, max-subscription, api-key-removal]
---

# Plan: Route Interactive Chat Through Claude CLI

## Goal

Replace the `@anthropic-ai/sdk` (direct API) interactive chat flow with `ClaudeRunner` (Claude CLI subprocess). This removes the API key requirement and uses the Max subscription, matching how the prism-cli and plugin mode already work.

## What We're NOT Doing

- Not adding `@anthropic-ai/claude-agent-sdk` as a new dependency (existing `ClaudeRunner` with `shell: true` handles Windows)
- Not deleting `src/core/task/`, `src/core/api/claude-sdk.ts`, or `src/core/api/auth.ts` (dead code cleanup is a separate task)
- Not changing plugin mode or Spectrum execution paths — only the interactive chat path changes
- Not modifying the `ClaudeRunner` class itself — it already works
- Not adding multi-turn resumable sessions — each message is a fresh CLI invocation with history in the prompt

## Success Criteria

### Automated Verification
- [x] TypeScript compiles: `cd cmd/prism-vscode && npm run check-types`
- [x] Extension builds: `cd cmd/prism-vscode && npm run compile`
- [x] Webview builds: `cd cmd/prism-vscode/webview-ui && npm run build`

### Manual Verification
- [ ] Extension loads without errors in VS Code
- [ ] No API key prompt appears — chat is immediately available (when Claude CLI is installed)
- [ ] Sending a message in chat streams a response from Claude via CLI
- [ ] "Claude CLI not found" message appears when CLI is absent
- [ ] Plugin mode skills (`/prism-research`, etc.) still work
- [ ] Spectrum execution still works
- [ ] "New chat" button clears history and subsequent messages work
- [ ] Stop button aborts streaming mid-response
- [ ] Tool activity events (file reads, searches) show as tool_use messages in chat

---

## Phase 1: Controller — Replace sendMessage with ClaudeRunner

**Goal**: Rewrite the `sendMessage` gRPC handler to use `ClaudeRunner` instead of `PrismApiHandler` + `PrismTask`. Remove all API key logic from the controller.

### Files Changed

- `src/core/controller/index.ts`

### Steps

#### 1.1 Add new private fields for CLI-based chat

Add at the class field level (near `_currentTask` at line 61):

```typescript
// Interactive chat via CLI
private _chatRunner: ClaudeRunner | null = null
private _chatMessages: PrismChatMessage[] = []
```

#### 1.2 Remove API key imports and startup check

**Remove imports** at lines 12-13:
```typescript
// REMOVE:
import { getApiKey, promptForApiKey } from "../api/auth"
import { PrismApiHandler, ModelName } from "../api/claude-sdk"
import { PrismTask } from "../task/index"
```

**Replace with** (only need ClaudeRunner):
```typescript
import { ClaudeRunner, type RunnerOptions } from "../../claude/runner"
import type { ClaudeRunnerEvent, ClaudeStreamEvent, ContentBlock } from "../../claude/events"
```

Note: `ClaudeRunner` is already imported indirectly via `checkClaudeCli` at line 19. Add the class import directly.

**Remove `_currentTask` field** at line 61:
```typescript
// REMOVE:
private _currentTask: PrismTask | undefined
```

**Remove `_checkApiKey()` call** from constructor at line 80:
```typescript
// REMOVE:
void this._checkApiKey()
```

**Remove `_checkApiKey()` method** at lines 544-547.

#### 1.3 Rewrite `sendMessage` handler (lines 186-268)

Replace the SDK mode section (lines 220-268) with `ClaudeRunner`-based chat:

```typescript
// --- CLI Mode: interactive chat ---
if (!this._state.hasClaudeCli) {
  return { ok: false, error: "Claude CLI not found. Install Claude Code and run 'claude login' to use Prism chat." }
}

// Add user message to chat history
const { v4: uuidv4 } = await import("uuid")
const userMsg: PrismChatMessage = {
  id: uuidv4(), ts: Date.now(), type: "user", text,
}
this._chatMessages = [...this._chatMessages, userMsg]

// Create streaming assistant message
const assistantMsg: PrismChatMessage = {
  id: uuidv4(), ts: Date.now(), type: "assistant_text", text: "", isStreaming: true,
}
this._chatMessages = [...this._chatMessages, assistantMsg]

await this.updateState({
  chatMessages: [...this._chatMessages],
  isChatStreaming: true,
  hasActiveTask: true,
})

// Build prompt with conversation context
const systemPrompt = buildSystemPrompt({
  workflowPhase: this._state.workflowPhase,
  workflowContext: this.workflow.context,
  workspaceRoot,
  prismDir: this._state.prismDir,
  hasPrismDir: this._state.hasPrismDir,
  hasStoriesJson: this._state.hasStoriesJson,
})
const prompt = this._buildChatPrompt(text, systemPrompt)

// Run in background via ClaudeRunner
void this._runChatSession(prompt, workspaceRoot, assistantMsg).catch((err: Error) => {
  console.error("[Prism] Chat session error:", err)
})

return { ok: true }
```

#### 1.4 Add `_runChatSession()` method

New private method on `PrismController`:

```typescript
/**
 * Run an interactive chat session via ClaudeRunner.
 * Streams clean text from CLI output into the chat UI.
 */
private async _runChatSession(
  prompt: string,
  workspaceRoot: string,
  assistantMsg: PrismChatMessage,
): Promise<void> {
  // Abort any previous chat runner
  if (this._chatRunner) {
    this._chatRunner.terminate()
    this._chatRunner = null
  }

  const runner = new ClaudeRunner()
  this._chatRunner = runner

  runner.on("event", (event: ClaudeRunnerEvent) => {
    // Extract clean text from assistant stream events
    if (event.type === "stream_event") {
      const se = event.event as ClaudeStreamEvent
      if (se.type === "assistant" && se.message) {
        for (const block of se.message.content) {
          if (block.type === "text" && block.text) {
            assistantMsg.text = (assistantMsg.text ?? "") + block.text
          }
        }
        void this.updateState({ chatMessages: [...this._chatMessages] })
      } else if (se.type === "result" && se.result) {
        // Final result — may contain summary text
        if (!assistantMsg.text) {
          assistantMsg.text = se.result
        }
        void this.updateState({ chatMessages: [...this._chatMessages] })
      }
    }

    // Show tool activities in chat (same pattern as ModeBridge)
    if (event.type === "tool_activity") {
      const { v4: uuidv4 } = require("uuid") as typeof import("uuid")
      const toolMsg: PrismChatMessage = {
        id: uuidv4(), ts: Date.now(), type: "tool_use",
        toolName: event.activity.toolName,
        toolInput: { description: event.activity.description },
        toolUseId: uuidv4(),
        needsApproval: false, approved: true,
      }
      // Insert tool message before the streaming assistant message
      const idx = this._chatMessages.indexOf(assistantMsg)
      if (idx >= 0) {
        this._chatMessages.splice(idx, 0, toolMsg)
      } else {
        this._chatMessages.push(toolMsg)
      }
      void this.updateState({ chatMessages: [...this._chatMessages] })
    }
  })

  try {
    const options: RunnerOptions = { projectDir: workspaceRoot }
    await runner.runStreaming(prompt, options)
  } finally {
    assistantMsg.isStreaming = false
    this._chatRunner = null
    await this.updateState({
      chatMessages: [...this._chatMessages],
      isChatStreaming: false,
    })
  }
}
```

#### 1.5 Add `_buildChatPrompt()` method

```typescript
/**
 * Build a CLI prompt that includes conversation history as context.
 * Prior messages are encoded as text so the CLI session has context.
 */
private _buildChatPrompt(currentText: string, systemPrompt: string): string {
  // Collect prior conversation (excluding the just-added user message and assistant placeholder)
  const priorMessages = this._chatMessages.filter(
    m => (m.type === "user" || m.type === "assistant_text") && m.text && !m.isStreaming
  )
  // Exclude the last entry (the current user message we just added)
  const historyMsgs = priorMessages.slice(0, -1)

  if (historyMsgs.length === 0) {
    return `${systemPrompt}\n\n${currentText}`
  }

  const history = historyMsgs.map(m => {
    const role = m.type === "user" ? "User" : "Assistant"
    return `${role}: ${m.text}`
  }).join("\n\n")

  return `${systemPrompt}\n\n## Previous conversation\n${history}\n\n## Current request\n${currentText}`
}
```

#### 1.6 Update `abortTask` handler (line 272)

Replace the task abort logic:

```typescript
registerUnary("ChatService", "abortTask", async () => {
  // Abort Plugin mode if running
  if (this._modeBridge?.isPluginStreaming) {
    this._modeBridge.terminate()
  }
  // Abort CLI chat if running
  if (this._chatRunner) {
    this._chatRunner.terminate()
    this._chatRunner = null
  }
  await this.updateState({
    isChatStreaming: false,
    chatMode: "sdk",
    activePluginSkill: null,
  })
  return { ok: true }
})
```

#### 1.7 Update `clearMessages` handler (line 290)

Replace task cleanup with chat history reset:

```typescript
registerUnary("ChatService", "clearMessages", async () => {
  // Terminate any running chat session
  if (this._chatRunner) {
    this._chatRunner.terminate()
    this._chatRunner = null
  }
  this._chatMessages = []
  await this.updateState({
    chatMessages: [],
    isChatStreaming: false,
    hasActiveTask: false,
    pendingApprovalToolUseId: undefined,
  })
  return { ok: true }
})
```

#### 1.8 Update `setApiKey` handler (lines 324-339)

Convert to a no-op that returns success (keeps the gRPC contract stable in case old webview is cached):

```typescript
registerUnary("ChatService", "setApiKey", async () => {
  // API key no longer needed — using Claude CLI Max subscription
  return { ok: true }
})
```

### Checkpoint: [x] Phase 1 complete

After Phase 1, run `npm run check-types` from `cmd/prism-vscode/`. The controller should compile. The webview will have type errors since `hasApiKey` still exists in the state interface — that's expected and fixed in Phase 2.

---

## Phase 2: State — Remove `hasApiKey`

**Goal**: Remove the `hasApiKey` field from the shared state interface and webview state mirror.

### Files Changed

- `src/shared/PrismState.ts`
- `webview-ui/src/context/PrismStateContext.tsx`

### Steps

#### 2.1 Update `PrismState.ts`

Remove `hasApiKey` from the `PrismExtensionState` interface at line 68:
```typescript
// REMOVE:
hasApiKey: boolean
```

Remove from `DEFAULT_PRISM_STATE` at line 107:
```typescript
// REMOVE:
hasApiKey: false,
```

#### 2.2 Update `PrismStateContext.tsx`

Remove `hasApiKey` from the webview's `PrismExtensionState` interface at line 128:
```typescript
// REMOVE:
hasApiKey: boolean
```

Remove from `DEFAULT_STATE` at line 170:
```typescript
// REMOVE:
hasApiKey: false,
```

### Checkpoint: [x] Phase 2 complete

Run `npm run check-types` from `cmd/prism-vscode/`. Any remaining references to `hasApiKey` will surface as type errors — fix them in Phase 3.

---

## Phase 3: Webview — Replace ApiKeySetup with CliNotFound

**Goal**: Remove the API key UI, replace with a "Claude CLI not found" component that guides installation.

### Files Changed

- `webview-ui/src/views/ChatView.tsx`
- `webview-ui/src/App.tsx`
- `webview-ui/src/services/grpc-client.ts`

### Steps

#### 3.1 Replace `ApiKeySetup` with `CliNotFound` in `ChatView.tsx`

Remove the entire `ApiKeySetup` component (lines 13-95).

Add a new `CliNotFound` component in its place:

```tsx
const CliNotFound: React.FC = () => (
  <div
    style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      height: "100%",
      padding: "24px",
      gap: "16px",
      textAlign: "center",
    }}
  >
    <div style={{ fontSize: "24px" }}>&#x2699;</div>
    <div style={{ fontWeight: 600, fontSize: "14px" }}>Claude CLI Not Found</div>
    <div style={{ color: "var(--vscode-descriptionForeground)", fontSize: "12px", maxWidth: "300px" }}>
      Prism uses your Claude Max subscription via the Claude CLI. Install it and log in to get started.
    </div>
    <div style={{ display: "flex", flexDirection: "column", gap: "8px", width: "100%", maxWidth: "320px", fontSize: "12px" }}>
      <div style={{
        padding: "8px 12px",
        borderRadius: "6px",
        backgroundColor: "var(--vscode-textBlockQuote-background)",
        fontFamily: "var(--vscode-editor-font-family, monospace)",
        textAlign: "left",
      }}>
        <div style={{ color: "var(--vscode-descriptionForeground)", marginBottom: "4px" }}>1. Install Claude Code:</div>
        <div>npm install -g @anthropic-ai/claude-code</div>
        <div style={{ color: "var(--vscode-descriptionForeground)", marginTop: "8px", marginBottom: "4px" }}>2. Log in with your Max subscription:</div>
        <div>claude login</div>
      </div>
    </div>
    <div style={{ color: "var(--vscode-descriptionForeground)", fontSize: "11px", maxWidth: "300px" }}>
      After installing and logging in, reload VS Code to detect the CLI.
    </div>
  </div>
)
```

#### 3.2 Update the gate in `ChatView` render (line 267)

Change from:
```tsx
if (!state.hasApiKey) {
  return <ApiKeySetup />
}
```

To:
```tsx
if (!state.hasClaudeCli) {
  return <CliNotFound />
}
```

#### 3.3 Update `App.tsx` isFirstTimeUser (line 42)

Change from:
```typescript
const isFirstTimeUser = !state.hasPrismDir && !state.hasApiKey
```

To:
```typescript
const isFirstTimeUser = !state.hasPrismDir
```

This means the welcome screen only shows when `.prism/` is missing. Once initialized, users go straight to chat (which either works or shows `CliNotFound`).

#### 3.4 Remove `setApiKey` from `grpc-client.ts`

Remove the `setApiKey` static method from `ChatServiceClient` at line 112-114:
```typescript
// REMOVE:
static setApiKey(apiKey: string): Promise<ChatResponse> {
    return this.makeUnaryRequest("ChatService", "setApiKey", { apiKey })
}
```

### Checkpoint: [x] Phase 3 complete

Run `cd cmd/prism-vscode/webview-ui && npm run build`. Webview should compile. Then run `cd cmd/prism-vscode && npm run check-types` for the full extension.

---

## Phase 4: Package — Remove SDK dependency and config

**Goal**: Clean up `package.json` — remove the now-unused `@anthropic-ai/sdk` dependency and the `prism.claudeApiKey` configuration setting.

### Files Changed

- `cmd/prism-vscode/package.json`

### Steps

#### 4.1 Remove `@anthropic-ai/sdk` from dependencies

Remove from `"dependencies"` at line 417:
```json
// REMOVE:
"@anthropic-ai/sdk": "^0.36.0",
```

#### 4.2 Remove `prism.claudeApiKey` from configuration

Remove the configuration property at lines 352-356:
```json
// REMOVE:
"prism.claudeApiKey": {
    "type": "string",
    "default": "",
    "description": "Anthropic API key for Claude Agent SDK (stored in Settings; prefer using the sidebar to store in SecretStorage)"
},
```

#### 4.3 Update walkthrough "configure-claude" step (lines 323-333)

Change the description text from API key instructions to CLI instructions:
```json
{
    "id": "configure-claude",
    "title": "Configure Claude",
    "description": "Prism uses your Claude Max subscription via the Claude CLI. Install it globally with `npm install -g @anthropic-ai/claude-code`, then run `claude login` to authenticate.\n\n[Open Prism Sidebar](command:prism.openSidebar)",
    "media": {
        "svg": "media/prism-icon.svg",
        "altText": "Configure Claude"
    },
    "completionEvents": []
}
```

### Checkpoint: [x] Phase 4 complete

Run `cd cmd/prism-vscode && npm install` (to update `node_modules` after removing the dep). Then `npm run compile` for a full build.

**Note**: `@anthropic-ai/sdk` was moved to `devDependencies` (not fully removed) because `claude-sdk.ts` and the `task/` directory still import it. Those files are dead code but the plan defers their deletion to a separate task. The SDK is not bundled into the production extension — esbuild only includes reachable code from the entry point.

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Conversation history in prompt grows large | May exceed CLI input limits for long chats | Truncate history to last N turns (e.g., last 10 user/assistant pairs) |
| `ClaudeRunner` emits duplicate text for multi-block events | Assistant text could appear twice | Extract text per content block; the existing `stream_event` is emitted once per JSON line |
| Users without Claude CLI installed see broken chat | No chat possible | `CliNotFound` component with clear install instructions |
| `shell: true` on ClaudeRunner may behave differently across shells | Command injection or path issues | Prompt is the last argument; no user-controlled path injection |
| Removing `@anthropic-ai/sdk` breaks something else | Build failure | The only import is in `claude-sdk.ts:7` which is dead code after Phase 1 |

## Edge Cases

- **User has API key stored but no CLI**: Chat shows `CliNotFound`. Old API key in SecretStorage is harmless (never read).
- **User sends message while previous is streaming**: `sendMessage` handler calls `_chatRunner.terminate()` before starting a new session (via `_runChatSession`).
- **CLI exits with error**: The `finally` block in `_runChatSession` ensures `isStreaming` is set to `false` and the runner is cleaned up.
- **No workspace folder open**: Handled at line 197 of the existing `sendMessage` handler — returns error before reaching CLI logic.
- **Empty conversation**: `_buildChatPrompt` with no history produces `{systemPrompt}\n\n{text}`.
