---
title: cl-plugin-structure v0.7.2 Integration + Opus 4.8 Adoption
date: 2026-06-03
version_from: 3.2.1
version_to: 3.3.0
status: approved
research: .prism/shared/research/2026-06-03-cl-plugin-structure-integration.md
---

# Plan: cl-plugin-structure v0.7.2 Integration + Opus 4.8 Adoption

## Summary

Bundle cl-plugin-structure v0.7.2 into prism-plugin as a new skill, adopt Opus 4.8 capabilities across 6 heavy-reasoning skills + 3 deep-reasoning prompt bodies, switch prism-spectrum to 1M context, update the stale Opus model pin, and bump the plugin version to 3.3.0.

**Hard constraints:**
- Never delete or rewrite existing skills, commands, agents, or hooks without explicit approval
- Do NOT modify .mcp.json or brainstorm-channel
- .prism/shared/evals/v2.*/*, .prism/shared/docs/CRUSH.md, .prism/shared/research/2026-02-27-*.md are time-capsules — leave untouched
- prism-eval submodule has pre-existing drift — leave alone (skills/prism-eval/ in the main repo is fair game)

---

## Phase 1 — Add cl-plugin-structure Skill

### Task 1.1 — Copy skill via robocopy (strips dev metadata)

```powershell
$src = "C:\Users\digit\.claude\skills\cl-plugin-structure"
$dst = "C:\Users\digit\Developer\prism-plugin\skills\cl-plugin-structure"
robocopy $src $dst /MIR /XD .git .prism /XF .gitignore /NFL /NDL /NJH /NJS
```

**Verify:**
- `skills/cl-plugin-structure/SKILL.md` exists with `version: 0.7.2` in frontmatter
- `skills/cl-plugin-structure/references/model-config.md` exists (NEW in 0.7.2)
- `skills/cl-plugin-structure/examples/minimal-plugin.md` exists
- `skills/cl-plugin-structure/scripts/validate-agent.sh` exists

**Files created:**
```
skills/cl-plugin-structure/
├── SKILL.md
├── CLAUDE.md
├── README.md
├── references/ (11 files including model-config.md)
├── examples/ (3 files)
└── scripts/ (6 scripts)
```

Status: pending

---

## Phase 2 — Model Pin Update

### Task 2.1 — Update claude-sdk.ts Opus pin

**File:** `apps/prism-vscode/src/core/api/claude-sdk.ts`
**Line 20 change:** `opus: "claude-opus-4-6"` → `opus: "claude-opus-4-8"`

Leave line 21 (`sonnet: "claude-sonnet-4-6"`) and line 22 (`haiku: "claude-haiku-4-5-20251001"`) untouched — both are current.

### Task 2.2 — Update eval-schemas.md example pin

**File:** `skills/prism-eval/references/eval-schemas.md`
**Line 89 change:** `"executor_model": "claude-opus-4-6"` → `"executor_model": "claude-opus-4-8"`

This is the JSON schema example for new benchmark.json files — updating it to show the current model is correct.

**Do NOT touch:**
- `.prism/shared/evals/v2.4.9/workspace/iteration-1/benchmark.json` — historical snapshot
- `.prism/shared/evals/v2.5.1/workspace/iteration-1/benchmark.json` — historical snapshot
- Any file under `.prism/shared/docs/` or `.prism/shared/research/2026-02-*`

Status: pending

---

## Phase 3 — Effort Level Enrichment (6 skills)

Add `effort: xhigh` to the YAML frontmatter of these 6 skills only. Add AFTER `model:` line. No other changes to these files.

| Skill | File | Current `model:` line |
|---|---|---|
| prism-brainstorm | `skills/prism-brainstorm/SKILL.md` | `model: opus` |
| prism-iterate | `skills/prism-iterate/SKILL.md` | `model: opus` |
| prism-plan | `skills/prism-plan/SKILL.md` | `model: opus` |
| prism-prd | `skills/prism-prd/SKILL.md` | `model: opus` |
| prism-design | `skills/prism-design/SKILL.md` | `model: opus` |
| prism-subagent | `skills/prism-subagent/SKILL.md` | `model: opus` |

**Resulting frontmatter block (example for prism-plan):**
```yaml
---
name: prism-plan
description: ...
model: opus
effort: xhigh
---
```

**Not changing:** prism-spectrum (model changes in Phase 4 instead), and no other skills.

### Phase 3 Open Item — Agent Effort Proposal

Two agents currently use `model: opus, effort: high`: `codebase-analyzer` and `prism-analyzer`.
These are candidates for `effort: xhigh` per the user brief. **NOT changing in this commit — user approval required.** Flagged here for follow-up decision.

Status: pending

---

## Phase 4 — prism-spectrum Model Change

**File:** `skills/prism-spectrum/SKILL.md`
**Frontmatter change:** `model: sonnet` → `model: opus[1m]`

Rationale: prism-spectrum runs autonomous multi-story sessions where holding full state avoids compaction mid-execution. Opus 4.8 + 1M context is the right profile.

**Body audit:** Scan skill body for any text referencing "200K" context limits. If found, update to reflect 1M capability. Flag exact line in commit message if body is updated.

**Availability note to add in body:** "Requires Max/Team/Enterprise plan for included 1M Opus context, or usage credits on Pro. Disable globally with `CLAUDE_CODE_DISABLE_1M_CONTEXT=1`."

Status: pending

---

## Phase 5 — ultrathink Keyword Insertion (3 skills)

Add the literal keyword `ultrathink` into the prompt body (not frontmatter) of these 3 skills.
Append one sentence at a contextually appropriate location in each skill's body. Do not rewrite surrounding content.

| Skill | File | Proposed insertion |
|---|---|---|
| prism-brainstorm | `skills/prism-brainstorm/SKILL.md` | In the divergent-thinking / ideation phase section: "For the divergent-thinking phase, ultrathink the problem space and surface assumptions that aren't being questioned." |
| prism-iterate | `skills/prism-iterate/SKILL.md` | Before proposing iterations section: "Before proposing each iteration, ultrathink whether the previous approach actually moved the needle on the success criteria." |
| prism-validate | `skills/prism-validate/SKILL.md` | In ambiguous gate handling: "When a validation gate ambiguously passes, ultrathink whether the success criteria were genuinely met or just papered over." |

**Not adding ultrathink to:** Any other skill — dilutes the signal. Three targeted insertions.

Status: pending

---

## Phase 6 — Cross-Reference 9 Skills

Add a one-line "See also" cross-reference at the bottom of each listed skill body. Do not otherwise modify these files.

| Skill | File | Cross-reference to add |
|---|---|---|
| prism-research | `skills/prism-research/SKILL.md` | `> See also: [cl-plugin-structure/references/folder-architecture-routing.md](../cl-plugin-structure/references/folder-architecture-routing.md) for efficient context loading via routing tables.` |
| prism-plan | `skills/prism-plan/SKILL.md` | `> See also: [cl-plugin-structure/references/component-patterns.md](../cl-plugin-structure/references/component-patterns.md) for multi-skill harness planning.` |
| prism-implement | `skills/prism-implement/SKILL.md` | `> See also: [cl-plugin-structure/references/hook-events.md](../cl-plugin-structure/references/hook-events.md) for hook-touching implementation work.` |
| prism-validate | `skills/prism-validate/SKILL.md` | `> See also: [cl-plugin-structure/scripts/](../cl-plugin-structure/scripts/) for validator scripts (validate-agent.sh, validate-hook-schema.sh, validate-settings.sh).` |
| prism-eval | `skills/prism-eval/SKILL.md` | `> See also: [cl-plugin-structure/references/token-optimization-research.md](../cl-plugin-structure/references/token-optimization-research.md) §10 (Plugin Audit Checklist).` |
| prism-init | `skills/prism-init/SKILL.md` | `> See also: [cl-plugin-structure/examples/minimal-plugin.md](../cl-plugin-structure/examples/minimal-plugin.md) and [standard-plugin.md](../cl-plugin-structure/examples/standard-plugin.md) for reference scaffolding.` |
| prism-debug | `skills/prism-debug/SKILL.md` | `> See also: [cl-plugin-structure/references/cowork-compatibility.md](../cl-plugin-structure/references/cowork-compatibility.md) for surface-specific debugging (Claude Code vs Cowork).` |
| prism-spectrum | `skills/prism-spectrum/SKILL.md` | `> See also: [cl-plugin-structure/references/model-config.md](../cl-plugin-structure/references/model-config.md) §6 for 1M context aliases and availability.` |
| prism-brainstorm | `skills/prism-brainstorm/SKILL.md` | `> See also: [cl-plugin-structure/references/model-config.md](../cl-plugin-structure/references/model-config.md) §5 for ultrathink keyword behavior.` |

Status: pending

---

## Phase 7 — Manifest Updates

### Task 7.1 — plugin.json version bump

**File:** `.claude-plugin/plugin.json`
- `"version": "3.2.1"` → `"version": "3.3.0"`
- Add `"keywords"` array if not present:
  ```json
  "keywords": ["plugin-development", "skill-authoring", "token-optimization", "routing-table", "opus-4-8", "effort-levels"]
  ```

### Task 7.2 — marketplace.json version + description update

**File:** `.claude-plugin/marketplace.json`
- `plugins[0].version: "3.2.1"` → `"3.3.0"`
- `metadata.description` update:
  ```
  "Structured development workflow plugins for Claude Code — includes cl-plugin-structure skill (v0.7.2) for plugin/skill authoring, bundled with Opus 4.8 enrichments and current model-line guidance."
  ```

Status: pending

---

## Phase 8 — Documentation Updates

### Task 8.1 — CLAUDE.md routing table

**File:** `CLAUDE.md` (currently 170 lines, ~1,450 tokens)

Add a **Routing Table** section between "Core Workflow Phases" and "Execution Models". The routing table maps the 5 core task types in this repo to the specific files to load. This addresses the "guess-what-to-read leak" from the Cliefnotes routing-table pattern.

**Proposed routing table:**

```markdown
## Routing Table

| Task | Read first | Skip | Use skill |
|---|---|---|---|
| Research / plan a new feature | `.prism/shared/research/`, `.prism/shared/plans/` latest | `apps/`, `skills/` internals | `/prism-research`, `/prism-plan` |
| Implement an approved plan | Relevant plan in `.prism/shared/plans/` | Unrelated skill SKILL.md | `/prism-implement`, `/prism-subagent` |
| Hook or plugin config changes | `hooks/hooks.json`, `skills/cl-plugin-structure/references/hook-events.md` | `.prism/shared/ref/` | (direct edit) |
| Model config / skill enrichment | `apps/prism-vscode/src/core/api/claude-sdk.ts`, `skills/cl-plugin-structure/references/model-config.md` | `.prism/shared/evals/` | (direct edit) |
| Spectrum / story execution | `stories.json`, `.prism/shared/spectrum/progress.md` | `apps/` | `/prism-spectrum` |
```

Do not restructure or shorten other CLAUDE.md sections. Just insert this table.

**Token budget check:** Adding ~15 lines keeps the file well under 5,000 tokens.

### Task 8.2 — README.md Requirements section

**File:** `README.md`

Add a `## Requirements` section after the Installation section. Content:

```markdown
## Requirements

- **Claude Code v2.1.154 or later** — required for Opus 4.8 features used by `prism-brainstorm`, `prism-iterate`, `prism-plan`, `prism-prd`, `prism-design`, and `prism-subagent` (effort: xhigh).
  Run `claude update` if on an older version.
- **Max / Team / Enterprise plan recommended** for `prism-spectrum` (uses `opus[1m]` — 1M context Opus). Pro users require usage credits for 1M context.
```

Do not restructure the README. Insertion only.

### Task 8.3 — CHANGELOG.md v3.3.0 entry

**File:** `CHANGELOG.md`

Insert the following at the top (before `## [2.4.1]`):

```markdown
## [3.3.0] - 2026-06-03

### Added
- `skills/cl-plugin-structure/` — cl-plugin-structure v0.7.2 bundled as a skill. Includes `references/model-config.md` (current Claude model line + effort levels + ultrathink + 1M context), `references/folder-architecture-routing.md` (Cliefnotes routing-table pattern), `references/token-optimization-research.md` (~51 KB: autoresearch, Attention Residuals, observational memory), `examples/` (3 plugin scaffolds), and `scripts/` (6 validator scripts).
- Routing table added to `CLAUDE.md` — maps 5 task types to per-task file loads.
- `## Requirements` section added to `README.md` — documents Claude Code v2.1.154+ requirement.

### Changed
- Opus pin updated: `claude-opus-4-6` → `claude-opus-4-8` in `apps/prism-vscode/src/core/api/claude-sdk.ts` and `skills/prism-eval/references/eval-schemas.md`.
- `effort: xhigh` added to 6 heavy-reasoning skills: `prism-brainstorm`, `prism-iterate`, `prism-plan`, `prism-prd`, `prism-design`, `prism-subagent`.
- `prism-spectrum` model changed from `sonnet` to `opus[1m]` for autonomous multi-story execution.
- 9 existing skills cross-linked to cl-plugin-structure references.

### Notes
- `ultrathink` keyword woven into `prism-brainstorm`, `prism-iterate`, `prism-validate` prompt bodies.
- Plugin version bumped 3.2.1 → 3.3.0 in `plugin.json` and `marketplace.json`.
- After review: run `/prism-release` to build VSIX, CLI binaries, and create the GitHub release.
```

Status: pending

---

## Phase 9 — Hook Schema Validation

Run the cl-plugin-structure validator against current hooks.json:

```bash
bash skills/cl-plugin-structure/scripts/validate-hook-schema.sh hooks/hooks.json
```

If it errors, report before proceeding. If it passes, note result. **Do not modify hooks.json** regardless of output — this is an audit step.

Status: pending

---

## Phase 10 — Validation Gate

All of the following must pass before declaring done:

### Automated checks
```bash
claude plugin validate .
```

### Spot checks
| Check | Expected |
|---|---|
| `skills/cl-plugin-structure/SKILL.md` frontmatter `version:` | `0.7.2` |
| `skills/cl-plugin-structure/references/model-config.md` exists | yes |
| All 21 prism-* skills present | yes |
| All 25 commands present | yes |
| All 14 agents present, untouched | yes |
| prism-brainstorm frontmatter has `effort: xhigh` | yes |
| prism-iterate frontmatter has `effort: xhigh` | yes |
| prism-plan frontmatter has `effort: xhigh` | yes |
| prism-prd frontmatter has `effort: xhigh` | yes |
| prism-design frontmatter has `effort: xhigh` | yes |
| prism-subagent frontmatter has `effort: xhigh` | yes |
| prism-brainstorm body contains `ultrathink` | yes |
| prism-iterate body contains `ultrathink` | yes |
| prism-validate body contains `ultrathink` | yes |
| prism-spectrum frontmatter `model:` value | `opus[1m]` |
| `apps/prism-vscode/src/core/api/claude-sdk.ts` line 20 | `"claude-opus-4-8"` |
| `skills/prism-eval/references/eval-schemas.md` line 89 | `"claude-opus-4-8"` |
| `.prism/shared/evals/v2.4.9/workspace/iteration-1/benchmark.json` unchanged | yes |
| `plugin.json` version | `3.3.0` |
| `marketplace.json` plugin version | `3.3.0` |
| `CHANGELOG.md` has `## [3.3.0]` entry | yes |
| `README.md` has `## Requirements` section | yes |

Status: pending

---

## Post-Merge Step (after PR review + push)

Run `/prism-release` to:
- Build VSIX package
- Build CLI binaries (windows/darwin/linux, amd64/arm64)
- Build Electron + Tauri installer + NSIS installer
- Create GitHub release tag v3.3.0 with all assets

Do NOT run `/prism-bookend` — it re-analyzes and re-suggests a version bump, which would conflict with the bump already applied in this plan.

---

## Commit Message

```
feat(skills): bundle cl-plugin-structure v0.7.2 + adopt Opus 4.8 capabilities

- Add cl-plugin-structure skill (SKILL.md + references/ + examples/ + scripts/)
  Includes new references/model-config.md for current Claude model line
- Update Opus pin: claude-opus-4-6 -> claude-opus-4-8 (claude-sdk.ts, eval-schemas.md)
- Add effort: xhigh to 6 heavy-reasoning skills (brainstorm, iterate, plan, prd, design, subagent)
- Weave ultrathink keyword into prism-brainstorm, prism-iterate, prism-validate
- Switch prism-spectrum to opus[1m] for autonomous multi-story execution
- Cross-link 9 existing skills to cl-plugin-structure references
- Bump plugin version 3.2.1 -> 3.3.0
- README: document Claude Code v2.1.154+ requirement
- CLAUDE.md: add routing table for 5 core task types
```

---

## Success Criteria

**Automated Verification:**
- `claude plugin validate .` returns clean
- `grep -r 'claude-opus-4-6' skills/ apps/prism-vscode/src/` returns no results
- All 21 skills in `ls skills/` output
- All 14 agents in `ls agents/` output
- `grep 'effort: xhigh' skills/prism-brainstorm/SKILL.md skills/prism-iterate/SKILL.md skills/prism-plan/SKILL.md skills/prism-prd/SKILL.md skills/prism-design/SKILL.md skills/prism-subagent/SKILL.md` → 6 matches
- `grep 'ultrathink' skills/prism-brainstorm/SKILL.md skills/prism-iterate/SKILL.md skills/prism-validate/SKILL.md` → 3 matches
- `grep 'model: opus\[1m\]' skills/prism-spectrum/SKILL.md` → 1 match
- `grep '3.3.0' .claude-plugin/plugin.json .claude-plugin/marketplace.json` → 2 matches

**Manual Verification:**
- Review diff to confirm no skill/command/agent/hook was deleted
- Confirm .prism/shared/evals/ time-capsules are untouched
- Confirm .mcp.json is untouched
- Review CHANGELOG.md v3.3.0 entry reads correctly
- Confirm README.md Requirements section is present
