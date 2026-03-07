---
title: Plugin Statistics
description: Component counts, model assignment distribution, and how the plugin connects to platform implementations.
outline: [2, 3]
---

# Plugin Statistics

## Component Counts

| Category | Files | Total Lines |
|----------|-------|-------------|
| Plugin manifests | 2 | 28 |
| Commands | 25 | 4,023 |
| Agents | 11 | 1,491 |
| Skills (SKILL.md) | 14 | 2,496 |
| Skill references | 9 | ~450 |
| Scripts | 3 (+ 1 Python) | 947 |
| CLAUDE.md | 1 | 115 |
| Hooks | 0 | 0 |
| MCP servers | 0 | 0 |
| **Plugin total** | **~66** | **~9,550** |

## Model Assignment Distribution

| Model | Components | Typical Cost | Use Case |
|-------|------------|-------------|----------|
| **Opus** | 14 assignments | Highest | Deep analysis, planning, document generation |
| **Sonnet** | 22 assignments | Medium | General execution, routing, coordination |
| **Haiku** | 11 assignments | Lowest | Fast lookups, simple operations, file scanning |

## Largest Components

| Component | Type | Lines | Purpose |
|-----------|------|-------|---------|
| `create_plan.md` | Command | 442 | Interactive plan creation — most complex single prompt |
| `prism-spectrum` | Skill | 406 | Autonomous story execution with signal protocol |
| `spectrum.sh` | Script | 312 | Shell loop for autonomous execution |
| `prism` | Skill | 276 | Master orchestrator routing all workflows |
| `decompose_plan.md` | Command | 256 | Plan-to-stories conversion |
| `generate_tech_spec.md` | Command | 252 | Technical specification generation |
| `iterate_plan.md` | Command | 249 | Plan iteration with surgical edits |
| `prism-release` | Skill | 245 | Full release pipeline with eval snapshot |
| `prism-eval` | Skill | 237 | Skill evaluation runner with benchmarking |

## How the Plugin Connects to Platforms

The Claude plugin is the **brain** — the three platform implementations (CLI, VS Code, Electron) are the **body**:

```
┌─────────────────────────────────────────────────────────────────┐
│                    Claude Plugin (Part V)                         │
│   25 commands, 11 agents, 14 skills, 4 scripts                  │
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
