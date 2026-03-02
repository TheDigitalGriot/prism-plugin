---
title: Commands Reference
description: All 25 Prism commands — user-invocable via /command-name from Claude Code.
outline: [2, 3]
---

# Commands Reference

Commands live at `commands/` and are user-invocable via `/command-name`. Each is a markdown file with YAML frontmatter specifying `description` and `model`.

## Core Workflow Commands

| # | Command | File | Lines | Model | Description |
|---|---------|------|-------|-------|-------------|
| 1 | `/create_plan` | `create_plan.md` | 442 | **opus** | Interactive plan creation with parallel research agents, phased output, two-category success criteria |
| 2 | `/research_codebase` | `research_codebase.md` | 179 | **opus** | Spawns 5+ parallel agents to document the codebase |
| 3 | `/implement_plan` | `implement_plan.md` | 85 | **sonnet** | Executes approved plans phase by phase with verification checkpoints |
| 4 | `/validate_plan` | `validate_plan.md` | 167 | **sonnet** | Validates implementation against plan, runs automated checks, generates report |
| 5 | `/iterate_plan` | `iterate_plan.md` | 249 | **opus** | Updates existing plans surgically based on feedback |
| 6 | `/decompose_plan` | `decompose_plan.md` | 256 | **opus** | Converts plans into `stories.json` for Spectrum autonomous execution |

## Session Management Commands

| # | Command | File | Lines | Model | Description |
|---|---------|------|-------|-------|-------------|
| 7 | `/create_handoff` | `create_handoff.md` | 78 | **sonnet** | Creates handoff documents at `.prism/shared/handoffs/` for session transfer |
| 8 | `/resume_handoff` | `resume_handoff.md` | 219 | **sonnet** | Resumes work from handoff documents, validates current state |
| 9 | `/commit` | `commit.md` | 44 | **haiku** | Git commits with user approval, explicitly no Claude attribution |
| 10 | `/describe_pr` | `describe_pr.md` | 91 | **sonnet** | Generates PR descriptions from diff, updates PR via `gh` |
| 11 | `/retroactive` | `retroactive.md` | 80 | **sonnet** | Creates ticket/issue and PR retroactively after experimental work |

## Document Generation Commands

| # | Command | File | Lines | Model | Description |
|---|---------|------|-------|-------|-------------|
| 12 | `/generate_prd` | `generate_prd.md` | 196 | **opus** | Product Requirements Document with 9-section template |
| 13 | `/generate_pricing` | `generate_pricing.md` | 228 | **opus** | Professional pricing proposals with Gantt charts and T-shirt sizing |
| 14 | `/generate_tech_spec` | `generate_tech_spec.md` | 252 | **opus** | Technical specs: architecture, data models, API contracts |
| 15 | `/generate_user_flows` | `generate_user_flows.md` | 230 | **opus** | User flows, wireframes (ASCII), screen inventories, responsive design |

## Debug & Verification Commands

| # | Command | File | Lines | Model | Description |
|---|---------|------|-------|-------|-------------|
| 16 | `/prism-debug` | `prism-debug.md` | 184 | **sonnet** | Spawns parallel debug investigation agents (log, state, git) |
| 17 | `/prism-verify` | `prism-verify.md` | 142 | **sonnet** | Browser UI verification via playwright-cli with structured results |
| 18 | `/prism-screenshot` | `prism-screenshot.md` | 54 | **haiku** | Captures browser screenshot of a URL |
| 19 | `/prism-browse` | `prism-browse.md` | 82 | **sonnet** | Opens interactive headed browser session for exploration |

## Infrastructure Commands

| # | Command | File | Lines | Model | Description |
|---|---------|------|-------|-------|-------------|
| 20 | `/prism_dir_update` | `prism_dir_update.md` | 145 | **sonnet** | Migrates projects from legacy `thoughts/` to `.prism/` structure |
| 21 | `/prism_cli` | `prism_cli.md` | 93 | — | Launches Prism CLI TUI dashboard |
| 22 | `/cli-install` | `cli-install.md` | 132 | **sonnet** | Installs prism-cli binary from GitHub releases, configures PATH |
| 23 | `/cli-uninstall` | `cli-uninstall.md` | 150 | **sonnet** | Removes prism-cli binary, PATH entries, optionally `~/.prism/` |
| 24 | `/worktree` | `worktree.md` | 90 | **haiku** | Creates git worktrees for parallel development |
| 25 | `/review-setup` | `review-setup.md` | 91 | **haiku** | Sets up local environment to review a colleague's branch or PR |

## Command Frontmatter Format

```markdown
---
description: What this command does (shown in Claude Code's command palette)
model: opus|sonnet|haiku
---

# Command Title

Detailed prompt instructions that shape Claude's behavior when this command is invoked...
```
