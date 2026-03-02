---
title: Component Invocation Graph
description: How Prism skills, commands, and agents call each other — the complete invocation graph.
outline: [2, 3]
---

# Component Invocation Graph

## Skills → Commands

```
prism (master orchestrator)
  ├── /prism-research
  ├── /prism-plan
  ├── /prism-implement
  ├── /prism-validate
  ├── /prism-iterate
  ├── /prism-spectrum
  ├── /prism-debug
  ├── /prism-verify
  ├── /prism-prd
  └── /prism-visual-docs

prism-prd
  ├── /generate_prd
  ├── /generate_user_flows (offered as companion)
  ├── /generate_tech_spec (offered as companion)
  └── /generate_pricing (offered as companion)

prism-visual-docs
  ├── /generate_user_flows
  └── /generate_tech_spec (optional)

prism-implement
  ├── /commit (after each phase)
  ├── /validate_plan (after completion)
  └── /describe_pr (for PR creation)

prism-spectrum
  └── /prism-debug (on quality gate failure — auto-retry)
```

## Skills → Agents (Parallel Spawning)

```
prism-research ───────────────────────────────┐
  ├── codebase-locator        (haiku)   ────┐ │
  ├── codebase-analyzer       (opus)    ────┤ │
  ├── codebase-pattern-finder (sonnet)  ────┤ ├── All 6 in parallel
  ├── prism-locator           (haiku)   ────┤ │
  ├── prism-analyzer          (opus)    ────┤ │
  └── web-search-researcher   (sonnet)  ────┘ │
                                               │
prism-plan ────────────────────────────────────┤
  ├── codebase-analyzer       (opus)    ────┐  │
  ├── codebase-pattern-finder (sonnet)  ────┤  ├── 3 in parallel
  └── prism-analyzer          (opus)    ────┘  │
                                               │
prism-iterate ─────────────────────────────────┤
  ├── codebase-locator        (haiku)   ────┐  │
  ├── codebase-analyzer       (opus)    ────┤  ├── 3 in parallel
  └── codebase-pattern-finder (sonnet)  ────┘  │
                                               │
prism-debug ───────────────────────────────────┤
  ├── log-investigator        (haiku)   ────┐  │
  ├── state-investigator      (haiku)   ────┤  ├── 3 in parallel
  └── git-investigator        (haiku)   ────┘  │
                                               │
prism-verify ──────────────────────────────────┤
  └── browser-verifier        (haiku)          │
                                               │
prism-prd ─────────────────────────────────────┤
  └── prism-locator           (haiku)          │
                                               │
prism-visual-docs ─────────────────────────────┘
  └── prism-locator           (haiku)
```

## Commands → Agents

```
/create_plan
  ├── codebase-locator        (haiku)
  ├── codebase-analyzer       (opus)
  ├── codebase-pattern-finder (sonnet)
  ├── prism-locator           (haiku)
  └── prism-analyzer          (opus)

/research_codebase
  ├── codebase-locator        (haiku)
  ├── codebase-analyzer       (opus)
  ├── codebase-pattern-finder (sonnet)
  ├── prism-locator           (haiku)
  ├── prism-analyzer          (opus)
  └── web-search-researcher   (sonnet)

/iterate_plan
  ├── codebase-locator        (haiku)
  ├── codebase-analyzer       (opus)
  ├── codebase-pattern-finder (sonnet)
  ├── prism-locator           (haiku)
  └── prism-analyzer          (opus)

/prism-debug
  ├── log-investigator        (haiku)
  ├── state-investigator      (haiku)
  └── git-investigator        (haiku)
```
