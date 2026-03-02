---
title: Spectrum Execution
description: VS Code Spectrum execution states, SpectrumEngine iteration loop, and SpectrumRunner signal handling.
outline: [2, 3]
---

# Spectrum Execution (VS Code)

The VS Code extension runs Spectrum through the same signal protocol as the CLI.

## Execution States

| State | Description |
|-------|-------------|
| `idle` | Waiting to start |
| `running` | Claude CLI active, processing stories |
| `paused` | Execution paused by user |
| `complete` | All stories finished |
| `maxIterations` | Iteration limit reached |
| `error` | Fatal error, cannot continue |

## SpectrumEngine

Manages the execution loop state machine. On each iteration:

1. Check max iterations — exceeded? → `maxIterations` state
2. Select next story via `StoriesManager.getNextStory()`
3. Spawn Claude CLI via `SpectrumRunner`
4. Stream output, parse tools and signals
5. Handle signal: Continue → pause, then next iteration; Complete → check remaining; Error → stop
6. Update stories.json on disk

## SpectrumRunner

Per-iteration CLI subprocess manager:
- Spawns `claude` with `--dangerously-skip-permissions --print --output-format stream-json`
- Streams stdout/stderr through output parser
- Detects signals (`<spectrum-continue>`, `<spectrum-retry>`, `<spectrum-blocked>`, `<spectrum-error>`, `<promise>COMPLETE</promise>`)
- Fires events: `recentActivities[]`, `logs[]`, signal detection
