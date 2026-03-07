---
date: 2026-03-07
researcher: Claude
git_commit: 33f2cac
branch: main
repository: prism-plugin
topic: "Skill Discovery and Routing System"
tags: [research, skills, routing, discovery, meta-skill, frontmatter, agents, commands]
status: complete
---

# Research: Skill Discovery and Routing System

## Research Question

Map out the skill discovery and routing system in this plugin. How does the prism meta-skill route to phase-specific skills?

## Summary

The Prism plugin uses a three-layer auto-discovery architecture where skills, commands, and agents are discovered by Claude Code from their respective directories via naming conventions and YAML frontmatter. The `prism` meta-skill (`skills/prism/SKILL.md`) acts as a hub that routes to 12 phase-specific skills based on a decision tree: it first spawns a `prism-locator` agent to check for existing `.prism/` artifacts, then selects the appropriate phase skill based on what exists (nothing -> research, research exists -> plan, plan exists -> implement, implementation done -> validate). Each skill's `description` field in its YAML frontmatter contains trigger phrases that Claude Code uses for natural-language routing when users invoke skills implicitly rather than by name.

## Files Discovered

| File | Purpose |
|------|---------|
| `skills/prism/SKILL.md` | Meta-skill hub — routes to phase-specific skills |
| `skills/prism-research/SKILL.md` | Phase 1: Research orchestrator |
| `skills/prism-plan/SKILL.md` | Phase 2: Planning orchestrator |
| `skills/prism-implement/SKILL.md` | Phase 3: Implementation orchestrator |
| `skills/prism-validate/SKILL.md` | Phase 4: Validation orchestrator |
| `skills/prism-verify/SKILL.md` | Phase 3.5: Browser verification |
| `skills/prism-iterate/SKILL.md` | Feedback loop: plan update + re-implementation |
| `skills/prism-spectrum/SKILL.md` | Autonomous multi-story execution |
| `skills/prism-debug/SKILL.md` | Debug investigation orchestrator |
| `skills/prism-prd/SKILL.md` | Product requirements document generation |
| `skills/prism-visual-docs/SKILL.md` | User flows and wireframe generation |
| `skills/prism-docs-update/SKILL.md` | VitePress documentation sync |
| `skills/prism-release/SKILL.md` | Versioned release pipeline |
| `skills/prism/references/workflow-patterns.md` | Workflow patterns reference |
| `agents/*.md` | 11 agent definitions (spawned by skills via Task tool) |
| `commands/*.md` | 25 command definitions (invoked via `/command-name`) |

## Component Analysis

### 1. Skill Discovery Mechanism

**Location**: `skills/*/SKILL.md`

**How it works**:
Claude Code auto-discovers skills by scanning the `skills/` directory for subdirectories containing a `SKILL.md` file. Each `SKILL.md` has YAML frontmatter with three fields that drive discovery:

- `name` — the skill identifier (e.g., `prism-research`), invocable as `/prism-research`
- `description` — a natural-language description containing explicit trigger phrases (e.g., "Triggers on 'research this', 'understand how X works'")
- `model` — the preferred model tier: `opus`, `sonnet`, or (implicitly via agents) `haiku`

There are 13 skills total across 13 subdirectories under `skills/`. Discovery is convention-based: any `skills/<name>/SKILL.md` file is auto-registered.

**Frontmatter examples**:

At `skills/prism/SKILL.md:1-5`:
```yaml
name: prism
description: Structured 4-phase development workflow... Triggers on "help me build", "implement this feature", "fix this bug", "prism", "structured workflow"...
model: sonnet
```

At `skills/prism-research/SKILL.md:1-5`:
```yaml
name: prism-research
description: Research phase... Triggers on "research this", "understand how X works", "map out the system", "explore the codebase"...
model: sonnet
```

### 2. The Prism Meta-Skill (Hub Router)

**Location**: `skills/prism/SKILL.md`

**How it works**:
The `prism` skill is the central hub. It does not perform work itself; it routes to phase-specific skills. The routing logic at `skills/prism/SKILL.md:46-61` follows a decision tree:

**Step 1 — Check existing artifacts** (`skills/prism/SKILL.md:50-54`):
```
Task(subagent_type="prism-locator")
"Find existing research, plans, or work related to [topic]"
```

**Step 2 — Route based on findings** (`skills/prism/SKILL.md:57-61`):
- **Nothing exists** -> Start with `/prism-research`
- **Research exists** -> Start with `/prism-plan`
- **Plan exists (incomplete)** -> Resume `/prism-implement`
- **Implementation done** -> Run `/prism-validate`

**Step 3 — Complexity-based shortcutting** (`skills/prism/SKILL.md:39-44`):

| Scenario | Phases |
|----------|--------|
| New feature, unfamiliar codebase | Full R->P->I->V |
| Feature in known codebase | P->I->V (skip Research) |
| Simple change, clear scope | I->V (skip Research + Plan) |
| Trivial fix (<20 lines) | Direct implementation |

The meta-skill also documents all available phase skills in a quick-reference table at `skills/prism/SKILL.md:17-27` and all available agents at `skills/prism/SKILL.md:252-276`.

### 3. Two Routing Modes

**How it works**:
Users can reach phase skills through two distinct routing modes:

**Mode A — Explicit invocation**: User types `/prism-research`, `/prism-plan`, etc. Claude Code matches the `name` field in YAML frontmatter directly and loads that skill.

**Mode B — Natural-language routing via meta-skill**: User says something like "help me build X" or "prism". Claude Code matches the `prism` meta-skill's description triggers. The `prism` skill then internally routes to the correct phase skill based on the artifact-checking decision tree.

**Mode C — Natural-language routing to phase skill directly**: User says "research this codebase". Claude Code matches `prism-research`'s trigger phrases directly, bypassing the meta-skill hub entirely.

### 4. Command Discovery and Invocation

**Location**: `commands/*.md`

**How it works**:
Commands are auto-discovered from `commands/*.md` (25 total). Each has YAML frontmatter with `description` and `model` fields. Commands are invoked directly via `/command-name` syntax. They differ from skills in that they are single-purpose operations rather than multi-step orchestrators.

Skills invoke commands as part of their workflows:
- `prism` meta-skill references `/decompose_plan` at `skills/prism/SKILL.md:153`
- `prism-prd` invokes `/generate_prd` (documented at `skills/prism-prd/SKILL.md:9`)
- `prism-visual-docs` invokes `/generate_user_flows` and `/generate_tech_spec` (documented at `skills/prism-visual-docs/SKILL.md:9`)

Commands do NOT have a `name` field — their filename (minus `.md`) is the identifier. For example, `commands/create_plan.md` is invoked as `/create_plan`.

### 5. Agent Discovery and Spawning

**Location**: `agents/*.md`

**How it works**:
Agents are auto-discovered from `agents/*.md` (11 total). Each has YAML frontmatter with four fields:
- `name` — agent identifier (e.g., `codebase-locator`)
- `description` — purpose description
- `tools` — allowed tool list (e.g., `Read, Glob, Grep, Bash`)
- `model` — preferred model tier

Agents are NOT directly user-invocable. They are spawned by skills via the Task tool:
```
Task(subagent_type="agent-name")
```

This is documented at `skills/prism/SKILL.md:276` and used extensively across skills.

**Agent-to-skill mapping**:

| Agent | Spawned By | Model |
|-------|-----------|-------|
| `graph-navigator` | prism-research | haiku |
| `codebase-locator` | prism-research, prism-plan | haiku |
| `codebase-analyzer` | prism-research, prism-plan | opus |
| `codebase-pattern-finder` | prism-research, prism-plan | sonnet |
| `prism-locator` | prism (hub), prism-research | haiku |
| `prism-analyzer` | prism-plan | opus |
| `web-search-researcher` | prism-research | sonnet |
| `browser-verifier` | prism-verify | haiku |
| `log-investigator` | prism-debug | haiku |
| `state-investigator` | prism-debug | haiku |
| `git-investigator` | prism-debug | haiku |

### 6. Skill-to-Skill Routing (Phase Transitions)

**Location**: `skills/prism/SKILL.md:17-27`

**How it works**:
The complete phase flow with all entry/exit points:

```
User Request
    |
    v
[prism meta-skill] -- checks .prism/ artifacts --> routes to:
    |
    +-- /prism-prd ---------> /prism-visual-docs --------+
    |                                                     |
    +-- /prism-research ----------------------------------+
    |                                                     |
    +-----------------------------------------------------+
    |
    v
/prism-plan
    |
    +-- /prism-implement (manual) ---+
    |                                |
    +-- /decompose_plan              |
        |                            |
        v                            |
    spectrum.sh                      |
        |                            |
        v                            |
    /prism-spectrum (1 story/session)|
        |                            |
        +----------------------------+
        |
        v
/prism-validate
    |
    +-- PASS --> /commit, /describe_pr
    |
    +-- ISSUES --> /prism-iterate --> back to /prism-implement
```

At any point during implementation or spectrum execution, `/prism-debug` can be invoked for investigation. `/prism-verify` sits between implement and validate as an optional browser verification step.

### 7. Reference File System

**Location**: `skills/*/references/*.md`

**How it works**:
Skills can bundle reference files in a `references/` subdirectory. These are loaded as additional context when the skill is activated. The following reference files exist:

| File | Parent Skill |
|------|-------------|
| `skills/prism-research/references/research-template.md` | prism-research |
| `skills/prism-research/references/exploration-patterns.md` | prism-research |
| `skills/prism-plan/references/plan-template.md` | prism-plan |
| `skills/prism-validate/references/validation-template.md` | prism-validate |
| `skills/prism-verify/references/verification-template.md` | prism-verify |
| `skills/prism-verify/references/verification-patterns.md` | prism-verify |
| `skills/prism-docs-update/references/section-mapping.md` | prism-docs-update |
| `skills/prism/references/workflow-patterns.md` | prism (hub) |

### 8. Model Assignment Strategy

**Location**: YAML frontmatter across all skills, commands, and agents

**How it works**:
Model assignment follows a consistent tier strategy:

- **Opus** (deep analysis): `prism-plan`, `prism-iterate`, `prism-prd`, `prism-visual-docs`, `codebase-analyzer`, `prism-analyzer`, `create_plan`, `iterate_plan`, `generate_prd`, `generate_tech_spec`, `generate_user_flows`, `generate_pricing`, `decompose_plan`, `research_codebase`
- **Sonnet** (general work): `prism` (hub), `prism-research`, `prism-implement`, `prism-validate`, `prism-debug`, `prism-spectrum`, `prism-verify`, `codebase-pattern-finder`, `web-search-researcher`
- **Haiku** (fast lookups): `codebase-locator`, `prism-locator`, `graph-navigator`, `browser-verifier`, `log-investigator`, `state-investigator`, `git-investigator`

## Patterns Found

### Pattern: YAML Frontmatter as Discovery Contract

**Example at**: `skills/prism-research/SKILL.md:1-5`

```yaml
---
name: prism-research
description: Research phase for complex coding tasks. Use when exploring a codebase before planning implementation. Triggers on "research this", "understand how X works", "map out the system", "explore the codebase", or when starting unfamiliar work.
model: sonnet
---
```

**Also used in**:
- All 13 skills at `skills/*/SKILL.md:1-5`
- All 11 agents at `agents/*.md:1-6` (with additional `tools` field)
- All 25 commands at `commands/*.md:1-4` (with `description` and `model` only, no `name`)

### Pattern: Artifact-Based State Machine

**Example at**: `skills/prism/SKILL.md:57-61`

The prism meta-skill inspects the `.prism/` directory to determine workflow state:
- No artifacts -> Research phase
- Research artifacts exist -> Plan phase
- Plan exists -> Implement phase
- Implementation complete -> Validate phase

This pattern is also used by `prism-spectrum` which reads `stories.json` status fields to determine which story to execute next.

### Pattern: Task-Based Agent Delegation

**Example at**: `skills/prism-research/SKILL.md:44-47`

```
Task(subagent_type="prism-locator")
"Find existing research about [topic]"
```

Skills delegate work to agents via the `Task()` tool. The `subagent_type` parameter matches the agent's `name` field in its YAML frontmatter. Multiple agents can run in parallel when searching different areas.

**Also used in**:
- `skills/prism/SKILL.md:53-54` (prism-locator for artifact check)
- `skills/prism-research/SKILL.md:58-60` (codebase-locator)
- `skills/prism-research/SKILL.md:66-68` (codebase-analyzer)
- `skills/prism-research/SKILL.md:74-76` (codebase-pattern-finder)
- `skills/prism-verify/SKILL.md:29` (browser-verifier)

### Pattern: Skill-to-Command Delegation

Skills invoke commands as sub-operations within their workflow:
- `prism-prd` invokes `/generate_prd` at `skills/prism-prd/SKILL.md:9`
- `prism-visual-docs` invokes `/generate_user_flows` at `skills/prism-visual-docs/SKILL.md:9`
- `prism` hub references `/decompose_plan` at `skills/prism/SKILL.md:153`

## Historical Context

From `.prism/` directory:

- `.prism/shared/research/2026-02-22-prism-plugin-architecture.md` — Comprehensive architecture analysis documenting the three-layer architecture (10 skills, 22 commands, 9 agents at that time; now 13 skills, 25 commands, 11 agents)

## Architecture Notes

- **Convention**: Skills live in `skills/<name>/SKILL.md`, commands in `commands/<name>.md`, agents in `agents/<name>.md`
- **Convention**: Skills use `name` frontmatter, commands use filename as identifier
- **Convention**: Agents declare their allowed `tools` in frontmatter; skills and commands do not
- **Convention**: Three debug agents (`log-investigator`, `state-investigator`, `git-investigator`) use a simpler frontmatter format (no YAML `---` delimiters, just markdown headers for Model/Purpose)
- **Pattern**: The `prism` meta-skill is the only skill that functions purely as a router — all other skills perform actual workflow orchestration
- **Decision**: Model tiers are assigned by cognitive complexity: Opus for analysis/planning, Sonnet for general orchestration, Haiku for fast lookups and investigation

## Open Questions

- [ ] How does Claude Code's internal skill matcher rank competing trigger phrase matches when multiple skills could match a user query (e.g., "research and plan this feature" matches both prism-research and prism-plan)?
- [ ] Are reference files in `skills/*/references/` automatically loaded by Claude Code when the skill activates, or does the skill's markdown body need to explicitly reference them?
- [ ] The three debug agents (log-investigator, state-investigator, git-investigator) lack standard YAML frontmatter with `---` delimiters — are they discovered the same way as other agents?

## Code References

Quick navigation:

| Reference | Description |
|-----------|-------------|
| `skills/prism/SKILL.md:1-5` | Meta-skill YAML frontmatter (discovery entry) |
| `skills/prism/SKILL.md:17-27` | Phase skill quick-reference table |
| `skills/prism/SKILL.md:39-44` | Workflow selection matrix (complexity routing) |
| `skills/prism/SKILL.md:50-54` | Artifact check via prism-locator agent |
| `skills/prism/SKILL.md:57-61` | State-based routing decision tree |
| `skills/prism/SKILL.md:153` | Spectrum entry via /decompose_plan |
| `skills/prism/SKILL.md:252-276` | Complete agent registry |
| `skills/prism-research/SKILL.md:1-5` | Research skill frontmatter with triggers |
| `skills/prism-research/SKILL.md:22-33` | Agent table for research phase |
| `skills/prism-plan/SKILL.md:1-5` | Plan skill frontmatter with triggers |
| `skills/prism-implement/SKILL.md:1-5` | Implement skill frontmatter with triggers |
| `skills/prism-validate/SKILL.md:1-5` | Validate skill frontmatter with triggers |
| `skills/prism/references/workflow-patterns.md:195-201` | Spectrum architecture diagram |
| `agents/codebase-locator.md:1-6` | Agent frontmatter with tools field |
