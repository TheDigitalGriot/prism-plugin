---
title: cl-plugin-structure v0.7.2 Integration + Opus 4.8 Adoption
date: 2026-06-03
author: prism-research
status: complete
---

# Research: cl-plugin-structure v0.7.2 Integration + Opus 4.8 Adoption

## Summary

prism-plugin v3.2.1 carries 21 skills, 25 commands, and 14 agents. Six skills use `model: opus` with no effort annotation; `prism-spectrum` uses `model: sonnet`; two files carry a stale `claude-opus-4-6` pin. The cl-plugin-structure v0.7.2 skill lives at a peer path and contains 11 reference documents plus examples and validator scripts — the material is additive rather than overlapping, making a straight bundling into `skills/cl-plugin-structure/` safe.

---

## 1. Inventory — Skills (21)

| Skill | Model | Effort | Notes |
|---|---|---|---|
| prism | sonnet | — | Main RPIV orchestrator |
| prism-bookend | sonnet | — | Context-aware release workflow |
| prism-brainstorm | **opus** | — | → needs effort: xhigh + ultrathink |
| prism-debug | sonnet | — | |
| prism-design | **opus** | — | → needs effort: xhigh |
| prism-dispatch | sonnet | — | |
| prism-docs-update | sonnet | — | |
| prism-eval | sonnet | — | |
| prism-finish | sonnet | — | |
| prism-implement | sonnet | — | |
| prism-init | haiku | — | |
| prism-iterate | **opus** | — | → needs effort: xhigh + ultrathink |
| prism-plan | **opus** | — | → needs effort: xhigh |
| prism-prd | **opus** | — | → needs effort: xhigh |
| prism-release | sonnet | — | |
| prism-research | sonnet | — | |
| prism-spectrum | sonnet | — | → needs model: opus[1m] |
| prism-subagent | **opus** | — | → needs effort: xhigh |
| prism-validate | sonnet | — | → needs ultrathink in body |
| prism-verify | sonnet | — | |
| prism-visual-docs | sonnet | — | |

**6 opus skills with no effort annotation:** prism-brainstorm, prism-design, prism-iterate, prism-plan, prism-prd, prism-subagent.
Opus 4.8 default is `high`; `xhigh` is the explicit upgrade step.

---

## 2. Inventory — Agents (14)

| Agent | Model | Effort | MaxTurns |
|---|---|---|---|
| browser-verifier | haiku | low | 8 |
| codebase-analyzer | **opus** | high | 15 |
| codebase-locator | haiku | low | 8 |
| codebase-pattern-finder | sonnet | medium | 15 |
| git-investigator | haiku | low | 8 |
| graph-navigator | haiku | low | 5 |
| log-investigator | haiku | low | 8 |
| prism-analyzer | **opus** | high | 12 |
| prism-locator | haiku | low | 5 |
| quality-reviewer | sonnet | medium | 10 |
| spec-reviewer | sonnet | medium | 10 |
| state-investigator | haiku | low | 8 |
| visual-regression-grader | sonnet | medium | 8 |
| web-search-researcher | sonnet | medium | 12 |

**2 opus agents currently at `effort: high`:** codebase-analyzer, prism-analyzer.
These are candidates for `effort: xhigh` — user approval required before changing (flagged in plan §8).

---

## 3. Inventory — Commands (25)

cli-install, cli-uninstall, commit, create_handoff, create_plan, decompose_plan, describe_pr, generate_prd, generate_pricing, generate_tech_spec, generate_user_flows, implement_plan, iterate_plan, prism-browse, prism-debug, prism-screenshot, prism-verify, prism_cli, prism_dir_update, research_codebase, resume_handoff, retroactive, review-setup, validate_plan, worktree.

All 25 present. No pinned model IDs found in any command file.

---

## 4. Inventory — Manifests

### .claude-plugin/plugin.json
- version: **3.2.1**
- Has `brainstorm-channel` MCP server (bun stdio, `prism-brainstorm/scripts/brainstorm-channel.ts`)
- No keywords field

### .claude-plugin/marketplace.json
- plugins[0].version: **3.2.1**
- metadata.description: "Structured development workflow plugins for Claude Code"

### .mcp.json (root — DO NOT MODIFY)
- codebase-memory-mcp (stdio)
- chrome-devtools (npx, headless, isolated, slim)

---

## 5. Inventory — Hooks (hooks/hooks.json)

7 hooks total. All use `type: "command"` (deterministic execution):

| Hook | Matcher | Command |
|---|---|---|
| PreCompact | (all) | `python ${CLAUDE_PLUGIN_ROOT}/scripts/pre-compact.py` |
| PostCompact | (all) | `python ${CLAUDE_PLUGIN_ROOT}/scripts/post-compact.py` |
| PostToolUse | Write\|Edit\|Bash | `python ${CLAUDE_PLUGIN_ROOT}/scripts/log-observation.py` |
| WorktreeCreate | (all) | `bash ${CLAUDE_PLUGIN_ROOT}/scripts/worktree-setup.sh` |
| WorktreeRemove | (all) | `bash ${CLAUDE_PLUGIN_ROOT}/scripts/worktree-cleanup.sh` |
| SubagentStart | (all) | `python ${CLAUDE_PLUGIN_ROOT}/scripts/log-agent.py` |
| SubagentStop | (all) | `python ${CLAUDE_PLUGIN_ROOT}/scripts/log-agent.py` |

**Hook audit finding (plan §8):** Zero `type: "prompt"` hooks detected. All hooks are already using the deterministic `command` type. No follow-up required.

---

## 6. Stale Model Pins

Grep command run: `grep -rE 'claude-(opus|sonnet|haiku)-[0-9]' . --include='*.ts' --include='*.js' --include='*.json' --include='*.md'`

**Actionable (main repo, non-historical):**

| File | Line | Current | Action |
|---|---|---|---|
| `apps/prism-vscode/src/core/api/claude-sdk.ts` | 20 | `"claude-opus-4-6"` | → `"claude-opus-4-8"` |
| `skills/prism-eval/references/eval-schemas.md` | 89 | `"claude-opus-4-6"` | → `"claude-opus-4-8"` |

**Already current (leave alone):**

| File | Line | Value | Status |
|---|---|---|---|
| `apps/prism-vscode/src/core/api/claude-sdk.ts` | 21 | `"claude-sonnet-4-6"` | Current — Sonnet 4.6 is the current sonnet model |
| `apps/prism-vscode/src/core/api/claude-sdk.ts` | 22 | `"claude-haiku-4-5-20251001"` | Current — Haiku 4.5 is the current haiku model |

**Historical time-capsules (DO NOT MODIFY):**

- `.prism/shared/evals/v2.4.9/workspace/iteration-1/benchmark.json` — historical eval snapshot
- `.prism/shared/evals/v2.5.1/workspace/iteration-1/benchmark.json` — historical eval snapshot
- `.prism/shared/docs/2026-03-06-skill-creator-eval-analysis.md` — research note, intentionally dated
- `.prism/shared/docs/CRUSH.md` — reference doc, historical
- `.prism/shared/ref/` subtree — all third-party reference material, untouched
- `.prism/shared/research/2026-02-28-*.md` — historical research docs

---

## 7. cl-plugin-structure v0.7.2 Source Map

**Location:** `C:\Users\digit\.claude\skills\cl-plugin-structure\`

```
cl-plugin-structure/
├── SKILL.md              ~19 KB, frontmatter version: 0.7.2
├── CLAUDE.md
├── README.md
├── references/
│   ├── channel-patterns.md
│   ├── command-patterns.md
│   ├── component-patterns.md
│   ├── cowork-compatibility.md
│   ├── folder-architecture-routing.md   Cliefnotes routing-table pattern
│   ├── hook-events.md
│   ├── manifest-reference.md
│   ├── mcp-patterns.md
│   ├── model-config.md                  NEW IN 0.7.2 — full model line guidance
│   ├── settings-local-md.md
│   └── token-optimization-research.md  ~51 KB — autoresearch, Attention Residuals, observational memory
├── examples/
│   ├── minimal-plugin.md
│   ├── standard-plugin.md
│   └── advanced-plugin.md
└── scripts/
    ├── hook-linter.sh
    ├── parse-frontmatter.sh
    ├── test-hook.sh
    ├── validate-agent.sh
    ├── validate-hook-schema.sh
    └── validate-settings.sh
```

**Target install path:** `skills/cl-plugin-structure/` (disjoint from all prism-* skill names)

---

## 8. Coverage Matrix — New vs Overlap

| cl-plugin-structure document | Status vs prism | Notes |
|---|---|---|
| SKILL.md | **NET NEW skill** | First cl-plugin-structure content in prism |
| references/model-config.md | **NET NEW** | prism has Model Assignment Convention (3 lines) but no full model-line guidance |
| references/folder-architecture-routing.md | **NET NEW** | prism lacks routing-table meta-pattern; Cliefnotes source |
| references/token-optimization-research.md | **NET NEW** | autoresearch / Attention Residuals / observational memory not in prism docs |
| references/cowork-compatibility.md | **NET NEW** | prism has no Cowork surface docs |
| references/channel-patterns.md | **NET NEW** | prism has brainstorm-channel implementation but no pattern docs |
| references/settings-local-md.md | **NET NEW** | .local.md pattern not documented in prism |
| examples/minimal-plugin.md | **NET NEW** | No example plugin structure files exist |
| examples/standard-plugin.md | **NET NEW** | — |
| examples/advanced-plugin.md | **NET NEW** | — |
| scripts/ (6 validators) | **NET NEW** | prism has no plugin validation scripts |
| references/component-patterns.md | OVERLAPS | prism's CLAUDE.md Three-Layer Architecture covers similar ground; cl-plugin-structure more complete |
| references/hook-events.md | OVERLAPS | prism's hooks.json shows 7 hooks; cl-plugin-structure docs full taxonomy |
| references/mcp-patterns.md | OVERLAPS | prism has .mcp.json + brainstorm-channel; cl-plugin-structure docs patterns |
| references/manifest-reference.md | OVERLAPS | prism has plugin.json/marketplace.json; cl-plugin-structure docs schema |
| references/command-patterns.md | OVERLAPS | prism's commands/ dir is well-established; patterns additive |

**Conflict check:** `cl-plugin-structure` does not match any existing `prism-*` skill folder name. Safe to add.

---

## 9. CLAUDE.md Routing Table Audit

CLAUDE.md is currently **170 lines (~1,450 tokens)**. It contains:
- Project identity and architecture overview
- Core Workflow Phases (4 phases)
- Execution models table (4 rows)
- .prism/ directory structure
- stories.json schema
- Key Principles
- Compaction Survival (6-file recovery sequence)
- CLI Dashboard description
- Code Intelligence (codebase-memory-mcp guidance)
- File Naming Conventions

**Finding:** CLAUDE.md does NOT have a routing table (the "| Task | Read first | Skip | Use skills |" pattern from cl-plugin-structure/references/folder-architecture-routing.md §3). A compact routing table for the 5 core task types in this repo should be added, targeting under 5,000 tokens total for the file.

---

## 10. README + CHANGELOG State

- **README.md:** 322 lines. Has Installation, Usage, Skills table, Agents table. Does NOT have a "Requirements" section. Nearest is the Installation section which makes no version mention.
- **CHANGELOG.md:** 42 lines. Only two entries: [2.4.1] (2026-03-05) and [2.0.0] (2026-02-10). No entry for v3.x releases — the v3.x versioning series jumps started after the last CHANGELOG update. The v3.3.0 entry will be the first new entry since [2.4.1].

---

## 11. Open Questions (Proposed for Plan Review)

1. **codebase-analyzer + prism-analyzer effort upgrade:** Both use `model: opus, effort: high`. Plan item says "propose, don't change." Flagged for user decision.
2. **SKILL.md token budget:** cl-plugin-structure/SKILL.md is ~19 KB — well over the 800-token discovery budget recommended in the skill itself. Leave as-is in this commit; flag as follow-up.
3. **prism-spectrum 1M context body:** The skill body may reference 200K context limits; these should be updated to 1M. This is captured in plan item #6.

---

*Generated by prism-research. Documentarian, not critic.*
