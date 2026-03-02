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
| Commands | 25 | 3,729 |
| Agents | 10 | 1,365 |
| Skills (SKILL.md) | 11 | 1,823 |
| Skill references | 7 | ~350 |
| Scripts | 3 (+ 1 Python) | 947 |
| CLAUDE.md | 1 | 115 |
| Hooks | 0 | 0 |
| MCP servers | 0 | 0 |
| **Plugin total** | **~60** | **~8,357** |

## Model Assignment Distribution

| Model | Components | Typical Cost | Use Case |
|-------|------------|-------------|----------|
| **Opus** | 14 assignments | Highest | Deep analysis, planning, document generation |
| **Sonnet** | 21 assignments | Medium | General execution, routing, coordination |
| **Haiku** | 10 assignments | Lowest | Fast lookups, simple operations, file scanning |

## Largest Components

| Component | Type | Lines | Purpose |
|-----------|------|-------|---------|
| `create_plan.md` | Command | 442 | Interactive plan creation — most complex single prompt |
| `prism-spectrum` | Skill | 376 | Autonomous story execution with signal protocol |
| `spectrum.sh` | Script | 312 | Shell loop for autonomous execution |
| `prism` | Skill | 275 | Master orchestrator routing all workflows |
| `decompose_plan.md` | Command | 256 | Plan-to-stories conversion |
| `generate_tech_spec.md` | Command | 252 | Technical specification generation |
| `iterate_plan.md` | Command | 249 | Plan iteration with surgical edits |

## How the Plugin Connects to Platforms

The Claude plugin is the **brain** — the three platform implementations (CLI, VS Code, Electron) are the **body**:

```
┌─────────────────────────────────────────────────────────────────┐
│                    Claude Plugin (Part V)                         │
│   25 commands, 10 agents, 11 skills, 4 scripts                  │
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
│  Progress,    │  │  Stories,    │  │  Stories,        │
│  Logs,        │  │  Chat,       │  │  Chat,           │
│  Spring       │  │  Trees,      │  │  Spectrum,       │
│  animations   │  │  Office,     │  │  Welcome         │
│               │  │  Monitor     │  │                  │
└──────────────┘  └──────────────┘  └──────────────────┘

All read/write .prism/ — All parse signal protocol — All spawn claude CLI
```

The plugin's markdown files are loaded by the `claude` CLI process at session start. Every platform spawns `claude` as a child process, and the plugin's skills, commands, and agents shape how that `claude` session behaves. The platforms only provide visualization, user interaction, and process management — the actual workflow intelligence lives in the plugin's prompt engineering.
