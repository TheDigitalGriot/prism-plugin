---
title: Workflow State Machine
description: The 4-phase workflow state machine with validated transitions and phase-dependent behavior.
outline: [2, 3]
---

# Workflow State Machine (VS Code)

The extension implements the same 4-phase workflow as the CLI, with validated transitions:

```
              ┌──────────────────────────────────────┐
              │                                      │
              │    ┌──────┐                          │
              │    │ IDLE │                          │
              │    └──┬───┘                          │
              │       │                              │
              │  ┌────┴─────┬──────────┬──────────┐  │
              │  ▼          ▼          ▼          ▼  │
              │ Research → Plan → Implement → Validate
              │  │          │          │          │  │
              │  └──────────┴──────────┴──────────┘  │
              │       (any phase can return to Idle)  │
              └──────────────────────────────────────┘
```

Each phase transition is validated by the `WorkflowStateMachine`. The active phase determines:
- System prompts sent to Claude
- Status bar indicator color
- Available actions in the sidebar
