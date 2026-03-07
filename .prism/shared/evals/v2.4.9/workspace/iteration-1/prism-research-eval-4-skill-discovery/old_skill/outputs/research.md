---
date: 2026-03-07T00:00:00Z
researcher: Claude (v2.4.8 skill eval)
repository: prism-plugin
branch: main
topic: "Skill Discovery and Routing System"
tags: [research, skills, discovery, routing, meta-skill, frontmatter, auto-discovery]
status: complete
---

# Skill Discovery and Routing System

## Research Question

How does the prism plugin's skill discovery system work? How does the `prism` meta-skill route to phase-specific skills?

---

## Summary

The Prism plugin uses a convention-based auto-discovery system where Claude Code scans the `skills/*/SKILL.md` file pattern on plugin enable. Each SKILL.md file contains YAML frontmatter with `name`, `description`, and `model` fields. The `description` field embeds natural-language trigger patterns that Claude Code uses to match user intent. The `prism` meta-skill (`skills/prism/SKILL.md`) acts as the master orchestrator, routing to 12 phase-specific skills based on task context and existing `.prism/` artifacts.

---

## Files Discovered

| File | Purpose | Lines |
|------|---------|-------|
| `skills/prism/SKILL.md` | Master orchestrator / meta-skill | 277 |
| `skills/prism-research/SKILL.md` | Research phase skill | 122 |
| `skills/prism-plan/SKILL.md` | Planning phase skill | 127 |
| `skills/prism-implement/SKILL.md` | Implementation phase skill | 123 |
| `skills/prism-validate/SKILL.md` | Validation phase skill | 109 |
| `skills/prism-iterate/SKILL.md` | Iteration phase skill | 104 |
| `skills/prism-spectrum/SKILL.md` | Autonomous story execution skill | 407 |
| `skills/prism-debug/SKILL.md` | Debug investigation skill | 222 |
| `skills/prism-verify/SKILL.md` | Browser verification skill | 125 |
| `skills/prism-prd/SKILL.md` | PRD generation skill | 123 |
| `skills/prism-visual-docs/SKILL.md` | Visual documentation skill | 147 |
| `skills/prism-docs-update/SKILL.md` | VitePress docs sync skill | 139 |
| `skills/prism-release/SKILL.md` | Release pipeline skill | ~100 |
| `.claude-plugin/plugin.json` | Plugin manifest (name, version) | 8 |
| `.claude-plugin/marketplace.json` | Distribution configuration | 20 |

---

## Component Analysis

### 1. Auto-Discovery Mechanism

Claude Code discovers skills through a filesystem convention. When the plugin is enabled (via `--plugin-dir` or marketplace install), Claude Code scans the `skills/*/SKILL.md` pattern within the plugin directory. There is no explicit skill registry or configuration file listing skills. The `plugin.json` at `.claude-plugin/plugin.json:1-8` declares only the plugin name, version, and author -- it does not enumerate individual skills.

The discovery documentation in `prism-docs/docs/plugin/manifest.md:41` states:

> Auto-Discovery: Claude Code scans `commands/`, `agents/`, `skills/*/SKILL.md` on enable

This means all three component types (commands, agents, skills) use convention-over-configuration -- they are discovered by their filesystem location and filename pattern, not by explicit registration.

### 2. YAML Frontmatter Structure

Every SKILL.md file begins with YAML frontmatter containing three fields:

```yaml
---
name: <skill-name>
description: <when-to-use text with embedded trigger patterns>
model: <opus|sonnet|haiku>
---
```

- **`name`**: The skill's identifier, used for explicit invocation via `/prism:<name>` (e.g., `/prism:prism-research`).
- **`description`**: A natural-language string that serves dual purposes: (1) it describes the skill's function to the AI, and (2) it embeds trigger patterns that Claude Code uses for automatic activation. Trigger patterns are written as quoted phrases (e.g., `"research this"`, `"understand how X works"`).
- **`model`**: Specifies the preferred AI model tier for execution. Some skills omit this field (e.g., `prism-docs-update`, `prism-release`).

### 3. Trigger Pattern Catalog

Each skill embeds trigger phrases in its `description` field. These are the patterns extracted from all 13 skill frontmatter blocks:

| Skill | Model | Trigger Patterns (from `description` field) |
|-------|-------|---------------------------------------------|
| `prism` | sonnet | "help me build", "implement this feature", "fix this bug", "prism", "structured workflow" |
| `prism-research` | sonnet | "research this", "understand how X works", "map out the system", "explore the codebase" |
| `prism-plan` | opus | "create a plan", "plan the implementation", "design how to build" |
| `prism-implement` | sonnet | "implement the plan", "start building", "execute phase 1" |
| `prism-validate` | sonnet | "validate the plan", "verify implementation", "check if complete" |
| `prism-iterate` | opus | "iterate on plan", "update and continue", "adjust the approach" |
| `prism-spectrum` | sonnet | "spectrum", "execute story", "run spectrum" |
| `prism-debug` | sonnet | "debug this", "why is this failing", "investigate the error", "prism debug" |
| `prism-verify` | sonnet | "verify the UI", "check the browser", "visual verification", "browser check" |
| `prism-prd` | opus | "create a PRD", "write product requirements", "document this product", "define the product spec" |
| `prism-visual-docs` | opus | "create user flows", "design the screens", "map user journeys", "create wireframes", "document the UX" |
| `prism-docs-update` | (none) | "update prism docs", "sync docs site", "update documentation site" |
| `prism-release` | (none) | "release", "bump version", "new version", "cut a release", "prism-release" |

### 4. The `prism` Meta-Skill Routing Logic

The `prism` meta-skill at `skills/prism/SKILL.md` functions as the master orchestrator. Its routing operates through two mechanisms:

#### 4a. Workflow Selection Table (`skills/prism/SKILL.md:39-44`)

The meta-skill defines a scenario-based routing table:

| Scenario | Phases |
|----------|--------|
| New feature, unfamiliar codebase | Full R->P->I->V |
| Feature in known codebase | P->I->V (skip Research) |
| Simple change, clear scope | I->V (skip Research + Plan) |
| Trivial fix (<20 lines) | Direct implementation |

#### 4b. Artifact-Based State Detection (`skills/prism/SKILL.md:48-61`)

Before routing, the meta-skill spawns a `prism-locator` agent to check existing state in `.prism/`:

```
Task(subagent_type="prism-locator")
"Find existing research, plans, or work related to [topic]"
```

Based on findings, it routes:

| Existing Artifacts | Route To |
|-------------------|----------|
| Nothing exists | `/prism-research` |
| Research exists | `/prism-plan` |
| Plan exists (incomplete) | `/prism-implement` |
| Implementation done | `/prism-validate` |

This means routing is not hard-coded to a single path. The meta-skill dynamically inspects the `.prism/shared/` directory tree to determine what phase the project is in and routes accordingly.

#### 4c. Phase-to-Skill Mapping (`skills/prism/SKILL.md:16-27`)

The meta-skill contains a reference table mapping phases to specific skills:

| Phase | Skill | Output Location |
|-------|-------|-----------------|
| Research | `/prism-research` | `.prism/shared/research/YYYY-MM-DD-topic.md` |
| Plan | `/prism-plan` | `.prism/shared/plans/YYYY-MM-DD-feature.md` |
| Implement | `/prism-implement` | Working code + updated checkboxes |
| Verify UI | `/prism-verify` | `.prism/local/verifications/{date}-{context}/` |
| Validate | `/prism-validate` | `.prism/shared/validation/YYYY-MM-DD-report.md` |
| Iterate | `/prism-iterate` | Updated plan + continued implementation |
| Spectrum | `/prism-spectrum` | Autonomous story execution via `spectrum.sh` |
| Debug | `/prism-debug` | Debug investigation report |

#### 4d. Document Generation Sub-Flow (`skills/prism/SKILL.md:29-35`)

The meta-skill also documents a secondary routing path for document generation:

| Type | Skill/Command | Output |
|------|---------------|--------|
| PRD | `/prism-prd` | `.prism/shared/plans/YYYY-MM-DD-[name]-PRD.md` |
| User Flows | `/prism-visual-docs` | `.prism/shared/plans/YYYY-MM-DD-[name]-USER-FLOWS.md` |
| Tech Spec | `/generate_tech_spec` | `.prism/shared/plans/YYYY-MM-DD-[name]-TECHNICAL-SPEC.md` |
| Pricing | `/generate_pricing` | `.prism/shared/plans/YYYY-MM-DD-[name]-PRICING.md` |

These document generation skills have their own internal flow:

```
prism-prd --> prism-visual-docs --> prism-plan
```

As documented at `skills/prism/SKILL.md:228-234`.

### 5. Two Invocation Paths

Skills can be activated in two ways:

1. **Automatic activation**: When a user message matches trigger patterns in the `description` frontmatter, Claude Code automatically selects and activates the matching skill. The `prism` meta-skill has broad triggers ("help me build", "implement this feature") that catch general development requests.

2. **Explicit invocation**: Users can directly invoke any skill using the `/prism:<skill-name>` syntax (e.g., `/prism:prism-research`, `/prism:prism-plan`). This bypasses the meta-skill's routing entirely.

The explicit invocation syntax is documented in `README.md:43-50`.

### 6. Spectrum External Invocation

The `spectrum.sh` script at `scripts/spectrum.sh:163-167` invokes Claude with `--print` and `--dangerously-skip-permissions` flags, passing a prompt string. It does NOT use `--skill` flag. Instead, it passes a prompt that activates the `prism-spectrum` skill through its trigger patterns (the prompt contains the word "spectrum" and the context about executing stories).

### 7. Skill Directory Structure

Each skill directory follows a consistent pattern:

```
skills/<skill-name>/
  SKILL.md              # Required: the skill definition
  references/           # Optional: supporting templates and patterns
    <template>.md
  scripts/              # Optional: utility scripts (only prism/ has this)
    <script>.py
```

The `references/` subdirectory is used by 5 of the 13 skills:
- `prism/references/workflow-patterns.md`
- `prism-research/references/exploration-patterns.md`, `research-template.md`
- `prism-plan/references/plan-template.md`
- `prism-validate/references/validation-template.md`
- `prism-verify/references/verification-template.md`, `verification-patterns.md`
- `prism-docs-update/references/section-mapping.md`

### 8. Inter-Skill References

Skills reference each other through slash-command syntax in their body text, not through imports or programmatic links. For example:

- `prism-prd/SKILL.md:78-79` references `/prism-research` and `/prism-plan` as next steps
- `prism-visual-docs/SKILL.md:91-93` references `/prism-plan`, `/prism-implement`, `/generate_pricing` as next steps
- `prism-iterate/SKILL.md:77` references `/prism-implement` workflow for resuming
- `prism-iterate/SKILL.md:81` references `/prism-validate` for re-validation
- `prism-debug/SKILL.md:30-34` shows its position between Implement and Iterate

### 9. Context Management for Routing

The meta-skill includes a context budget guide at `skills/prism/SKILL.md:239-243`:

| Context Level | Action |
|---------------|--------|
| < 40% | Continue |
| 40-60% | Consider phase transition |
| > 60% | Save state, start fresh |

This influences routing decisions -- when context is high, the meta-skill favors saving state (via handoff documents) and recommending a fresh session rather than continuing in the current one.

---

## Patterns Found

### Pattern 1: Convention-Over-Configuration Discovery
- **Where**: `.claude-plugin/plugin.json:1-8` (no skill list), `skills/*/SKILL.md` (filesystem convention)
- **How**: Claude Code scans `skills/*/SKILL.md` automatically. No registry file exists.

### Pattern 2: Natural Language Trigger Matching
- **Where**: Every `SKILL.md` frontmatter `description` field
- **How**: Trigger phrases embedded in description text. Claude Code matches user messages against these descriptions to select which skill to activate.

### Pattern 3: Artifact-Based State Machine
- **Where**: `skills/prism/SKILL.md:48-61`
- **How**: The meta-skill routes based on what `.prism/shared/` artifacts exist (research docs, plans, implementation state), creating an implicit state machine driven by filesystem state.

### Pattern 4: Dual Invocation (Automatic vs Explicit)
- **Where**: `README.md:43-50` (explicit `/prism:<name>` syntax), frontmatter descriptions (automatic matching)
- **How**: Users can bypass the meta-skill routing by invoking phase skills directly.

### Pattern 5: Hierarchical Skill-to-Agent Delegation
- **Where**: `skills/prism/SKILL.md:252-276` (agent catalog), individual SKILL.md files (Task() calls)
- **How**: Skills delegate to agents via `Task(subagent_type="agent-name")`. The meta-skill documents all available agents; phase skills reference specific subsets.

---

## Open Questions

1. How does Claude Code resolve conflicts when multiple skill descriptions match a user message? (e.g., "help me build" matches `prism` meta-skill, but could also match `prism-implement`)
2. What is the exact matching algorithm Claude Code uses against the `description` field -- is it substring matching, semantic similarity, or something else?
3. When the meta-skill routes to a phase skill (e.g., decides research is needed), does it invoke that skill as a new skill activation, or does it inline the skill's instructions?
4. The `prism-docs-update` and `prism-release` skills omit the `model` field from frontmatter -- what model is used in that case?
