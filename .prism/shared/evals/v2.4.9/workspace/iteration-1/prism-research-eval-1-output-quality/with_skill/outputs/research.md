---
date: 2026-03-07
researcher: Claude
git_commit: 33f2cac
branch: main
repository: prism-plugin
topic: "Navigation system in the Prism Claude Code plugin"
tags: [research, navigation, skills, commands, agents, workflow, plugin-architecture]
status: complete
---

# Research: Navigation System in the Prism Claude Code Plugin

## Research Question

How does the navigation system in this codebase work? This project is a Claude Code plugin with skills, agents, and commands.

## Summary

Prism is a Claude Code plugin (v2.4.9) that implements navigation through a three-layer architecture: Skills (orchestrators), Commands (operations), and Agents (specialists). Navigation is driven by two complementary mechanisms: (1) automatic discovery via YAML frontmatter in `SKILL.md` files, where Claude Code matches user intent to skill descriptions and triggers them contextually, and (2) explicit invocation via `/command-name` slash commands defined as markdown files in `commands/`. Agents are spawned programmatically by skills and commands using `Task(subagent_type="agent-name")` and run in isolated contexts with their own tool restrictions and model assignments.

## Files Discovered

| File | Purpose |
|------|---------|
| `.claude-plugin/plugin.json` | Plugin manifest defining name "prism", version 2.4.9 |
| `skills/prism/SKILL.md` | Root orchestrator skill, main entry point and workflow router |
| `skills/prism-research/SKILL.md` | Research phase skill |
| `skills/prism-plan/SKILL.md` | Planning phase skill |
| `skills/prism-implement/SKILL.md` | Implementation phase skill |
| `skills/prism-validate/SKILL.md` | Validation phase skill |
| `skills/prism-iterate/SKILL.md` | Iteration phase skill (plan update + re-implement) |
| `skills/prism-spectrum/SKILL.md` | Autonomous story execution skill |
| `skills/prism-debug/SKILL.md` | Debug investigation skill |
| `skills/prism-verify/SKILL.md` | Browser/UI verification skill |
| `skills/prism-prd/SKILL.md` | PRD generation skill |
| `skills/prism-visual-docs/SKILL.md` | User flow and wireframe generation skill |
| `skills/prism-release/SKILL.md` | Version release pipeline skill |
| `skills/prism-docs-update/SKILL.md` | VitePress documentation sync skill |
| `commands/research_codebase.md` | `/research_codebase` command |
| `commands/create_plan.md` | `/create_plan` command |
| `commands/implement_plan.md` | `/implement_plan` command |
| `commands/validate_plan.md` | `/validate_plan` command |
| `commands/decompose_plan.md` | `/decompose_plan` command |
| `commands/create_handoff.md` | `/create_handoff` command |
| `commands/resume_handoff.md` | `/resume_handoff` command |
| `commands/describe_pr.md` | `/describe_pr` command |
| `commands/commit.md` | `/commit` command |
| `commands/worktree.md` | `/worktree` command |
| `commands/generate_prd.md` | `/generate_prd` command |
| `commands/generate_user_flows.md` | `/generate_user_flows` command |
| `commands/generate_tech_spec.md` | `/generate_tech_spec` command |
| `commands/generate_pricing.md` | `/generate_pricing` command |
| `commands/iterate_plan.md` | `/iterate_plan` command |
| `commands/prism_dir_update.md` | `/prism_dir_update` command |
| `commands/prism-debug.md` | `/prism-debug` command |
| `commands/prism-verify.md` | `/prism-verify` command |
| `commands/prism-browse.md` | `/prism-browse` command |
| `commands/prism-screenshot.md` | `/prism-screenshot` command |
| `commands/prism_cli.md` | `/prism_cli` command |
| `commands/cli-install.md` | `/cli-install` command |
| `commands/cli-uninstall.md` | `/cli-uninstall` command |
| `commands/review-setup.md` | `/review-setup` command |
| `commands/retroactive.md` | `/retroactive` command |
| `agents/graph-navigator.md` | Knowledge graph structural analysis agent |
| `agents/codebase-locator.md` | File/component location agent |
| `agents/codebase-analyzer.md` | Code analysis and data flow tracing agent |
| `agents/codebase-pattern-finder.md` | Pattern and example discovery agent |
| `agents/prism-locator.md` | .prism/ document discovery agent |
| `agents/prism-analyzer.md` | .prism/ document insight extraction agent |
| `agents/web-search-researcher.md` | External documentation research agent |
| `agents/log-investigator.md` | Log analysis debug agent |
| `agents/state-investigator.md` | Application state debug agent |
| `agents/git-investigator.md` | Git history debug agent |
| `agents/browser-verifier.md` | Playwright-based browser verification agent |
| `scripts/spectrum.sh` | Bash orchestrator for autonomous multi-story execution |

## Component Analysis

### 1. Plugin Manifest and Discovery Entry Point

**Location**: `.claude-plugin/plugin.json`

**How it works**:
- The manifest at `.claude-plugin/plugin.json:1-8` declares the plugin name as `"prism"` with version `"2.4.9"`
- Claude Code discovers this plugin by detecting the `.claude-plugin/plugin.json` file
- The plugin name `"prism"` becomes the namespace prefix for commands (e.g., `/prism:command-name`), though plugin-prefix is optional when no naming conflicts exist
- Once loaded, Claude Code scans the plugin's `skills/`, `commands/`, and `agents/` directories to register all components

### 2. Skills Layer (Auto-Discovered Orchestrators)

**Location**: `skills/*/SKILL.md`

**How it works**:
- Each skill is a directory containing a `SKILL.md` file with YAML frontmatter
- The frontmatter contains three navigation-critical fields:
  - `name`: unique identifier (e.g., `prism-research`)
  - `description`: natural language trigger phrases that Claude Code matches against user intent
  - `model`: which AI model handles this skill (`sonnet`, `opus`, or `haiku`)
- Claude Code's `Skill` tool reads all skill descriptions and automatically invokes the matching skill when user input matches trigger phrases
- Skills are NOT invoked via `/skill-name` -- they are auto-discovered based on context

**Trigger phrase examples from frontmatter**:
- `prism` skill (`skills/prism/SKILL.md:3`): Triggers on "help me build", "implement this feature", "fix this bug", "prism", "structured workflow"
- `prism-research` skill (`skills/prism-research/SKILL.md:3`): Triggers on "research this", "understand how X works", "map out the system"
- `prism-plan` skill (`skills/prism-plan/SKILL.md:3`): Triggers on "create a plan", "plan the implementation", "design how to build"
- `prism-implement` skill (`skills/prism-implement/SKILL.md:3`): Triggers on "implement the plan", "start building", "execute phase 1"
- `prism-validate` skill (`skills/prism-validate/SKILL.md:3`): Triggers on "validate the plan", "verify implementation", "check if complete"
- `prism-debug` skill (`skills/prism-debug/SKILL.md:3`): Triggers on "debug this", "why is this failing", "investigate the error"
- `prism-spectrum` skill (`skills/prism-spectrum/SKILL.md:3`): Triggers on "spectrum", "execute story", "run spectrum"

**Model assignment convention**:
- Opus: `prism-plan`, `prism-iterate`, `prism-prd`, `prism-visual-docs` (deep analysis)
- Sonnet: `prism`, `prism-research`, `prism-implement`, `prism-validate`, `prism-debug`, `prism-spectrum`, `prism-verify` (general work)
- No skill uses Haiku directly (that is reserved for agents)

**The root skill `prism` acts as a router** (`skills/prism/SKILL.md:37-44`):
- It contains a workflow selection table that maps scenarios to phase combinations
- New feature in unfamiliar codebase: Full R->P->I->V
- Feature in known codebase: P->I->V (skip Research)
- Simple change with clear scope: I->V (skip Research + Plan)
- Trivial fix (<20 lines): Direct implementation

### 3. Commands Layer (Explicit Slash Commands)

**Location**: `commands/*.md`

**How it works**:
- Each `.md` file in `commands/` becomes a user-invocable slash command
- The filename (minus `.md`) becomes the command name: `create_plan.md` -> `/create_plan`
- Commands use YAML frontmatter with `description` and `model` fields
- Unlike skills, commands require explicit user invocation via `/command-name`
- Commands are single-purpose operations (single `.md` file each)

**Command categories**:

Core workflow commands (parallel the skill phases):
- `/research_codebase` (`commands/research_codebase.md:2`) - model: opus
- `/create_plan` (`commands/create_plan.md:2`) - model: opus
- `/implement_plan` (`commands/implement_plan.md:2`) - model: sonnet
- `/validate_plan` (`commands/validate_plan.md:2`) - model: sonnet
- `/decompose_plan` (`commands/decompose_plan.md:2`) - model: opus

Session management commands:
- `/create_handoff` (`commands/create_handoff.md:2`) - model: sonnet
- `/resume_handoff` (`commands/resume_handoff.md:2`) - model: sonnet

Document generation commands:
- `/generate_prd` (`commands/generate_prd.md`)
- `/generate_user_flows` (`commands/generate_user_flows.md`)
- `/generate_tech_spec` (`commands/generate_tech_spec.md`)
- `/generate_pricing` (`commands/generate_pricing.md`)
- `/describe_pr` (`commands/describe_pr.md:2`) - model: sonnet

**Relationship between skills and commands**:
- Skills invoke commands internally. For example, `prism-prd` skill at `skills/prism-prd/SKILL.md:9` invokes the `/generate_prd` command
- `prism-visual-docs` skill at `skills/prism-visual-docs/SKILL.md:9` invokes `/generate_user_flows` and optionally `/generate_tech_spec`
- Commands provide the implementation logic; skills provide the orchestration and workflow context

### 4. Agents Layer (Spawned Specialists)

**Location**: `agents/*.md`

**How it works**:
- Agents are spawned programmatically via `Task(subagent_type="agent-name")`
- Each agent runs in its own isolated context with a custom system prompt
- Agent files use YAML frontmatter with `name`, `description`, `tools`, and `model` fields
- The `tools` field restricts what tools the agent can access
- Agents cannot spawn other agents (no nesting)
- Skills define which agents they use; agents do not self-activate

**Agent categorization by purpose**:

Research agents (used by `prism-research`, `prism-plan`, `research_codebase`):
- `graph-navigator` (`agents/graph-navigator.md:4`) - model: haiku, tools: codebase-memory-mcp
- `codebase-locator` (`agents/codebase-locator.md:3`) - model: haiku, tools: Read, Glob, Grep, Bash
- `codebase-analyzer` (`agents/codebase-analyzer.md:3`) - model: opus, tools: Read, Glob, Grep, Bash
- `codebase-pattern-finder` (`agents/codebase-pattern-finder.md:3`) - model: sonnet, tools: Read, Glob, Grep, Bash
- `prism-locator` (`agents/prism-locator.md:3`) - model: haiku, tools: Read, Glob, Grep
- `prism-analyzer` (`agents/prism-analyzer.md:3`) - model: opus, tools: Read, Glob, Grep
- `web-search-researcher` (`agents/web-search-researcher.md`) - model: sonnet

Debug agents (used by `prism-debug`):
- `log-investigator` (`agents/log-investigator.md`) - log analysis
- `state-investigator` (`agents/state-investigator.md`) - app state checking
- `git-investigator` (`agents/git-investigator.md`) - git history analysis

Verification agents (used by `prism-verify`):
- `browser-verifier` (`agents/browser-verifier.md:3`) - model: haiku, tools: Bash only

**Model assignment follows a cost/capability convention**:
- Haiku for fast, cheap lookups: `codebase-locator`, `prism-locator`, `graph-navigator`, `browser-verifier`
- Opus for deep analysis: `codebase-analyzer`, `prism-analyzer`
- Sonnet for general work: `codebase-pattern-finder`, `web-search-researcher`

### 5. Workflow Phase Navigation (State Machine)

**Location**: `skills/prism/SKILL.md:15-27`

**How it works**:
- The core workflow forms a linear pipeline: Research -> Plan -> Implement -> Validate
- Each phase produces artifacts that the next phase consumes, stored in `.prism/shared/`:
  - Research outputs to `.prism/shared/research/YYYY-MM-DD-topic.md`
  - Plan outputs to `.prism/shared/plans/YYYY-MM-DD-feature.md`
  - Validation outputs to `.prism/shared/validation/YYYY-MM-DD-report.md`

**Phase transition logic** (`skills/prism/SKILL.md:48-61`):
- The `prism` skill checks `.prism/` for existing artifacts to determine where to start
- Nothing exists -> Start with Research
- Research exists -> Start with Plan
- Plan exists (incomplete) -> Resume Implementation
- Implementation done -> Run Validation

**Extended workflow paths**:

Document generation path (`skills/prism/SKILL.md:228-234`):
```
prism-prd -> prism-visual-docs -> prism-plan
```

Debug/iterate path (`skills/prism-debug/SKILL.md:29-34`):
```
Implement (failure) -> Debug -> Iterate
```

Spectrum autonomous path:
```
prism-plan -> /decompose_plan -> spectrum.sh (external loop)
```

### 6. Spectrum External Orchestration

**Location**: `scripts/spectrum.sh`

**How it works**:
- `spectrum.sh` (`scripts/spectrum.sh:1-60`) is a bash script that runs outside Claude Code
- It spawns fresh Claude sessions in a loop, one per story from `stories.json`
- Each session invokes the `prism-spectrum` skill with a specific story
- State persists through files on disk (not AI context):
  - `.prism/stories/stories.json` - story definitions and status
  - `.prism/shared/spectrum/progress.md` - accumulated learnings
- The script derives the progress path from the stories path (`scripts/spectrum.sh:41-60`)
- Supports epic-scoped layouts: `.prism/stories/<epic>/stories.json`
- Environment variables control behavior: `SPECTRUM_MAX_ITERATIONS` (default 50), `SPECTRUM_VERBOSE`, `SPECTRUM_PAUSE` (default 2s)

**Signal protocol**: Stories communicate completion status via output signals:
- `<spectrum-continue>` - move to next story
- `<spectrum-retry>` - retry current story
- `<spectrum-blocked>` - story is blocked
- `<spectrum-error>` - error occurred
- `<promise>COMPLETE</promise>` - story finished successfully

### 7. Context Management Navigation

**Location**: `skills/prism/SKILL.md:237-243`

**How it works**:
- The plugin tracks context window usage to decide when to transition phases
- < 40% context used: Continue current phase
- 40-60% context used: Consider phase transition
- \> 60% context used: Save state and start fresh session
- Handoff documents (`/create_handoff`) preserve state across sessions
- Resumption (`/resume_handoff`) loads state from handoff documents

### 8. `.prism/` Directory as Navigation State Store

**Location**: `.prism/shared/`

**How it works**:
- The `.prism/` directory serves as the persistent state machine for workflow navigation
- Skills check for existing artifacts to determine workflow position
- File naming convention (`YYYY-MM-DD-topic.md`) provides chronological ordering
- The `prism-locator` agent is dedicated to searching this directory
- Structure:
  - `shared/research/` - research phase outputs
  - `shared/plans/` - planning phase outputs
  - `shared/validation/` - validation phase outputs
  - `shared/handoffs/` - session transfer documents
  - `shared/spectrum/` - autonomous execution state
  - `shared/prs/` - PR descriptions
  - `shared/ref/` - reference materials
  - `shared/docs/` - project documentation
  - `stories/` - Spectrum story definitions

## Patterns Found

### Pattern 1: YAML Frontmatter Discovery

**Example at**: `skills/prism-research/SKILL.md:1-5`

```yaml
---
name: prism-research
description: Research phase for complex coding tasks. Use when exploring a codebase before planning implementation. Triggers on "research this", "understand how X works"...
model: sonnet
---
```

**Also used in**:
- All 13 skill files in `skills/*/SKILL.md`
- All 25 command files in `commands/*.md` (use `description` only, no `name`)
- All 11 agent files in `agents/*.md` (add `tools` field)

### Pattern 2: Agent Spawning via Task Tool

**Example at**: `skills/prism-research/SKILL.md:45-47`

```
Task(subagent_type="prism-locator")
"Find existing research about [topic]"
```

**Also used in**:
- `skills/prism/SKILL.md:53-55` - prism-locator for checking existing work
- `skills/prism-plan/SKILL.md:27-30` - codebase-analyzer, codebase-pattern-finder, prism-analyzer
- `skills/prism-debug/SKILL.md` - log-investigator, state-investigator, git-investigator
- `skills/prism-verify/SKILL.md:27-28` - browser-verifier
- `commands/research_codebase.md:38-42` - graph-navigator, codebase-locator, codebase-analyzer

### Pattern 3: Documentarian Principle

**Example at**: `agents/codebase-locator.md:10-17`

```markdown
## CRITICAL: YOUR ONLY JOB IS TO DOCUMENT AND EXPLAIN THE CODEBASE AS IT EXISTS TODAY
- DO NOT suggest improvements or changes unless the user explicitly asks
- DO NOT perform root cause analysis unless the user explicitly asks
- DO NOT critique the implementation
- ONLY describe what exists, where it exists, and how components are organized
```

**Also used in**:
- `agents/codebase-analyzer.md:10-17`
- `agents/codebase-pattern-finder.md:10-15`
- `agents/graph-navigator.md:10-13`
- `agents/browser-verifier.md:10-14`
- `skills/prism-research/SKILL.md:11-18`

### Pattern 4: Phase-to-Phase Artifact Handoff

**Example at**: `skills/prism-plan/SKILL.md:19-21`

```markdown
## Prerequisites
- Research exists in `.prism/shared/research/` OR
- Sufficient codebase understanding from current session
```

**Also used in**:
- `skills/prism-implement/SKILL.md:13-15` - requires approved plan in `.prism/shared/plans/`
- `skills/prism-validate/SKILL.md:13-14` - requires plan and implementation
- `skills/prism-visual-docs/SKILL.md:28-30` - locates relevant PRD first

### Pattern 5: Parallel Agent Execution

Research and debug skills spawn multiple agents concurrently for efficiency.

**Example at**: `skills/prism-research/SKILL.md:58-65`

Steps 2-4 of the research workflow spawn `codebase-locator`, `codebase-analyzer`, `codebase-pattern-finder`, `prism-locator`, and `web-search-researcher` in parallel, then synthesize after all complete.

**Also used in**:
- `commands/research_codebase.md:34-43` - spawns parallel sub-agent tasks
- `skills/prism-debug/SKILL.md` - spawns log-investigator, state-investigator, git-investigator in parallel

## Architecture Notes

- **Three-layer hierarchy**: Skills orchestrate, Commands execute, Agents specialize. Skills invoke commands and spawn agents. Commands spawn agents. Agents do not spawn other agents.
- **Plugin packaging**: The `.claude-plugin/plugin.json` manifest at the repo root makes this an installable Claude Code plugin. The `commands/`, `skills/`, and `agents/` directories at the root are the standard plugin layout.
- **Dual invocation model**: Skills use automatic context-based discovery (Claude Code's Skill tool matches descriptions). Commands use explicit `/command-name` invocation. Both coexist and skills frequently delegate to commands internally.
- **File-based state machine**: Workflow progression is determined by the presence/absence of files in `.prism/shared/` subdirectories. There is no database or in-memory state -- navigation state lives entirely in the filesystem.
- **Model tiering convention**: Opus handles deep analysis, Sonnet handles general work, Haiku handles fast lookups. This is applied consistently across both skills and agents.
- **Context isolation**: Each agent runs in its own context window with restricted tools. This prevents agents from consuming the main conversation's context budget and enforces separation of concerns.

## Historical Context

From `.prism/` directory:

- `.prism/shared/ref/docs/slash-commands.md` - Claude Code documentation on slash command mechanics, skill vs command differences, and the Skill tool
- `.prism/shared/ref/docs/plugins.md` - Claude Code plugin creation documentation, plugin structure, manifest format
- `.prism/shared/ref/docs/sub-agents.md` - Claude Code subagent documentation covering built-in agents, custom agent creation, frontmatter fields

## Open Questions

- [ ] How does the `Skill` tool's 15,000 character budget limit affect which skills are visible when all 13 skills are loaded?
- [ ] Is there a priority or precedence order when multiple skills match the same user input?
- [ ] How does the `disable-model-invocation` frontmatter field interact with Prism skills -- are any skills currently using it?
- [ ] What is the exact mechanism by which `spectrum.sh` invokes the `prism-spectrum` skill in each fresh Claude session?

## Code References

Quick navigation:

| Reference | Description |
|-----------|-------------|
| `.claude-plugin/plugin.json:1-8` | Plugin manifest with name and version |
| `skills/prism/SKILL.md:15-27` | Core workflow phase table |
| `skills/prism/SKILL.md:37-44` | Workflow selection matrix (complexity -> phases) |
| `skills/prism/SKILL.md:48-61` | State-based workflow resumption logic |
| `skills/prism/SKILL.md:228-234` | Document generation flow diagram |
| `skills/prism-research/SKILL.md:1-5` | Skill frontmatter with trigger phrases |
| `skills/prism-research/SKILL.md:22-33` | Agent table for research phase |
| `skills/prism-debug/SKILL.md:29-34` | Debug workflow position diagram |
| `skills/prism-spectrum/SKILL.md:1-4` | Spectrum skill frontmatter |
| `commands/research_codebase.md:34-43` | Parallel agent spawning pattern |
| `commands/create_plan.md:49-66` | Agent usage in planning |
| `commands/decompose_plan.md:1-3` | Plan-to-stories decomposition entry |
| `agents/codebase-locator.md:1-6` | Agent frontmatter with tools and model |
| `agents/graph-navigator.md:1-6` | Graph-first agent configuration |
| `scripts/spectrum.sh:1-60` | External bash orchestrator |
