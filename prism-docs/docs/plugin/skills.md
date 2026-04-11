---
title: Skills Reference
description: All 20 Prism skills — auto-discovered workflow orchestrators with YAML frontmatter trigger patterns.
outline: [2, 3]
---

# Skills Reference

Skills live at `skills/*/SKILL.md` and are auto-discovered workflow orchestrators. They activate automatically based on trigger patterns in user messages or are invoked explicitly via `/skill-name`.

## Core Workflow Skills

| # | Skill | Lines | Model | Trigger Patterns |
|---|-------|-------|-------|-----------------|
| 1 | `prism` | 276 | **sonnet** | "help me build", "implement this feature", "fix this bug", "prism", "structured workflow" |
| 2 | `prism-research` | 121 | **sonnet** | "research this", "understand how X works", "map out the system", "explore the codebase" |
| 3 | `prism-plan` | 126 | **opus** | "create a plan", "plan the implementation", "design how to build" |
| 4 | `prism-implement` | 122 | **sonnet** | "implement the plan", "start building", "execute phase 1" |
| 5 | `prism-validate` | 108 | **sonnet** | "validate the plan", "verify implementation", "check if complete" |
| 6 | `prism-iterate` | 103 | **opus** | "iterate on plan", "update and continue", "adjust the approach" |

## Specialized Skills

| # | Skill | Lines | Model | Trigger Patterns |
|---|-------|-------|-------|-----------------|
| 7 | `prism-debug` | 221 | **sonnet** | "debug this", "why is this failing", "investigate the error" |
| 8 | `prism-spectrum` | 254 | **sonnet** | "spectrum", "execute story", "run spectrum" |
| 9 | `prism-verify` | 125 | **sonnet** | "verify the UI", "check the browser", "visual verification" |
| 10 | `prism-prd` | 122 | **opus** | "create a PRD", "write product requirements", "document this product" |
| 11 | `prism-visual-docs` | 146 | **opus** | "create user flows", "design the screens", "create wireframes" |

### Design & Completion Skills (v3.0.1)

| # | Skill | Lines | Model | Trigger Patterns |
|---|-------|-------|-------|-----------------|
| 12 | `prism-brainstorm` | ~90 | **opus** | "brainstorm this", "design options", "explore approaches", "let's think about" |
| 13 | `prism-design` | ~80 | **opus** | "design this", "create a design", "design the architecture" |
| 14 | `prism-finish` | ~100 | **sonnet** | "finish this branch", "ready to merge", "create PR", "clean up branch" |

**`prism-brainstorm`** includes a browser-based **Visual Companion** — a zero-dependency Node.js HTTP/WebSocket server that serves interactive HTML mockups for A/B design choices. User clicks are captured as JSONL events.

**`prism-design`** bridges research and planning — it produces architectural decisions, interface contracts, and visual documentation that the planning phase turns into tasks.

**`prism-finish`** presents 4 structured options: merge locally, push and create PR, keep as-is, or discard (requires confirmation).

### Setup & Utility Skills (v3.0.3)

| # | Skill | Lines | Model | Trigger Patterns |
|---|-------|-------|-------|-----------------|
| 15 | `prism-init` | 53 | **haiku** | "init prism", "set up prism", "initialize prism", "create .prism folder" |

**`prism-init`** wraps `init_prism.py` to initialize the `.prism/` directory structure in any project. Creates 15 directories including `designs/` (Figma/Pencil.dev files) and `assets/` (AI-generated images, videos, 3D models), updates `.gitignore`, and optionally adds a Prism section to `CLAUDE.md`.

### Release, Eval & Docs Skills (v2.5.0)

| # | Skill | Lines | Model | Trigger Patterns |
|---|-------|-------|-------|-----------------|
| 16 | `prism-release` | 245 | — | "release", "bump version", "new version", "cut a release" |
| 17 | `prism-eval` | 237 | **sonnet** | "run evals", "compare versions", "benchmark skills", "evaluate v2.5.0", "regression check" |
| 18 | `prism-docs-update` | 138 | — | "update prism docs", "sync docs site", "update documentation site" |

### Subagent Execution Skills (v3.2.0)

| # | Skill | Lines | Model | Trigger Patterns |
|---|-------|-------|-------|-----------------|
| 19 | `prism-subagent` | ~85 | **opus** | "subagent execute", "drive this plan with subagents", "dispatch implementers", "subagent driven development" |
| 20 | `prism-dispatch` | ~140 | **sonnet** | "fan out", "parallel agents", "investigate in parallel", "multiple unrelated failures", "split this work across agents" |

**`prism-subagent`** fills the medium-tier execution gap between `prism-implement` (single phase) and `prism-spectrum` (10+ stories, autonomous overnight). For 3–10 task plans where Spectrum is overkill, it dispatches a fresh implementer subagent per task with two-stage review (`spec-reviewer` then `quality-reviewer`), bounded retries, and compaction-survivable `state.json`. Innovations include domain-aware context priming (R3F / Electron / fullstack / experimental primers), diff-only reviews, a 5-status protocol with `NEEDS_CLARIFICATION` distinct from `NEEDS_CONTEXT`, a 9-class review decision matrix with explicit skip rules, repeated-issue and no-op spin loop detectors, automatic model escalation ladders, and 3-cycle hard caps on retries. Reuses `agents/spec-reviewer.md` and `agents/quality-reviewer.md` verbatim.

**`prism-dispatch`** generalizes the parallel agent fan-out pattern for ad-hoc use, sibling to `prism-research` (fixed agent roster) and `prism-debug` (fixed 3-agent flow). Use when facing 2+ independent problem domains that can be investigated or fixed concurrently without shared state. Includes when-to-use decision flow, sibling-skills disambiguation table, per-agent model selection guidance, and explicit anti-patterns (fan-out stampede capped at 5 agents per dispatch; hidden sequential dependencies via file-overlap audit).

**Execution-models table now reads:**

| Scope | Skill |
|---|---|
| Single phase / quick fix | `/prism-implement` |
| **3–10 tasks, mostly independent, stay in session** | **`/prism-subagent`** ← new |
| 10+ stories, autonomous overnight | `/prism-spectrum` |
| Parallel investigation of unrelated failures | `/prism-debug` |

## Skill Subdirectory Contents

Each skill directory may contain supporting files:

```
skills/
├── prism/
│   ├── SKILL.md                         # 276 lines — master orchestrator
│   ├── references/
│   │   └── workflow-patterns.md         # Reusable workflow pattern library
│   └── scripts/
│       └── init_prism.py                # 185 lines — .prism/ directory initializer
├── prism-init/
│   └── SKILL.md                         # 53 lines — haiku (project init, wraps init_prism.py)
├── prism-research/
│   ├── SKILL.md                         # 121 lines
│   └── references/
│       ├── exploration-patterns.md      # Agent spawning patterns
│       └── research-template.md         # Output document template
├── prism-plan/
│   ├── SKILL.md                         # 126 lines
│   └── references/
│       └── plan-template.md             # Plan document structure
├── prism-validate/
│   ├── SKILL.md                         # 108 lines
│   └── references/
│       └── validation-template.md       # Validation report template
├── prism-verify/
│   ├── SKILL.md                         # 125 lines
│   └── references/
│       ├── verification-template.md     # Browser verification template
│       └── verification-patterns.md     # Playwright-cli patterns
├── prism-spectrum/
│   ├── SKILL.md                         # 406 lines — manifest-aware story execution
│   └── references/
│       ├── story-manifest-schema.md     # Per-requirement tracking schema
│       └── contracts-convention.md      # Cross-domain contract convention
├── prism-debug/SKILL.md                 # 221 lines
├── prism-implement/SKILL.md             # 122 lines
├── prism-iterate/SKILL.md               # 103 lines
├── prism-prd/SKILL.md                   # 122 lines
├── prism-visual-docs/SKILL.md           # 146 lines
├── prism-release/SKILL.md              # 245 lines — full release pipeline
├── prism-eval/
│   ├── SKILL.md                         # 237 lines — skill evaluation runner
│   └── references/
│       └── eval-schemas.md              # evals.json and benchmark.json schemas
├── prism-docs-update/
│   ├── SKILL.md                         # 138 lines — VitePress docs syncer
│   └── references/
│       └── section-mapping.md           # Monolithic doc → VitePress page mapping
├── prism-subagent/                      # v3.2.0 — same-session subagent-driven execution
│   ├── SKILL.md                         # ~85 lines — opus, decision flow + iron laws
│   └── references/                      # ~5500 tokens, on-demand
│       ├── dispatch-protocol.md         # implementer + reviewer dispatch templates
│       ├── status-protocol.md           # 5-status handling matrix
│       ├── review-decision-matrix.md    # 9 task classes with skip rules
│       ├── retry-ladder.md              # bounded retries + loop detectors
│       ├── state-schema.md              # state.json schema + recovery protocol
│       └── domain-hints.md              # R3F / Electron / fullstack / experimental
└── prism-dispatch/                      # v3.2.0 — generalized parallel fan-out
    └── SKILL.md                         # ~140 lines — sonnet, ad-hoc parallel dispatch
```

## Skill Frontmatter Format

```markdown
---
name: skill-name
description: When to use this skill and trigger patterns
model: opus|sonnet|haiku
---

# Skill Title

Orchestration instructions: which agents to spawn, which commands to invoke,
what order to execute, how to present results to the user...
```

## Master Orchestrator: `prism`

The `prism` skill (276 lines) is the master orchestrator — it routes to all other skills:

```
User: "help me build a login form"
    │
    ▼
prism skill activates (trigger: "help me build")
    │
    ├── Detects task type → routes to appropriate phase
    │
    ├── If needs design work   → /prism-brainstorm → /prism-design
    ├── If unfamiliar codebase → /prism-research
    ├── If needs planning      → /prism-plan
    ├── If plan exists         → /prism-implement
    ├── If needs validation    → /prism-validate
    ├── If needs iteration     → /prism-iterate
    └── If work is complete    → /prism-finish
```
