---
date: 2026-02-28T00:00:00Z
author: Claude
repository: prism-plugin
branch: main
topic: "Prism Electron App — V2 UI (VS Code-style layout)"
status: complete
plan: ".prism/shared/plans/2026-02-28-prism-electron-v2-ui.md"
---

# Prism Electron App — V2 UI Research

> Research for integrating the rails-based VS Code-style layout (prototype: `.prism/shared/ref/electron-ui/prism-electron-rails-prototype-v2.jsx`) into the existing `cmd/prism-electron/` app. The implementation spec is at `.prism/shared/ref/electron-ui/prism-electron-v2-implementation-spec.md`.

---

## Summary

The prism-electron app is a fully functional Electron desktop app (all 5 phases of the shared-architecture plan complete). The current UI is a simple 2-view router: chat ↔ spectrum, with a WelcomeView for first-time users. The V2 UI adds a full VS Code-style shell — activity bars, collapsible left/right content rails, a tab system for center content, a bottom panel with Pixel Office animation, and a GitKraken-style commit graph — wrapping the existing ChatView and spectrum components. The integration requires: a new `LayoutContext`, replacing `App.tsx` with an `AppShell`, adding 4 IPC handlers, and new layout/rail/tab components.

---

## Files Discovered

### Existing Prism-Electron Source

| Path | Description |
|------|-------------|
| `cmd/prism-electron/webview-ui/src/App.tsx` | Root React component — current 2-view router (chat/spectrum/welcome/loading) |
| `cmd/prism-electron/webview-ui/src/Providers.tsx` | Provider wrapper — currently just `<PrismStateContextProvider>` |
| `cmd/prism-electron/webview-ui/src/electron.ts` | Electron IPC transport adapter |
| `cmd/prism-electron/webview-ui/src/context/PrismStateContext.tsx` | Global state — stories, spectrum, chat, workflow phase |
| `cmd/prism-electron/webview-ui/src/views/ChatView.tsx` | Chat interface — no props, reads from context |
| `cmd/prism-electron/webview-ui/src/views/SpectrumView.tsx` | Spectrum dashboard — prop: `onBack: () => void` |
| `cmd/prism-electron/webview-ui/src/components/WelcomeView.tsx` | First-time onboarding |
| `cmd/prism-electron/webview-ui/src/components/workflow/PhaseIndicator.tsx` | Phase header + transition buttons |
| `cmd/prism-electron/webview-ui/src/components/spectrum/*.tsx` | SpectrumControls, ProgressBar, SignalStatus, StoryList, ActivityLog |
| `cmd/prism-electron/webview-ui/src/services/grpc-client.ts` | 6 service clients (State, UI, Workflow, Chat, Plugin, Spectrum) |
| `cmd/prism-electron/webview-ui/src/theme/theme.css` | `--prism-*` CSS variables (dark theme) |
| `cmd/prism-electron/webview-ui/src/theme/spectral.css` | Phase color system, gradient definitions, animations |
| `cmd/prism-electron/src/hosts/electron/ElectronIPCBridge.ts` | IPC handler registration |
| `cmd/prism-electron/src/hosts/electron/ElectronPrismController.ts` | Main process controller |
| `cmd/prism-electron/src/preload.ts` | contextBridge — exposes `window.electronAPI` |

### Reference Files

| Path | Description |
|------|-------------|
| `.prism/shared/ref/electron-ui/prism-electron-rails-prototype-v2.jsx` | Self-contained React prototype with all V2 UI features |
| `.prism/shared/ref/electron-ui/prism-electron-v2-implementation-spec.md` | Full spec: design tokens, layout, components, IPC, stories |
| `.prism/shared/plans/2026-02-28-prism-electron-shared-architecture.md` | Completed 5-phase shared architecture plan |

---

## Current App Architecture

### View Routing (App.tsx)

The current `App.tsx` routes between 4 states using a simple `currentView: "chat" | "spectrum"` state variable:

```
isHydrated=false → <LoadingView /> (centered "Loading Prism...")
currentView="spectrum" → <SpectrumView onBack={() => setCurrentView("chat")} />
!hasPrismDir → <WelcomeView />
default → <ChatView /> + optional Spectrum pill button
```

The outer container is a `100vh` flex column using `--prism-bg`, `--prism-fg`, `--prism-font-family`, `--prism-font-size`.

### State Available via PrismStateContext

The `usePrismState()` hook provides `PrismExtensionState`:

| Field | Type | Available for V2 UI |
|-------|------|---------------------|
| `stories` | `PrismStory[]` | StoriesPanel (StoryList) |
| `spectrum` | `PrismSpectrumState` | SpectrumPanel (controls, progress, logs) |
| `chatMessages` | `PrismChatMessage[]` | ChatView (existing) |
| `workflowPhase` | `WorkflowPhase` | StatusBar phase buttons |
| `hasPrismDir` | `boolean` | WelcomeView trigger |
| `hasStoriesJson` | `boolean` | StoriesPanel gating |
| `hasClaudeCli` | `boolean` | SpectrumControls gating |
| `isChatStreaming` | `boolean` | ChatView (existing) |
| `plan` | `object \| null` | StoriesPanel plans section |

### Existing CSS Variables

`theme.css` defines:
- `--prism-bg`: `#1a1b2e` (main background)
- `--prism-bg-panel`: `#16172b`
- `--prism-bg-editor`: `#12131f`
- `--prism-bg-input`: `#252640`
- `--prism-fg`, `--prism-fg-muted`, `--prism-fg-disabled`, `--prism-fg-active`
- `--prism-border`: `#2d2e4a`
- `--prism-font-family`: Inter/system-ui
- `--prism-font-mono`: ui-monospace/Cascadia Code

`spectral.css` defines:
- `--prism-blue`: `#3b82f6` (Research)
- `--prism-teal`: `#14b8a6` (Plan)
- `--prism-green`: `#22c55e` (Implement)
- `--prism-amber`: `#f59e0b` (Validate)
- `--prism-purple`: `#7c3aed`

### Existing IPC Bridge

`ElectronIPCBridge` currently handles:
- `grpc_request` — routes to gRPC handler
- `grpc_request_cancel` — cancels a streaming request
- `shell:openExternal` — opens URLs in system browser
- `prism:openProject` — file dialog for project selection

`window.electronAPI` in the renderer exposes:
- `invoke(channel, data?)` → `ipcRenderer.invoke(channel, data)`
- `on(channel, cb)` → event listener
- `send(channel, data)` → fire-and-forget

---

## V2 UI — What Is Being Added

### Layout Shell

The V2 replaces the simple flex-column `App.tsx` with a full IDE-style shell:

```
TitleBar (32px) — logo, project name, window controls (frameless window)
StatusBar (34px) — health dot, IDLE label, RPIV phase buttons
MainArea (flex row, fill remaining height):
  ActivityBar (left, 44px) — Files / Stories / Git icons + Settings at bottom
  LeftRail (260px, collapsible) — switches between FilesPanel, StoriesPanel, GitPanel
  CenterArea (flex col, flex: 1):
    TabBar (36px) — Chat (pinned) + story/file/git tabs
    CenterContent (flex: 1) — ChatView | StoryDetailView | FileContentView | GitGraphView
    FloatingChatPill (absolute, bottom-right) — returns to chat from any tab
    BottomPanel (180px, toggle) — PixelOffice | Terminal
  RightRail (260px, collapsible) — switches between MonitorPanel, SpectrumPanel, WorkspacePanel
  ActivityBar (right, 44px) — Monitor / Spectrum / Workspace icons
BottomStatusBar (24px) — prism status, stories count, Office toggle
```

### New Context: LayoutContext

A new `LayoutContext.tsx` manages all layout state independently of `PrismStateContext`:

```typescript
interface LayoutState {
  leftPanel: 'files' | 'stories' | 'git';
  rightPanel: 'monitor' | 'spectrum' | 'workspace';
  leftCollapsed: boolean;
  rightCollapsed: boolean;
  tabs: Tab[];
  activeTabId: string;
  bottomOpen: boolean;
  bottomTab: 'office' | 'terminal';
  currentPhase: 'research' | 'plan' | 'implement' | 'validate' | null;
}
interface Tab {
  id: string;      // "chat", "story:STORY-001", "file:App.tsx", "git:graph"
  type: 'chat' | 'story' | 'file' | 'git';
  label: string;
  pinned: boolean; // Chat tab always pinned
}
```

Provider goes inside `Providers.tsx`:
```tsx
<PrismStateContextProvider>
  <LayoutProvider>
    <AppShell />
  </LayoutProvider>
</PrismStateContextProvider>
```

`electron-store` (already in `package.json`) should persist: `leftPanel`, `rightPanel`, `leftCollapsed`, `rightCollapsed`, `bottomOpen`. Tabs reset each session.

### New Components

| Component | File | Purpose |
|-----------|------|---------|
| `AppShell` | `components/layout/AppShell.tsx` | Outer layout container |
| `TitleBar` | `components/layout/TitleBar.tsx` | 32px draggable title bar |
| `StatusBar` | `components/layout/StatusBar.tsx` | 34px RPIV phase bar |
| `ActivityBar` | `components/layout/ActivityBar.tsx` | 44px icon bar (left/right) |
| `ContentRail` | `components/layout/ContentRail.tsx` | Collapsible 260px rail |
| `TabBar` | `components/layout/TabBar.tsx` | 36px tab strip |
| `FloatingChatPill` | `components/layout/FloatingChatPill.tsx` | Floating return-to-chat button |
| `BottomPanel` | `components/layout/BottomPanel.tsx` | 180px toggle panel |
| `BottomStatusBar` | `components/layout/BottomStatusBar.tsx` | 24px status strip |
| `FilesPanel` | `components/panels/FilesPanel.tsx` | File explorer with FileTree |
| `StoriesPanel` | `components/panels/StoriesPanel.tsx` | Story list + phase progress |
| `GitPanel` | `components/panels/GitPanel.tsx` | Git status + staged/unstaged |
| `MonitorPanel` | `components/panels/MonitorPanel.tsx` | System health + exec history |
| `SpectrumPanel` | `components/panels/SpectrumPanel.tsx` | Spectrum controls + logs |
| `WorkspacePanel` | `components/panels/WorkspacePanel.tsx` | Projects + agent kanban |
| `StoryDetailView` | `views/StoryDetailView.tsx` | Story detail in center tab |
| `FileContentView` | `views/FileContentView.tsx` | Code viewer in center tab |
| `GitGraphView` | `views/GitGraphView.tsx` | Git commit graph in center tab |
| `PixelOffice` | `components/office/PixelOffice.tsx` | CSS pixel-art agent scene |
| `CollapsibleSection` | `components/common/CollapsibleSection.tsx` | Accordion for rail panels |
| `StatusDot` | `components/common/StatusDot.tsx` | Color-coded status indicator |

### New IPC Handlers (in ElectronIPCBridge.ts)

```typescript
ipcMain.handle('read-file', async (_, filePath: string) => string)
ipcMain.handle('git-status', async () => { staged: GitFile[], unstaged: GitFile[] })
ipcMain.handle('git-log', async (_, { limit?: number }) => GitCommit[])
ipcMain.handle('git-branch-info', async () => { branch: string, ahead: number, behind: number })
```

### New CSS Variables Needed

The V2 spec uses colors not currently in `theme.css`/`spectral.css`:

| Variable | Value | Usage |
|----------|-------|-------|
| `--bg-base` | `#0f1419` | Main bg (different from current `--prism-bg`) |
| `--bg-surface` | `#141b22` | Status bar, elevated surfaces |
| `--bg-rail` | `#111920` | Left/right rail backgrounds |
| `--bg-panel` | `#0d1117` | Activity bars, bottom panel |
| `--bg-input` | `#1a2332` | Input fields |
| `--bg-hover` | `rgba(255,255,255,0.04)` | Hover states |
| `--border` | `#1e2d3d` | Default borders (different from current `--prism-border`) |
| `--border-active` | `#2a3f54` | Active borders |
| `--text` | `#c9d1d9` | Primary text (different from current `--prism-fg`) |
| `--text-muted` | `#6e7a87` | Secondary text |
| `--text-dim` | `#4a5568` | Timestamps, line numbers |

**Strategy:** Add these as additional CSS vars in `theme.css` alongside the existing `--prism-*` vars. New V2 components use the new tokens; existing components (`ChatView`, etc.) continue using `--prism-*`.

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+B` | Toggle left rail |
| `Ctrl+Shift+B` | Toggle right rail |
| `Ctrl+J` | Toggle bottom panel |
| `Ctrl+1/2/3` | Focus Files/Stories/Git panel |
| `Ctrl+W` | Close active tab |
| `Escape` | Return to Chat tab |

---

## Integration Points

### App.tsx → AppShell.tsx

Current `App.tsx` is the only file to structurally replace. The new `AppShell` wraps all layout zones. The existing views (`ChatView`, `SpectrumView`, `WelcomeView`) are mounted inside the new shell rather than replacing it.

Key behavior change: The WelcomeView may need to be shown as the center content (or overlay) when `!hasPrismDir`, rather than replacing the entire layout.

### ChatView Integration

`ChatView` has no props — it reads everything from `usePrismState()`. It can be mounted directly as the center content when `activeTab.type === "chat"`. No changes to `ChatView.tsx` needed.

### SpectrumPanel vs SpectrumView

The existing `SpectrumView` is a full-page view with a back button. For V2, the spectrum controls/logs live in the right rail `SpectrumPanel`. The existing spectrum components (`SpectrumControls`, `ProgressBar`, `SignalStatus`, `StoryList`, `ActivityLog`) can be reused inside `SpectrumPanel` without modification.

### StoriesPanel Data

`PrismStateContext` already provides `stories: PrismStory[]`, `plan`, `workflowPhase`, `hasStoriesJson`. The `StoriesPanel` directly consumes these via `usePrismState()`.

### Existing Spectrum Components Reusable

All 5 spectrum components (`SpectrumControls`, `ProgressBar`, `SignalStatus`, `StoryList`, `ActivityLog`) can be used directly inside `SpectrumPanel` and `MonitorPanel` with no modifications.

### PhaseIndicator → StatusBar

The existing `PhaseIndicator` and `PhaseTransition` components can be reused in the new `StatusBar` (34px bar), replacing the current header in `ChatView`.

---

## Prototype Analysis

The prototype (`prism-electron-rails-prototype-v2.jsx`) is a standalone, self-contained React component (~1500 lines) with:

- **Color constants** as a `S` object (matching spec exactly)
- **SVG icon components** (Files, Stories, Git, Monitor, Spectrum, Workspace, Folder, Chat, Close, ChevronRight, ChevronDown)
- **`CollapsibleSection`** — accordion with title + chevron + badge, used throughout rails
- **`StatusDot`** — colored indicator with pulse animation for in-progress states
- **`ActivityBar`** (left/right) — 44px column with icon buttons and active border indicator
- **`LeftRail`** — collapsible container with `FilesPanel`, `StoriesPanel`, `GitPanel`
- **`RightRail`** — collapsible container with `MonitorPanel`, `SpectrumPanel`, `WorkspacePanel`
- **`TabBar`** — horizontal tab strip with pinned chat tab and closeable tabs
- **`FloatingChatPill`** — absolutely-positioned pill button with pulsing glow animation
- **`BottomPanel`** — toggled from status bar, contains PixelOffice + Terminal tabs
- **`PixelOffice`** — CSS div-based pixel art scene with animated agents (no canvas API)
- **`StatusBar`** — 34px bar with health dot and RPIV phase buttons
- **`TitleBar`** — 32px bar with logo, project name, window controls
- **`BottomStatusBar`** — 24px bar with Office toggle
- **All mock data** — file tree, story list, git commits, agent list as inline constants
- **State management** — full `useState` hooks for layout state (collapsed, tabs, panels)

The prototype uses all inline styles (no Tailwind/CSS files) with the `S` constant for colors. The implementation should extract these to CSS variables per the spec.

---

## Implementation Stories (from spec)

| Story | Title | Key Deliverables |
|-------|-------|-----------------|
| 1 | Layout Shell + State Context | `LayoutContext.tsx`, outer shell zones (TitleBar, StatusBar, BottomStatusBar), `AppShell.tsx` |
| 2 | Activity Bars + Rail Containers | `ActivityBar.tsx`, `ContentRail.tsx` with collapse behavior |
| 3 | Tab System + Center Router | `TabBar.tsx`, content router, pinned chat tab, `FloatingChatPill.tsx` |
| 4 | Left Rail — StoriesPanel | `StoriesPanel.tsx` with PhaseProgress, StoryList, click → tab |
| 5 | Left Rail — FilesPanel + GitPanel | `FilesPanel.tsx` (FileTree), `GitPanel.tsx`, file/git click → tab |
| 6 | Right Rail — Monitor + Spectrum + Workspace | `MonitorPanel.tsx`, `SpectrumPanel.tsx`, `WorkspacePanel.tsx` |
| 7 | Bottom Panel — Pixel Office | `BottomPanel.tsx`, `PixelOffice.tsx` (CSS pixel art), Terminal tab |
| 8 | IPC Handlers + Real Data | 4 new IPC handlers, replace mock data in FilesPanel/GitPanel/GitGraphView |
| 9 | Keyboard Shortcuts + Polish | Keyboard handlers, electron-store persistence, animation polish |

---

## Open Questions

1. **TitleBar window chrome:** The spec says "frameless window with drag region" — does this require modifying `main.ts` (`frame: false` BrowserWindow option) or should we keep native OS window chrome?

2. **WelcomeView placement:** When `!hasPrismDir`, should the WelcomeView show as an overlay over the AppShell, or replace the center content area entirely?

3. **Font choice:** The spec calls for JetBrains Mono throughout, but the current app uses Inter for UI text and a monospace fallback for code. Should the entire UI switch to JetBrains Mono, or only code/data areas?

4. **Existing SpectrumView:** With SpectrumPanel in the right rail, the full-page `SpectrumView.tsx` may become redundant. Should it be retained as a tab type, removed, or repurposed?

5. **Color token migration:** The V2 spec uses different base colors (`--bg-base: #0f1419`) vs current (`--prism-bg: #1a1b2e`). Should V2 components use new tokens alongside existing ones, or do we migrate all components to the new tokens?

6. **electron-store dependency:** The spec calls for `electron-store` to persist layout state. Confirm it's already in `package.json` (the plan says it was deferred to Phase 5 but installed then using plain `fs` instead due to ESM issues). The current `window-state.ts` uses plain `fs` — same pattern should be used for layout state persistence.
