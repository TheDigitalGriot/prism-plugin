---
title: Agents Reference
description: All 14 Prism agents — specialized subprocesses spawned via Task(subagent_type="agent-name").
outline: [2, 3]
---

# Agents Reference

Agents live at `agents/` and are spawned via `Task(subagent_type="agent-name")`. They run as parallel subprocesses, each with a designated model and restricted tool set.

## Research Agents

| # | Agent | File | Lines | Model | Tools | Role |
|---|-------|------|-------|-------|-------|------|
| 1 | `codebase-locator` | `codebase-locator.md` | 122 | **haiku** | Read, Glob, Grep, Bash | Find WHERE code lives — file locations by feature. Does NOT analyze contents. |
| 2 | `codebase-analyzer` | `codebase-analyzer.md` | 143 | **opus** | Read, Glob, Grep, Bash | Understand HOW code works — traces data flow, explains logic with file:line refs. |
| 3 | `codebase-pattern-finder` | `codebase-pattern-finder.md` | 227 | **sonnet** | Read, Glob, Grep, Bash | Finds similar implementations, returns concrete code examples to model after. |
| 4 | `prism-locator` | `prism-locator.md` | 134 | **haiku** | Read, Glob, Grep | Discovers documents in `.prism/` directory, categorizes by type. |
| 5 | `prism-analyzer` | `prism-analyzer.md` | 175 | **opus** | Read, Glob, Grep | Deep-dives on `.prism/` documents, extracts decisions and actionable items. "Documentarian, Not Critic" principle enforced. |
| 6 | `web-search-researcher` | `web-search-researcher.md` | 108 | **sonnet** | WebSearch, WebFetch, Read | Researches current information from the web with source links. |

## Debug Agents

| # | Agent | File | Lines | Model | Tools | Role |
|---|-------|------|-------|-------|-------|------|
| 7 | `log-investigator` | `log-investigator.md` | 106 | **haiku** | Bash | Analyzes log files for errors, warnings, and patterns. |
| 8 | `state-investigator` | `state-investigator.md` | 121 | **haiku** | Bash | Examines application state: databases, config files, environment. |
| 9 | `git-investigator` | `git-investigator.md` | 140 | **haiku** | Bash | Analyzes git history to find changes related to a reported issue. |

## Verification Agent

| # | Agent | File | Lines | Model | Tools | Role |
|---|-------|------|-------|-------|-------|------|
| 10 | `browser-verifier` | `browser-verifier.md` | 92 | **haiku** | Bash | Executes playwright-cli commands, returns structured JSON verification results. |

## Code Intelligence Agent (v2.5.0)

| # | Agent | File | Lines | Model | Tools | Role |
|---|-------|------|-------|-------|-------|------|
| 11 | `graph-navigator` | `graph-navigator.md` | 95 | **haiku** | codebase-memory-mcp (11 graph tools) | Queries the codebase knowledge graph for structural analysis — functions, call chains, dependencies, dead code, blast radius. Never reads files directly; uses graph tools exclusively. |

### Visual Regression Agent

| # | Agent | File | Lines | Model | Tools | Role |
|---|-------|------|-------|-------|-------|------|
| 12 | `visual-regression-grader` | `visual-regression-grader.md` | ~100 | **sonnet** | Read, Glob, Grep, Bash | Grades visual regression diffs: regression, intentional, or inconclusive. |

### Review Agents (v3.0.1)

Two-stage review agents dispatched sequentially after Spectrum quality gates pass. Spec compliance is verified first, then code quality. Both are read-only — they cannot modify code.

| # | Agent | File | Lines | Model | Tools | Role |
|---|-------|------|-------|-------|-------|------|
| 13 | `spec-reviewer` | `spec-reviewer.md` | ~70 | **sonnet** | Read, Glob, Grep, Bash | Verifies implementation matches story requirements exactly. Checks for missing requirements, over-building, and scope drift. **Does NOT trust implementer self-reports** — verifies independently. |
| 14 | `quality-reviewer` | `quality-reviewer.md` | ~75 | **sonnet** | Read, Glob, Grep, Bash | Reviews code quality, architecture, and testing AFTER spec compliance passes. Checks file responsibility, decomposition, testing, production readiness. |

## Agent Frontmatter Format

```markdown
---
name: agent-name
description: Description shown in Claude Code's agent registry
tools: Read, Glob, Grep, Bash
model: opus|sonnet|haiku
---

You are a specialist at [specific capability]. Your job is to [specific task]...
```

## Agent Design Principles

1. **Single responsibility** — Each agent does one thing well (locate, analyze, find patterns, etc.)
2. **Restricted tools** — Agents only receive the tools they need; `codebase-locator` gets Glob/Grep but NOT Edit
3. **Model-appropriate** — Fast lookup tasks use Haiku, deep analysis uses Opus, general work uses Sonnet
4. **Parallel by default** — Skills spawn 3–6 agents concurrently; agents never depend on each other's output
