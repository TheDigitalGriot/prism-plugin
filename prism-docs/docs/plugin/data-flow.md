---
title: Data Flow Through .prism/
description: How workflow artifacts flow through the .prism/ directory from research to PR description.
outline: [2, 3]
---

# Data Flow Through .prism/

The plugin's workflow produces artifacts that flow through the `.prism/` directory:

```
User request / ticket
    │
    ▼
┌──────────────────────────────────────────────────────────────┐
│  /prism-research                                              │
│  Spawns 6 agents → aggregates findings                        │
│  Output: .prism/shared/research/YYYY-MM-DD-topic.md           │
└──────────────────────────────┬───────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────┐
│  /prism-plan                                                  │
│  Interactive planning → user approval at each step            │
│  Output: .prism/shared/plans/YYYY-MM-DD-feature.md            │
└──────────────────────────────┬───────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────┐
│  /decompose_plan                                              │
│  Converts plan phases into executable stories                 │
│  Output: .prism/stories/stories.json                          │
│          .prism/stories/<story-id>-manifest.json (per story)  │
│          .prism/shared/contracts/interfaces.json (if needed)  │
└──────────────────────────────┬───────────────────────────────┘
                               │
                ┌──────────────┴──────────────┐
                │                             │
    Manual execution                 Autonomous execution
                │                             │
                ▼                             ▼
┌──────────────────────┐    ┌──────────────────────────────────┐
│  /prism-implement     │    │  spectrum.sh + /prism-spectrum    │
│  Phase by phase       │    │  Fresh Claude session per story   │
│  with checkpoints     │    │  Signal protocol for flow control │
│                       │    │                                    │
│                       │    │  Progress:                         │
│                       │    │  .prism/shared/spectrum/progress.md│
└──────────┬────────────┘    └──────────────┬───────────────────┘
           │                                │
           └────────────┬───────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────────────────────┐
│  /prism-validate                                              │
│  Runs automated checks, compares against plan                 │
│  Output: .prism/shared/validation/YYYY-MM-DD-report.md        │
└──────────────────────────────┬───────────────────────────────┘
                               │
              ┌────────────────┴────────────────┐
              │                                 │
         All passed                       Issues found
              │                                 │
              ▼                                 ▼
┌──────────────────────┐          ┌──────────────────────────┐
│  /describe_pr         │          │  /prism-iterate           │
│  Output:              │          │  Update plan + continue   │
│  .prism/shared/prs/   │          │  → loops back to plan     │
└──────────────────────┘          └──────────────────────────┘
```

## Session Handoffs

When context window limits are reached:

```
/create_handoff  → .prism/shared/handoffs/YYYY-MM-DD_HH-MM-SS_topic.md
                          │
                    (new Claude session)
                          │
/resume_handoff  ← reads handoff + validates current state → continues work
```
