---
title: Execution State Machine
description: The Spectrum execution state machine — states, signal protocol, and iteration lifecycle.
outline: [2, 3]
---

# Execution State Machine

## State Diagram

```
                                ┌──────────────┐
                                │              │
                                │    IDLE      │
                                │              │
                                └──────┬───────┘
                                       │
                                  [Enter pressed]
                                       │
                                       ▼
                                ┌──────────────┐
               ┌───────────────▶│              │◀──────────────────┐
               │                │   RUNNING    │                   │
               │      ┌────────▶│              │◀────────┐         │
               │      │         └──┬───┬───┬───┘         │         │
               │      │            │   │   │             │         │
               │   [resume]        │   │   │          [retry]   [continue]
               │      │            │   │   │          [blocked]    │
               │      │         [p]│   │   │[Claude      │         │
               │      │            │   │   │ finished]   │         │
               │      │            ▼   │   │             │         │
               │   ┌──────┐        │   │   ▼             │         │
               │   │      │        │   │ ┌────────────┐  │         │
               │   │PAUSED│◀───────┘   │ │Parse Signal│──┘         │
               │   │      │            │ └──────┬─────┘            │
               │   └──┬───┘            │        │                  │
               │      │                │   ┌────┴────────────┐     │
               │   [p/enter]           │   │     │     │     │     │
               │      │                │   ▼     ▼     ▼     ▼     │
               └──────┘                │ Error Retry Block Continue │
                                       │   │     │     │     │     │
                                       │   │     │     └─────┴─────┘
                                       │   │     │
                                       │   │  ┌──┴────────┐
                                       │   │  │ > 3       │
                                       │   │  │ retries?  │
                                [max   │   │  └──┬────┬───┘
                                iter]  │   │     │    │
                                       │   │   YES   NO
                                       │   │     │    │
                                       │   │     │    └──▶ Continue ──▶ RUNNING
                                       │   │     │
                            ┌──────────┘   │     │
                            │              │     │
                            ▼              ▼     ▼
                   ┌──────────────┐  ┌──────────────┐
                   │     MAX      │  │              │
                   │  ITERATIONS  │  │    ERROR     │
                   │              │  │              │
                   └──────┬───────┘  └──────┬───────┘
                          │                 │
                     [Enter]           [Enter]
                          │                 │
                          ▼                 ▼
                   ┌──────────────┐  ┌──────────────┐
                   │   COMPLETE   │  │     QUIT     │
                   └──────┬───────┘  └──────────────┘
                          │
                     [Enter]
                          │
                          ▼
                   ┌──────────────┐
                   │     QUIT     │
                   └──────────────┘
```

## State Descriptions

| State | String | Behavior |
|-------|--------|----------|
| `StateIdle` | `"IDLE"` | Waiting for user to press Enter to start |
| `StateRunning` | `"RUNNING"` | Claude CLI active, processing stories |
| `StatePaused` | `"PAUSED"` | Execution paused, can resume with `p` |
| `StateComplete` | `"COMPLETE"` | All stories finished successfully |
| `StateMaxIterations` | `"PAUSED"` | Iteration limit reached (soft stop) |
| `StateError` | `"ERROR"` | Fatal error, cannot continue |

## Signal Protocol

Signals are XML-like tags emitted in Claude's output text, parsed via regex:

| Signal | Tag | Priority | Action |
|--------|-----|----------|--------|
| Complete | `<promise>COMPLETE</promise>` | 1 (highest) | If 0 remaining → Complete; if remaining > 0 → override & continue |
| Error | `<spectrum-error reason="...">...</spectrum-error>` | 2 | Fatal → Error state |
| Retry | `<spectrum-retry reason="...">...</spectrum-retry>` | 3 | Increment error counter; retry if under limit (3) |
| Blocked | `<spectrum-blocked reason="...">...</spectrum-blocked>` | 4 | Log warning, skip to next unblocked story |
| Continue | `<spectrum-continue>...</spectrum-continue>` | 5 | Success, schedule next iteration after pause |
| None | (no match) | 6 | Assume continue |

## Iteration Lifecycle

```
┌─ Iteration N ──────────────────────────────────────────────────────┐
│                                                                     │
│  1. Check max iterations ─── exceeded? ──▶ StateMaxIterations      │
│                │                                                    │
│                ▼                                                    │
│  2. Increment counter, create output channel                       │
│                │                                                    │
│                ▼                                                    │
│  3. RunClaudeStreamingCmd() ──▶ spawn `claude` CLI process         │
│     + ListenToOutput()        ├── stream stdout/stderr             │
│                               ├── parse JSON events                │
│                               └── emit ToolActivityMsg             │
│                │                                                    │
│                ▼                                                    │
│  4. ClaudeFinishedMsg received                                     │
│                │                                                    │
│          ┌─────┴─────┐                                              │
│       error?      success?                                          │
│          │            │                                             │
│          ▼            ▼                                             │
│  5a. Inc errors   5b. ParseSignal()                                │
│      backoff          ReloadStoriesCmd()                            │
│      retry            SignalDetectedMsg                             │
│                │                                                    │
│                ▼                                                    │
│  6. handleSignal() ──▶ determine next action                       │
│                │                                                    │
│          ┌─────┴──────────────────┐                                 │
│      continue?              terminal?                               │
│          │                      │                                   │
│          ▼                      ▼                                   │
│  7. Pause (N seconds)    Complete/Error                             │
│          │                                                          │
│          ▼                                                          │
│  8. StartNextIterationMsg ──▶ Loop to step 1                       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```
