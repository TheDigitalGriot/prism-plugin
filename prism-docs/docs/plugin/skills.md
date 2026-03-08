---
title: Skills Reference
description: All 11 Prism skills — auto-discovered workflow orchestrators with YAML frontmatter trigger patterns.
outline: [2, 3]
---

# Skills Reference

Skills live at `skills/*/SKILL.md` and are auto-discovered workflow orchestrators. They activate automatically based on trigger patterns in user messages or are invoked explicitly via `/skill-name`.

## Core Workflow Skills

| # | Skill | Lines | Model | Trigger Patterns |
|---|-------|-------|-------|-----------------|
| 1 | `prism` | 275 | **sonnet** | "help me build", "implement this feature", "fix this bug", "prism", "structured workflow" |
| 2 | `prism-research` | 113 | **sonnet** | "research this", "understand how X works", "map out the system", "explore the codebase" |
| 3 | `prism-plan` | 126 | **opus** | "create a plan", "plan the implementation", "design how to build" |
| 4 | `prism-implement` | 122 | **sonnet** | "implement the plan", "start building", "execute phase 1" |
| 5 | `prism-validate` | 94 | **sonnet** | "validate the plan", "verify implementation", "check if complete" |
| 6 | `prism-iterate` | 103 | **opus** | "iterate on plan", "update and continue", "adjust the approach" |

## Specialized Skills

| # | Skill | Lines | Model | Trigger Patterns |
|---|-------|-------|-------|-----------------|
| 7 | `prism-debug` | 221 | **sonnet** | "debug this", "why is this failing", "investigate the error" |
| 8 | `prism-spectrum` | 254 | **sonnet** | "spectrum", "execute story", "run spectrum" |
| 9 | `prism-verify` | 125 | **sonnet** | "verify the UI", "check the browser", "visual verification" |
| 10 | `prism-prd` | 122 | **opus** | "create a PRD", "write product requirements", "document this product" |
| 11 | `prism-visual-docs` | 146 | **opus** | "create user flows", "design the screens", "create wireframes" |

## Skill Subdirectory Contents

Each skill directory may contain supporting files:

```
skills/
├── prism/
│   ├── SKILL.md                         # 275 lines — master orchestrator
│   ├── references/
│   │   └── workflow-patterns.md         # Reusable workflow pattern library
│   └── scripts/
│       └── init_prism.py                # 178 lines — .prism/ directory initializer
├── prism-research/
│   ├── SKILL.md                         # 113 lines
│   └── references/
│       ├── exploration-patterns.md      # Agent spawning patterns
│       └── research-template.md         # Output document template
├── prism-plan/
│   ├── SKILL.md                         # 126 lines
│   └── references/
│       └── plan-template.md             # Plan document structure
├── prism-validate/
│   ├── SKILL.md                         # 94 lines
│   └── references/
│       └── validation-template.md       # Validation report template
├── prism-verify/
│   ├── SKILL.md                         # 125 lines
│   └── references/
│       ├── verification-template.md     # Browser verification template
│       └── verification-patterns.md     # Playwright-cli patterns
├── prism-spectrum/
│   ├── SKILL.md                         # 254 lines — manifest-aware story execution
│   └── references/
│       ├── story-manifest-schema.md     # Per-requirement tracking schema
│       └── contracts-convention.md      # Cross-domain contract convention
├── prism-debug/SKILL.md                 # 221 lines
├── prism-implement/SKILL.md             # 122 lines
├── prism-iterate/SKILL.md               # 103 lines
├── prism-prd/SKILL.md                   # 122 lines
└── prism-visual-docs/SKILL.md           # 146 lines
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

The `prism` skill (275 lines) is the master orchestrator — it routes to all other skills:

```
User: "help me build a login form"
    │
    ▼
prism skill activates (trigger: "help me build")
    │
    ├── Detects task type → routes to appropriate phase
    │
    ├── If unfamiliar codebase → /prism-research
    ├── If needs planning      → /prism-plan
    ├── If plan exists         → /prism-implement
    ├── If needs validation    → /prism-validate
    └── If needs iteration     → /prism-iterate
```
