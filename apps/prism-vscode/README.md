# Prism — AI-Powered Development Workflow for VS Code

Prism is a VS Code extension that delivers the structured 4-phase development workflow: **Research → Plan → Implement → Validate**, powered by Claude AI. It serves as the IDE-first companion to the [Prism CLI](../../cmd/prism-cli/).

## Features

### 🔵 Research Phase
Spawn parallel AI agents to thoroughly document your codebase — architecture, patterns, dependencies, and existing implementations. Output saved to `.prism/shared/research/`.

### 🟦 Plan Phase
Design implementation strategies interactively with Claude. Plans are contracts with explicit success criteria. Output saved to `.prism/shared/plans/`.

### 🟢 Implement Phase
Execute the approved plan phase by phase with verification checkpoints. Claude follows the plan exactly, adapting only when reality differs from expectation.

### 🟡 Validate Phase
Verify every success criterion — automated tests and manual checks — before shipping. Output saved to `.prism/shared/validation/`.

### ◉ Spectrum Autonomous Execution
For large features with many stories, Spectrum runs one story per fresh Claude session in a loop — no context degradation, real-time progress dashboard.

## Prerequisites

- VS Code 1.84+
- Anthropic API key **or** [Claude CLI](https://claude.ai/download) installed
- A workspace with or without an existing `.prism/` directory

## Getting Started

1. Install the Prism extension
2. Open the Prism sidebar (activity bar icon, or `Ctrl+Shift+R`)
3. Follow the **Get Started with Prism** walkthrough (`Help > Get Started`)
4. Initialize `.prism/` in your workspace
5. Start with the Research phase

## Commands

| Command | Keybinding | Description |
|---------|-----------|-------------|
| Start Research Phase | `Ctrl+Shift+R` | Begin documenting the codebase |
| Start Plan Phase | `Ctrl+Shift+Alt+P` | Design the implementation |
| Start Implement Phase | `Ctrl+Shift+I` | Execute the plan |
| Start Validate Phase | `Ctrl+Shift+V` | Verify success criteria |
| Start Spectrum | `Ctrl+Shift+S` | Begin autonomous story execution |
| Open Prism Sidebar | — | Focus the Prism panel |
| Initialize .prism/ | — | Set up .prism/ directory structure |
| Prism Commit | — | Create a Prism-style commit |
| Decompose Plan | — | Convert plan to Spectrum stories |
| Create Handoff | — | Generate session handoff document |
| Generate PR Description | — | Create PR description from changes |

## Tree Views

The Prism activity bar panel contains three native tree views:

- **Research** — lists `.prism/shared/research/` documents with dates and topics
- **Plans** — lists `.prism/shared/plans/` with completion status
- **Stories** — lists stories from `stories.json` with color-coded status icons

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `prism.defaultModel` | `sonnet` | Model for implementation tasks |
| `prism.planningModel` | `opus` | Model for research and planning |
| `prism.spectrum.maxIterations` | `50` | Maximum Spectrum loop iterations |
| `prism.spectrum.pauseSeconds` | `2` | Pause between iterations |
| `prism.autoApprove.readFile` | `true` | Auto-approve file reads |
| `prism.autoApprove.listFiles` | `true` | Auto-approve directory listings |
| `prism.autoApprove.searchFiles` | `true` | Auto-approve file searches |

## Architecture

```
Extension Host (Node.js)
├── PrismController         — Central state + gRPC dispatch
├── WorkflowStateMachine    — Phase transitions (Research→Plan→Implement→Validate)
├── StoriesManager          — stories.json CRUD + dependency resolution
├── SpectrumEngine          — Autonomous execution state machine
├── SpectrumRunner          — Per-iteration Claude CLI spawner
├── PrismTask               — Claude Agent SDK streaming task
└── PluginBridge            — Maps commands to Prism plugin skills

Webview (React 18 + Vite)
├── ChatView                — Streaming chat with tool visualization
├── SpectrumView            — Real-time Spectrum dashboard
├── WelcomeView             — First-time user onboarding
└── Tree Views              — Research / Plans / Stories native views
```

## Building

```bash
cd cmd/prism-vscode

# Install dependencies
npm install
cd webview-ui && npm install && cd ..

# Build extension
npm run compile

# Build webview
npm run build:webview

# Package VSIX (requires vsce)
npm run package
```

## License

MIT — see [LICENSE](../../LICENSE)
