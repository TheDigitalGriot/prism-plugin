---
date: 2026-03-07
researcher: Claude
git_commit: 33f2cac
branch: main
repository: prism-plugin
topic: "Agent Spawning Architecture — How Skills Invoke Agents via the Task Tool"
tags: [research, agents, skills, task-tool, architecture, spawning]
status: complete
---

# Research: Agent Spawning Architecture — How Skills Invoke Agents via the Task Tool

## Research Question

How do skills invoke agents via the Task tool in this codebase? What is the agent spawning architecture?

## Summary

Skills invoke agents using `Task(subagent_type="agent-name")` calls, where the `subagent_type` string matches the filename (minus `.md`) of an agent definition in the `agents/` directory. Each agent is a standalone markdown file with YAML frontmatter declaring its `name`, `description`, `tools`, and `model` assignment. Skills act as orchestrators that spawn one or more agents (often in parallel) to perform specialized work, then synthesize the results. There is also a secondary invocation pattern using `Agent(subagent_type="general-purpose")` found in the `prism-docs-update` skill.

## Files Discovered

| File | Purpose |
|------|---------|
| `skills/prism/SKILL.md` | Root orchestrator skill; documents all agents and the `Task(subagent_type=...)` invocation pattern |
| `skills/prism-research/SKILL.md` | Research phase skill; spawns 6 agents via Task |
| `skills/prism-plan/SKILL.md` | Planning phase skill; spawns `prism-analyzer` via Task |
| `skills/prism-implement/SKILL.md` | Implementation phase skill; does NOT spawn agents |
| `skills/prism-validate/SKILL.md` | Validation phase skill; does NOT spawn agents |
| `skills/prism-verify/SKILL.md` | Browser verification skill; spawns `browser-verifier` via Task |
| `skills/prism-debug/SKILL.md` | Debug skill; spawns 3 investigation agents in parallel via Task |
| `skills/prism-iterate/SKILL.md` | Iteration skill; conditionally spawns 3 research agents via Task |
| `skills/prism-spectrum/SKILL.md` | Spectrum autonomous execution; spawns 3 debug agents via Task on failure |
| `skills/prism-prd/SKILL.md` | PRD generation skill; spawns `prism-locator` via Task |
| `skills/prism-visual-docs/SKILL.md` | Visual docs skill; spawns `prism-locator` via Task |
| `skills/prism-docs-update/SKILL.md` | Docs update skill; uses `Agent(subagent_type="general-purpose")` pattern |
| `agents/codebase-locator.md` | Agent: finds WHERE code lives (model: haiku, tools: Read, Glob, Grep, Bash) |
| `agents/codebase-analyzer.md` | Agent: understands HOW code works (model: opus, tools: Read, Glob, Grep, Bash) |
| `agents/codebase-pattern-finder.md` | Agent: finds patterns to model after (model: sonnet, tools: Read, Glob, Grep, Bash) |
| `agents/prism-locator.md` | Agent: finds existing docs in `.prism/` (model: haiku, tools: Read, Glob, Grep) |
| `agents/prism-analyzer.md` | Agent: extracts insights from docs (model: opus, tools: Read, Glob, Grep) |
| `agents/web-search-researcher.md` | Agent: external web research (model: sonnet, tools: WebSearch, WebFetch, Read) |
| `agents/browser-verifier.md` | Agent: browser verification via playwright-cli (model: haiku, tools: Bash) |
| `agents/graph-navigator.md` | Agent: knowledge graph queries (model: haiku, tools: codebase-memory-mcp) |
| `agents/log-investigator.md` | Agent: log analysis for debugging (model: haiku) |
| `agents/state-investigator.md` | Agent: app state inspection for debugging (model: haiku) |
| `agents/git-investigator.md` | Agent: git history analysis for debugging (model: haiku) |
| `commands/create_plan.md` | Command: shows alternate Task spawning syntax (without subagent_type) |

## Component Analysis

### The Task Invocation Mechanism

**Location**: Referenced across all skill files in `skills/*/SKILL.md`

**How it works**:
- The canonical invocation syntax is: `Task(subagent_type="agent-name")`
- The `subagent_type` value corresponds to the agent markdown filename minus the `.md` extension in the `agents/` directory
- After the Task call, a natural-language prompt string is provided describing what the agent should do
- Example at `skills/prism-research/SKILL.md:44-46`:
  ```
  Task(subagent_type="prism-locator")
  "Find existing research about [topic]"
  ```
- The root skill documents this pattern at `skills/prism/SKILL.md:276`:
  ```
  Invoke via: `Task(subagent_type="agent-name")`
  ```

**Data flow**:
```
Skill (orchestrator) → Task(subagent_type="agent-name") + prompt → Agent runs with its declared tools/model → Returns findings → Skill synthesizes results
```

### Agent Definition Structure

**Location**: `agents/*.md`

**How it works**:
- Each agent is a markdown file with YAML frontmatter containing four fields:
  - `name`: Agent identifier (matches filename)
  - `description`: What the agent does and when to use it
  - `tools`: Comma-separated list of tools the agent can access
  - `model`: Which AI model runs the agent (haiku, sonnet, or opus)
- The body of the markdown file contains the agent's system prompt: its responsibilities, search strategies, output format, and behavioral rules
- Three agents (log-investigator, state-investigator, git-investigator) use a non-frontmatter format with `## Model` heading instead of YAML frontmatter

**Agent definitions with YAML frontmatter** (at `agents/<name>.md:1-6`):
```yaml
---
name: codebase-locator
description: Locates files...
tools: Read, Glob, Grep, Bash
model: haiku
---
```

**Agent definitions without YAML frontmatter** (at `agents/log-investigator.md:1-6`):
```markdown
# Log Investigator Agent
...
## Model
haiku
```

### Model Assignment Convention

**Location**: YAML frontmatter `model:` field in each agent file

**How it works**:
- **Opus** (deep analysis): `codebase-analyzer` (`agents/codebase-analyzer.md:5`), `prism-analyzer` (`agents/prism-analyzer.md:5`)
- **Sonnet** (general work): `codebase-pattern-finder` (`agents/codebase-pattern-finder.md:5`), `web-search-researcher` (`agents/web-search-researcher.md:5`)
- **Haiku** (fast lookups): `codebase-locator` (`agents/codebase-locator.md:5`), `prism-locator` (`agents/prism-locator.md:5`), `browser-verifier` (`agents/browser-verifier.md:5`), `graph-navigator` (`agents/graph-navigator.md:5`), `log-investigator` (`agents/log-investigator.md:6`), `state-investigator` (`agents/state-investigator.md:6`), `git-investigator` (`agents/git-investigator.md:6`)

### Tool Assignment per Agent

**Location**: YAML frontmatter `tools:` field in each agent file

**How it works**:
- Each agent declares which tools it can access, scoping its capabilities:
  - `Read, Glob, Grep, Bash` — full codebase exploration (codebase-locator, codebase-analyzer, codebase-pattern-finder)
  - `Read, Glob, Grep` — read-only exploration without Bash (prism-locator, prism-analyzer)
  - `WebSearch, WebFetch, Read` — web research (web-search-researcher)
  - `Bash` — command execution only (browser-verifier)
  - `codebase-memory-mcp (all 11 tools)` — graph tools only (graph-navigator)

### Skill-to-Agent Spawning Map

**Location**: Various skill files

**How it works** — each skill spawns specific agents:

| Skill | Agents Spawned | Parallel? | Location |
|-------|---------------|-----------|----------|
| `prism-research` | prism-locator, graph-navigator, codebase-locator, codebase-analyzer, codebase-pattern-finder, web-search-researcher | Yes (Steps 1-5) | `skills/prism-research/SKILL.md:44-80` |
| `prism-plan` | prism-analyzer, codebase-analyzer, codebase-pattern-finder | No (Step 1 only) | `skills/prism-plan/SKILL.md:38` |
| `prism-debug` | log-investigator, state-investigator, git-investigator | Yes (all 3 in parallel) | `skills/prism-debug/SKILL.md:64-85` |
| `prism-verify` | browser-verifier | No (single agent) | `skills/prism-verify/SKILL.md:76` |
| `prism-iterate` | codebase-locator, codebase-analyzer, codebase-pattern-finder | Conditional (only if research needed) | `skills/prism-iterate/SKILL.md:98-101` |
| `prism-spectrum` | log-investigator, state-investigator, git-investigator | Yes (on quality gate failure) | `skills/prism-spectrum/SKILL.md:313-319` |
| `prism-prd` | prism-locator | No (Step 1 only) | `skills/prism-prd/SKILL.md:33` |
| `prism-visual-docs` | prism-locator | No (Step 1 only) | `skills/prism-visual-docs/SKILL.md:33` |
| `prism` (root) | prism-locator | No (context check only) | `skills/prism/SKILL.md:53` |
| `prism-implement` | (none) | N/A | `skills/prism-implement/SKILL.md` |
| `prism-validate` | (none) | N/A | `skills/prism-validate/SKILL.md` |

### Alternative Invocation Pattern: Agent()

**Location**: `skills/prism-docs-update/SKILL.md:42,92`

**How it works**:
- The `prism-docs-update` skill uses a different syntax: `Agent(subagent_type="general-purpose", description="...")`
- This appears at line 42: `Agent(subagent_type="general-purpose", description="Compare doc sections to site pages")`
- And at line 92: `Agent(subagent_type="general-purpose", description="Update [section-name] pages")`
- This uses `"general-purpose"` rather than a named agent from the `agents/` directory
- The `description` parameter provides the prompt inline rather than as a separate string

### Alternative Invocation Pattern: Task() without subagent_type

**Location**: `commands/create_plan.md:426-431`

**How it works**:
- The `create_plan` command shows a Python-like pseudocode example of spawning concurrent tasks:
  ```python
  tasks = [
      Task("Research database schema", db_research_prompt),
      Task("Find API patterns", api_research_prompt),
  ]
  ```
- This is a conceptual example (pseudocode) rather than the actual invocation syntax used in skills
- The actual skill files consistently use `Task(subagent_type="agent-name")` with a quoted prompt string on the next line

## Patterns Found

### Pattern 1: Parallel Agent Spawning for Investigation

**Example at**: `skills/prism-debug/SKILL.md:62-85`

```
Task(subagent_type="log-investigator")
"Investigate recent logs for errors related to: [issue description]..."

Task(subagent_type="state-investigator")
"Check application state for anomalies related to: [issue description]..."

Task(subagent_type="git-investigator")
"Analyze git history for changes related to: [issue description]..."
```

**Also used in**:
- `skills/prism-spectrum/SKILL.md:313-319` (same 3 debug agents on quality gate failure)
- `skills/prism-research/SKILL.md:44-80` (5-6 research agents in parallel)

### Pattern 2: Single Agent Spawning for Context Loading

**Example at**: `skills/prism-prd/SKILL.md:33-34`

```
Task(subagent_type="prism-locator")
"Find existing research or documentation about [topic]"
```

**Also used in**:
- `skills/prism-visual-docs/SKILL.md:33` (prism-locator for PRD lookup)
- `skills/prism/SKILL.md:53` (prism-locator for existing work check)
- `skills/prism-plan/SKILL.md:38` (prism-analyzer for research doc analysis)

### Pattern 3: Conditional Agent Spawning

**Example at**: `skills/prism-iterate/SKILL.md:96-101`

The skill only spawns research agents "if changes require new technical understanding":
```
Task(subagent_type="codebase-locator")    # Find relevant files
Task(subagent_type="codebase-analyzer")   # Understand implementation
Task(subagent_type="codebase-pattern-finder")  # Find similar patterns
```

### Pattern 4: Documentarian Principle in Agent Prompts

**Example at**: `agents/codebase-locator.md:128`

Every research and analysis agent contains a "CRITICAL" section and a "REMEMBER" footer enforcing the documentarian principle:
```
## CRITICAL: YOUR ONLY JOB IS TO DOCUMENT AND EXPLAIN THE CODEBASE AS IT EXISTS TODAY
- DO NOT suggest improvements or changes unless the user explicitly asks
...
## REMEMBER: You are a documentarian, not a critic or consultant
```

**Also used in**:
- `agents/codebase-analyzer.md:10-17,150`
- `agents/codebase-pattern-finder.md:10-17,233`
- `agents/browser-verifier.md:10-14`

## Historical Context

From `.prism/` directory:

- `.prism/shared/research/2026-02-22-prism-plugin-architecture.md` - Previous architecture research
- `.prism/shared/docs/PRISM-DOCUMENTATION-2.4.4.md` - Full documentation covering agent architecture
- `.prism/shared/research/2026-02-28-prism-shared-architecture.md` - Shared architecture research

## Architecture Notes

- **Three-Layer Architecture**: Skills (Orchestrators) invoke Commands (Operations) and spawn Agents (Specialists) via Task tool. This is documented at `skills/prism/SKILL.md:1-10`.
- **Convention**: All agent files live in `agents/` directory at repository root. All skill files live in `skills/<skill-name>/SKILL.md`.
- **Convention**: Agent filenames use `<domain>-<role>` pattern (e.g., `codebase-locator`, `git-investigator`). Skills use `prism-<phase>` pattern (e.g., `prism-research`, `prism-debug`).
- **Convention**: Skills declare their own model in YAML frontmatter (`model: sonnet` or `model: opus`), separate from the models assigned to agents they spawn.
- **Convention**: The prompt string passed after `Task(subagent_type=...)` describes the specific work for that invocation; the agent's markdown file provides the system-level instructions and behavioral constraints.
- **Two format standards for agents**: Agents with YAML frontmatter (8 agents) and agents with plain markdown headings (3 debug agents: log-investigator, state-investigator, git-investigator).

## Open Questions

- [ ] Is the `Agent(subagent_type="general-purpose")` syntax in prism-docs-update a different mechanism than `Task(subagent_type=...)`, or are they aliases?
- [ ] The debug agents (log-investigator, state-investigator, git-investigator) lack YAML frontmatter with `tools:` field — how are their tool permissions determined at runtime?
- [ ] The `create_plan.md` command shows `Task("label", prompt)` syntax without `subagent_type` — is this a third invocation pattern or purely illustrative pseudocode?

## Code References

Quick navigation:

| Reference | Description |
|-----------|-------------|
| `skills/prism/SKILL.md:276` | Canonical invocation syntax documentation |
| `skills/prism/SKILL.md:53` | Root skill spawning prism-locator |
| `skills/prism-research/SKILL.md:22` | Research skill agent table |
| `skills/prism-research/SKILL.md:44-80` | Research skill spawning 6 agents across 5 steps |
| `skills/prism-debug/SKILL.md:62-85` | Debug skill spawning 3 agents in parallel |
| `skills/prism-plan/SKILL.md:38` | Plan skill spawning prism-analyzer |
| `skills/prism-verify/SKILL.md:29,76` | Verify skill spawning browser-verifier |
| `skills/prism-iterate/SKILL.md:98-101` | Iterate skill conditional agent spawning |
| `skills/prism-spectrum/SKILL.md:313-319` | Spectrum spawning debug agents on failure |
| `skills/prism-prd/SKILL.md:33` | PRD skill spawning prism-locator |
| `skills/prism-visual-docs/SKILL.md:33` | Visual docs skill spawning prism-locator |
| `skills/prism-docs-update/SKILL.md:42,92` | Docs update using Agent() syntax |
| `commands/create_plan.md:426-431` | Alternate Task syntax (pseudocode) |
| `agents/codebase-locator.md:1-6` | Agent YAML frontmatter example |
| `agents/log-investigator.md:1-6` | Agent non-frontmatter format example |
