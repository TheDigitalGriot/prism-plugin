# Plan: Prism Eval Admin Dashboard

**Date**: 2026-03-07
**Research**: `.prism/shared/research/2026-03-07-prism-eval-admin-dashboard.md`
**PRD Spec**: `.prism/shared/ref/prism-eval/prism-admin-dashboard-spec.md`
**Prototype**: `.prism/shared/ref/prism-eval/prism-admin-dashboard.jsx`
**Target**: `prism-eval/` (Electron 40 + React 19 + TypeScript + Vite starter)
**Status**: Approved

---

## Goal

Build a 5-screen Electron admin dashboard that visualizes eval, benchmark, comparator, and agent trace data from the skill-creator plugin infrastructure. Spectral Observatory design language. All data sourced from skill-creator JSON output files.

---

## Success Criteria

#### Automated Verification
- [ ] `cd prism-eval && npm start` launches the Electron app without errors
- [ ] `cd prism-eval && npm run lint` passes with no errors
- [ ] TypeScript compiles with no errors (`tsc --noEmit`)
- [ ] All 5 screens render with mock data (no blank/broken screens)
- [ ] Navigation between all screens works via sidebar and breadcrumbs
- [ ] Cross-screen click-throughs navigate to correct filtered views

#### Manual Verification
- [ ] Spectral color system matches the prototype visually
- [ ] JetBrains Mono renders for data values, DM Sans for body text
- [ ] Agent Trace DAG playback plays, pauses, scrubs, and changes speed
- [ ] Skill Graph nodes are interactive (click → detail panel)
- [ ] PassRateRing animations are smooth on mount
- [ ] Live feed entries appear with slide-in animation
- [ ] App shell sidebar navigation highlights active screen
- [ ] Eval Explorer detail panel opens/closes on card click
- [ ] Benchmark outgrowth warning renders when gap exists
- [ ] Window minimum size enforced (1024x680)

---

## What We're NOT Doing

- No Monaco editor diff views (deferred)
- No real-time WebSocket/file-tail integration (mock live feed only)
- No Canvas/WebGL rendering (SVG for DAG and graph)
- No imports from `packages/prism-ui/` (standalone app)
- No `d3-force` physics (radial layout for Skill Graph, dagre for DAG)
- No IPC file watchers or directory selection (mock data layer, real data in Phase 8)
- No packaging/distribution (dev mode only)
- No tests (deferred to follow-up)

---

## Decisions

1. **State management**: React Context + useReducer (matches cmd/prism-electron/ pattern)
2. **Charts**: Recharts (lightweight, React-native, bar/line/area)
3. **DAG layout**: dagre (mature, well-documented, SVG-compatible)
4. **CSS**: Tailwind v4 with `@tailwindcss/vite` + `--prism-*` custom properties
5. **Fonts**: JetBrains Mono (data/code) + DM Sans (body/UI) via Google Fonts or local
6. **Routing**: Custom screen state via useReducer (no react-router — single-window app)
7. **Mock data**: Extract from prototype JSX, type as TypeScript interfaces

---

## Phase 1: App Shell + Theme

**Goal**: Sidebar, top bar, screen routing, spectral CSS tokens, fonts installed.

### Steps

- [x] 1.1 Install dependencies:
  ```
  npm install tailwindcss @tailwindcss/vite recharts dagre @types/dagre
  ```
- [x] 1.2 Create `prism-eval/src/theme/spectral.css` — all SPECTRAL color tokens as `--prism-*` CSS custom properties (spec Section 1: Color System)
- [x] 1.3 Create `prism-eval/src/theme/fonts.css` — `@font-face` declarations for JetBrains Mono and DM Sans (or Google Fonts import)
- [x] 1.4 Update `prism-eval/src/index.css` — import Tailwind v4, theme CSS, fonts CSS, add `@theme` block mapping `--prism-*` to Tailwind utilities
- [x] 1.5 Update `prism-eval/vite.renderer.config.mts` — add `@vitejs/plugin-react` (already present) and `tailwindcss()` plugin
- [x] 1.6 Create `prism-eval/src/types/index.ts` — TypeScript interfaces for all data models:
  - `Skill`, `EvalCase`, `GradingResult`, `ComparisonResult`, `AnalysisResult`, `BenchmarkData`, `HistoryData`, `TimingData`, `TraceStep`, `LiveFeedEvent`
- [x] 1.7 Create `prism-eval/src/data/mock-data.ts` — extract mock data from prototype JSX, typed with interfaces
- [x] 1.8 Create `prism-eval/src/context/NavigationContext.tsx` — useReducer with:
  - State: `{ activeScreen, breadcrumbs, params: { skillFilter?, evalId?, traceRunId?, selectedVersion? } }`
  - Actions: `NAVIGATE`, `SET_FILTER`, `SELECT_EVAL`, `SELECT_TRACE`, `SELECT_VERSION`
- [x] 1.9 Create `prism-eval/src/components/layout/Sidebar.tsx` — 220px fixed sidebar with:
  - Logo area (32px spectral gradient "P" + "Prism Admin" + version)
  - 5 navigation items with active indicator (3px spectral gradient left bar)
  - Status footer (green dot + last scan + counts)
- [x] 1.10 Create `prism-eval/src/components/layout/TopBar.tsx` — 44px top bar with:
  - Left: breadcrumb navigation (all screens, active bold)
  - Right: namespace badge + user avatar
- [x] 1.11 Create `prism-eval/src/components/layout/AppShell.tsx` — flexbox layout:
  - Sidebar (220px fixed) + content column (top bar 44px + screen content flex:1)
- [x] 1.12 Update `prism-eval/src/App.tsx` — wrap in NavigationProvider, render AppShell, route to screen placeholders based on activeScreen
- [x] 1.13 Update `prism-eval/src/main.ts` — set minimum window size (1024x680), set title "Prism Admin"

**Checkpoint**: [x] Phase 1 complete

### Verification
```bash
cd prism-eval && npm start
# App launches with sidebar, top bar, and placeholder content
# Clicking sidebar items switches active screen
# Breadcrumbs show all screens, active is bold
# Spectral colors visible on sidebar
```

---

## Phase 2: Shared Components

**Goal**: All reusable components from the spec built and visually verified.

### Steps

- [x] 2.1 Create `prism-eval/src/components/shared/SpectralBar.tsx` — 2px gradient line, configurable max-width (200-320px)
- [x] 2.2 Create `prism-eval/src/components/shared/Badge.tsx` — compact label with colored text on dim background. Props: `label`, `color` (spectral key), `size?`. 10px uppercase JetBrains Mono, 0.08em letter-spacing
- [x] 2.3 Create `prism-eval/src/components/shared/StatCard.tsx` — metric card with icon, uppercase label, 28px JetBrains Mono value, optional subtitle. Props: `icon`, `label`, `value`, `subtitle?`, `color`
- [x] 2.4 Create `prism-eval/src/components/shared/DeltaIndicator.tsx` — inline delta with arrow (▲/▼), percentage, green/red/muted coloring. Props: `delta`, `lowerIsBetter?`
- [x] 2.5 Create `prism-eval/src/components/shared/PassRateRing.tsx` — SVG circular progress. Props: `rate` (0-1), `size` (36/48/56px). Stroke color: green ≥0.8, amber ≥0.6, red <0.6. Animated stroke-dashoffset on mount (800ms ease)
- [x] 2.6 Create `prism-eval/src/components/shared/ExpectationRow.tsx` — pass/fail row with check/cross icon, text, evidence. Props: `text`, `passed`, `evidence`
- [x] 2.7 Create `prism-eval/src/components/shared/SurfaceCard.tsx` — reusable card wrapper with `--prism-surface` background, border, optional header bar. Props: `title?`, `headerRight?`, `children`, `accentColor?`

**Checkpoint**: [x] Phase 2 complete

### Verification
```bash
cd prism-eval && npm start
# Create a temporary "Component Gallery" screen showing all shared components
# Verify visual fidelity against prototype screenshots
```

---

## Phase 3: Mission Control Screen

**Goal**: First real screen — operational overview with stat cards, skill table, live feed, version chart.

### Steps

- [x] 3.1 Create `prism-eval/src/screens/MissionControl.tsx` — layout container:
  - Header ("Mission Control" + subtitle + SpectralBar)
  - Stat cards row (flex, gap:14px, wrap)
  - Two-column section: skill table (2/3) + live feed (1/3)
  - Version progression (full-width bottom)
- [x] 3.2 Implement stat cards row — 4 StatCard components:
  - Avg Pass Rate (green, delta subtitle)
  - Total Evals (blue, coverage subtitle)
  - Skills Improved (teal, baseline subtitle)
  - Total Tokens (amber, "Across all eval runs")
- [x] 3.3 Create `prism-eval/src/components/mission-control/SkillPerformanceTable.tsx`:
  - SurfaceCard with header (title + legend badges CAP/PREF)
  - Rows: PassRateRing (36px) + skill name (JetBrains Mono 13px bold) + metadata + DeltaIndicator + type badge
  - Max-height 340px with overflow scroll
  - Row hover: surfaceHover background
  - Row click: dispatches NAVIGATE to Eval Explorer with skillFilter
- [x] 3.4 Create `prism-eval/src/components/mission-control/LiveFeed.tsx`:
  - SurfaceCard with "Live Feed" header + green pulsing dot
  - Entries: 2px left-edge color bar + type badge (EVAL/TOOL/SPAWN/BENCH/COMPARE/GRADE) + timestamp + description + agent name
  - Mock data: 8-10 events from prototype
  - New entries animate with slide-in (200ms ease-out + teal flash)
- [x] 3.5 Create `prism-eval/src/components/mission-control/VersionProgression.tsx`:
  - Custom SVG BarChart showing pass rate per version (v2.4.5 → v2.4.9)
  - Spectral gradient on latest version bar
  - Percentage labels above bars, version labels below
  - SurfaceCard wrapper
  - Bar click: dispatches NAVIGATE to Benchmarks with version selected

**Checkpoint**: [x] Phase 3 complete

### Verification
```bash
cd prism-eval && npm start
# Mission Control renders with all 4 stat cards
# Skill table shows 13 skills with pass rates, deltas, type badges
# Live feed shows mock events with colored left edges
# Version chart renders 5 bars with labels
# Click skill row → screen switches (placeholder for now)
```

---

## Phase 4: Eval Explorer Screen

**Goal**: Browse eval cases with master-detail split, filtering, score comparison, and grading details.

### Steps

- [x] 4.1 Create `prism-eval/src/context/EvalContext.tsx` — useReducer with:
  - State: `{ evals, selectedEvalId, activeSkillFilter, detailOpen }`
  - Actions: `SELECT_EVAL`, `SET_SKILL_FILTER`, `CLOSE_DETAIL`
  - Computed: filtered evals based on activeSkillFilter
- [x] 4.2 Create `prism-eval/src/screens/EvalExplorer.tsx` — layout:
  - Header + SpectralBar + skill filter chips
  - Two-panel split: eval list (360px when detail open, 100% when closed) + detail panel (flex:1)
- [x] 4.3 Create `prism-eval/src/components/eval-explorer/SkillFilterChips.tsx`:
  - Horizontal chip row: "All (N)" default + one chip per unique skill
  - Active chip: colored border + dim background
  - JetBrains Mono 11px, skill names without `prism-` prefix
- [x] 4.4 Create `prism-eval/src/components/eval-explorer/EvalCard.tsx`:
  - Top: skill badge (teal) + pass count fraction + WIN/LOSE badge
  - Middle: eval prompt text (13px, 2 lines max, text-overflow ellipsis)
  - Bottom: score, token count (K), time in JetBrains Mono
  - Click: dispatches SELECT_EVAL, list narrows to 360px
  - Selected: blue border + surfaceHover
  - Hover on non-selected: borderLight
- [x] 4.5 Create `prism-eval/src/components/eval-explorer/EvalDetailPanel.tsx`:
  - Close button (returns to full-width list)
  - Header: eval ID + prompt as heading
  - Score comparison: 3 side-by-side cards (v2.4.9 green / v2.4.8 amber / No Skill muted)
  - Each card: 24px JetBrains Mono score/5, token count, time
- [x] 4.6 Create `prism-eval/src/components/eval-explorer/ComparatorVerdict.tsx`:
  - Highlighted callout bar: greenDim background, green border
  - Scale icon (⚖) + winner declaration + rubric summary text
  - Data from comparison.json mock
- [x] 4.7 Create `prism-eval/src/components/eval-explorer/ExpectationsPanel.tsx`:
  - SurfaceCard with pass count header
  - ExpectationRow components for each expectation
  - Evidence detail expandable on click

**Checkpoint**: [x] Phase 4 complete

### Verification
```bash
cd prism-eval && npm start
# Navigate to Eval Explorer via sidebar
# Filter chips show all skills, clicking filters the list
# Click eval card → detail panel slides in, list narrows
# Score comparison shows 3 cards with different accent colors
# Comparator verdict shows winner with reasoning
# Expectations show pass/fail with evidence
# Close button returns to full-width list
```

---

## Phase 5: Agent Trace Visualizer

**Goal**: DAG flow visualization of the eval pipeline with playback controls and step details.

### Steps

- [x] 5.1 Create `prism-eval/src/context/TraceContext.tsx` — useReducer with:
  - State: `{ steps, playhead, playing, speed, maxTime, selectedStep, activeSteps }`
  - Actions: `PLAY`, `PAUSE`, `RESET`, `SKIP_TO_END`, `SET_SPEED`, `SET_PLAYHEAD`, `SELECT_STEP`, `TICK`
  - Computed: `activeSteps = steps.filter(s => s.time <= playhead)`
- [x] 5.2 Create `prism-eval/src/screens/AgentTraces.tsx` — layout:
  - DAG canvas (flex:1) + step detail panel (280px right)
  - Playback controls bar below DAG
- [x] 5.3 Create `prism-eval/src/components/traces/DagCanvas.tsx`:
  - Fixed position layout for the eval pipeline topology (fork-join pattern)
  - SVG rendering of nodes and edges
  - Node states: inactive (navyLight fill, dashed edges), active (colored fill 22% opacity, solid edges), running (pulsing glow ring animation)
  - Status dot: green (complete), amber (running), border-gray (pending)
  - Labels: agent name (9px JetBrains Mono bold), action (8px muted)
  - Node colors: blue (orchestration), teal (with_skill), amber (old_skill), green (evaluation)
  - Click node → dispatches SELECT_STEP
- [x] 5.4 Create `prism-eval/src/components/traces/DagNode.tsx`:
  - SVG group: circle + status dot + label text
  - Animated pulsing glow for running state (SVG animate on r and opacity)
  - Active fill transition (300ms)
- [x] 5.5 Create `prism-eval/src/components/traces/DagEdge.tsx`:
  - SVG line from bottom of source to top of target
  - Active: solid teal 2px 88% opacity
  - Inactive: dashed 1px border color
  - Transition on activation
- [x] 5.6 Create `prism-eval/src/components/traces/PlaybackControls.tsx`:
  - Reset, Play/Pause, Skip to End buttons
  - Timeline scrubber: range input with gradient fill
  - Time display: current/max in JetBrains Mono
  - Speed buttons: 1x/2x/4x toggle group (teal highlight on active)
  - Timer logic: setInterval at 100ms, increment by 0.1 * speed
  - Dragging scrubber pauses playback
- [x] 5.7 Create `prism-eval/src/components/traces/StepDetailPanel.tsx`:
  - Agent card: colored border, name, action description
  - Timing section: start, duration, end (JetBrains Mono)
  - Tool calls: vertical list with → prefix, teal tool names
  - Empty state: "Click a node in the DAG to view step details."

**Checkpoint**: [x] Phase 5 complete

### Verification
```bash
cd prism-eval && npm start
# Navigate to Agent Traces
# DAG renders with correct topology (fork-join pattern)
# All nodes start inactive (dashed edges, dim fills)
# Click Play → nodes activate sequentially based on time
# Running nodes pulse with glow animation
# Scrubber moves with playhead, dragging pauses
# Speed buttons change playback rate
# Click node → step detail panel populates
# Reset returns to initial state
```

---

## Phase 6: Benchmark Comparator Screen

**Goal**: Side-by-side version comparison with aggregate metrics, outgrowth warning, and per-skill breakdown.

### Steps

- [x] 6.1 Create `prism-eval/src/screens/Benchmarks.tsx` — layout:
  - Header + SpectralBar
  - Version cards row (3 cards)
  - Metric comparison section (3 rows)
  - Model outgrowth warning
  - Per-skill breakdown table
- [x] 6.2 Create `prism-eval/src/components/benchmarks/VersionCard.tsx`:
  - Label (CURRENT/BASELINE/NO SKILL) uppercase textMuted
  - Version string (20px bold JetBrains Mono, version-colored)
  - PassRateRing (56px) with percentage
  - Token + time stats with ± stddev
  - Current card: 3px spectral gradient top stripe + green-tinted border
- [x] 6.3 Create `prism-eval/src/components/benchmarks/MetricComparison.tsx`:
  - 3 metric rows (Pass Rate, Mean Tokens, Mean Time)
  - Each row: label + delta badge + two horizontal bars (green current, amber baseline)
  - Numeric values at right edge
  - `lowerIsBetter` flag inverts delta color for tokens and time
- [x] 6.4 Create `prism-eval/src/components/benchmarks/OutgrowthWarning.tsx`:
  - Amber-tinted callout with ⚠ icon
  - Without-skill pass rate + gap to with-skill rate
  - Per-skill outgrowth gaps as badge pills
  - Contextual message about capability uplift convergence
- [x] 6.5 Create `prism-eval/src/components/benchmarks/SkillBreakdown.tsx`:
  - Table rows: skill name (JetBrains Mono) + horizontal progress bar + percentage + DeltaIndicator
  - Bar color by pass rate threshold (green/amber/red)
  - Click row → navigates to Eval Explorer filtered to that skill

### Verification
```bash
cd prism-eval && npm start
# Navigate to Benchmarks
# 3 version cards render with correct styling (current has gradient stripe)
# Metric bars show proportional widths with delta badges
# Outgrowth warning shows amber callout with gap data
# Per-skill table shows all skills with progress bars
# Click skill row → navigates to Eval Explorer
```

---

## Phase 7: Skill Graph Screen

**Goal**: Visualize the 13-skill ecosystem as a radial graph with interactive nodes and detail panel.

### Steps

- [x] 7.1 Create `prism-eval/src/screens/SkillGraph.tsx` — layout:
  - Graph canvas (flex:1) + node detail panel (260px right)
  - Legend row above graph
- [x] 7.2 Create `prism-eval/src/components/graph/GraphCanvas.tsx`:
  - SVG viewBox centered on (0,0)
  - Central `prism` meta-router node (teal, 30px radius)
  - 13 skill nodes arranged radially at 200px orbit
  - Node size: 16px + (passRate * 12px)
  - Node fill: color at 22% opacity, inner circle at (passRate * nodeSize) for fill-level effect
  - Dashed edges from central node to all skills (33% opacity)
  - Click node → dispatches SELECT_NODE
  - Selected node: thicker stroke (2.5px vs 1.5px)
- [x] 7.3 Create `prism-eval/src/components/graph/GraphNode.tsx`:
  - SVG group: outer circle (fill), inner circle (fill level), label text
  - Color: blue for capability uplift, amber for encoded preference, teal for meta
  - Label: skill name (without `prism-` prefix) + pass rate %
  - Hover: scale 1.05× via CSS transform
- [x] 7.4 Create `prism-eval/src/components/graph/GraphLegend.tsx`:
  - Horizontal badge row: capability uplift count (blue), encoded preference count (amber), meta router (teal)
- [x] 7.5 Create `prism-eval/src/components/graph/NodeDetailPanel.tsx`:
  - Skill card: name (JetBrains Mono) + type badge with colored border
  - Metrics: 4 rows — pass rate, eval count, delta, token usage
  - Outgrowth status: contextual message based on skill type
    - Capability: "Skill provides X% uplift over base Claude. Still essential." / "Gap narrowing — monitor."
    - Preference: "Durable regardless of model capability improvements."
  - Empty state: "Select a skill node to view details."

### Verification
```bash
cd prism-eval && npm start
# Navigate to Skill Graph
# Central teal node with 13 orbiting skill nodes
# Nodes sized proportionally to pass rate
# Blue nodes for capability uplift, amber for preference
# Click node → detail panel shows metrics and outgrowth status
# Legend shows correct counts per type
```

---

## Phase 8: IPC + Data Layer

**Goal**: Main process loads JSON files from skill-creator workspace directories, renderer receives data via IPC.

### Steps

- [x] 8.1 Update `prism-eval/src/preload.ts` — expose `evalAPI` via contextBridge:
  ```typescript
  contextBridge.exposeInMainWorld('evalAPI', {
    invoke: (channel: string, data?: unknown) => ipcRenderer.invoke(channel, data),
    on: (channel: string, callback: Function) => { /* returns unsubscribe */ },
    selectDirectory: () => ipcRenderer.invoke('eval:selectDirectory'),
  })
  ```
- [x] 8.2 Create `prism-eval/src/types/electron.d.ts` — type declarations for `window.evalAPI`
- [x] 8.3 Create `prism-eval/src/services/EvalDataService.ts` — main process service:
  - `loadWorkspace(dirPath: string)` — reads all JSON files from a skill-creator workspace
  - `loadEvalsJson(path)` → typed `EvalCase[]`
  - `loadGradingJson(path)` → typed `GradingResult`
  - `loadComparisonJson(path)` → typed `ComparisonResult`
  - `loadAnalysisJson(path)` → typed `AnalysisResult`
  - `loadBenchmarkJson(path)` → typed `BenchmarkData`
  - `loadHistoryJson(path)` → typed `HistoryData`
  - `loadTimingJson(path)` → typed `TimingData`
  - Validation: graceful handling of missing/malformed files
- [x] 8.4 Register IPC handlers in `prism-eval/src/main.ts`:
  - `eval:selectDirectory` → `dialog.showOpenDialog({ properties: ['openDirectory'] })`
  - `eval:loadWorkspace` → calls EvalDataService.loadWorkspace
  - `eval:getEvals` → returns loaded evals
  - `eval:getBenchmark` → returns loaded benchmark
  - `eval:getHistory` → returns loaded history
  - `eval:getTraces` → returns loaded trace data
- [x] 8.5 Create `prism-eval/src/context/DataContext.tsx` — useReducer:
  - State: `{ loaded, workspacePath, evals, benchmark, history, traces, error }`
  - Actions: `SET_WORKSPACE`, `LOAD_SUCCESS`, `LOAD_ERROR`
  - On mount: check for previously loaded workspace path
- [x] 8.6 Create `prism-eval/src/components/shared/WorkspaceSelector.tsx`:
  - "Open Workspace" button in sidebar footer or top bar
  - Calls `evalAPI.selectDirectory()`, dispatches SET_WORKSPACE
  - Shows loaded workspace path when connected
- [x] 8.7 Update all screens to consume DataContext instead of direct mock data imports:
  - If `loaded === false`, show mock data with a subtle "Demo Data" badge
  - If `loaded === true`, render real workspace data

### Verification
```bash
cd prism-eval && npm start
# App starts with mock data (Demo Data badge visible)
# Click "Open Workspace" → native directory picker opens
# Select a skill-creator workspace directory
# Screens update with real data from JSON files
# Missing files gracefully show "No data" states
```

---

## Phase 9: Cross-Screen Navigation

**Goal**: All click-through navigation paths from the spec work correctly.

### Steps

- [x] 9.1 Wire Mission Control click-throughs:
  - Skill row click → Eval Explorer with `skillFilter` set
  - Version bar click → Benchmarks with `selectedVersion` set
  - Live feed "View All" → Agent Traces (latest run)
- [x] 9.2 Wire Eval Explorer click-throughs:
  - "View Trace" button in detail → Agent Traces with `traceRunId` set
  - Skill filter chip already working from Phase 4
- [x] 9.3 Wire Benchmark click-throughs:
  - Skill breakdown row → Eval Explorer with `skillFilter` set
  - Outgrowth badge → Skill Graph with skill node pre-selected
- [x] 9.4 Wire Skill Graph click-throughs:
  - "View Evals" button in node detail → Eval Explorer with `skillFilter` set
- [x] 9.5 Update breadcrumb navigation:
  - Track navigation stack in context
  - Breadcrumbs show path (e.g., "Mission Control / Eval Explorer / prism-research")
  - Clicking breadcrumb segment navigates back to that screen with prior params

### Verification
```bash
cd prism-eval && npm start
# From Mission Control: click skill row → Eval Explorer filtered to that skill
# From Mission Control: click version bar → Benchmarks with that version
# From Eval Explorer: click "View Trace" → Agent Traces for that eval
# From Benchmarks: click skill → Eval Explorer filtered
# From Benchmarks: click outgrowth badge → Skill Graph with node selected
# From Skill Graph: click "View Evals" → Eval Explorer filtered
# Breadcrumbs update and allow back-navigation
```

---

## Phase 10: Polish + Animation

**Goal**: All animations from the spec, visual polish, and final refinements.

### Steps

- [x] 10.1 PassRateRing mount animation:
  - Animated `stroke-dashoffset` from 0 → target over 800ms with ease curve
  - Trigger on component mount or data change
- [x] 10.2 Live feed entry animation:
  - New entries slide in from top (200ms ease-out)
  - Brief teal flash on left edge (fade out over 500ms)
- [x] 10.3 Screen transitions:
  - Fade-crossfade between screens (150ms)
  - CSS transition on opacity + transform (slight translateY)
- [x] 10.4 Version progression bar animation:
  - Staggered height growth on mount (each bar delays 80ms, grows over 500ms)
- [x] 10.5 DAG node activation animation:
  - Fill color fades in over 300ms on activation
  - Edge stroke-dashoffset animates from source to target
  - Running glow ring: SVG animate on r (28-36px) and opacity (0.3-0.1), 2s cycle
- [x] 10.6 Skeleton loading states:
  - Shimmer animation (navy → navyLight gradient sweep) for loading cards
  - Show while DataContext is loading workspace
- [x] 10.7 Visual polish pass:
  - Verify all font sizes match spec (JetBrains Mono data values, DM Sans body)
  - Verify all color applications match prototype
  - Verify hover states on interactive elements
  - Verify spacing and gap values match spec
- [x] 10.8 Window management:
  - Minimum size enforced: 1024 × 680
  - Window position/size persistence to userData (follow window-state.ts pattern from cmd/prism-electron/)
  - App title: "Prism Admin — Eval Dashboard"

### Verification
```bash
cd prism-eval && npm start
# PassRateRings animate on mount (smooth 800ms fill)
# Live feed entries slide in with teal flash
# Screen transitions are smooth (no jarring cuts)
# Version bars stagger in on Mission Control load
# DAG nodes glow when running, edges animate on activation
# Loading states show shimmer before data loads
# Window remembers position/size across restarts
# All fonts, colors, and spacing match prototype visually
```

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| dagre layout produces suboptimal DAG positioning | Agent Traces looks wrong | Manually define rank/order hints for the fixed eval pipeline topology |
| Recharts bundle size bloats the app | Slower startup | Only import specific chart components (BarChart, LineChart), not the full package |
| SVG performance with many animated nodes | Janky playback on Skill Graph | Limit to 13 nodes (fixed set), use CSS transforms instead of SVG attribute animation |
| skill-creator JSON schema changes | Data loading breaks | Validate against typed interfaces, show graceful error states for unexpected data |
| Font loading delays (FOUT) | Text flashes unstyled | Bundle fonts locally in assets/ rather than loading from CDN |

---

## Edge Cases

- **Empty workspace**: No JSON files found → show "No eval data found. Run evals with skill-creator first." with link to docs
- **Partial data**: Some JSON files present, others missing → render available screens, show "No data" for missing sections
- **Malformed JSON**: Parse errors → log to console, show error badge on affected screen tab
- **Zero evals**: evals.json exists but empty array → show "No eval cases defined yet" empty state
- **All skills at 100%**: Version progression and delta indicators should handle 0 delta gracefully (muted dash, not green arrow)
- **Large eval sets**: 50+ evals → eval list should virtualize or paginate (deferred, but design for it)
- **history.json with single version**: No comparison possible → version chart shows single bar, benchmark shows "Need 2+ versions to compare"

---

## File Manifest

### New Files (by phase)

```
prism-eval/src/
├── theme/
│   ├── spectral.css                    # Phase 1
│   └── fonts.css                       # Phase 1
├── types/
│   ├── index.ts                        # Phase 1
│   └── electron.d.ts                   # Phase 8
├── data/
│   └── mock-data.ts                    # Phase 1
├── context/
│   ├── NavigationContext.tsx            # Phase 1
│   ├── EvalContext.tsx                  # Phase 4
│   ├── TraceContext.tsx                 # Phase 5
│   └── DataContext.tsx                  # Phase 8
├── services/
│   └── EvalDataService.ts              # Phase 8
├── components/
│   ├── layout/
│   │   ├── AppShell.tsx                # Phase 1
│   │   ├── Sidebar.tsx                 # Phase 1
│   │   └── TopBar.tsx                  # Phase 1
│   ├── shared/
│   │   ├── SpectralBar.tsx             # Phase 2
│   │   ├── Badge.tsx                   # Phase 2
│   │   ├── StatCard.tsx                # Phase 2
│   │   ├── DeltaIndicator.tsx          # Phase 2
│   │   ├── PassRateRing.tsx            # Phase 2
│   │   ├── ExpectationRow.tsx          # Phase 2
│   │   ├── SurfaceCard.tsx             # Phase 2
│   │   └── WorkspaceSelector.tsx       # Phase 8
│   ├── mission-control/
│   │   ├── SkillPerformanceTable.tsx   # Phase 3
│   │   ├── LiveFeed.tsx                # Phase 3
│   │   └── VersionProgression.tsx      # Phase 3
│   ├── eval-explorer/
│   │   ├── SkillFilterChips.tsx        # Phase 4
│   │   ├── EvalCard.tsx                # Phase 4
│   │   ├── EvalDetailPanel.tsx         # Phase 4
│   │   ├── ComparatorVerdict.tsx       # Phase 4
│   │   └── ExpectationsPanel.tsx       # Phase 4
│   ├── traces/
│   │   ├── DagCanvas.tsx               # Phase 5
│   │   ├── DagNode.tsx                 # Phase 5
│   │   ├── DagEdge.tsx                 # Phase 5
│   │   ├── PlaybackControls.tsx        # Phase 5
│   │   └── StepDetailPanel.tsx         # Phase 5
│   ├── benchmarks/
│   │   ├── VersionCard.tsx             # Phase 6
│   │   ├── MetricComparison.tsx        # Phase 6
│   │   ├── OutgrowthWarning.tsx        # Phase 6
│   │   └── SkillBreakdown.tsx          # Phase 6
│   └── graph/
│       ├── GraphCanvas.tsx             # Phase 7
│       ├── GraphNode.tsx               # Phase 7
│       ├── GraphLegend.tsx             # Phase 7
│       └── NodeDetailPanel.tsx         # Phase 7
└── screens/
    ├── MissionControl.tsx              # Phase 3
    ├── EvalExplorer.tsx                # Phase 4
    ├── AgentTraces.tsx                 # Phase 5
    ├── Benchmarks.tsx                  # Phase 6
    └── SkillGraph.tsx                  # Phase 7
```

### Modified Files

```
prism-eval/src/index.css                # Phase 1 (Tailwind + theme imports)
prism-eval/src/App.tsx                  # Phase 1 (AppShell + routing)
prism-eval/src/main.ts                  # Phase 1 (window config), Phase 8 (IPC handlers)
prism-eval/src/preload.ts               # Phase 8 (evalAPI)
prism-eval/vite.renderer.config.mts     # Phase 1 (tailwind plugin)
prism-eval/package.json                 # Phase 1 (new dependencies)
```

### Total: ~45 new files, ~6 modified files
