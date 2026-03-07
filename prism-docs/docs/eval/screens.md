---
title: Eval Dashboard Screens
description: Five interactive screens for mission control, eval exploration, agent traces, benchmarks, and skill graphs.
outline: [2, 3]
---

# Eval Dashboard Screens

## 1. Mission Control

The operational overview screen. Displays:

- **Stat cards**: Average pass rate, total evals run, skills improved, total tokens consumed
- **Skill Performance Table**: All skills with pass rate, eval count, delta, token usage
- **Version Progression**: Line chart showing pass rate trend across versions
- **Live Feed**: Chronological event log of eval runs (EVAL, TOOL, SPAWN, BENCH, COMPARE, GRADE events)
- **Delta Indicators**: Color-coded arrows showing improvement/regression per skill

## 2. Eval Explorer

Drill-down into individual eval cases:

- **Skill Filter Chips**: Filter by skill name
- **Eval Cards**: Each eval case showing prompt, with-skill score vs old-skill score, comparator verdict
- **Eval Detail Panel**: Slide-out panel with full prompt, expectations list (pass/fail with evidence), output preview
- **Expectations Panel**: Individual assertion rows with pass/fail badges and evidence quotes

## 3. Agent Traces

DAG-based visualization of agent execution:

- **DagCanvas**: Renders agent execution as a directed acyclic graph using Dagre layout
- **DagNode**: Individual agent steps (color-coded by status: complete/running/pending)
- **DagEdge**: Dependency arrows between steps
- **Playback Controls**: Step through trace execution chronologically
- **Step Detail Panel**: Selected step's tools used, duration, and output

## 4. Benchmarks

Version-to-version metric comparison:

- **Version Cards**: Side-by-side cards for current vs baseline versions
- **Metric Comparison**: Pass rate, mean tokens +/- stddev, mean time +/- stddev
- **Skill Breakdown**: Per-skill comparison table with delta highlighting
- **Outgrowth Warning**: Alerts when token usage grows disproportionately to quality gains

## 5. Skill Graph

Interactive visualization of skill relationships:

- **GraphCanvas**: Force-directed or hierarchical layout of skills, commands, and agents
- **GraphNode**: Nodes sized by line count, colored by model assignment
- **GraphLegend**: Model color key (Opus/Sonnet/Haiku)
- **Node Detail Panel**: Click a node to see connections, line count, trigger patterns

---

# Eval Skill Integration

The Eval Dashboard is the visual frontend for the `prism-eval` skill workflow:

```
┌──────────────┐     ┌──────────────┐     ┌──────────────────┐
│ prism-release │────>│  prism-eval  │────>│  Eval Dashboard  │
│ (Step 7-8:   │     │  (Skill)     │     │  (Electron app)  │
│  snapshot +  │     │  Runs evals, │     │  Visualizes      │
│  eval gen)   │     │  grades,     │     │  benchmark.json, │
│              │     │  benchmarks) │     │  grading.json,   │
└──────────────┘     └──────────────┘     │  timing.json)    │
                                          └──────────────────┘
```

## Eval Lifecycle

1. **`/prism-release`** creates a version snapshot (`.prism/shared/evals/v2.5.0-snapshot/`) and generates `evals.json` for each skill
2. **`prism-eval`** skill runs eval cases — spawns parallel agents, captures timing, grades outputs, builds `benchmark.json`
3. **Eval Dashboard** reads the workspace directory, presents results across all 5 screens
4. Developer reviews pass rates, identifies regressions, and iterates on skills

## Eval Data Schema

Eval cases are defined in `.prism/shared/evals/<version>/skills/<skill>/evals.json`:

```json
{
  "skill": "prism-research",
  "version": "v2.5.0",
  "baseline": "../../../v2.4.9-snapshot/skills/prism-research/SKILL.md",
  "evals": [
    {
      "id": 1,
      "dimension": "output_quality|behavioral_compliance|regression",
      "prompt": "Research the authentication system in this codebase",
      "expected_output": "Structured research document with file:line references",
      "expectations": [
        "Output follows research template format",
        "Contains file:line references, not just file paths",
        "Does not suggest improvements (documentarian principle)"
      ]
    }
  ]
}
```
