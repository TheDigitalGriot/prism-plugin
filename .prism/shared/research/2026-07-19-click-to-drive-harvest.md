---
date: 2026-07-19
topic: "B4 click-to-drive across Fragment surfaces — buildable spec"
tags: [fragment, click-to-drive, channels, drive-intent, harvest, spec]
status: complete — feeds the click-to-drive build
---

# B4 — Generalizing "click-to-drive" across Fragment surfaces

## How it works today (2 variants)
- **Variant A — Claude Code channel** (browser brainstorm companion): click → HTTP POST `:52342/channel` → MCP `notifications/message/create` (bare wake payload; real choice written to `$STATE_DIR/events` over a separate WS). The wake exists ONLY to advance an out-of-process, idle Claude Code REPL. (`brainstorm-channel.ts`, `server.cjs`, `helper.js`.)
- **Variant B — Cowork `sendPrompt()`**: click calls `sendPrompt('<fully-formed instruction>')` and simply IS the next user turn — no wake needed (agent is turn-based, co-hosted). Rule: the string must self-carry intent.

## ARCHITECTURE RESOLUTION (decisive)
**Fragment-emitted apps are Variant B, not A.** They embed their OWN agent in-process/turn-based:
- electron: `@anthropic-ai/claude-agent-sdk` `query()` (`templates/electron/src/main.ts:119-165`, IPC `app:send-message`).
- vscode: `spawn('claude'|'codex'|'gemini',['-m',content])` (`templates/vscode/src/agents/manager.ts:32-81`) via `BaseController.emit('chat-message')` (`BaseController.ts:52-56`).
- tui: `exec.Command("claude","-m",content)` (`templates/tui/agent/claude.go:32-46`).

→ **A channel is the WRONG mechanism** (nothing to wake; would add a 2nd process, bound port, CORS, capability negotiation, v2.1.80+ requirement — and couldn't even target this app's embedded agent). **Use direct agent-input.** The one exception (document, don't build): a surface embedding a *persistent interactive* PTY REPL — none do today.

## Canonical design: DriveIntent + drive()
```ts
// packages/core/src/shared/drive.ts (NEW)
export interface DriveIntent {
  model: ModelId; content: string;   // content MUST be a fully-formed instruction (self-carries intent)
  source: string; meta?: Record<string,string>; sessionId?: string;
}
```
Clicks emit a `DriveIntent`; each surface routes it to `drive()` which funnels into the SAME agent call the chat box uses.

### Shared (emit once in core)
- `packages/core/src/shared/drive.ts` — the interface.
- `BaseController._registerHandlers()` add `ChatService.drive` handler: `this.emit('chat-message', { model: model ?? state.chat.activeModel, content })` → `{status:'ok'}`. Clicks + typing converge on the same `chat-message`.
- `ChatServiceClient.driveIntent(intent)` in `templates/ui/src/services/grpc-client.ts` mirroring `sendMessage`.

### Per-surface glue (fragment connect must emit)
- **electron** (`electron-glue.ts`): `apps/electron/src/plugin-glue/drive-bridge.ts` (`ipcMain.handle('app:drive', … driveAgent(intent))` → same path as app:send-message); preload adds `drive: intent => ipcRenderer.invoke('app:drive', intent)`; `drive-client.ts` renderer helper w/ delegated `[data-drive]` click listener (electron analogue of helper.js).
- **vscode** (`vscode-glue.ts`): change emitted `mcp-commands.ts` so after the timeline push it calls `controller.emit('chat-message', …)` (today dead-ends at timeline); `webview-ui/src/plugin-glue/drive-client.ts` posts `ChatService.drive`; register `<plugin>.drive` as a real `vscode.commands.registerCommand` for tree/CodeLens/status-bar clicks.
- **tui** (`tui-glue.ts` + base): PREREQUISITES — (1) wire chat-pane `enter` (`pane_chat.go:44-50`) to actually call `agent.SendMessage` via `tea.Cmd`; (2) extend `plugin.Context` (`context.go`) with a `Drive func(DriveIntent)` / `Bus` handle (today plugins get no agent handle). Then emit tab whose Update maps click/selection → `ctx.Drive(...)`; base adds a `DriveEvent` + `EventBus.Subscribe` + `tea.MouseMsg` hit-testing.
- **mobile** (greenfield): `apps/mobile/src/plugin-glue/drive-client.ts` — `drive(intent)` posting to a companion/relay (or on-device SDK); tap handler reads a typed `driveIntent` prop (RN has no DOM data-*); `detectSurfaces`+`connect.ts` switch gain `case 'mobile'` + `generateMobileGlue`. The one surface where a relay is justified — but it relays into the app's OWN agent host, NOT a Claude Code channel.

## Prereq gaps to fix
- connect glue's `mcp-*` handlers dead-end at the timeline instead of driving the agent.
- TUI chat-enter doesn't call the agent; plugin tabs get no agent handle.

## Note (if a channel path is ever kept)
brainstorm-channel.ts uses `capabilities:{}` + `notifications/message/create`; canonical `channel-patterns.md` prescribes `capabilities.experimental["claude/channel"]={}` + `notifications/claude/channel`. Standardize on channel-patterns.md if channels are ever used.
