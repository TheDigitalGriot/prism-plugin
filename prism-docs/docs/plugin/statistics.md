---
title: Plugin Statistics
description: Component counts, model assignment distribution, and how the plugin connects to platform implementations.
outline: [2, 3]
---

# Plugin Statistics

## Component Counts <small>(v3.2.0)</small>

| Category | Files | Total Lines | Change from v3.1.1 |
|----------|-------|-------------|---------------------|
| Plugin manifests | 2 | 28 | — |
| Commands | 25 | 4,051 | — |
| Agents | 14 | ~1,750 | — |
| Skills (SKILL.md) | 20 | ~2,975 | +2 (prism-subagent, prism-dispatch) |
| Skill references | 25 | ~5,500 | +6 (prism-subagent references: dispatch-protocol, status-protocol, review-decision-matrix, retry-ladder, state-schema, domain-hints) |
| Scripts | 12 | ~2,680 | +1 (extract-tasks.py ~280 lines); pre-compact.py +39 lines, post-compact.py +13 lines |
| CLAUDE.md | 1 | 116 | +1 line (prism-subagent in execution-models table) |
| Hooks | 7 events | ~40 | — |
| MCP servers | 2 | — | — |
| **Plugin total** | **~108** | **~17,140** | +2 skills, +1 script, +6 references |

## Component Counts <small>(v3.0.3, historical)</small>

| Category | Files | Total Lines | Change from v3.0.2 |
|----------|-------|-------------|---------------------|
| Plugin manifests | 2 | 28 | — |
| Commands | 25 | 4,051 | — |
| Agents | 14 | ~1,750 | — |
| Skills (SKILL.md) | 18 | ~2,750 | +1 (prism-init) |
| Skill references | 19 | ~2,500 | — |
| Scripts | 11 | ~2,400 | init_prism.py +7 lines (designs/, assets/) |
| CLAUDE.md | 1 | 115 | — |
| Hooks | 7 events | ~40 | — |
| MCP servers | 2 | — | — |
| **Plugin total** | **~99** | **~13,800** | +1 skill, +2 .prism/ dirs |

## Model Assignment Distribution <small>(v3.0.3)</small>

| Model | Components | Typical Cost | Use Case |
|-------|------------|-------------|----------|
| **Opus** | 16 assignments | Highest | Deep analysis, planning, document generation |
| **Sonnet** | 26 assignments | Medium | General execution, routing, coordination |
| **Haiku** | 12 assignments | Lowest | Fast lookups, simple operations, file scanning, project init |

**Dynamic Model Selection (v3.0.3):** Skills can override agent default models at dispatch time based on task complexity. See `skills/prism-spectrum/references/model-selection.md`.

## Largest Components

| Component | Type | Lines | Purpose |
|-----------|------|-------|---------|
| `create_plan.md` | Command | 442 | Interactive plan creation — most complex single prompt |
| `spectrum.sh` | Script | 518 | Shell loop with deterministic operations |
| `decompose_plan.md` | Command | 334 | Plan-to-stories with manifests and contracts |
| `prism` | Skill | 276 | Master orchestrator routing all workflows |
| `prism-spectrum` | Skill | 254 | Manifest-aware story execution with signals |
| `generate_tech_spec.md` | Command | 252 | Technical specification generation |
| `iterate_plan.md` | Command | 249 | Plan iteration with surgical edits |
| `prism-release` | Skill | 245 | Full release pipeline with eval snapshot |
| `prism-eval` | Skill | 237 | Skill evaluation runner with benchmarking |

## How the Plugin Connects to Platforms

The Claude plugin is the **brain** — the three platform implementations (CLI, VS Code, Electron) are the **body**:

```
┌─────────────────────────────────────────────────────────────────┐
│                    Claude Plugin (Part V)                         │
│   25 commands, 14 agents, 17 skills, 7 hooks, 11 references      │
│   Pure prompt engineering — defines workflows and behavior       │
│                                                                   │
│   Invoked by: claude CLI process                                 │
│   Output to:  .prism/shared/ directory                           │
│   Control:    XML signal protocol                                │
└──────────┬────────────────┬────────────────┬────────────────────┘
           │                │                │
           ▼                ▼                ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────────┐
│  CLI (Part I) │  │ VS Code      │  │ Electron         │
│  Go TUI       │  │ (Part II)    │  │ (Part III)       │
│               │  │ TypeScript   │  │ TypeScript       │
│  Spawns       │  │              │  │                  │
│  claude CLI   │  │  Spawns      │  │  Spawns          │
│  with signal  │  │  claude CLI  │  │  claude CLI      │
│  parsing      │  │  with signal │  │  with signal     │
│               │  │  parsing     │  │  parsing         │
│  Renders:     │  │              │  │                  │
│  Stories,     │  │  Renders:    │  │  Renders:        │
│  Progress,    │  │  Stories,    │  │  V2 IDE shell,   │
│  Logs,        │  │  Chat,       │  │  Chat + Tabs,    │
│  Thinking,    │  │  Trees,      │  │  Files, Git,     │
│  Tool spinners│  │  Office,     │  │  Spectrum,       │
│  Spring anims │  │  Monitor     │  │  Office, Monitor │
└──────────────┘  └──────────────┘  └──────────────────┘

All read/write .prism/ — All parse signal protocol — All spawn claude CLI
```

The plugin's markdown files are loaded by the `claude` CLI process at session start. Every platform spawns `claude` as a child process, and the plugin's skills, commands, and agents shape how that `claude` session behaves. The platforms only provide visualization, user interaction, and process management — the actual workflow intelligence lives in the plugin's prompt engineering.
