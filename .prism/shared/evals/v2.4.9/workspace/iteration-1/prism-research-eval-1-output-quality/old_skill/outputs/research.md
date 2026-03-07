---
date: 2026-03-07
researcher: Claude
git_commit: 33f2cac
branch: main
repository: prism-plugin
topic: "Navigation System in the Prism Plugin"
tags: [research, navigation, skills, agents, commands, workflow, plugin-architecture]
status: complete
---

# Research: Navigation System in the Prism Plugin

## Research Question

How does the navigation system work in this codebase? This project is a Claude Code plugin with skills, agents, and commands.

## Summary

The Prism plugin implements a three-layer navigation architecture: Skills (orchestrators) invoke Commands (operations) and spawn Agents (specialists) via the `Task` tool. Navigation between layers is governed by YAML frontmatter for auto-discovery, slash-command invocation for commands, and `Task(subagent_type="agent-name")` for agent spawning. The entire system routes users through a structured 4-phase workflow (Research, Plan, Implement, Validate) with additional phases for Debug, Verify, Iterate, and autonomous Spectrum execution.

## Files Discovered

| File | Purpose |
|------|---------|
| `.claude-plugin/plugin.json` | Plugin metadata and version (v2.4.9) |
| `skills/prism/SKILL.md` | Root orchestrator skill; workflow selection and phase routing |
| `skills/prism-research/SKILL.md` | Research phase orchestrator |
| `skills/prism-plan/SKILL.md` | Planning phase orchestrator |
| `skills/prism-implement/SKILL.md` | Implementation phase orchestrator |
| `skills/prism-validate/SKILL.md` | Validation phase orchestrator |
| `skills/prism-spectrum/SKILL.md` | Autonomous multi-story execution orchestrator |
| `skills/prism-debug/SKILL.md` | Debug investigation orchestrator |
| `skills/prism-verify/SKILL.md` | Browser-based UI verification orchestrator |
| `skills/prism-iterate/SKILL.md` | Plan iteration and re-implementation orchestrator |
| `skills/prism-prd/SKILL.md` | PRD generation orchestrator |
| `skills/prism-visual-docs/SKILL.md` | Visual documentation orchestrator |
| `skills/prism-release/SKILL.md` | Release pipeline orchestrator |
| `skills/prism-docs-update/SKILL.md` | VitePress docs sync orchestrator |
| `skills/prism/references/workflow-patterns.md` | Workflow lifecycle and patterns reference |
| `skills/prism-research/references/research-template.md` | Research document output template |
| `commands/research_codebase.md` | Research command (invokable via `/research_codebase`) |
| `commands/create_plan.md` | Plan creation command (invokable via `/create_plan`) |
| `commands/implement_plan.md` | Plan implementation command (invokable via `/implement_plan`) |
| `commands/validate_plan.md` | Plan validation command (invokable via `/validate_plan`) |
| `commands/decompose_plan.md` | Story decomposition command (invokable via `/decompose_plan`) |
| `commands/commit.md` | Git commit command (invokable via `/commit`) |
| `commands/describe_pr.md` | PR description command (invokable via `/describe_pr`) |
| `commands/create_handoff.md` | Session handoff creation command |
| `commands/resume_handoff.md` | Session handoff resumption command |
| `commands/worktree.md` | Git worktree management command |
| `commands/prism-browse.md` | Browser navigation command |
| `commands/prism-screenshot.md` | Screenshot capture command |
| `commands/prism-verify.md` | Verification command |
| `commands/prism-debug.md` | Debug command |
| `commands/iterate_plan.md` | Plan iteration command |
| `commands/generate_prd.md` | PRD generation command |
| `commands/generate_user_flows.md` | User flow generation command |
| `commands/generate_tech_spec.md` | Tech spec generation command |
| `commands/generate_pricing.md` | Pricing proposal generation command |
| `commands/cli-install.md` | CLI installation command |
| `commands/cli-uninstall.md` | CLI uninstallation command |
| `commands/prism_cli.md` | CLI management command |
| `commands/prism_dir_update.md` | Prism directory update command |
| `commands/retroactive.md` | Retroactive documentation command |
| `commands/review-setup.md` | Review setup command |
| `agents/codebase-locator.md` | File location specialist agent |
| `agents/codebase-analyzer.md` | Code analysis specialist agent |
| `agents/codebase-pattern-finder.md` | Pattern discovery specialist agent |
| `agents/prism-locator.md` | `.prism/` document finder agent |
| `agents/prism-analyzer.md` | `.prism/` document insight extractor agent |
| `agents/web-search-researcher.md` | External web research agent |
| `agents/graph-navigator.md` | Knowledge graph structural analysis agent |
| `agents/browser-verifier.md` | Browser verification agent |
| `agents/log-investigator.md` | Log analysis debug agent |
| `agents/state-investigator.md` | Application state debug agent |
| `agents/git-investigator.md` | Git history debug agent |

## Component Analysis

### Layer 1: Skills (Orchestrators)

**Location**: `skills/*/SKILL.md`

**How it works**:
Skills are auto-discovered by Claude Code through YAML frontmatter at the top of each `SKILL.md` file. The frontmatter contains three fields that control discovery and routing:

- `name`: The skill identifier, used as a slash-command trigger (e.g., `prism-research` triggers via `/prism-research`)
- `description`: Natural language triggers — Claude Code matches user intent against these descriptions to auto-select the appropriate skill
- `model`: The AI model to use (`opus`, `sonnet`, or `haiku`)

**Entry point**: `skills/prism/SKILL.md:1-5` — the root `prism` skill defines the overall workflow and provides a routing table at lines 17-27 mapping phases to their respective skills.

**Skill routing table** (`skills/prism/SKILL.md:17-27`):

| Phase | Skill | Output Location |
|-------|-------|-----------------|
| Research | `/prism-research` | `.prism/shared/research/` |
| Plan | `/prism-plan` | `.prism/shared/plans/` |
| Implement | `/prism-implement` | Working code |
| Verify UI | `/prism-verify` | `.prism/local/verifications/` |
| Validate | `/prism-validate` | `.prism/shared/validation/` |
| Iterate | `/prism-iterate` | Updated plan |
| Spectrum | `/prism-spectrum` | Autonomous story execution |
| Debug | `/prism-debug` | Debug investigation report |

**Workflow selection logic** (`skills/prism/SKILL.md:37-44`): The root skill provides a decision matrix based on familiarity with the codebase:
- New feature, unfamiliar codebase: Full R->P->I->V
- Feature in known codebase: P->I->V (skip Research)
- Simple change, clear scope: I->V (skip Research + Plan)
- Trivial fix (<20 lines): Direct implementation

**Model assignment convention**:
- `opus`: Deep analysis skills — `prism-plan` (`skills/prism-plan/SKILL.md:4`), `prism-iterate` (`skills/prism-iterate/SKILL.md:4`), `prism-prd` (`skills/prism-prd/SKILL.md:4`), `prism-visual-docs` (`skills/prism-visual-docs/SKILL.md:4`)
- `sonnet`: General workflow skills — `prism` (`skills/prism/SKILL.md:4`), `prism-research` (`skills/prism-research/SKILL.md:4`), `prism-implement` (`skills/prism-implement/SKILL.md:4`), `prism-validate` (`skills/prism-validate/SKILL.md:4`), `prism-spectrum` (`skills/prism-spectrum/SKILL.md:4`), `prism-debug` (`skills/prism-debug/SKILL.md:4`), `prism-verify` (`skills/prism-verify/SKILL.md:4`)

**Total skills**: 14 SKILL.md files across the `skills/` directory.

### Layer 2: Commands (Operations)

**Location**: `commands/*.md`

**How it works**:
Commands are single-purpose prompt files invokable by the user via `/command-name` syntax. Each command has YAML frontmatter with `description` and `model` fields. Unlike skills, commands do not have a `name` field — the filename itself serves as the command name (e.g., `commit.md` is invoked via `/commit`).

**Frontmatter structure** (`commands/commit.md:1-4`):
```yaml
---
description: Create git commits with user approval and no Claude attribution
model: haiku
---
```

**Navigation patterns — how skills invoke commands**:
- `prism-prd` invokes `/generate_prd` (`skills/prism-prd/SKILL.md:42`)
- `prism-visual-docs` invokes `/generate_user_flows` and `/generate_tech_spec` (`skills/prism-visual-docs/SKILL.md:42`, `skills/prism-visual-docs/SKILL.md:60`)
- `prism-implement` references `/commit`, `/validate`, `/describe_pr` as post-implementation commands (`skills/prism-implement/SKILL.md:99-103`)
- `prism-iterate` references `/prism-implement` and `/prism-validate` for resumption (`skills/prism-iterate/SKILL.md:77`, `skills/prism-iterate/SKILL.md:81`)

**Command categories**:
1. **Workflow commands**: `research_codebase`, `create_plan`, `implement_plan`, `validate_plan`, `iterate_plan`, `decompose_plan`
2. **Git/PR commands**: `commit`, `describe_pr`, `worktree`
3. **Session management**: `create_handoff`, `resume_handoff`
4. **Document generation**: `generate_prd`, `generate_user_flows`, `generate_tech_spec`, `generate_pricing`
5. **Browser/verification**: `prism-browse`, `prism-screenshot`, `prism-verify`
6. **Utility**: `cli-install`, `cli-uninstall`, `prism_cli`, `prism_dir_update`, `retroactive`, `review-setup`, `prism-debug`

**Total commands**: 25 command files in the `commands/` directory.

### Layer 3: Agents (Specialists)

**Location**: `agents/*.md`

**How it works**:
Agents are spawned by skills (and some commands) via the `Task` tool with a `subagent_type` parameter matching the agent's `name` field in its frontmatter. Agents run in parallel for efficiency and are designed for focused, single-purpose work.

**Invocation pattern** (used throughout all skills):
```
Task(subagent_type="agent-name")
"Instructions for the agent"
```

**Frontmatter structure** (`agents/codebase-locator.md:1-6`):
```yaml
---
name: codebase-locator
description: Locates files, directories, and components...
tools: Read, Glob, Grep, Bash
model: haiku
---
```

Each agent frontmatter specifies:
- `name`: The identifier used in `subagent_type` parameter
- `description`: What the agent does
- `tools`: Which tools the agent is allowed to use
- `model`: The AI model (haiku for fast lookups, opus for deep analysis, sonnet for general work)

**Agent categories and their skills consumers**:

1. **Research agents** (consumed by `prism-research`, `prism-plan`, `prism-iterate`, `research_codebase`, `create_plan`):
   - `codebase-locator` — Find WHERE files live (`agents/codebase-locator.md:1`). Model: haiku. Tools: Read, Glob, Grep, Bash.
   - `codebase-analyzer` — Understand HOW code works (`agents/codebase-analyzer.md:1`). Model: opus. Tools: Read, Glob, Grep, Bash.
   - `codebase-pattern-finder` — Find patterns to model after (`agents/codebase-pattern-finder.md:1`). Model: sonnet. Tools: Read, Glob, Grep, Bash.
   - `prism-locator` — Find existing docs in `.prism/` (`agents/prism-locator.md:1`). Model: haiku. Tools: Read, Glob, Grep.
   - `prism-analyzer` — Extract insights from docs (`agents/prism-analyzer.md:1`). Model: opus. Tools: Read, Glob, Grep.
   - `web-search-researcher` — External web research (`agents/web-search-researcher.md:1`). Model: sonnet. Tools: WebSearch, WebFetch, Read.
   - `graph-navigator` — Knowledge graph structural analysis (`agents/graph-navigator.md:1`). Model: haiku. Tools: codebase-memory-mcp (all 11 tools).

2. **Debug agents** (consumed by `prism-debug`, `prism-spectrum`):
   - `log-investigator` — Analyze log files (`agents/log-investigator.md:1`). Model: haiku.
   - `state-investigator` — Check app state and config (`agents/state-investigator.md:1`). Model: haiku.
   - `git-investigator` — Analyze git history (`agents/git-investigator.md:1`). Model: haiku.

3. **Verification agents** (consumed by `prism-verify`, `prism-spectrum`):
   - `browser-verifier` — Execute playwright-cli checks (`agents/browser-verifier.md:1`). Model: haiku. Tools: Bash.

**Total agents**: 11 agent files in the `agents/` directory.

### Navigation Flow: How Phases Connect

**Primary workflow navigation** (`skills/prism/SKILL.md:49-61`):

The root `prism` skill checks `.prism/` for existing artifacts to determine where to start:
1. Nothing exists -> Start with `/prism-research`
2. Research exists -> Start with `/prism-plan`
3. Plan exists (incomplete) -> Resume with `/prism-implement`
4. Implementation done -> Run `/prism-validate`

**Phase-to-phase transitions**:

```
/prism-research  -->  /prism-plan  -->  /prism-implement  -->  /prism-verify  -->  /prism-validate
                                              |                                         |
                                              v                                         v
                                        /prism-debug                              /prism-iterate
                                        (on failure)                          (on issues found)
                                              |                                         |
                                              v                                         v
                                        /prism-spectrum                          back to /prism-implement
                                        (auto-retry)
```

**Document generation flow** (`skills/prism/SKILL.md:229-234`):
```
/prism-prd  -->  /prism-visual-docs  -->  /prism-plan
```

**Post-implementation command chain** (`skills/prism-implement/SKILL.md:99-103`):
```
/prism-implement  -->  /commit  -->  /validate  -->  /describe_pr
```

**Session handoff flow**:
```
/create_handoff  -->  [new session]  -->  /resume_handoff
```

**Spectrum autonomous flow** (`skills/prism/references/workflow-patterns.md:192-201`):
```
/prism-plan  -->  /decompose_plan  -->  spectrum.sh loop
                                              |
                                    /prism-spectrum (per iteration)
                                              |
                                        (on failure)
                                              |
                                    /prism-debug (auto-invoked)
```

### Plugin Discovery Mechanism

**Location**: `.claude-plugin/plugin.json`

**How it works**:
The `.claude-plugin/plugin.json` file (`line 1-8`) defines the plugin identity with `name`, `description`, `version`, and `author` fields. Claude Code discovers this file and then auto-discovers all skills, commands, and agents from the conventional directory structure:
- `skills/*/SKILL.md` — auto-discovered as skills
- `commands/*.md` — auto-discovered as slash commands
- `agents/*.md` — available for spawning via `Task(subagent_type=...)`

### State Persistence and Navigation Context

**Location**: `.prism/` directory

**How it works**:
The `.prism/` directory structure serves as the navigation state store. Each phase reads from and writes to specific subdirectories, enabling phase transitions and session continuity:

- `.prism/shared/research/` — Research output (read by Plan phase)
- `.prism/shared/plans/` — Plan output (read by Implement, Validate, Iterate, Decompose phases)
- `.prism/shared/validation/` — Validation reports
- `.prism/shared/handoffs/` — Session transfer documents
- `.prism/shared/prs/` — PR descriptions
- `.prism/shared/spectrum/progress.md` — Spectrum accumulated learnings
- `.prism/stories/stories.json` — Story definitions for Spectrum
- `.prism/local/verifications/` — Browser verification artifacts (gitignored)

**File naming convention**: `YYYY-MM-DD-topic.md` (or `YYYY-MM-DD-ENG-XXXX-description.md` with ticket reference)

### Context Management Navigation

**Location**: `skills/prism/SKILL.md:239-243`

The root skill includes a context management decision table that guides when to transition phases based on AI context window usage:

| Context Usage | Action |
|---------------|--------|
| < 40% | Continue current phase |
| 40-60% | Consider phase transition |
| > 60% | Save state, start fresh session |

This drives navigation to `/create_handoff` when context is high, and `/resume_handoff` to continue in a fresh session.

### TodoWrite Integration

**Location**: `skills/prism/SKILL.md:246-251`

Each phase uses Claude's TodoWrite system for in-session task tracking:
- Research: Track open questions
- Plan: Track phases as todos
- Implement: Track steps within phases
- Validate: Track criteria checks

This provides within-session navigation separate from the cross-session `.prism/` file-based navigation.

## Patterns Found

### Pattern 1: YAML Frontmatter for Auto-Discovery

**Example at**: `skills/prism-research/SKILL.md:1-5`

```yaml
---
name: prism-research
description: Research phase for complex coding tasks...
model: sonnet
---
```

**Also used in**:
- All 14 skill files in `skills/*/SKILL.md`
- All 25 command files in `commands/*.md` (with `description` and `model` only, no `name`)
- All 11 agent files in `agents/*.md` (with `name`, `description`, `tools`, and `model`)

### Pattern 2: Task-Based Agent Spawning

**Example at**: `skills/prism-research/SKILL.md:44-46`

```
Task(subagent_type="prism-locator")
"Find existing research about [topic]"
```

**Also used in**:
- `skills/prism/SKILL.md:53-55` — spawns `prism-locator` for initial check
- `skills/prism-plan/SKILL.md:37-39` — spawns `prism-analyzer` for context loading
- `skills/prism-debug/SKILL.md:62-85` — spawns `log-investigator`, `state-investigator`, `git-investigator` in parallel
- `skills/prism-verify/SKILL.md:75-81` — spawns `browser-verifier`
- `skills/prism-prd/SKILL.md:33-35` — spawns `prism-locator`
- `skills/prism-visual-docs/SKILL.md:31-33` — spawns `prism-locator`
- `commands/research_codebase.md:38-43` — spawns multiple agents in parallel
- `commands/create_plan.md:52-56` — spawns multiple research agents

### Pattern 3: Parallel Agent Execution

**Example at**: `skills/prism-debug/SKILL.md:62-85`

Three agents are spawned simultaneously for parallel investigation:
- `Task(subagent_type="log-investigator")` at line 64
- `Task(subagent_type="state-investigator")` at line 72
- `Task(subagent_type="git-investigator")` at line 80

**Also used in**:
- `commands/research_codebase.md:34-43` — parallel research agents
- `commands/create_plan.md:49-56` — parallel context-gathering agents
- `skills/prism-research/SKILL.md:98` — Rule 3: "Run agents in parallel when searching different areas"

### Pattern 4: Documentarian-Not-Critic Principle

**Example at**: `agents/codebase-locator.md:10-17`

```markdown
## CRITICAL: YOUR ONLY JOB IS TO DOCUMENT AND EXPLAIN THE CODEBASE AS IT EXISTS TODAY
- DO NOT suggest improvements or changes unless the user explicitly asks
- DO NOT perform root cause analysis unless the user explicitly asks
...
- ONLY describe what exists, where it exists, and how components are organized
```

**Also used in**:
- `agents/codebase-analyzer.md:10-17`
- `agents/codebase-pattern-finder.md:10-17`
- `agents/graph-navigator.md:10-13`
- `agents/browser-verifier.md:10-14`
- `skills/prism-research/SKILL.md:11-18`

### Pattern 5: Signal Protocol for Spectrum Navigation

**Example at**: `skills/prism-spectrum/SKILL.md:270-278`

| Signal | Meaning | Action |
|--------|---------|--------|
| `<promise>COMPLETE</promise>` | All stories done | Terminate loop |
| `<spectrum-continue>` | Story complete, more remain | Continue loop |
| `<spectrum-retry>` | Recoverable error | Retry in fresh session |
| `<spectrum-blocked>` | Story blocked | Skip, continue loop |
| `<spectrum-error>` | Fatal error | Stop loop |

This signal protocol is the navigation mechanism between `spectrum.sh` (the bash loop orchestrator) and `/prism-spectrum` (the per-iteration skill).

### Pattern 6: Workflow Position Diagrams

**Example at**: `skills/prism-debug/SKILL.md:30-34`

```
Implement (failure)  -->  Debug (You Are Here)  -->  Iterate (with findings)
```

**Also used in**:
- `skills/prism-prd/SKILL.md:14-18` — PRD -> Research -> Plan
- `skills/prism-visual-docs/SKILL.md:14-18` — PRD -> Visual Docs -> Plan
- `skills/prism/SKILL.md:229-234` — PRD -> Visual Docs -> Plan

## Historical Context

From `.prism/` directory:

- `.prism/shared/research/2026-02-22-prism-plugin-architecture.md` — Previous research on the plugin architecture
- `.prism/shared/research/2026-02-12-prism-cli-deep-dive.md` — Deep dive on the CLI dashboard component
- `.prism/shared/research/2026-02-26-prism-vscode-extension-architecture.md` — VSCode extension architecture research
- `.prism/shared/research/2026-02-28-prism-shared-architecture.md` — Shared architecture research
- `.prism/shared/research/2026-03-01-three-package-split-architecture.md` — Three-package split architecture research

## Architecture Notes

- **Three-layer hierarchy**: Skills orchestrate workflows by invoking Commands and spawning Agents. This separation keeps each layer focused on a single responsibility level.
- **Convention over configuration**: File placement in `skills/`, `commands/`, or `agents/` directories determines the component type. YAML frontmatter provides metadata for auto-discovery.
- **Model tier assignment**: Opus handles deep analysis (planning, iteration, code analysis), Sonnet handles general workflow (research, implementation, validation), and Haiku handles fast lookups (file location, log investigation, browser verification).
- **File-based state machine**: The `.prism/` directory serves as the persistent state store. Phase transitions are determined by what artifacts exist — research documents trigger plan creation, plans trigger implementation, etc.
- **Fresh context per iteration**: The Spectrum system spawns a new Claude session per story, using files as long-term memory. This avoids context window degradation over long-running tasks.
- **Parallel-first agent design**: Skills are designed to spawn multiple agents simultaneously when their work is independent, reducing total execution time.

## Open Questions

- [ ] How does Claude Code's internal skill auto-discovery mechanism prioritize when multiple skills match user intent?
- [ ] Is there a formal schema validation for the YAML frontmatter beyond convention?
- [ ] How does the `tools` field in agent frontmatter restrict tool access — is this enforced by Claude Code or advisory?

## Code References

| Reference | Description |
|-----------|-------------|
| `skills/prism/SKILL.md:17-27` | Core workflow routing table |
| `skills/prism/SKILL.md:37-44` | Workflow selection decision matrix |
| `skills/prism/SKILL.md:49-61` | Existing work check and phase routing |
| `skills/prism/SKILL.md:229-234` | Document generation flow diagram |
| `skills/prism/SKILL.md:239-243` | Context management navigation table |
| `skills/prism-research/SKILL.md:1-5` | Skill frontmatter example |
| `skills/prism-research/SKILL.md:44-46` | Agent spawning pattern |
| `skills/prism-spectrum/SKILL.md:270-278` | Signal protocol table |
| `skills/prism-debug/SKILL.md:30-34` | Workflow position diagram |
| `skills/prism-debug/SKILL.md:62-85` | Parallel agent spawning |
| `agents/codebase-locator.md:1-6` | Agent frontmatter structure |
| `agents/codebase-locator.md:10-17` | Documentarian principle |
| `commands/commit.md:1-4` | Command frontmatter structure |
| `.claude-plugin/plugin.json:1-8` | Plugin identity configuration |
