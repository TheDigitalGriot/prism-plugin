---
title: Model Assignment Convention
description: The strict three-tier model assignment convention — Opus for deep analysis, Sonnet for general work, Haiku for fast lookups.
outline: [2, 3]
---

# Model Assignment Convention

The plugin follows a strict three-tier model assignment convention. Each component is assigned the cheapest model that can reliably handle its task.

## Opus — Deep Analysis & Creative Synthesis

Used when the task requires understanding complex relationships, generating structured documents, or making architectural decisions.

| Component | Type | Why Opus |
|-----------|------|----------|
| `codebase-analyzer` | Agent | Traces multi-file data flow, explains complex logic |
| `prism-analyzer` | Agent | Extracts nuanced insights from research documents |
| `create_plan` | Command | Generates phased plans with success criteria |
| `iterate_plan` | Command | Surgical plan updates requiring architectural judgment |
| `decompose_plan` | Command | Converts plans to dependency-ordered stories |
| `research_codebase` | Command | Coordinates multi-agent research campaigns |
| `generate_prd` | Command | Creates comprehensive product requirements |
| `generate_pricing` | Command | Professional pricing proposals with Gantt charts |
| `generate_tech_spec` | Command | API contracts, data models, architecture diagrams |
| `generate_user_flows` | Command | UX documentation with wireframes |
| `prism-plan` | Skill | Interactive planning with user feedback loops |
| `prism-iterate` | Skill | Plan adjustment requiring deep understanding |
| `prism-prd` | Skill | PRD orchestration with context awareness |
| `prism-visual-docs` | Skill | Visual documentation orchestration |

## Sonnet — General Implementation Work

Used for straightforward execution, routing, and integration tasks that don't require deep synthesis.

| Component | Type | Why Sonnet |
|-----------|------|------------|
| `codebase-pattern-finder` | Agent | Pattern matching is systematic, not creative |
| `web-search-researcher` | Agent | Web research follows clear procedures |
| `implement_plan` | Command | Follows an existing plan — execution not design |
| `validate_plan` | Command | Comparison against criteria — checklist work |
| `describe_pr` | Command | Summarizes known diffs |
| `create_handoff` | Command | Structured document generation |
| `resume_handoff` | Command | Context reconstruction from artifacts |
| `retroactive` | Command | Post-hoc documentation |
| `prism-debug` | Command | Parallel agent coordination |
| `prism-verify` | Command | Browser verification coordination |
| `prism-browse` | Command | Interactive browser session |
| Infrastructure cmds | Commands | CLI install/uninstall, dir migration |
| `prism` | Skill | Master router — routes, doesn't synthesize |
| `prism-research` | Skill | Agent spawning coordination |
| `prism-implement` | Skill | Phase-by-phase execution coordination |
| `prism-validate` | Skill | Verification coordination |
| `prism-debug` | Skill | Debug agent coordination |
| `prism-spectrum` | Skill | Single-story execution with signal protocol |
| `prism-verify` | Skill | Browser verification orchestration |

## Haiku — Fast Lookups & Simple Operations

Used for tasks that are fast, focused, and don't require nuanced judgment.

| Component | Type | Why Haiku |
|-----------|------|-----------|
| `codebase-locator` | Agent | File location via Glob/Grep — no analysis needed |
| `prism-locator` | Agent | Directory scanning — mechanical task |
| `log-investigator` | Agent | Log file parsing — pattern matching |
| `state-investigator` | Agent | Environment checks — straightforward |
| `git-investigator` | Agent | Git log analysis — structured data |
| `browser-verifier` | Agent | Playwright command execution — procedural |
| `commit` | Command | Git commit — minimal judgment needed |
| `worktree` | Command | Git worktree creation — procedural |
| `review-setup` | Command | Branch checkout — procedural |
| `prism-screenshot` | Command | Single browser screenshot — trivial |
