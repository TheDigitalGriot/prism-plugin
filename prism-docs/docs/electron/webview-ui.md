---
title: Webview UI — React SPA
description: Transport adapter, gRPC client base, service clients, view switcher, and theme for the Electron React SPA.
outline: [2, 3]
---

# Webview UI — React SPA

## Transport Adapter (`webview-ui/src/electron.ts`)

The transport adapter is a drop-in replacement for VS Code's `vscode.ts`. It bridges the React SPA to Electron's IPC system using a re-dispatch pattern:

```typescript
// Inbound: Main → Renderer
window.electronAPI.on('grpc_response', (data) => {
  // Re-dispatch as a standard window "message" event
  // so grpc-client-base.ts works without modification
  window.dispatchEvent(new MessageEvent('message', { data }));
});

// Outbound: Renderer → Main
export const electronApi = {
  postMessage: (message: unknown) => {
    const msg = message as { type: string; grpc_request?: unknown; grpc_request_cancel?: unknown };
    if (msg.type === 'grpc_request') {
      window.electronAPI.invoke('grpc_request', msg.grpc_request);
    } else if (msg.type === 'grpc_request_cancel') {
      window.electronAPI.invoke('grpc_request_cancel', msg.grpc_request_cancel);
    }
  },
};
```

The re-dispatch pattern is key: by converting IPC responses into standard `window.dispatchEvent(new MessageEvent(...))` events, the entire `grpc-client-base.ts` works without any modification. The only change needed was swapping the import from `../vscode` to `../electron`.

## gRPC Client Base (`webview-ui/src/services/grpc-client-base.ts`)

The `ProtoBusClient` abstract base implements unary and streaming RPC over the postMessage protocol:

### Unary Requests
1. Generate UUID4 `request_id`
2. Set up `window.addEventListener('message', handler)`
3. Post request via `electronApi.postMessage()`
4. Wait for response with matching `request_id`
5. Resolve/reject promise, remove listener

### Streaming Requests
1. Same setup as unary
2. Keep listener active until `is_streaming === false`
3. Call `callbacks.onResponse()` for each message
4. Call `callbacks.onComplete()` on stream end
5. Return unsubscribe function (removes listener + sends cancel)

## Service Clients (`webview-ui/src/services/grpc-client.ts`)

Stateless client classes extending `ProtoBusClient`:

| Client | Methods |
|--------|---------|
| `StateServiceClient` | `subscribeToState()` (streaming), `getState()` (unary) |
| `UiServiceClient` | `initializeWebview()`, `initPrism()` |
| `WorkflowServiceClient` | `transition(transition)`, `getAvailableTransitions()` |
| `ChatServiceClient` | `sendMessage(text)`, `abortTask()`, `clearMessages()`, `approveToolUse()` |
| `PluginServiceClient` | `executeSkill()`, `terminateSkill()`, `checkCli()`, `getSkills()` |
| `SpectrumServiceClient` | `start()`, `pause()`, `resume()`, `stop()`, `skipStory()`, `reset()` |

## View Switcher (`webview-ui/src/App.tsx`)

The top-level component routes between views based on state:

```
No .prism/ dir detected  →  WelcomeView (with "Open Project…" button)
Chat mode active         →  ChatView (message list + input + phase selector)
Spectrum active          →  SpectrumView (progress bar + story list + logs)
```

## Theme (`webview-ui/src/theme/`)

All VS Code CSS custom properties (`--vscode-sideBar-background`, `--vscode-foreground`, etc.) were replaced with Prism-specific custom properties:

```css
:root {
  --prism-bg: #1a1b2e;
  --prism-fg: #e2e8f0;
  --prism-font-family: 'Inter', system-ui, -apple-system, sans-serif;
  --prism-font-size: 13px;
  --prism-input-bg: #252640;
  --prism-input-border: #3a3b5c;
  --prism-button-bg: #6366f1;
  --prism-button-fg: #ffffff;
  /* ... spectral theme colors */
}
```

The `spectral.css` file was also cleaned: `body.vscode-light` and `body.vscode-high-contrast` selectors were removed since the Electron app uses a single dark theme.
