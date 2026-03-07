---
title: Eval Dashboard Overview
description: Electron-based evaluation dashboard for visualizing skill benchmarks, agent traces, and grading results.
outline: [2, 3]
---

# Eval Dashboard Overview

| Property | Value |
|----------|-------|
| Location | `prism-eval/` |
| Runtime | Electron 40, React 19, TypeScript |
| Build | Electron Forge + Vite |
| Styling | Tailwind CSS v4 |
| Charts | Recharts |
| Layout | Dagre (DAG layout for agent traces) |
| Source files | 52 TypeScript/TSX files (~1,278 lines) |
| Window title | "Prism Admin — Eval Dashboard" |

## Purpose

When the `prism-eval` skill runs evaluations, it produces structured JSON output (`benchmark.json`, `grading.json`, `timing.json`) under `.prism/shared/evals/`. The Eval Dashboard reads these workspaces and presents the data across five interactive screens, enabling developers to:

- Monitor aggregate skill health across versions
- Drill into individual eval case pass/fail grades with evidence
- Replay agent execution traces as DAG visualizations
- Compare benchmark metrics (pass rate, tokens, time) between versions
- Visualize the skill dependency graph

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Main Process (src/main.ts)                             │
│  ├── Window management (1024x680 min, state persisted)  │
│  ├── IPC: eval:selectDirectory → file picker dialog     │
│  └── IPC: eval:loadWorkspace → EvalDataService          │
├─────────────────────────────────────────────────────────┤
│  Preload (src/preload.ts)                               │
│  └── contextBridge: electronAPI.selectDirectory/load     │
├─────────────────────────────────────────────────────────┤
│  Renderer (React 19 SPA)                                │
│  ├── AppShell (Sidebar + TopBar + content area)         │
│  ├── DataContext (workspace data provider)              │
│  ├── NavigationContext (screen routing)                 │
│  ├── EvalContext (eval selection state)                 │
│  ├── TraceContext (trace playback state)                │
│  └── 5 screens (see below)                             │
└─────────────────────────────────────────────────────────┘
```

## Data Flow

```
.prism/shared/evals/<version>/workspace/iteration-N/
    │
    ├── benchmark.json          ──→  Benchmarks screen
    ├── <skill>-eval-<id>/
    │   ├── eval_metadata.json  ──→  EvalExplorer (assertions)
    │   ├── grading.json        ──→  EvalExplorer (pass/fail)
    │   ├── timing.json         ──→  Benchmarks (token/time)
    │   └── with_skill/
    │       └── outputs/        ──→  EvalExplorer (full output)
    │
    └── WorkspaceSelector ──→ user picks iteration directory
```

The `EvalDataService` (main process) reads the workspace directory, parses all JSON files, and sends structured data to the renderer via IPC.

## Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Desktop runtime | Electron | 40.0.0 |
| UI framework | React | 19.2.4 |
| Build tooling | Electron Forge + Vite | 7.11.1 / 5.4.21 |
| Styling | Tailwind CSS | v4.2.1 |
| Charts | Recharts | 3.8.0 |
| DAG layout | Dagre | 0.8.5 |
| Language | TypeScript | ~4.5.4 |
