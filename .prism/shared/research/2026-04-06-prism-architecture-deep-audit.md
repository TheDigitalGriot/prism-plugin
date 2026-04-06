# Prism v3.0.1 Architecture Deep Audit

**Date:** 2026-04-06
**Scope:** Execution models, orphaned components, invocation map, token efficiency, visual regression pipeline, Chrome DevTools MCP assessment

---

## Table of Contents

1. [Spectrum vs Worktrees vs SDD — Execution Model Comparison](#1-spectrum-vs-worktrees-vs-sdd)
2. [Commit Convention Gap](#2-commit-convention-gap)
3. [Orphaned & Standalone Components](#3-orphaned--standalone-components)
4. [Complete Invocation Map](#4-complete-invocation-map)
5. [Token Efficiency Analysis](#5-token-efficiency-analysis)
6. [Visual Regression Pipeline Status](#6-visual-regression-pipeline-status)
7. [Chrome DevTools MCP Assessment](#7-chrome-devtools-mcp-assessment)
8. [Recommendations](#8-recommendations)

---

## 1. Spectrum vs Worktrees vs SDD

Prism contains three distinct execution models that operate at different levels of abstraction:

| Dimension | Spectrum | Git Worktrees | Subagent-Driven Dev (SDD) |
|-----------|----------|---------------|---------------------------|
| **What it is** | Bash-orchestrated multi-session autonomous loop | Filesystem-level branch isolation | Single-session task dispatch with two-stage review |
| **Invocation** | `./scripts/spectrum.sh` | `/worktree` command | `superpowers:subagent-driven-development` skill |
| **Isolation** | Fresh `claude --print` process per story | Separate working directory per branch | Fresh Task subagent per task within one session |
| **Scope** | One story = one commit = one session | Infrastructure (enables the other two) | One plan = many tasks = many subagents |
| **Human in loop** | No (autonomous) | Yes (manual branch work) | Partial (controller AI, same session as user) |
| **Review system** | Two-stage (spec + quality) via agents | None | Two-stage (spec + quality) via subagents |
| **Failure handling** | Signal protocol (retry/blocked/error/needs-context) | Cleanup warnings only | Status protocol (DONE/CONCERNS/NEEDS_CONTEXT/BLOCKED) |
| **State persistence** | `stories.json` + `progress.md` (files) | Git branch + symlinked `.prism/shared` | TodoWrite (session-local, lost on close) |
| **Requires worktrees** | No (works on current branch) | IS the worktree system | Yes (hard dependency per Superpowers spec) |
| **Commit format** | `[STORY-XXX] title` | No convention specified | No convention specified |

### Key Insight: These Are Composable, Not Competing

```
SDD ──requires──> Git Worktrees ──cleanup──> prism-finish
                                                  ^
Spectrum ──────────────────follows────────────────┘
```

- **Spectrum** is for large features (10+ stories) running autonomously overnight
- **SDD** is for medium features (3-10 tasks) within a single interactive session
- **Worktrees** are infrastructure that SDD requires but Spectrum ignores
- **prism-finish** bridges both to completion (merge/PR/keep/discard)

### When to Use Each

| Scenario | Use |
|----------|-----|
| Large feature, overnight autonomy | Spectrum (`/decompose_plan` → `spectrum.sh`) |
| Medium feature, interactive session | SDD (`superpowers:subagent-driven-development`) |
| Quick fix, single file | Direct `/prism-implement` (no orchestration needed) |
| Reviewing a colleague's PR | Worktree (`/review-setup`) |
| Parallel feature work while main branch stays clean | Worktree (`/worktree`) |

---

## 2. Commit Convention Gap

### Current State

The last 30 commits follow conventional commits consistently:

| Prefix | Count | Pattern |
|--------|-------|---------|
| `feat:` | 21 | New features |
| `fix:` | 3 | Bug fixes |
| `docs:` | 3 | Documentation |
| `chore:` | 1 | Maintenance |
| Version tags | 2 | `v3.0.1`, `v3.0.0` |

### The Problem

Three different commit conventions exist:

| System | Convention | Source |
|--------|-----------|--------|
| **Manual work** | `feat:` / `fix:` / `docs:` (conventional commits) | Established codebase pattern |
| **Spectrum** | `[STORY-XXX] Story title` | `prism-spectrum/SKILL.md:269-278` |
| **SDD** | None specified | `implementer-prompt.md` says only "Commit your work" |
| **Prism /commit** | "Use imperative mood, focus on why" — no prefix required | `commands/commit.md` |

### Impact

When SDD is used (as we did in this session), commits naturally follow the user/AI's convention — which happened to be `feat:`/`fix:`/`docs:`. But this is not enforced. Spectrum uses its own `[STORY-XXX]` format. The `/commit` command forbids Claude attribution but doesn't mandate conventional commit prefixes.

### Recommendation

Standardize on conventional commits everywhere. Add to:
1. `prism-spectrum/SKILL.md` commit section: `feat(STORY-XXX): description` instead of `[STORY-XXX] description`
2. SDD `implementer-prompt.md`: Add commit message guidance with `feat:`/`fix:`/`docs:` prefixes
3. `/commit` command: Add conventional commit prefix requirement

---

## 3. Orphaned & Standalone Components

### Skills Not in Master Routing Table

The `prism/SKILL.md` master orchestrator routes to 11 of 17 skills. **6 skills are unreachable from the routing graph:**

| Skill | Status | How to Reach | Issue |
|-------|--------|-------------|-------|
| `prism-brainstorm` | Indirectly used | Only via `prism-design` | Not in `prism/SKILL.md` routing |
| `prism-design` | Orphaned from routing | User must type `/prism-design` directly | Not in `prism/SKILL.md` routing |
| `prism-finish` | Orphaned from routing | User must type `/prism-finish` directly | Not in `prism/SKILL.md` routing |
| `prism-docs-update` | Standalone tool | User must type `/prism-docs-update` directly | Intentionally standalone |
| `prism-eval` | Standalone tool | User must type `/prism-eval` directly | Intentionally standalone |
| `prism-release` | Standalone tool | User must type `/prism-release` directly | Intentionally standalone |

**Fix needed:** `prism-design`, `prism-brainstorm`, and `prism-finish` should be added to the `prism/SKILL.md` routing table. The other three are intentionally standalone utilities.

### Commands That Duplicate Skills

5 commands duplicate functionality of their corresponding skills:

| Command | Duplicates Skill | Both Active? |
|---------|-----------------|-------------|
| `implement_plan.md` | `prism-implement` | Yes — different invocation paths |
| `iterate_plan.md` | `prism-iterate` | Yes |
| `research_codebase.md` | `prism-research` | Yes |
| `validate_plan.md` | `prism-validate` | Yes |
| `prism-debug.md` | `prism-debug` | Yes |

These exist because commands predate skills in the plugin architecture. The skill versions are richer (they load references, spawn agents). The command versions are simpler (inline instructions). Both are user-invocable. **Not a bug** — commands are the legacy path, skills are the modern path.

### All Agents Are Active

All 14 agents are referenced by at least one active skill or command. Zero orphaned agents.

### All Scripts Are Active

All 11 scripts are referenced by hooks.json or by skills/commands. Zero orphaned scripts.

### All Hooks Reference Existing Scripts

All 7 hook events point to scripts that exist. Zero broken references.

---

## 4. Complete Invocation Map

### Entry Points (What Users Can Invoke)

```
USER ACTIONS                          COMPONENT TRIGGERED
──────────                            ──────────────────
"help me build X"                  → prism skill (hub) → routes to phase
"/prism-research"                  → prism-research skill → 6 agents parallel
"/prism-plan"                      → prism-plan skill → codebase-analyzer, prism-analyzer
"/prism-implement"                 → prism-implement skill → direct execution
"/prism-validate"                  → prism-validate skill → visual-regression-grader
"/prism-brainstorm"                → prism-brainstorm skill → visual companion server
"/prism-design"                    → prism-design skill → prism-brainstorm, generate_user_flows
"/prism-finish"                    → prism-finish skill → describe_pr command
"/prism-spectrum"                  → prism-spectrum skill (usually via spectrum.sh)
"/prism-debug"                     → prism-debug skill → 3 debug agents parallel
"/prism-verify"                    → prism-verify skill → browser-verifier, visual-regression-grader
"spectrum"                         → prism-spectrum skill
"run evals"                        → prism-eval skill
"release"                          → prism-release skill → bump-version.py
"update prism docs"                → prism-docs-update skill
./scripts/spectrum.sh              → claude CLI → prism-spectrum skill (autonomous)
```

### Maximum Agent Dispatch Per Workflow

| Workflow | Max Agents | Models Used |
|----------|-----------|-------------|
| `/prism-research` | 7 | 2 haiku + 2 opus + 2 sonnet + 1 haiku (graph) |
| `/prism-spectrum` (full UI story) | 7 | 3 haiku (debug) + 2 sonnet (reviewers) + 1 haiku (browser) + 1 sonnet (grader) |
| `/prism-debug` | 3 | 3 haiku (log, state, git investigators) |
| `/prism-verify` | 2 | 1 haiku (browser-verifier) + 1 sonnet (grader) |
| `/prism-plan` | 3 | 1 opus (analyzer) + 1 sonnet (pattern-finder) + 1 opus (prism-analyzer) |

### Hook Event Frequency (Estimated Per Session)

| Hook | Trigger | Est. Fires/Session |
|------|---------|-------------------|
| PostToolUse (Write\|Edit\|Bash) | Every file modification + bash command | 50-200 |
| SubagentStart/SubagentStop | Every agent dispatch | 10-30 |
| PreCompact/PostCompact | Context compression events | 0-3 |
| WorktreeCreate/WorktreeRemove | Worktree lifecycle | 0-2 |

---

## 5. Token Efficiency Analysis

### Skill Loading Costs

| Skill | Base Tokens | Max Tokens (all refs) | Progressive Disclosure? |
|-------|------------|----------------------|------------------------|
| `prism-spectrum` | ~3,427 | ~6,982 | Yes — 7 conditional refs |
| `prism-eval` | ~2,360 | ~3,361 | Partial — 1 ref |
| `prism-release` | ~2,284 | ~2,284 | No refs (all inline) |
| `prism` (hub) | ~2,170 | ~4,563 | 1 ref (never loaded) |
| `prism-debug` | ~1,682 | ~1,682 | No refs |
| `prism-validate` | ~1,656 | ~2,897 | 1 ref (always loaded) |
| `prism-verify` | ~1,345 | ~5,583 | 3 refs (conditional) |
| `prism-visual-docs` | ~1,242 | ~1,242 | No refs |
| `prism-research` | ~1,162 | ~2,705 | 2 refs |
| `prism-prd` | ~1,105 | ~1,105 | No refs |
| `prism-plan` | ~906 | ~2,071 | 1 ref |
| `prism-brainstorm` | ~794 | ~794 | Loads visual-companion.md on demand |
| `prism-implement` | ~785 | ~785 | No refs |
| `prism-design` | ~769 | ~769 | No refs |
| `prism-iterate` | ~765 | ~765 | No refs |
| `prism-finish` | ~762 | ~762 | No refs |
| `prism-docs-update` | ~1,219 | ~2,775 | 1 ref (always loaded) |

### Token Budget Assessment

**Well-optimized (progressive disclosure working):**
- `prism-spectrum` — best in class. 7 conditional refs, backend stories load 0 refs
- `prism-verify` — 3 conditional refs, visual regression only loads when baselines exist
- `prism-brainstorm` — visual companion guide loaded only when user accepts

**Candidates for optimization:**
- `prism-release` (2,284 tokens, all inline) — Step 3 build commands could move to `references/build-commands.md`
- `prism-debug` (1,682 tokens, no refs) — 3 agent dispatch templates are inline, could be references
- `prism-eval` (2,360 tokens, 1 ref) — eval workflow steps are all inline

**Model assignment concerns:**
- `prism-visual-docs` and `prism-prd` are opus skills that primarily orchestrate commands. They spawn one haiku agent then invoke opus commands. The skill itself doesn't need opus — the commands do. Consider downgrading to sonnet.
- `prism-brainstorm` is opus for the design exploration reasoning. Justified — brainstorming needs creative synthesis.
- `prism-design` is opus. Justified — architectural decisions need deep reasoning.

### Total Plugin Token Footprint

| Category | Est. Tokens | Loaded When |
|----------|-------------|-------------|
| All 17 SKILL.md files | ~24,431 | Only the activated skill loads |
| All 19 reference files | ~16,694 | Conditional per skill |
| All 14 agent definitions | ~15,761 | Only dispatched agents load |
| All 25 commands | ~27,395 | Only invoked commands load |
| CLAUDE.md | ~500 | Every session |
| **Worst case single session** | ~6,982 | Spectrum with all refs |
| **Typical single session** | ~3,000-5,000 | One skill + 2-3 agents |

---

## 6. Visual Regression Pipeline Status

### Pipeline Flowchart

```
/prism-verify or Spectrum
    │
    ▼
playwright-cli check ──── BROKEN (not installed)
    │
    ▼
Dev server detection ──── SOLID (package.json parsing)
    │
    ▼
browser-verifier agent ── SOLID (definition complete)
    │
    ▼
playwright-cli commands ── BROKEN (not installed)
    │
    ▼
Baselines check ────────── UNTESTED (directory exists, empty)
    │
    ▼
visual-regression.sh ──── BROKEN (requires playwright-cli)
    │
    ▼
pixelmatch diffing ──────── AVAILABLE (via npx)
    │
    ▼
visual-regression-grader ── SOLID (agent definition complete)
    │
    ▼
Verdict → Action ────────── SOLID (regression/intentional/inconclusive)
```

### Current Status: **Pipeline is architecturally complete but non-functional**

**Root cause:** `playwright-cli` is not installed. This single missing dependency breaks the entire screenshot-capture and browser-verification chain.

**Inconsistent install instructions:**
- `visual-regression.sh:126` says `npm install -g @anthropic-ai/claude-code`
- `commands/prism-verify.md:19` says `npm install -g @playwright/cli@latest`
- Neither currently provides a working `playwright-cli` binary

**What works without playwright-cli:**
- All agent definitions are complete and correct
- `pixelmatch` is available via npx
- The grader decision matrix (regression/intentional/inconclusive) is well-defined
- All graceful-skip paths work (pipeline doesn't crash, just skips)

**Baseline storage:**
- `.prism/shared/validation/baselines/` — exists, committed, currently empty
- `.prism/shared/validation/diffs/` — created on demand at runtime

### Fix Required

Install `playwright-cli` and establish at least one baseline to test the full pipeline end-to-end.

---

## 7. Chrome DevTools MCP Assessment

### What It Is

Google's official MCP server (33,400+ stars) bridging AI coding agents to live Chrome sessions via CDP/Puppeteer. Exposes 29 tools across input automation, navigation, emulation, performance, network, and debugging.

### Head-to-Head vs Playwright CLI

| Use Case | Winner | Why |
|----------|--------|-----|
| Taking screenshots | Tie | Both capable |
| Console errors | Chrome DevTools MCP | `list_console_messages` with source-mapped stacks |
| DOM assertions | Playwright CLI | Native locator + assertion API |
| Visual regression | Playwright CLI | `toHaveScreenshot()` with baseline management |
| Interactive debugging | Chrome DevTools MCP | `--autoConnect` to live session is unique |
| Performance audits | Chrome DevTools MCP | Lighthouse, Core Web Vitals, memory snapshots |
| CI/CD reliability | Playwright CLI | Deterministic, cross-browser |
| Token efficiency | Playwright CLI | ~13,700 tokens vs ~18,000-19,000 |
| Cross-browser | Playwright CLI | Chromium + Firefox + WebKit |

### Recommendation for Prism

**Use both — they're complementary:**

1. **Playwright CLI** as the primary automation workhorse for `browser-verifier` and `visual-regression.sh` (consistent, token-efficient, assertion-rich)
2. **Chrome DevTools MCP** as a debugging escalation tool:
   - Add to `.mcp.json` with `--slim` flag for token budget control
   - Use `lighthouse_audit` in `prism-validate` for performance success criteria
   - Use `--autoConnect` for interactive debugging sessions via `/prism-browse`
   - Use `--isolated --headless` in Spectrum runs to prevent profile pollution

### Integration Path

```json
// .mcp.json
{
  "chrome-devtools": {
    "command": "npx",
    "args": ["chrome-devtools-mcp@latest", "--headless", "--isolated", "--slim"]
  }
}
```

The `--slim` flag reduces from 29 tools to 3, cutting token cost from ~18K to ~3K. Use full mode only when performance auditing is needed.

---

## 8. Recommendations

### Priority 1: Fix Broken Things

1. **Install playwright-cli** — unblocks the entire visual regression pipeline
2. **Add prism-design, prism-brainstorm, prism-finish to `prism/SKILL.md` routing** — currently orphaned from the master orchestrator
3. **Standardize commit conventions** — add `feat:`/`fix:`/`docs:` guidance to Spectrum and SDD

### Priority 2: Token Optimization

4. **Move `prism-release` build commands to references** — save ~800 tokens when skill loads
5. **Downgrade `prism-visual-docs` and `prism-prd` to sonnet** — they orchestrate, not synthesize
6. **Add `model:` field to `prism-docs-update` and `prism-release`** — currently unspecified

### Priority 3: Architecture Cleanup

7. **Consider deprecating 5 duplicate commands** (implement_plan, iterate_plan, research_codebase, validate_plan, prism-debug) in favor of their skill equivalents
8. **Add Chrome DevTools MCP** to `.mcp.json` with `--slim` flag for debugging escalation
9. **Create baseline screenshots** for at least one UI component to test visual regression end-to-end
10. **Document the three execution models** (Spectrum vs SDD vs manual) in CLAUDE.md with a decision tree

### Priority 4: Future Considerations

11. **Worktree integration with Spectrum** — Spectrum could optionally run in a worktree to keep main clean during autonomous execution
12. **Agent dispatch cost dashboard** — the `log-agent.py` JSONL data could feed a cost analysis view in the CLI TUI

> **Note:** Prism's RPIV workflow (Research → Plan → Implement → Validate) IS the spec-driven development methodology. The Superpowers "Subagent-Driven Development" patterns (two-stage review, implementer status protocol, distrust pattern) have been absorbed into Prism's existing phases — there is no separate "SDD skill" to create. The Superpowers reference in `.prism/shared/ref/` is a studied reference, not a missing native implementation.

---

*Research conducted using 5 parallel agents: codebase-analyzer (×3), web-search-researcher, codebase-analyzer (visual regression). Total analysis time: ~6 minutes.*
