---
title: packages/prism-ui
description: Shared React component library — views, components, office canvas engine, and CSS variable bridge.
outline: [2, 3]
---

# packages/prism-ui

**Package name**: `@prism/ui`
**Purpose**: Shared React components and canvas office engine.

**TypeScript path alias**: `@prism-ui/*` → `../../../packages/prism-ui/src/*` (consumers are 3 levels deep from repo root)

## Contents

| Directory | Files | Description |
|-----------|-------|-------------|
| `src/context/` | `PrismStateContext.tsx` | `PrismStateContextProvider`, `usePrismState` hook, re-exports all state types |
| `src/transport/` | `types.ts` | `WebviewTransport` interface (postMessage, getState, setState) |
| `src/services/` | `grpc-client-base.ts`, `grpc-client.ts` | `ProtoBusClient` abstract class with `WebviewTransport` injection, unary + streaming; 6 concrete clients: StateService, UiService, WorkflowService, ChatService, PluginService, SpectrumService |
| `src/views/` | `ChatView.tsx`, `SpectrumView.tsx` | Main chat interface (Virtuoso virtual scrolling, phase indicator, suggestion chips), Spectrum dashboard (controls, progress, stories, signals, activity log) |
| `src/components/` | `WelcomeView.tsx` | Onboarding / first-run view when `.prism/` not detected |
| `src/components/common/` | `MarkdownBlock.tsx` | react-markdown renderer with remark-gfm, rehype-highlight, custom overrides for code blocks, tables, links |
| `src/components/chat/` | `ChatRow.tsx`, `ChatTextArea.tsx`, `ToolRow.tsx` | Message type dispatcher (user/assistant/tool_use/tool_result/completion/error), auto-resizing input with Enter-to-send, tool use + result row renderers |
| `src/components/workflow/` | `PhaseIndicator.tsx` | Phase indicator (icon + label + animated dots) and `PhaseTransition` buttons |
| `src/components/spectrum/` | `SpectrumControls.tsx`, `ProgressBar.tsx`, `StoryList.tsx`, `ActivityLog.tsx`, `SignalStatus.tsx` | Start/Pause/Resume/Stop/Skip buttons, animated spectral gradient bar, compact story list with status icons, timestamped log with auto-scroll, signal badge + error count |
| `src/styles/` | `bridge.css`, `tokens.ts` | 342-line CSS variable bridge (`[data-platform="vscode"]` / `[data-platform="electron"]`), typed `PRISM_TOKENS` constant + `PrismPlatform` type |
| `src/office/` | `OfficeApp.tsx`, `OfficeErrorBoundary.tsx`, `transport.ts`, `types.ts`, `office-constants.ts`, `colorize.ts`, `floorTiles.ts`, `wallTiles.ts`, `toolUtils.ts`, `notificationSound.ts` | Top-level office component, error boundary with retry, `OfficeTransport` interface, all type defs (`SpriteData = string[][]`, `Character`, `OfficeLayout`, `EditTool`, etc.), 117 lines of game constants, sprite HSL colorization, tile data, tool status mapping, Web Audio notifications |
| `src/office/engine/` | `officeState.ts`, `gameLoop.ts`, `renderer.ts`, `characters.ts`, `matrixEffect.ts` | `OfficeState` class (layout, characters, tiles, seats), rAF loop, canvas tile/character rendering, character FSM + BFS pathfinding, spawn/despawn visual effect |
| `src/office/sprites/` | `spriteData.ts`, `spriteCache.ts` | Hand-drawn sprite arrays (string[][]), render cache |
| `src/office/layout/` | `furnitureCatalog.ts`, `layoutSerializer.ts`, `tileMap.ts` | Furniture catalog + metadata, layout-to-tile conversion, walkability + BFS pathfinding |
| `src/office/editor/` | `EditorToolbar.tsx`, `editorActions.ts`, `editorState.ts` | UI toolbar for edit mode, paint/place/remove/move/rotate actions, editor state management |
| `src/office/hooks/` | `useExtensionMessages.ts`, `useEditorActions.ts`, `useEditorKeyboard.ts` | Extension-to-office message bridge, editor action handlers, keyboard shortcuts in edit mode |
| `src/office/components/` | `OfficeCanvas.tsx`, `ToolOverlay.tsx` | Main canvas element, HTML overlay for tool activity display |
| `src/office/components/ui/` | `AgentLabels.tsx`, `ZoomControls.tsx`, `BottomToolbar.tsx`, `SettingsModal.tsx`, `DebugView.tsx`, `StoryLabels.tsx` | Agent name labels, zoom +/- buttons, bottom action bar, settings dialog, debug info panel, story context labels |
| `src/office/fonts/` | `FSPixelSansUnicode-Regular.ttf` | Pixel font for office UI |

## Infrastructure Notes

- `package.json` declares `"main": "src/index.ts"` and `"types": "src/index.ts"` but **`src/index.ts` does not exist**
- Dependencies: `react-markdown`, `react-virtuoso`, `rehype-highlight`, `remark-gfm`, `highlight.js`, `class-variance-authority`, `clsx`, `lucide-react`, `tailwind-merge`, `uuid`
- Peer deps: `react`, `react-dom`
- Scripts: `typecheck` runs `tsc --noEmit`
- Zero test files, no Storybook

## CSS Variable Bridge

13 shared components use `--prism-*` tokens mapped by platform:

```css
[data-platform="vscode"] {
  --prism-editor-background: var(--vscode-editor-background, #1e1e1e);
}
[data-platform="electron"] {
  --prism-editor-background: #0f1419;
}
```

## Office Canvas Engine

The office is a pure software renderer — no PNG images at runtime:
```
SpriteData = string[][]   // 2D array of hex colours, '' = transparent
```

**Platform transport adapter** (`src/office/transport.ts`):
```typescript
interface OfficeTransport {
  postMessage(msg: unknown): void
  onMessage(handler: (msg: unknown) => void): () => void
}
// VS Code:  setOfficeTransport({ postMessage: vscode.postMessage, ... })
// Electron: setOfficeTransport({ postMessage: electronAPI.send, ... })
```
