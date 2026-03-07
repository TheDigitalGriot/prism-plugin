---
date: 2026-03-07
researcher: Claude
git_commit: 33f2cac
branch: main
repository: prism-plugin
topic: "Agent Spawning Architecture"
tags: [research, agents, skills, task-tool, architecture]
status: complete
---

# Research: Agent Spawning Architecture

## Research Question

How do skills invoke agents via the Task tool in the Prism plugin codebase?

## Summary

Prism uses a three-layer architecture where Skills (orchestrators) invoke Agents (specialists) via the `Task(subagent_type="agent-name")` call pattern. There are 11 agent definitions in `agents/*.md`, each with YAML frontmatter specifying a name, model assignment, and tool restrictions. Eight of the 13 skills spawn agents; the remaining five (prism-implement, prism-validate, prism-release, prism-docs-update, prism-spectrum) either operate without agents or use commands/scripts instead.

## Files Discovered

| File | Purpose |
|------|---------|
| `CLAUDE.md:27-31` | Documents the three-layer architecture and Task invocation syntax |
| `skills/prism-research/SKILL.md` | Research skill — spawns 6 agents |
| `skills/prism-plan/SKILL.md` | Plan skill — spawns 1 agent |
| `skills/prism-debug/SKILL.md` | Debug skill — spawns 3 agents |
| `skills/prism-verify/SKILL.md` | Verify skill — spawns 1 agent |
| `skills/prism/SKILL.md` | Root orchestrator skill — spawns 1 agent, documents all agents |
| `skills/prism-iterate/SKILL.md` | Iterate skill — spawns 3 agents conditionally |
| `skills/prism-prd/SKILL.md` | PRD skill — spawns 1 agent |
| `skills/prism-visual-docs/SKILL.md` | Visual docs skill — spawns 1 agent |
| `skills/prism-implement/SKILL.md` | Implement skill — spawns no agents |
| `skills/prism-validate/SKILL.md` | Validate skill — spawns no agents |
| `skills/prism-spectrum/SKILL.md` | Spectrum skill — references debug agents in diagrams |
| `skills/prism-release/SKILL.md` | Release skill — spawns no agents |
| `skills/prism-docs-update/SKILL.md` | Docs update skill — spawns no agents (uses different `Agent()` syntax) |
| `agents/graph-navigator.md` | Structural code analysis via knowledge graph |
| `agents/codebase-locator.md` | File/component location finding |
| `agents/codebase-analyzer.md` | Implementation detail analysis |
| `agents/codebase-pattern-finder.md` | Pattern discovery and cataloging |
| `agents/prism-locator.md` | `.prism/` directory document search |
| `agents/prism-analyzer.md` | Deep analysis of `.prism/` documents |
| `agents/web-search-researcher.md` | External web research |
| `agents/browser-verifier.md` | Browser UI verification via playwright-cli |
| `agents/log-investigator.md` | Log file analysis for debugging |
| `agents/state-investigator.md` | Application state inspection |
| `agents/git-investigator.md` | Git history analysis |
| `.prism/shared/research/2026-02-22-prism-plugin-architecture.md` | Prior research documenting agent invocation patterns |

## Component Analysis

### The Task Invocation Mechanism

**Location**: Referenced throughout `skills/*/SKILL.md` and `CLAUDE.md`

**How it works**:
- Skills invoke agents using the syntax: `Task(subagent_type="agent-name")`
- The `subagent_type` parameter value matches the `name` field in the agent's YAML frontmatter
- A natural-language prompt string follows the Task call, describing what the agent should do
- The Task tool spawns a subprocess with the agent's designated model and restricted tool set
- Multiple Task calls can run in parallel when investigating different areas simultaneously

**Invocation syntax** (from `CLAUDE.md:31`):
```
Task(subagent_type="agent-name")
```

**Example with prompt** (from `skills/prism-research/SKILL.md:45-46`):
```
Task(subagent_type="prism-locator")
"Find existing research about [topic]"
```

### Agent Definition Structure

**Location**: `agents/*.md`

**How it works**:
Each agent is a markdown file with YAML frontmatter containing three key fields:
1. `name` — the identifier used in `subagent_type` (e.g., `codebase-locator`)
2. `model` — the AI model tier to use (haiku, sonnet, or opus)
3. `tools` — comma-separated list of tools the agent is allowed to use
4. `description` — includes the `Task tool with subagent_type="..."` invocation hint

The body of each agent file contains:
- Role description ("You are a specialist at...")
- Core responsibilities
- Output format specification
- Rules and constraints
- The "documentarian, not critic" principle (for research agents)

**Example frontmatter** (from `agents/codebase-locator.md:1-5`):
```yaml
---
name: codebase-locator
description: Locates files, directories, and components relevant to a feature or task. Use Task tool with subagent_type="codebase-locator"...
tools: Read, Glob, Grep, Bash
model: haiku
---
```

### Model Assignment Convention

**Location**: `CLAUDE.md:34-36` and individual agent frontmatter

**How it works**:
Agents are assigned to model tiers based on task complexity:

| Model | Purpose | Agents |
|-------|---------|--------|
| **Opus** | Deep analysis | `codebase-analyzer`, `prism-analyzer` |
| **Sonnet** | General work | `codebase-pattern-finder`, `web-search-researcher` |
| **Haiku** | Fast lookups | `codebase-locator`, `prism-locator`, `graph-navigator`, `browser-verifier`, `log-investigator`, `state-investigator`, `git-investigator` |

### Tool Restrictions Per Agent

**Location**: Agent YAML frontmatter `tools` field

Each agent has a restricted tool set that defines what operations it can perform:

| Agent | Tools |
|-------|-------|
| `graph-navigator` | codebase-memory-mcp (all 11 tools) |
| `codebase-locator` | Read, Glob, Grep, Bash |
| `codebase-analyzer` | Read, Glob, Grep, Bash |
| `codebase-pattern-finder` | Read, Glob, Grep, Bash |
| `prism-locator` | Read, Glob, Grep |
| `prism-analyzer` | Read, Glob, Grep |
| `web-search-researcher` | WebSearch, WebFetch, Read |
| `browser-verifier` | Bash |
| `log-investigator` | (not specified in frontmatter, uses Bash in practice) |
| `state-investigator` | (not specified in frontmatter, uses Bash in practice) |
| `git-investigator` | (not specified in frontmatter, uses Bash in practice) |

### Skill-to-Agent Mapping

**Location**: Individual skill SKILL.md files

**How it works**:
Each skill that spawns agents has an "Available Agents" table and uses Task calls in its workflow steps. The complete mapping:

#### prism-research (`skills/prism-research/SKILL.md:22-33`)
Spawns up to 6 agents in a structured sequence:
1. `prism-locator` — Step 1: Check existing knowledge (line 45)
2. `graph-navigator` — Step 1b: Structural orientation (line 52)
3. `codebase-locator` — Step 2: Locate code (line 59)
4. `codebase-analyzer` — Step 3: Analyze components (line 66)
5. `codebase-pattern-finder` — Step 4: Find patterns (line 73)
6. `web-search-researcher` — Step 5: External research (line 80)

#### prism-plan (`skills/prism-plan/SKILL.md:38`)
Spawns 1 agent:
1. `prism-analyzer` — Step 1: Load context from research docs

#### prism-debug (`skills/prism-debug/SKILL.md:62-85`)
Spawns 3 agents in parallel:
1. `log-investigator` — Investigate logs (line 64)
2. `state-investigator` — Check app state (line 72)
3. `git-investigator` — Analyze git history (line 80)

#### prism-verify (`skills/prism-verify/SKILL.md:29, 76`)
Spawns 1 agent:
1. `browser-verifier` — Execute playwright-cli checks

#### prism (root) (`skills/prism/SKILL.md:53`)
Spawns 1 agent:
1. `prism-locator` — Check for existing work before starting workflow

#### prism-iterate (`skills/prism-iterate/SKILL.md:97-101`)
Conditionally spawns 3 agents ("Only spawn research tasks if changes require new technical understanding"):
1. `codebase-locator` — Find relevant files (line 98)
2. `codebase-analyzer` — Understand implementation (line 99)
3. `codebase-pattern-finder` — Find similar patterns (line 100)

#### prism-prd (`skills/prism-prd/SKILL.md:33`)
Spawns 1 agent:
1. `prism-locator` — Find existing research or documentation

#### prism-visual-docs (`skills/prism-visual-docs/SKILL.md:33`)
Spawns 1 agent:
1. `prism-locator` — Find the relevant PRD

### Parallel vs Sequential Spawning

**Location**: `skills/prism-research/SKILL.md:106`, `skills/prism-debug/SKILL.md:185`, `.prism/shared/research/2026-02-22-prism-plugin-architecture.md:638-671`

**How it works**:
The architecture supports two spawning patterns:

1. **Parallel spawning**: Multiple agents launched simultaneously for independent investigations. Used by:
   - `prism-research`: Steps 2-4 (codebase-locator, codebase-analyzer, codebase-pattern-finder) run in parallel (`SKILL.md:106`: "Run agents in parallel when searching different areas")
   - `prism-debug`: All three investigation agents always run in parallel (`SKILL.md:185`: "Always spawn investigation agents in parallel")

2. **Sequential spawning**: Agents that depend on prior results run after earlier agents complete. Used by:
   - `prism-research`: Step 1 (prism-locator) runs first to check existing knowledge, then parallel agents run, then results are synthesized
   - `prism-plan`: prism-analyzer runs first to load context before the planning workflow begins

The prior architecture research at `.prism/shared/research/2026-02-22-prism-plugin-architecture.md:638-671` documents these parallel/sequential patterns with ASCII flow diagrams.

### Agent Functional Categories

**Location**: `skills/prism/SKILL.md:255-276`

Agents are organized into two functional groups:

**Research Agents** (7 agents):
- `graph-navigator` — Structural analysis via knowledge graph
- `codebase-locator` — Find WHERE code lives
- `codebase-analyzer` — Understand HOW code works
- `codebase-pattern-finder` — Find patterns to follow
- `prism-locator` — Find existing docs in `.prism/`
- `prism-analyzer` — Extract insights from docs
- `web-search-researcher` — External research

**Debug Agents** (3 agents):
- `log-investigator` — Analyze logs for errors
- `state-investigator` — Check app state and config
- `git-investigator` — Analyze git history

**Verification Agent** (1 agent, not listed in the root skill's table):
- `browser-verifier` — Browser UI verification via playwright-cli

### The "Documentarian, Not Critic" Constraint

**Location**: `skills/prism-research/SKILL.md:11-18`, all research agent files

**How it works**:
All research agents share a core behavioral constraint documented in their agent files. Each research agent's markdown begins with a "CRITICAL" section stating:
- DO NOT suggest improvements or changes
- DO NOT critique the implementation
- DO NOT perform root cause analysis (unless asked)
- ONLY describe what exists, where it exists, how it works

This principle is documented in the prior architecture research at `.prism/shared/research/2026-02-22-prism-plugin-architecture.md:674-695`.

## Patterns Found

### Pattern 1: Task Invocation with Prompt String

**Example at**: `skills/prism-debug/SKILL.md:64-68`

```
Task(subagent_type="log-investigator")
"Investigate recent logs for errors related to: [issue description]
Look in common locations: logs/, ./logs/, application output
Search for: errors, warnings, stack traces, timestamps around failure
Return: Key findings with timestamps and severity"
```

**Also used in**:
- `skills/prism-research/SKILL.md:45-46` — prism-locator with topic search
- `skills/prism-plan/SKILL.md:38-39` — prism-analyzer with research doc
- `skills/prism-verify/SKILL.md:76-81` — browser-verifier with session/URL/checks

### Pattern 2: Agent Table Declaration in Skills

**Example at**: `skills/prism-research/SKILL.md:22-33`

```markdown
## Available Agents

Invoke via Task tool with subagent_type:

| Agent | Purpose |
|-------|---------|
| `graph-navigator` | Structural analysis via knowledge graph |
| `codebase-locator` | Find WHERE files/components live |
```

**Also used in**:
- `skills/prism-plan/SKILL.md:27-31`
- `skills/prism-debug/SKILL.md:176-181`
- `skills/prism-verify/SKILL.md:25-28`
- `skills/prism/SKILL.md:255-276`

### Pattern 3: Conditional Agent Spawning

**Example at**: `skills/prism-iterate/SKILL.md:95-101`

```markdown
## Research When Needed

Only spawn research tasks if changes require new technical understanding:

Task(subagent_type="codebase-locator")    # Find relevant files
Task(subagent_type="codebase-analyzer")   # Understand implementation
Task(subagent_type="codebase-pattern-finder")  # Find similar patterns
```

This pattern gates agent spawning on a conditional ("if changes require new technical understanding"), unlike prism-research which always spawns agents.

### Pattern 4: Agent Description Self-Documentation

**Example at**: `agents/codebase-locator.md:3`

```
description: Locates files, directories, and components relevant to a feature or task. Use Task tool with subagent_type="codebase-locator" and describe what you're looking for.
```

Every agent's `description` field in its YAML frontmatter includes the exact `Task tool with subagent_type="..."` invocation syntax. This serves as self-documentation so that Claude's skill auto-discovery can surface the correct invocation pattern.

**Also used in**:
- `agents/codebase-analyzer.md:3`
- `agents/codebase-pattern-finder.md:3`
- `agents/prism-locator.md:3`
- `agents/prism-analyzer.md:3`
- `agents/web-search-researcher.md:3`
- `agents/browser-verifier.md:3`
- `agents/graph-navigator.md:3`

### Pattern 5: Alternative Agent Syntax in prism-docs-update

**Example at**: `skills/prism-docs-update/SKILL.md:42-43`

```
Agent(subagent_type="general-purpose", description="Compare doc sections to site pages")
```

The `prism-docs-update` skill uses `Agent()` instead of `Task()` and references a `"general-purpose"` subagent type that does not correspond to any agent definition in `agents/`. This is a distinct invocation pattern from the standard `Task(subagent_type="agent-name")` used by all other skills.

## Historical Context

From `.prism/` directory:

- `.prism/shared/research/2026-02-22-prism-plugin-architecture.md` — Comprehensive prior research documenting the full plugin architecture including agent invocation patterns (Section 7: Agent Architecture, lines 600-695)
- `.prism/shared/docs/PRISM-DOCUMENTATION-2.4.4.md:306` — Official documentation stating "Agents live at `agents/` and are spawned via `Task(subagent_type="agent-name")`. They run as parallel subprocesses, each with a designated model and restricted tool set."

## Architecture Notes

- **Convention**: All agent files live in `agents/` at the repository root as flat `.md` files
- **Convention**: All skill files live in `skills/<skill-name>/SKILL.md` with optional `references/` subdirectories
- **Convention**: Agent names use `<domain>-<role>` format (e.g., `codebase-locator`, `log-investigator`)
- **Convention**: Skill names use `prism-<phase>` format (e.g., `prism-research`, `prism-plan`)
- **Pattern**: Skills declare their available agents in a markdown table before using them in workflow steps
- **Pattern**: The `description` field in agent YAML frontmatter always includes the `Task tool with subagent_type="..."` hint for discoverability
- **Decision**: Model assignment is based on task complexity: Opus for deep analysis, Sonnet for general work, Haiku for fast lookups
- **Decision**: Tool restrictions per agent enforce separation of concerns (e.g., prism-locator has no Bash access, browser-verifier has only Bash)

## Open Questions

- [ ] How does the Claude Code runtime actually parse the `Task(subagent_type="...")` syntax from the skill/agent markdown and spawn the subprocess?
- [ ] What is the relationship between the `Agent()` syntax used in `prism-docs-update` and the standard `Task()` syntax?
- [ ] Are the `log-investigator`, `state-investigator`, and `git-investigator` agents missing explicit `tools` fields in their YAML frontmatter intentionally, or is this an oversight?

## Code References

Quick navigation:

| Reference | Description |
|-----------|-------------|
| `CLAUDE.md:27-31` | Three-layer architecture definition |
| `CLAUDE.md:34-36` | Model assignment convention |
| `skills/prism-research/SKILL.md:22-33` | Research agent table |
| `skills/prism-research/SKILL.md:44-81` | Six-step agent spawning workflow |
| `skills/prism-research/SKILL.md:106` | Parallel execution rule |
| `skills/prism-debug/SKILL.md:62-85` | Three parallel debug agents |
| `skills/prism-debug/SKILL.md:185` | "Always spawn investigation agents in parallel" rule |
| `skills/prism-plan/SKILL.md:38-39` | prism-analyzer Task invocation |
| `skills/prism-verify/SKILL.md:29` | browser-verifier invocation reference |
| `skills/prism-verify/SKILL.md:76-81` | browser-verifier Task with session params |
| `skills/prism/SKILL.md:53-54` | Root skill prism-locator check |
| `skills/prism/SKILL.md:255-276` | Complete agent inventory table |
| `skills/prism-iterate/SKILL.md:95-101` | Conditional agent spawning |
| `skills/prism-prd/SKILL.md:33` | PRD prism-locator check |
| `skills/prism-visual-docs/SKILL.md:33` | Visual docs prism-locator check |
| `skills/prism-docs-update/SKILL.md:42-43` | Alternative Agent() syntax |
| `agents/codebase-locator.md:1-5` | Agent YAML frontmatter example |
| `agents/graph-navigator.md:3` | Graph-navigator description with Task hint |
| `.prism/shared/research/2026-02-22-prism-plugin-architecture.md:638-671` | Prior research: agent invocation flow diagrams |
| `.prism/shared/research/2026-02-22-prism-plugin-architecture.md:674-695` | Prior research: documentarian principle |
| `.prism/shared/docs/PRISM-DOCUMENTATION-2.4.4.md:306` | Official docs: agent spawning description |
