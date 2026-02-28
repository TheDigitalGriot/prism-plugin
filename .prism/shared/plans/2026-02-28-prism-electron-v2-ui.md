---
date: 2026-02-28T00:00:00Z
author: Claude
repository: prism-plugin
branch: main
topic: "Prism Electron App — V2 UI (VS Code-style layout)"
status: draft
research: ".prism/shared/research/2026-02-28-prism-electron-v2-ui.md"
prototype: ".prism/shared/ref/electron-ui/prism-electron-rails-prototype-v2.jsx"
spec: ".prism/shared/ref/electron-ui/prism-electron-v2-implementation-spec.md"
---

# Prism Electron V2 UI — Implementation Plan

> Transform the prism-electron app from a simple 2-view router into a full VS Code-style
> IDE shell with activity bars, collapsible content rails, a tab system, bottom panel with
> Pixel Office animation, and GitKraken-style commit graph.

---

## Goal

Add the V2 UI layout to `cmd/prism-electron/` so the app feels like a purpose-built IDE
for the Prism workflow. The existing ChatView, spectrum components, and PrismStateContext
remain unchanged — they are mounted inside the new shell.

## Decisions (Locked)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Window frame | **Keep native OS frame** | Safest cross-platform; TitleBar becomes styled in-content header |
| Color palette | **Migrate everything to V2 palette** | Unified look; update `--prism-*` CSS vars in `theme.css` |
| SpectrumView | **Defer** | Build SpectrumPanel first, decide later if full-page view is still needed |
| Typography | **Dual fonts** | Inter/system-ui for UI, JetBrains Mono for code/data |
| Layout persistence | **Plain fs** (extend `window-state.ts` pattern) | `electron-store` not installed; ESM compat issues |

---

## What We're NOT Doing

- **No frameless window** — keeping native OS title bar; TitleBar is a styled content header
- **No `electron-store`** — using plain `fs.readFileSync`/`writeFileSync` per existing `window-state.ts` pattern
- **No test infrastructure** — no test framework exists in webview-ui; all verification is manual + type-check
- **No Tailwind for layout** — following existing pattern of inline styles with CSS variables
- **No changes to PrismStateContext** — all new panels consume it via `usePrismState()` as-is
- **No changes to ChatView, spectrum components, or gRPC clients** — mounted unchanged in new shell
- **No multi-window support** — single BrowserWindow, single React app

---

## Success Criteria

### Automated Verification
- [ ] `cd cmd/prism-electron && npm run package` completes without errors (all 3 Vite targets)
- [ ] `cd cmd/prism-electron/webview-ui && npx tsc --noEmit` passes with zero TypeScript errors
- [ ] `npm start` launches the app with the V2 layout

### Manual Verification
- [ ] App window opens with full IDE shell: header bar, left/right activity bars, center content, bottom status bar
- [ ] Left activity bar: clicking Files/Stories/Git icons switches left rail content
- [ ] Right activity bar: clicking Monitor/Spectrum/Workspace icons switches right rail content
- [ ] Clicking active activity bar icon collapses its rail; clicking again reopens
- [ ] Chat tab is always present, always first, always pinned (non-closeable)
- [ ] Clicking a story in StoriesPanel opens StoryDetailView as a center tab
- [ ] Clicking a file in FilesPanel opens FileContentView as a center tab
- [ ] "View Git Graph" button opens GitGraphView as a center tab
- [ ] Tab close works — closing active tab activates the previous tab (or chat as fallback)
- [ ] Floating Chat Pill appears when not on chat tab; clicking returns to chat
- [ ] Bottom panel toggles from status bar "Office" button
- [ ] Pixel agents animate (bob + thinking dots) in the Office view
- [ ] Phase buttons in status bar change visual state
- [ ] Real file tree appears in FilesPanel (from IPC handler)
- [ ] Real git status appears in GitPanel (from IPC handler)
- [ ] Keyboard shortcuts work: Ctrl+B (left rail), Ctrl+Shift+B (right rail), Ctrl+J (bottom panel), Ctrl+W (close tab), Escape (chat tab)
- [ ] Layout state (collapsed rails, active panels, bottom panel) persists across app restarts
- [ ] `npm run make` produces a working distributable

---

## File Change Summary

### New Files (22 files)

**Context:**
| File | Description |
|------|-------------|
| `webview-ui/src/context/LayoutContext.tsx` | Layout state + actions (panels, tabs, collapse, bottom) |

**Layout Components (9 files):**
| File | Description |
|------|-------------|
| `webview-ui/src/components/layout/AppShell.tsx` | Outer layout container — assembles all zones |
| `webview-ui/src/components/layout/HeaderBar.tsx` | 34px bar: logo, project name, health dot, RPIV phase buttons |
| `webview-ui/src/components/layout/ActivityBar.tsx` | 44px icon column (left or right) |
| `webview-ui/src/components/layout/ContentRail.tsx` | Collapsible 260px rail container |
| `webview-ui/src/components/layout/TabBar.tsx` | 36px tab strip with pinned chat |
| `webview-ui/src/components/layout/FloatingChatPill.tsx` | Return-to-chat pill (bottom-right) |
| `webview-ui/src/components/layout/BottomPanel.tsx` | 180px toggle panel (Office + Terminal tabs) |
| `webview-ui/src/components/layout/BottomStatusBar.tsx` | 24px status strip with Office toggle |

**Panel Components (6 files):**
| File | Description |
|------|-------------|
| `webview-ui/src/components/panels/FilesPanel.tsx` | File explorer with recursive FileTree |
| `webview-ui/src/components/panels/StoriesPanel.tsx` | Story list + phase progress + research list |
| `webview-ui/src/components/panels/GitPanel.tsx` | Git status: staged/unstaged changes |
| `webview-ui/src/components/panels/MonitorPanel.tsx` | System health + execution history |
| `webview-ui/src/components/panels/SpectrumPanel.tsx` | Spectrum controls + logs (reuses existing components) |
| `webview-ui/src/components/panels/WorkspacePanel.tsx` | Projects + agent kanban |

**Center Content Views (3 files):**
| File | Description |
|------|-------------|
| `webview-ui/src/views/StoryDetailView.tsx` | Story detail: status, description, files, progress |
| `webview-ui/src/views/FileContentView.tsx` | Code viewer with line numbers + basic syntax highlighting |
| `webview-ui/src/views/GitGraphView.tsx` | GitKraken-style commit graph with lane visualization |

**Common Components (2 files):**
| File | Description |
|------|-------------|
| `webview-ui/src/components/common/CollapsibleSection.tsx` | Accordion with title, chevron, badge |
| `webview-ui/src/components/common/StatusDot.tsx` | Color-coded circle indicator with pulse animation |

**Office Feature (1 file):**
| File | Description |
|------|-------------|
| `webview-ui/src/components/office/PixelOffice.tsx` | CSS pixel-art agent scene with animation |

### Modified Files (5 files)

| File | Change |
|------|--------|
| `webview-ui/src/App.tsx` | Replace routing with `<AppShell />` import; preserve hydration gate + command handler |
| `webview-ui/src/Providers.tsx` | Add `<LayoutProvider>` wrapping |
| `webview-ui/src/theme/theme.css` | Migrate `--prism-*` vars to V2 darker palette; add new tokens |
| `webview-ui/src/theme/spectral.css` | Add V2 animations (chat pill glow, status dot pulse, rail collapse) |
| `src/hosts/electron/ElectronIPCBridge.ts` | Add 4 IPC handlers + dispose cleanup |

### Unchanged Files (consumed by new components)

All files under `webview-ui/src/views/ChatView.tsx`, `webview-ui/src/views/SpectrumView.tsx`, `webview-ui/src/components/WelcomeView.tsx`, `webview-ui/src/components/spectrum/*.tsx`, `webview-ui/src/components/chat/*.tsx`, `webview-ui/src/components/workflow/*.tsx`, `webview-ui/src/components/common/MarkdownBlock.tsx`, `webview-ui/src/context/PrismStateContext.tsx`, `webview-ui/src/services/*.ts`, `webview-ui/src/electron.ts`.

---

## Phase 1 — Foundation (LayoutContext + CSS Migration + AppShell Skeleton)

**Goal:** Create the layout state context, migrate CSS tokens to the V2 palette, and render the AppShell skeleton with all zones as colored placeholders. Existing ChatView is mounted in the center. App launches and chat works.

### Steps

**1.1 — Migrate `theme.css` to V2 palette**

Update `webview-ui/src/theme/theme.css` — change existing `--prism-*` values to match the V2 spec's darker palette:

```css
/* Before → After */
--prism-bg: #1a1b2e → #0f1419
--prism-bg-panel: #16172b → #0d1117
--prism-bg-editor: #12131f → #111920
--prism-bg-input: #252640 → #1a2332
--prism-bg-dropdown: #252640 → #1a2332
--prism-bg-hover: rgb(255 255 255 / 0.05) → rgba(255,255,255,0.04)
--prism-bg-active: rgb(255 255 255 / 0.10) → rgba(255,255,255,0.08)
--prism-fg: #e2e8f0 → #c9d1d9
--prism-fg-muted: #94a3b8 → #6e7a87
--prism-fg-disabled: #64748b → #4a5568
--prism-border: #2d2e4a → #1e2d3d
--prism-scrollbar: rgba(100,100,150,0.4) → rgba(110,122,135,0.4)
--prism-scrollbar-hover: rgba(100,100,150,0.7) → rgba(110,122,135,0.7)
```

Add new V2-specific tokens to the same `:root` block:

```css
/* New V2 layout tokens */
--prism-bg-surface: #141b22;     /* Elevated surfaces, status bar */
--prism-bg-rail: #111920;        /* Left/right rail backgrounds */
--prism-border-active: #2a3f54;  /* Focused/active borders */
--prism-text-dim: #4a5568;       /* Timestamps, line numbers (alias of fg-disabled) */
--prism-font-code: 'JetBrains Mono', 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
```

Also update `index.css` `@theme` block to map the new tokens to Tailwind utilities.

**1.2 — Create `webview-ui/src/context/LayoutContext.tsx`**

New file. Manages all layout state independently of PrismStateContext:

```typescript
// Types
type LeftPanel = 'files' | 'stories' | 'git'
type RightPanel = 'monitor' | 'spectrum' | 'workspace'
type TabType = 'chat' | 'story' | 'file' | 'git'
type BottomTab = 'office' | 'terminal'

interface Tab {
  id: string        // "chat", "story:STORY-001", "file:App.tsx", "git:graph"
  type: TabType
  label: string
  pinned: boolean   // Chat tab always pinned
}

interface LayoutState {
  leftPanel: LeftPanel
  rightPanel: RightPanel
  leftCollapsed: boolean
  rightCollapsed: boolean
  tabs: Tab[]
  activeTabId: string
  bottomOpen: boolean
  bottomTab: BottomTab
}

// Actions exposed via context
interface LayoutActions {
  setLeftPanel: (panel: LeftPanel) => void
  setRightPanel: (panel: RightPanel) => void
  toggleLeftCollapsed: () => void
  toggleRightCollapsed: () => void
  openTab: (tab: Omit<Tab, 'pinned'> & { pinned?: boolean }) => void
  closeTab: (tabId: string) => void
  setActiveTab: (tabId: string) => void
  toggleBottom: () => void
  setBottomTab: (tab: BottomTab) => void
}
```

Default state:
- `leftPanel: 'stories'`, `rightPanel: 'monitor'`
- `leftCollapsed: false`, `rightCollapsed: true`
- `tabs: [{ id: 'chat', type: 'chat', label: 'Chat', pinned: true }]`
- `activeTabId: 'chat'`
- `bottomOpen: false`, `bottomTab: 'office'`

Tab management rules:
- `openTab`: if tab with same `id` exists → activate it (no duplicates); else push + activate
- `closeTab`: cannot close pinned tabs; if closing active tab → activate previous tab or fallback to 'chat'
- Chat tab is always present, always first

Panel toggle behavior:
- `setLeftPanel(panel)`: if panel === current and not collapsed → collapse; if collapsed → uncollapse with new panel; else switch panel
- Same for `setRightPanel`

**1.3 — Add `<LayoutProvider>` to `Providers.tsx`**

Modify `webview-ui/src/Providers.tsx` (currently line 10-12):

```tsx
export const PrismProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <PrismStateContextProvider>
      <LayoutProvider>
        {children}
      </LayoutProvider>
    </PrismStateContextProvider>
  )
}
```

**1.4 — Create `webview-ui/src/components/common/StatusDot.tsx`**

Reusable status indicator:
- Props: `status: 'complete' | 'in_progress' | 'running' | 'pending'`, `size?: number` (default 8)
- Colors: complete=`--prism-green` (solid), in_progress/running=`--prism-amber` (hollow + pulse), pending=`--prism-text-dim` (solid)
- Pulse animation: CSS `@keyframes` for opacity 1→0.4→1 over 2s

**1.5 — Create `webview-ui/src/components/common/CollapsibleSection.tsx`**

Reusable accordion:
- Props: `title: string`, `defaultOpen?: boolean` (default true), `badge?: string | number`, `children: ReactNode`
- 10.5px uppercase title, letter-spacing 0.08em, font-weight 600
- Chevron rotates 90° on toggle (0.15s transition)
- Optional badge count right-aligned

**1.6 — Create `webview-ui/src/components/layout/AppShell.tsx`**

Skeleton layout container. All zones render with colored placeholder divs for now:

```
┌──────────────────────────────────────────────────────┐
│ HeaderBar (34px) — logo + project name + phase buttons │
├────┬─────────┬────────────────────────┬─────────┬────┤
│ L  │  Left   │ TabBar (36px)          │  Right  │ R  │
│ A  │  Rail   ├────────────────────────│  Rail   │ A  │
│ c  │ (260px) │ Center Content         │ (260px) │ c  │
│ t  │         │ (ChatView here)        │         │ t  │
│ b  │         │                        │         │ b  │
│ a  │         │  [FloatingChatPill]    │         │ a  │
│ r  │         ├────────────────────────│         │ r  │
│(44)│         │ BottomPanel (180px)    │         │(44)│
├────┴─────────┴────────────────────────┴─────────┴────┤
│ BottomStatusBar (24px)                                │
└──────────────────────────────────────────────────────┘
```

Structure:
```tsx
<div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
  <HeaderBar />                              {/* 34px */}
  <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
    <ActivityBar side="left" />              {/* 44px */}
    <ContentRail side="left" />              {/* 260px, collapsible */}
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      <TabBar />                             {/* 36px */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {/* Center content router */}
        {/* FloatingChatPill */}
      </div>
      {bottomOpen && <BottomPanel />}        {/* 180px */}
    </div>
    <ContentRail side="right" />             {/* 260px, collapsible */}
    <ActivityBar side="right" />             {/* 44px */}
  </div>
  <BottomStatusBar />                        {/* 24px */}
</div>
```

For Phase 1: HeaderBar, ActivityBar, ContentRail, TabBar, BottomPanel, BottomStatusBar are all placeholder divs with correct dimensions and background colors. Center content renders `<ChatView />` directly.

**1.7 — Rewrite `App.tsx` to use AppShell**

Replace the current routing logic in `webview-ui/src/App.tsx` (lines 37-137). Keep:
- `usePrismState()` hydration gate (line 73: `if (!state.isHydrated) return <LoadingView />`)
- WelcomeView gate (line 98: `if (!state.hasPrismDir) return <WelcomeView />` — show as center content or overlay)
- Command message handler (lines 46-70) — translate `startSpectrum` to `layout.setRightPanel('spectrum')` + uncollapse

New structure:
```tsx
export const App: React.FC = () => {
  const state = usePrismState()

  if (!state.isHydrated) return <LoadingView />
  if (!state.hasPrismDir) return <WelcomeView />

  return <AppShell />
}
```

Move command handler into AppShell (it needs LayoutContext).

### Checkpoint 1
- [ ] `npm start` launches with the new shell skeleton
- [ ] ChatView renders in center and chat still works
- [ ] V2 darker color palette is applied globally
- [x] `npx tsc --noEmit` passes in webview-ui

---

## Phase 2 — Activity Bars + Collapsible Rails

**Goal:** Implement left/right ActivityBar components and collapsible ContentRail containers with smooth transitions.

### Steps

**2.1 — Create `webview-ui/src/components/layout/ActivityBar.tsx`**

Props:
```typescript
interface ActivityBarProps {
  items: { id: string; label: string; icon: ReactNode; color: string }[]
  activeId: string
  onSelect: (id: string) => void
  side: 'left' | 'right'
  collapsed: boolean
}
```

- 44px wide, full height of main area
- Background: `var(--prism-bg-panel)`
- Border: 1px `var(--prism-border)` on the inner edge
- Icon buttons: 36x36px, centered in 44px column
- Active indicator: 2px colored border on inner edge (left border for left bar, right border for right bar)
- Inactive icons: `opacity: 0.6`
- Hover: `opacity: 1` with 0.15s transition
- Bottom of left bar: Settings icon (gear SVG)

Left bar items:
```typescript
[
  { id: 'files', label: 'Files', icon: <FolderIcon />, color: '--prism-purple' },
  { id: 'stories', label: 'Stories', icon: <ClipboardIcon />, color: '--prism-teal' },
  { id: 'git', label: 'Git', icon: <GitBranchIcon />, color: '--prism-amber' },
]
```

Right bar items:
```typescript
[
  { id: 'monitor', label: 'Monitor', icon: <MonitorIcon />, color: '--prism-blue' },
  { id: 'spectrum', label: 'Spectrum', icon: <SpectrumIcon />, color: '--prism-green' },
  { id: 'workspace', label: 'Workspace', icon: <WorkspaceIcon />, color: '--prism-teal' },
]
```

SVG icons: 20x20px, stroke-based (strokeWidth 1.5), matching the prototype's `I` object (lines 32-40 of the prototype JSX).

**2.2 — Create `webview-ui/src/components/layout/ContentRail.tsx`**

Props:
```typescript
interface ContentRailProps {
  side: 'left' | 'right'
}
```

Reads `leftPanel`/`rightPanel` and `leftCollapsed`/`rightCollapsed` from `useLayout()`.

- Width: 260px when open, 0px when collapsed
- `transition: width 0.2s ease, min-width 0.2s ease`
- `overflow: hidden` (content hidden when collapsed)
- Background: `var(--prism-bg-rail)`
- Border: 1px `var(--prism-border)` on the inner edge
- Rail header: panel title + collapse chevron button (RailHeader sub-component)
- Content: switches between panel components based on `leftPanel`/`rightPanel` state

For Phase 2, panels are placeholder divs with the panel name centered.

**2.3 — Wire ActivityBar + ContentRail into AppShell**

Replace placeholder divs in `AppShell.tsx` with real `<ActivityBar>` and `<ContentRail>` components. Wire `onSelect` to `layout.setLeftPanel()`/`layout.setRightPanel()`.

### Checkpoint 2
- [ ] Left activity bar shows Files/Stories/Git icons; clicking switches left rail content
- [ ] Right activity bar shows Monitor/Spectrum/Workspace icons; clicking switches right rail content
- [ ] Clicking active icon collapses its rail; clicking again reopens
- [ ] Rails animate smoothly (0.2s width transition)
- [ ] Active icon shows colored inner border indicator
- [x] `npx tsc --noEmit` passes

---

## Phase 3 — Tab System + Center Content Router

**Goal:** Implement the TabBar with pinned Chat tab, center content routing, and the FloatingChatPill.

### Steps

**3.1 — Create `webview-ui/src/components/layout/TabBar.tsx`**

Consumes `useLayout()` for `tabs`, `activeTabId`, `closeTab`, `setActiveTab`.

- 36px height, horizontal scroll
- Background: `var(--prism-bg-panel)`
- Bottom border: 1px `var(--prism-border)`
- Each tab:
  - Icon (by type: chat=bubble, story=clipboard, file=doc, git=branch) + label + close button
  - Active: 2px colored top border (chat=blue, story=teal, file=purple, git=amber), `var(--prism-bg)` background
  - Inactive: transparent bg, `var(--prism-fg-muted)` text
  - Pinned: small `●` dot, no close button
  - Close button: appears on hover, 16x16px `×`

**3.2 — Implement center content router in AppShell**

Based on `activeTabId`, render the correct view:
- `"chat"` → `<ChatView />`
- `"story:*"` → `<StoryDetailView storyId={...} />` (placeholder for now)
- `"file:*"` → `<FileContentView filePath={...} />` (placeholder for now)
- `"git:graph"` → `<GitGraphView />` (placeholder for now)

**3.3 — Create `webview-ui/src/components/layout/FloatingChatPill.tsx`**

- Absolutely positioned: `bottom: 16px, right: 16px` (shifts to `bottom: 196px` when bottom panel open)
- Only visible when `activeTabId !== "chat"`
- Pill shape: `border-radius: 20px`, `padding: 8px 16px 8px 12px`
- Background: `linear-gradient(135deg, blue, teal)` with 80% opacity + `backdrop-filter: blur(12px)`
- Contains: Chat icon (speech bubble SVG) + "Chat" label + green status dot (6px)
- Pulsing glow animation: `box-shadow` pulse between `blue@40` and `blue@60`, 3s cycle
- `z-index: 20`
- Click: `layout.setActiveTab('chat')`
- `transition: bottom 0.2s ease`

### Checkpoint 3
- [x] Chat tab is always first, always pinned (no close button)
- [x] Clicking a tab switches center content
- [x] Tab close works; closing active tab falls back to chat
- [x] FloatingChatPill appears when not on chat tab
- [x] Clicking pill returns to chat
- [x] Pill shifts up when bottom panel opens
- [x] `npx tsc --noEmit` passes

---

## Phase 4 — Left Rail Panels (Stories, Files, Git)

**Goal:** Build the three left rail panels with real UI. Story click opens StoryDetailView tab.

### Steps

**4.1 — Create `webview-ui/src/components/panels/StoriesPanel.tsx`**

Consumes `usePrismState()` for `stories`, `workflowPhase`, `plan`, `hasStoriesJson`.
Consumes `useLayout()` for `openTab`.

Sections (using `<CollapsibleSection>`):
1. **Current Phase** — phase label (colored, bold) + story count + thin progress bar (gradient fill, teal→green)
2. **Stories** (default open) — list of all stories with:
   - `<StatusDot>` by status
   - Story ID (muted, 10.5px)
   - Title (12.5px)
   - Step count (e.g. "3/5 steps")
   - Click → `layout.openTab({ id: 'story:' + story.id, type: 'story', label: story.title })`
3. **Research** (default collapsed) — placeholder list of research docs
4. **Plans** (default collapsed) — placeholder

**4.2 — Create `webview-ui/src/components/panels/FilesPanel.tsx`**

File explorer with recursive `FileTree` sub-component.

For Phase 4: uses mock data (hardcoded file tree from prototype lines ~700-730). Phase 8 replaces with real IPC data.

FileTree:
- Recursive component: `{ name, type: 'file'|'dir', children?, language? }`
- Directories: expand/collapse chevrons, 📁 icon (teal tint)
- Files: 📄 icon (muted), optional language badge (9px, dim, right-aligned)
- Indentation: `paddingLeft: 12 + depth * 16`
- Click file → `layout.openTab({ id: 'file:' + path, type: 'file', label: name })`
- Click directory → toggle expand

**4.3 — Create `webview-ui/src/components/panels/GitPanel.tsx`**

For Phase 4: uses mock data. Phase 8 replaces with IPC data.

Sections:
1. **Source Control** header with total change count badge
   - "View Git Graph" button: bordered card with branch icon, teal text, commit count pill
   - Click → `layout.openTab({ id: 'git:graph', type: 'git', label: 'Git Graph' })`
   - Branch name display with ahead/behind indicator
2. **Staged Changes** (using `<CollapsibleSection>`) — file list with status letter badges (A=green, M=amber, D=red)
3. **Changes** — unstaged file list, same format

**4.4 — Wire panels into ContentRail**

Replace placeholder divs in `ContentRail.tsx` with real panel components:
```tsx
// Left rail
switch (leftPanel) {
  case 'files': return <FilesPanel />
  case 'stories': return <StoriesPanel />
  case 'git': return <GitPanel />
}
```

### Checkpoint 4
- [x] StoriesPanel shows stories from PrismStateContext with status dots and step counts
- [x] Clicking a story opens it as a center tab (StoryDetailView placeholder)
- [x] FilesPanel shows mock file tree with expand/collapse
- [x] Clicking a file opens FileContentView placeholder as tab
- [x] GitPanel shows mock staged/unstaged with status badges
- [x] "View Git Graph" button opens GitGraphView placeholder as tab
- [x] CollapsibleSection chevron rotates on toggle
- [x] `npx tsc --noEmit` passes

**Checkpoint**: [x] Phase 4 complete

---

## Phase 5 — Right Rail Panels (Monitor, Spectrum, Workspace)

**Goal:** Build the three right rail panels. SpectrumPanel reuses existing spectrum components directly.

### Steps

**5.1 — Create `webview-ui/src/components/panels/MonitorPanel.tsx`**

Consumes `usePrismState()` for `spectrum`, `stories`.

Sections:
1. **System Health** — `<StatusDot>` + label ("Prism: Idle" / "Prism: Running"), last refresh timestamp
2. **Execution History** — list of completed stories with StatusDot, ID, duration (from `stories.filter(s => s.status === 'complete')`)
3. **Quality Gates** (collapsed by default) — plan's `qualityGates` array rendered as pass/fail badges (mock status)

**5.2 — Create `webview-ui/src/components/panels/SpectrumPanel.tsx`**

Consumes `usePrismState()` for `spectrum`, `stories`, `hasStoriesJson`, `hasClaudeCli`, `completedCount`, `remainingCount`.

Reuses existing components directly:
```tsx
import { SpectrumControls } from '../spectrum/SpectrumControls'
import { ProgressBar } from '../spectrum/ProgressBar'
import { SignalStatus } from '../spectrum/SignalStatus'
import { StoryList } from '../spectrum/StoryList'
import { ActivityLog } from '../spectrum/ActivityLog'
```

Sections:
1. **Spectrum Engine** — execution state label + iteration count, `<ProgressBar>`, `<SpectrumControls>`
2. **Activity Log** — `<ActivityLog>` (scrollable, max 200px)
3. **Signal Status** — `<SignalStatus>`
4. **Stories** — `<StoryList>` (compact)

**5.3 — Create `webview-ui/src/components/panels/WorkspacePanel.tsx`**

Sections:
1. **Projects** — cards with project name, active indicator (teal border + "Open" badge). Data: `state.prismDir` for current project.
2. **Agent Kanban** — status category badges (ACTIVE/THINKING/WAITING/DONE/PAUSED) + agent status cards with pulsing StatusDot. Mock data for now.

**5.4 — Wire panels into ContentRail**

Add right rail panel switching:
```tsx
// Right rail
switch (rightPanel) {
  case 'monitor': return <MonitorPanel />
  case 'spectrum': return <SpectrumPanel />
  case 'workspace': return <WorkspacePanel />
}
```

### Checkpoint 5
- [x] MonitorPanel shows system health and completed story history
- [x] SpectrumPanel renders all spectrum controls and they work (start/pause/stop)
- [x] ProgressBar and SignalStatus display correctly in the rail
- [x] WorkspacePanel shows current project card
- [x] All three panels switch correctly from activity bar
- [x] `npx tsc --noEmit` passes

**Checkpoint**: [x] Phase 5 complete

---

## Phase 6 — Center Content Views

**Goal:** Build the three center content views that render inside tabs: StoryDetailView, FileContentView, GitGraphView.

### Steps

**6.1 — Create `webview-ui/src/views/StoryDetailView.tsx`**

Props: `storyId: string`

Consumes `usePrismState()` to find the story: `state.stories.find(s => s.id === storyId)`.

Layout:
- Status badge: `<StatusDot>` + uppercase label + step count (e.g. "3/5 STEPS")
- Story ID: 20px bold
- Title: 15px muted
- Description block: bordered card with "DESCRIPTION" label header
- Modified files list: teal colored file paths from `story.files[]`
- Progress bar: segmented bar (one segment per step), filled segments use teal→green gradient

**6.2 — Create `webview-ui/src/views/FileContentView.tsx`**

Props: `filePath: string`

For Phase 6: mock file content (hardcoded sample). Phase 8 replaces with IPC `read-file` data.

Layout:
- Line numbers column: 48px wide, right-aligned, `var(--prism-text-dim)` color
- Code content: `var(--prism-font-code)` font family
- Basic keyword syntax highlighting:
  - `import` → purple
  - `class`, `async`, `private`, `export`, `const`, `function` → blue
  - String literals (single/double quotes) → green
  - Comments (`//`, `/* */`) → textDim
  - Default → text color
- Hover highlight on rows: `var(--prism-bg-hover)`

**6.3 — Create `webview-ui/src/views/GitGraphView.tsx`**

For Phase 6: mock commit data (hardcoded from prototype lines ~750-790). Phase 8 replaces with IPC data.

Layout:
- Header: branch name pill + ahead/behind count + Fetch/Pull/Push buttons (disabled/mock)
- Commit list (scrollable), each row:
  - Graph lane (40px): vertical line (2px, `var(--prism-border)`) with commit dots (10px circles)
    - Merge commits: hollow circle with blue border (12px)
    - Regular commits: solid circle, green for Claude, teal for human
  - Commit info: message (12.5px bold), hash (10.5px teal), author, relative time
  - Ref badges: HEAD=green bg, branch names=blue bg, matching text colors

**6.4 — Wire views into AppShell center content router**

```tsx
const activeTab = tabs.find(t => t.id === activeTabId)

switch (activeTab?.type) {
  case 'chat': return <ChatView />
  case 'story': return <StoryDetailView storyId={activeTabId.replace('story:', '')} />
  case 'file': return <FileContentView filePath={activeTabId.replace('file:', '')} />
  case 'git': return <GitGraphView />
  default: return <ChatView />
}
```

### Checkpoint 6
- [x] Clicking a story in StoriesPanel opens StoryDetailView with correct story data
- [x] StoryDetailView shows status, description, files, segmented progress bar
- [x] FileContentView renders mock code with line numbers and basic highlighting
- [x] GitGraphView shows mock commit graph with lanes and ref badges
- [x] Tab switching between all view types works
- [x] `npx tsc --noEmit` passes

**Checkpoint**: [x] Phase 6 complete

---

## Phase 7 — Bottom Panel + Pixel Office

**Goal:** Build the bottom panel container with PixelOffice CSS animation and Terminal tab, plus the BottomStatusBar.

### Steps

**7.1 — Create `webview-ui/src/components/layout/BottomStatusBar.tsx`**

24px height bar at the very bottom.

Contents:
- Left: Prism logo icon (small) + version text (10.5px muted)
- Center: Story count ("3/8 Stories" with spectral gradient text)
- Right: "Office" toggle button (teal text, toggles `layout.bottomOpen`)

**7.2 — Create `webview-ui/src/components/layout/BottomPanel.tsx`**

180px tall, toggled by `layout.bottomOpen`.

Structure:
- Tab bar (30px): "Office" tab + "Terminal" tab (switched by `layout.bottomTab`)
- Connected status: green dot + "connected" text
- Collapse chevron button (calls `layout.toggleBottom()`)
- Content area: renders `<PixelOffice />` or `<TerminalOutput />`

TerminalOutput: simple scrollable `<pre>` with `var(--prism-font-code)`, blinking cursor at bottom. Mock output lines.

**7.3 — Create `webview-ui/src/components/office/PixelOffice.tsx`**

Pure CSS/div-based pixel art scene. No canvas API. All positioned absolutely within a container.

Scene elements:
- **Wall**: 10px strip at top, `var(--prism-bg-rail)` color
- **Floor**: bottom 30px, alternating tile pattern using `repeating-linear-gradient`
- **Wall decorations**: small bordered rectangles at intervals (frames)
- **Plant**: stacked colored divs (green leaves + brown pot)
- **Water cooler**: blue + gray stacked divs

PixelAgent sub-component:
- Animated via `setInterval` (400ms tick)
- Parts: head (12px square, skin color), body (16x18px, agent color), desk, monitor, desk legs
- "Thinking" state: bobbing via `Math.sin(frame * 0.15) * 2`, thinking dots cycle 0→3
- Monitor screen: glows teal when thinking, dim when idle
- Name + status label below

Agent data:
```typescript
const AGENTS = [
  { name: "Claude", color: '#14b8a6', status: "thinking", x: 100 },
  { name: "Researcher", color: '#3b82f6', status: "idle", x: 240 },
  { name: "Validator", color: '#f59e0b', status: "idle", x: 380 },
]
```

Static mock data for now. Future: wire to PrismStateContext spectrum agent state.

**7.4 — Add V2 animations to `spectral.css`**

Add new keyframes and classes:

```css
/* Chat pill glow pulse */
@keyframes prism-pill-glow {
  0%, 100% { box-shadow: 0 0 15px rgba(59,130,246,0.25); }
  50%      { box-shadow: 0 0 25px rgba(59,130,246,0.40); }
}

/* Status dot pulse */
@keyframes prism-dot-pulse {
  0%, 100% { opacity: 1; }
  50%      { opacity: 0.4; }
}

.prism-dot-pulse {
  animation: prism-dot-pulse 2s ease-in-out infinite;
}
```

### Checkpoint 7
- [x] BottomStatusBar shows at bottom of window with Office toggle
- [x] Clicking "Office" opens the bottom panel
- [x] Pixel agents render as CSS divs (head + body + desk + monitor)
- [x] "Thinking" agent bobs and shows cycling dots
- [x] Monitor screens glow when agent is thinking
- [x] Terminal tab shows mock output with blinking cursor
- [x] FloatingChatPill shifts up when bottom panel opens
- [x] `npx tsc --noEmit` passes

**Checkpoint**: [x] Phase 7 complete

---

## Phase 8 — IPC Handlers + Real Data

**Goal:** Add 4 IPC handlers to the main process and wire panels to live data instead of mocks.

### Steps

**8.1 — Add IPC handlers to `src/hosts/electron/ElectronIPCBridge.ts`**

Add to `_registerHandlers()` method (after line 71):

```typescript
// Read file content (for FileContentView)
ipcMain.handle('prism:readFile', async (_event, filePath: string) => {
  // Security: resolve relative to project dir, reject traversal
  if (!this._currentProjectDir) return { ok: false, error: 'No project open' }
  const resolved = path.resolve(this._currentProjectDir, filePath)
  if (!resolved.startsWith(this._currentProjectDir)) {
    return { ok: false, error: 'Path traversal rejected' }
  }
  try {
    const content = await fs.promises.readFile(resolved, 'utf-8')
    return { ok: true, content }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
})

// Git status (for GitPanel)
ipcMain.handle('prism:gitStatus', async () => {
  if (!this._currentProjectDir) return { ok: false, error: 'No project open' }
  try {
    const { execSync } = require('child_process')
    const raw = execSync('git status --porcelain', {
      cwd: this._currentProjectDir, encoding: 'utf-8'
    })
    // Parse --porcelain output into staged/unstaged arrays
    const staged: Array<{ path: string; status: string }> = []
    const unstaged: Array<{ path: string; status: string }> = []
    for (const line of raw.split('\n').filter(Boolean)) {
      const index = line[0], worktree = line[1]
      const filePath = line.slice(3)
      if (index !== ' ' && index !== '?') staged.push({ path: filePath, status: index })
      if (worktree !== ' ') unstaged.push({ path: filePath, status: worktree === '?' ? 'U' : worktree })
    }
    return { ok: true, staged, unstaged }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
})

// Git log (for GitGraphView)
ipcMain.handle('prism:gitLog', async (_event, opts?: { limit?: number }) => {
  if (!this._currentProjectDir) return { ok: false, error: 'No project open' }
  try {
    const { execSync } = require('child_process')
    const limit = opts?.limit ?? 50
    const raw = execSync(
      `git log -${limit} --format="%H%n%h%n%an%n%ar%n%s%n%D%n---"`,
      { cwd: this._currentProjectDir, encoding: 'utf-8' }
    )
    // Parse into commit objects
    const commits = raw.split('---\n').filter(Boolean).map(block => {
      const [hash, shortHash, author, time, message, refs] = block.trim().split('\n')
      return { hash, shortHash, author, time, message, refs: refs || '' }
    })
    return { ok: true, commits }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
})

// Git branch info (for GitPanel header)
ipcMain.handle('prism:gitBranchInfo', async () => {
  if (!this._currentProjectDir) return { ok: false, error: 'No project open' }
  try {
    const { execSync } = require('child_process')
    const branch = execSync('git rev-parse --abbrev-ref HEAD', {
      cwd: this._currentProjectDir, encoding: 'utf-8'
    }).trim()
    let ahead = 0, behind = 0
    try {
      const counts = execSync(`git rev-list --left-right --count HEAD...@{upstream}`, {
        cwd: this._currentProjectDir, encoding: 'utf-8'
      }).trim().split('\t')
      ahead = parseInt(counts[0]) || 0
      behind = parseInt(counts[1]) || 0
    } catch { /* no upstream */ }
    return { ok: true, branch, ahead, behind }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
})
```

Add matching `ipcMain.removeHandler(...)` calls in `dispose()` for all 4 new handlers.

Need to add imports at top of file:
```typescript
import * as path from 'path'
import * as fs from 'fs'
```

**8.2 — Add file tree IPC handler**

```typescript
// File tree listing (for FilesPanel)
ipcMain.handle('prism:fileTree', async (_event, opts?: { depth?: number }) => {
  if (!this._currentProjectDir) return { ok: false, error: 'No project open' }
  try {
    const maxDepth = opts?.depth ?? 4
    const tree = await buildFileTree(this._currentProjectDir, maxDepth)
    return { ok: true, tree }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
})
```

Helper function `buildFileTree` — recursively reads directory, skips `node_modules`, `.git`, `.vite`, `dist`, `out`. Returns `{ name, type: 'file'|'dir', children?, language? }` objects.

**8.3 — Wire FilesPanel to IPC**

Replace mock data in `FilesPanel.tsx`:
```tsx
useEffect(() => {
  window.electronAPI?.invoke('prism:fileTree', { depth: 4 }).then(result => {
    if (result.ok) setFileTree(result.tree)
  })
}, [])
```

**8.4 — Wire GitPanel + GitGraphView to IPC**

Replace mock data:
- `GitPanel`: call `prism:gitStatus` + `prism:gitBranchInfo` on mount and on file change events
- `GitGraphView`: call `prism:gitLog` on mount

**8.5 — Wire FileContentView to IPC**

Replace mock content:
```tsx
useEffect(() => {
  window.electronAPI?.invoke('prism:readFile', filePath).then(result => {
    if (result.ok) setContent(result.content)
  })
}, [filePath])
```

### Checkpoint 8
- [ ] FilesPanel shows real project file tree
- [ ] GitPanel shows real staged/unstaged changes
- [ ] GitGraphView shows real commit history
- [ ] FileContentView displays real file content with syntax highlighting
- [ ] Opening a file from FilesPanel shows its real content
- [ ] No path traversal possible via prism:readFile (security check)
- [ ] `npx tsc --noEmit` passes

---

## Phase 9 — Keyboard Shortcuts + Persistence + Polish

**Goal:** Implement keyboard shortcut handlers, persist layout state across restarts, and final visual polish.

### Steps

**9.1 — Add keyboard shortcuts in AppShell**

Add a `useEffect` with `keydown` listener in `AppShell.tsx`:

```typescript
useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    const ctrl = e.ctrlKey || e.metaKey

    if (ctrl && !e.shiftKey && e.key === 'b') {
      e.preventDefault()
      layout.toggleLeftCollapsed()
    }
    if (ctrl && e.shiftKey && e.key === 'B') {
      e.preventDefault()
      layout.toggleRightCollapsed()
    }
    if (ctrl && !e.shiftKey && e.key === 'j') {
      e.preventDefault()
      layout.toggleBottom()
    }
    if (ctrl && e.key === '1') { e.preventDefault(); layout.setLeftPanel('files') }
    if (ctrl && e.key === '2') { e.preventDefault(); layout.setLeftPanel('stories') }
    if (ctrl && e.key === '3') { e.preventDefault(); layout.setLeftPanel('git') }
    if (ctrl && e.key === 'w') {
      e.preventDefault()
      layout.closeTab(layout.activeTabId)
    }
    if (e.key === 'Escape') {
      layout.setActiveTab('chat')
    }
  }
  window.addEventListener('keydown', handler)
  return () => window.removeEventListener('keydown', handler)
}, [layout])
```

**Note**: Ctrl+B may conflict with the native `Edit > Bold` accelerator if `role: 'editMenu'` is used. May need to remove/customize the Edit menu in `src/main.ts` (line 81).

**9.2 — Persist layout state**

Extend the `window-state.ts` pattern. Add layout fields to the saved state:

In `LayoutContext.tsx`, on state change, call `window.electronAPI?.invoke('prism:saveLayoutState', state)`.

New IPC handlers in `ElectronIPCBridge.ts`:
```typescript
ipcMain.handle('prism:saveLayoutState', async (_event, state) => {
  // Save to prism-layout-state.json in app.getPath('userData')
})
ipcMain.handle('prism:loadLayoutState', async () => {
  // Read from prism-layout-state.json
})
```

`LayoutContext` loads initial state on mount via `prism:loadLayoutState`. Debounce saves (500ms) to avoid excessive disk writes.

Persisted fields: `leftPanel`, `rightPanel`, `leftCollapsed`, `rightCollapsed`, `bottomOpen`.
NOT persisted: `tabs`, `activeTabId`, `bottomTab` — these reset each session.

**9.3 — Create `webview-ui/src/components/layout/HeaderBar.tsx`**

Replace the placeholder with the real 34px header bar:
- Left: Prism prism icon (small SVG) + project folder name (from `state.prismDir`)
- Center: RPIV phase buttons — reuse phase data from `PhaseIndicator`:
  - 4 buttons: Research / Plan / Implement / Validate
  - Active phase: colored background tint + bold text
  - Click: triggers `WorkflowServiceClient.transition()`
- Right: health dot (`<StatusDot>`) + status label ("IDLE" / "RUNNING")

**9.4 — Visual polish pass**

- Verify all animations: rail collapse (0.2s ease), tab transitions (0.1s), section chevron rotation (0.15s), chat pill glow (3s), status dot pulse (2s), pixel agent bob
- Verify all hover states: activity bar icons, tab items, file tree items, story list items
- Verify spectral gradient bar still renders correctly in new layout
- Verify scrollbar styling in all scrollable areas (panels, code viewer, logs)
- Verify `WelcomeView` renders correctly when `!hasPrismDir` (centered in window, no shell)

**9.5 — Wire command message handler**

Move the existing `App.tsx` message handler (lines 46-70) into `AppShell`. Translate commands to layout actions:
- `startSpectrum` → `layout.setRightPanel('spectrum')` + ensure right rail open
- `startPhase` → `layout.setActiveTab('chat')`
- `spectrumPause` / `spectrumStop` → pass through to `SpectrumServiceClient` (unchanged)

### Checkpoint 9 (Final)
- [ ] All keyboard shortcuts work (Ctrl+B, Ctrl+Shift+B, Ctrl+J, Ctrl+1/2/3, Ctrl+W, Escape)
- [ ] Layout state persists across app restarts (collapsed rails, active panels, bottom panel)
- [ ] HeaderBar shows project name and RPIV phase buttons
- [ ] All animations are smooth and match spec timings
- [ ] WelcomeView shows correctly for new users
- [ ] Command message handler works (spectrum/phase commands from main process)
- [ ] `npm run package` succeeds
- [ ] `npm run make` produces working distributable

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Color palette migration breaks existing components | ChatView/spectrum components may look wrong with new darker tokens | All existing components use CSS vars — they inherit automatically. Visual spot-check each component after migration. |
| Keyboard shortcut conflicts with native menu | Ctrl+B conflicts with Edit menu accelerator | Customize Edit menu in main.ts to remove Bold accelerator, or use different keybinding |
| Git command execution in IPC handlers | Shell injection via malicious filenames | Use `execSync` with `cwd` option (not string interpolation of paths). `readFile` handler validates path doesn't escape project dir. |
| Large file trees cause performance issues | `prism:fileTree` scanning deep repos | Cap depth at 4 levels. Skip `node_modules`, `.git`, `.vite`, `dist`, `out`. Lazy-load subdirectories on expand. |
| 22 new component files increase bundle size | Slower app startup | All components are simple inline-style React — no heavy dependencies. Lazy-load tab content views with `React.lazy()` if needed. |
| Pixel Office animation causes CPU usage | Agent animation `setInterval` runs continuously | Only run intervals when bottom panel is open. Clear intervals on unmount. |

---

## Edge Cases

- **No project open**: AppShell should handle `!state.hasPrismDir` gracefully — show WelcomeView as center content while shell is still rendered (or show WelcomeView without shell as current behavior)
- **Zero stories**: StoriesPanel should show "No stories.json found" placeholder with link to create one
- **No git repo**: GitPanel should show "Not a git repository" message if `git status` fails
- **Very long file paths**: Tab labels should truncate with ellipsis (max-width with `text-overflow: ellipsis`)
- **Many open tabs**: TabBar should horizontal-scroll when tabs exceed container width
- **Rapid panel switching**: Debounce layout state saves to avoid file system thrashing
- **Window resize**: Rails should respect min-width of 0 when collapsed; center area has implicit min-width from flex

---

## Reference Files

- Research: [.prism/shared/research/2026-02-28-prism-electron-v2-ui.md](.prism/shared/research/2026-02-28-prism-electron-v2-ui.md)
- Prototype: [.prism/shared/ref/electron-ui/prism-electron-rails-prototype-v2.jsx](.prism/shared/ref/electron-ui/prism-electron-rails-prototype-v2.jsx)
- Spec: [.prism/shared/ref/electron-ui/prism-electron-v2-implementation-spec.md](.prism/shared/ref/electron-ui/prism-electron-v2-implementation-spec.md)
- Shared architecture plan: [.prism/shared/plans/2026-02-28-prism-electron-shared-architecture.md](.prism/shared/plans/2026-02-28-prism-electron-shared-architecture.md)
