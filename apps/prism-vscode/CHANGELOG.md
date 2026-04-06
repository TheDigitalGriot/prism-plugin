# Changelog

All notable changes to the Prism VS Code extension are documented here.

## [2.4.1] — 2026-03-05

### Added
- Chat agent working
- Version display in panel StatusBar (right side, 9px monospace)
- Version passed from controller state via `initialState` message

### Fixed
- Stale version defaults in prism-core DEFAULT_PRISM_STATE and prism-ui DEFAULT_STATE

## [2.1.8] — 2026-02-26

### Added — Phase 7: Polish & Integration

#### Onboarding
- VS Code walkthrough ("Get Started with Prism") with 4 steps: Welcome, Set Up .prism/, Configure Claude, Your First Research
- WelcomeView component shown to first-time users with no `.prism/` directory and no API key
- `UiService.initPrism` gRPC handler — welcome screen can initialize `.prism/` without leaving the sidebar

#### Commands & Keybindings
- `prism.spectrum.start` command with `Ctrl+Shift+S` keybinding (replaces `prism.spectrum`)
- `prism.spectrum.pause` — pause Spectrum from keyboard
- `prism.spectrum.stop` — stop Spectrum from keyboard
- `prism.plan` keybinding `Ctrl+Shift+Alt+P` (avoids VS Code command palette conflict)
- `prism.commit` — trigger `/commit` skill via CLI bridge
- `prism.decompose` — trigger `/decompose_plan` skill
- `prism.handoff` — trigger `/create_handoff` skill
- `prism.describePR` — trigger `/describe_pr` skill

#### Spectral Theme
- Light theme CSS variable overrides (`body.vscode-light`)
- High-contrast theme overrides (`body.vscode-high-contrast`)
- `prism-phase-transition` CSS class for smooth color transitions
- Phase-specific glow animations: `prism-phase-bar-{phase}` classes
- `prism-fade-in` animation for new log entries
- `prism-header-accent` — 2px spectral gradient bar at sidebar top
- Spectral header accent applied to Chat view
- PhaseIndicator uses CSS glow classes instead of static inline border

#### Settings
- `prism.claudeApiKey` — optional API key storage in VS Code settings

#### Packaging
- Removed broken `media/prism-icon.png` reference from `package.json`
- README.md with feature overview, commands table, settings table, architecture
- CHANGELOG.md

---

## [2.1.7] — 2026-02-26

### Added — Phase 6: Spectrum Execution Dashboard

- `SpectrumEngine` state machine (Idle/Running/Paused/Complete/MaxIterations/Error)
- `SpectrumRunner` — per-iteration Claude CLI subprocess executor
- `SpectrumView` webview dashboard with ProgressBar, StoryList, ActivityLog, SignalStatus, SpectrumControls
- `SpectrumServiceClient` gRPC client with start/pause/resume/stop/skipStory/reset
- Chat ↔ Spectrum view routing in `App.tsx`
- `prism.spectrum.start` command and status bar integration

---

## [2.1.6] — 2026-02-26

### Added — Phase 5: Tree Views & Status Bar

- `ResearchTreeDataProvider` — lists `.prism/shared/research/` files with YAML frontmatter metadata
- `PlansTreeDataProvider` — lists `.prism/shared/plans/` with completion status and context menus
- `StoriesTreeDataProvider` — stories with color-coded status icons and expandable steps
- `WorkflowStatusBar` — phase indicator + story progress + Spectrum status in VS Code status bar
- All view/menu contributions in `package.json`
- `onDidChangePrismFile` and `onDidChangeState` events on `PrismController`

---

## [2.1.5] — 2026-02-26

### Added — Phase 4: Claude CLI Integration

- `ClaudeRunner` — spawn Claude CLI with `--output-format stream-json`
- `OutputParser` — tool activity, phase, and signal detection from CLI output
- `PluginBridge` — maps VS Code commands to Prism plugin skills (`/prism-research`, etc.)
- `ModeBridge` — hybrid SDK ↔ CLI mode switching with output bridging
- Skill trigger detection in chat messages

---

## [2.1.4] — 2026-02-26

### Added — Phase 3: Chat UI & Claude Agent SDK

- Full streaming chat interface with `react-virtuoso` virtualization
- `PrismTask` recursive streaming loop with tool-use handling
- 8 tool handlers: ReadFile, WriteFile, EditFile, ExecuteCommand, SearchFiles, ListFiles, AskFollowup, AttemptCompletion
- Tool approval flow (Allow / Deny)
- `MarkdownBlock` with `react-markdown` + syntax highlighting
- Phase-aware system prompts (Research / Plan / Implement / Validate)
- `PhaseIndicator` + `PhaseTransition` components

---

## [2.1.3] — 2026-02-26

### Added — Phase 2: Prism Core Services

- `.prism/` directory detection and initialization
- `FileSystemWatcher` for `.prism/` changes
- `StoriesManager` with stories.json CRUD and dependency resolution
- `WorkflowStateMachine` with phase transition validation
- Signal protocol parser (all 5 signal types)
- 75 unit tests for stories, signals, progress, workflow

---

## [2.1.0] — 2026-02-26

### Added — Phase 1: Foundation

- Extension scaffold with VS Code sidebar webview
- React 18 + Vite + Tailwind v4 webview
- gRPC-over-postMessage IPC bridge
- VS Code CSS variable integration + Prism spectral color system
