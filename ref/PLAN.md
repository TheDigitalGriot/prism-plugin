# Prism Migration Plan

## Status: COMPLETE

All phases have been executed. The Prism system is now generic and ready for use.

---

## What Was Done

### Phase 1: Clean Generic Commands - COMPLETE

Removed HumanLayer references from:
- `describe_pr.md` - Removed `humanlayer thoughts sync`, added inline default template
- `resume_handoff.md` - Removed HumanLayer sync, made ticket patterns generic

### Phase 2: Merge Overlapping Commands into Skills - COMPLETE

Merged philosophy and patterns into skills:
- `research_codebase*.md` -> `prism-research/SKILL.md` - Added "Document What IS" philosophy, follow-up handling
- `create_plan*.md` -> `prism-plan/SKILL.md` - Added philosophy, success criteria format
- `iterate_plan*.md` -> `prism-iterate/SKILL.md` - Added 5-point philosophy (Skeptical, Surgical, Thorough, Interactive, No Open Questions)

### Phase 3: Adapt HumanLayer-Specific Commands - COMPLETE

#### 3a: Adapted High-Value Commands
- `debug.md` -> `prism-debug.md` - Generic debug workflow with parallel agents
- `founder_mode.md` -> `retroactive.md` - Issue-tracker agnostic retroactive documentation

#### 3b: Created Generic Commands
- `create_worktree.md` -> `worktree.md` - Pure git worktree helper
- `local_review.md` -> `review-setup.md` - Generic PR review environment setup

#### 3c: Documented Workflow Patterns
- Created `skills/prism/references/workflow-patterns.md` with patterns from `linear.md` and `ralph_*.md`

#### 3d: Removed Meta-Commands
- Deleted `oneshot.md`, `oneshot_plan.md`

### Phase 4: Cleanup - COMPLETE

Deleted HumanLayer-specific files:
- `debug.md`, `founder_mode.md`, `create_worktree.md`, `local_review.md`
- `research_codebase_nt.md`, `create_plan_nt.md`, `iterate_plan_nt.md`, `describe_pr_nt.md`
- `linear.md`, `ralph_research.md`, `ralph_plan.md`, `ralph_impl.md`
- `ci_commit.md`, `ci_describe_pr.md`

Renamed generic versions:
- `research_codebase_generic.md` -> `research_codebase.md`
- `create_plan_generic.md` -> `create_plan.md`

### Phase 5: Update Documentation - COMPLETE

Updated `PROJECT_SUMMARY.md` and `PLAN.md` to reflect the completed migration state.

### Phase 6: Update Frontmatter - COMPLETE

#### Agents (6 files)
Removed `metadata:` block, added `tools:` and `model:` fields:

| Agent | Model | Tools |
|-------|-------|-------|
| `codebase-locator` | haiku | Read, Glob, Grep, Bash |
| `codebase-analyzer` | opus | Read, Glob, Grep, Bash |
| `codebase-pattern-finder` | sonnet | Read, Glob, Grep, Bash |
| `thoughts-locator` | haiku | Read, Glob, Grep |
| `thoughts-analyzer` | opus | Read, Glob, Grep |
| `web-search-researcher` | sonnet | WebSearch, WebFetch, Read |

#### Skills (6 files)
Added `model:` field:

| Skill | Model |
|-------|-------|
| `prism` | sonnet |
| `prism-research` | sonnet |
| `prism-plan` | opus |
| `prism-implement` | sonnet |
| `prism-validate` | sonnet |
| `prism-iterate` | opus |

#### Commands (13 files)
Added `model:` field:

| Command | Model |
|---------|-------|
| `commit.md` | haiku |
| `describe_pr.md` | sonnet |
| `create_handoff.md` | sonnet |
| `resume_handoff.md` | sonnet |
| `create_plan.md` | opus |
| `iterate_plan.md` | opus |
| `implement_plan.md` | sonnet |
| `validate_plan.md` | sonnet |
| `research_codebase.md` | opus |
| `prism-debug.md` | sonnet |
| `retroactive.md` | sonnet |
| `worktree.md` | haiku |
| `review-setup.md` | haiku |

---

## Final Inventory

### Plugin Manifest
```
.claude-plugin/
└── plugin.json
```

### Commands (13)
```
commands/
├── commit.md
├── create_handoff.md
├── create_plan.md
├── describe_pr.md
├── implement_plan.md
├── iterate_plan.md
├── prism-debug.md
├── research_codebase.md
├── resume_handoff.md
├── retroactive.md
├── review-setup.md
├── validate_plan.md
└── worktree.md
```

### Agents (6)
```
agents/
├── codebase-analyzer.md
├── codebase-locator.md
├── codebase-pattern-finder.md
├── thoughts-analyzer.md
├── thoughts-locator.md
└── web-search-researcher.md
```

### Skills (6)
```
skills/
├── prism/
│   ├── SKILL.md
│   ├── scripts/init_thoughts.py
│   └── references/workflow-patterns.md
├── prism-implement/
│   └── SKILL.md
├── prism-iterate/
│   └── SKILL.md
├── prism-plan/
│   ├── SKILL.md
│   └── references/plan-template.md
├── prism-research/
│   ├── SKILL.md
│   └── references/
│       ├── exploration-patterns.md
│       └── research-template.md
└── prism-validate/
    ├── SKILL.md
    └── references/validation-template.md
```

---

## Verification

### Automated
- [x] No `humanlayer` string in production files (only in docs)
- [x] All agents have `tools:` and `model:` frontmatter
- [x] All skills have `model:` frontmatter
- [x] All commands have `model:` frontmatter

### Manual (to be verified)
- [ ] `/prism` skill triggers on appropriate context
- [ ] `/prism-research` produces valid research document
- [ ] `/prism-plan` creates interactive plan
- [ ] `/prism-implement` follows plan phase-by-phase
- [ ] `/prism-validate` generates validation report
- [ ] Agents spawn correctly via Task()
- [ ] Commands are user-invocable

---

## Architecture Reference

### Three-Layer Model

```
User Request
     |
     v
+------------------+
|     SKILLS       |  Auto-discovered based on context
|  (Orchestrators) |  Complex multi-file workflows
|                  |  Invoke commands and agents
+------------------+
     |
     v
+------------------+
|    COMMANDS      |  User-invocable via /command
|  (Operations)    |  Single-file focused prompts
|                  |  Callable by skills too
+------------------+
     |
     v
+------------------+
|     AGENTS       |  Specialized workers via Task()
|  (Specialists)   |  Research, analysis, pattern finding
|                  |  Pure execution, no orchestration
+------------------+
```

### Key Philosophy: "Documentarian, Not Critic"

All research agents and commands follow this principle:
- DO NOT suggest improvements unless explicitly asked
- DO NOT critique the implementation or identify problems
- ONLY describe what exists, where it exists, how it works

This is encoded in:
- `agents/codebase-*.md`
- `skills/prism-research/SKILL.md`
- `commands/research_codebase.md`

### Phase 7: Plugin Packaging - COMPLETE

Created `.claude-plugin/plugin.json` manifest for distribution:

```json
{
  "name": "prism",
  "description": "Structured 4-phase development workflow (Research -> Plan -> Implement -> Validate)",
  "version": "1.0.0",
  "author": {
    "name": "Prism Team"
  }
}
```

**Plugin Structure**:
```
prism-plugin/                     # Plugin root directory
├── .claude-plugin/
│   └── plugin.json              # Plugin manifest (only this goes in .claude-plugin/)
├── agents/                       # 6 subagents (at plugin root)
├── commands/                     # 13 slash commands (at plugin root)
└── skills/                       # 6 skills (at plugin root)
```

**Installation**: `claude --plugin-dir ./prism-plugin`

**Benefits**:
- Namespaced commands: `/prism:commit`, `/prism:describe_pr`
- Easy installation via plugin system
- Version control and updates
- Marketplace distribution ready
