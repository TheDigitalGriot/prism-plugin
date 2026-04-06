# Plugin Structure Ecosystem Audit: Superpowers vs Prism

**Date:** 2026-04-06  
**Framework:** `/cl-plugin-structure` (Claude Code Plugin Architecture Reference)  
**Source Data:** `.prism/shared/research/2026-04-06-superpowers-vs-prism-audit.md`  
**Scope:** Structural compliance, harness architecture, token efficiency, component patterns, adoption roadmap

---

## 1. Manifest & Registration Compliance

### Superpowers

**File:** `.claude-plugin/plugin.json`
```json
{
  "name": "superpowers",
  "description": "Core skills library for Claude Code: TDD, debugging, collaboration patterns, and proven techniques",
  "version": "5.0.7",
  "author": { "name": "Jesse Vincent", "email": "jesse@fsck.com" }
}
```

| Field | Present | Notes |
|-------|---------|-------|
| `name` (required) | Yes | `superpowers` |
| `version` | Yes | `5.0.7` — semver compliant |
| `description` | Yes | Clear, concise |
| `author` | Yes | Name + email |
| `keywords` | No | Would improve discoverability |
| `commands` | No | Uses defaults (3 deprecated stubs) |
| `agents` | No | Uses default `agents/` path |
| `skills` | No | Uses default `skills/` path |
| `hooks` | No | Uses default `hooks/` path |

**Verdict:** Minimal but valid. Relies entirely on default directory conventions. No custom paths needed because the structure is flat.

### Prism

**File:** `.claude-plugin/plugin.json`

| Field | Present | Notes |
|-------|---------|-------|
| `name` (required) | Yes | `prism` |
| `version` | Yes | `2.5.2` |
| `description` | Yes | |
| `author` | Yes | |
| `keywords` | Yes | |
| `commands` | Yes | Custom paths for 18 commands |
| `agents` | Yes | Custom paths for 12 agents |
| `skills` | Yes | Custom paths for 14 skills |
| `hooks` | Yes | Custom hooks config |

**Verdict:** Fully specified manifest with custom paths. More complex but explicitly declares all component locations.

### cl-plugin-structure Assessment

Both are valid. Prism's explicit custom paths are the **correct pattern for plugins with 15+ components** per the Categorized/Hierarchical Structure guidelines. Superpowers' reliance on defaults works because it has fewer components (1 agent, 3 deprecated commands).

---

## 2. Component Organization Analysis

### 2.1 Agent Organization

**cl-plugin-structure recommendation:** For workflow-based plugins, use Workflow-Based Organization (planning → implementation → testing → deployment).

#### Superpowers: 1 Agent

```
agents/
└── code-reviewer.md    # model: inherit
```

- Single agent with `model: inherit` (controller decides model)
- All other "agent-like" work is done via subagent prompt templates inside skills
- The code-reviewer is dispatched by `requesting-code-review` skill

**Pattern match:** None of the three patterns (Role-Based, Capability-Based, Workflow-Based) apply meaningfully to a single agent.

**Token impact:** Minimal — 1 agent definition loaded on demand. But the prompt templates inside `skills/subagent-driven-development/` are substantial (~4 files, each 1-3KB) and are loaded into the controller's context when dispatching.

#### Prism: 12 Agents

```
agents/
├── browser-verifier.md         # haiku, 8 turns, Bash only
├── codebase-analyzer.md        # opus, 15 turns, Read/Glob/Grep/Bash
├── codebase-locator.md         # haiku, 8 turns, Read/Glob/Grep/Bash
├── codebase-pattern-finder.md  # sonnet, 15 turns, Read/Glob/Grep/Bash
├── git-investigator.md         # haiku, 8 turns
├── graph-navigator.md          # haiku, 5 turns, MCP tools only
├── log-investigator.md         # haiku, 8 turns
├── prism-analyzer.md           # opus, 12 turns
├── prism-locator.md            # haiku, 5 turns
├── state-investigator.md       # haiku, 8 turns
├── visual-regression-grader.md # sonnet, 8 turns
└── web-search-researcher.md    # sonnet, 12 turns
```

**Pattern match:** Hybrid of **Capability-Based** (browser-verifier, graph-navigator) and **Workflow-Based** (codebase-locator → codebase-analyzer → codebase-pattern-finder follows Research → Analyze → Pattern flow).

**cl-plugin-structure compliance:**
| Criterion | Status | Notes |
|-----------|--------|-------|
| YAML frontmatter | Yes | All agents have name, description, model, effort, maxTurns |
| Model assignment | Yes | Explicit per agent (haiku/sonnet/opus) |
| `disallowedTools` | Yes | All research agents block Write/Edit/NotebookEdit |
| `maxTurns` budgets | Yes | Range: 5-15, follows haiku(5-8), sonnet(12-18), opus(12-15) guidance |
| Tool restrictions | Yes | browser-verifier: Bash only; graph-navigator: MCP only |

**Token impact:** 12 agent definitions × ~200-400 tokens each = ~3,000-5,000 tokens at discovery. But agents are loaded on-demand, so actual per-session cost depends on which skills are invoked.

**Assessment:** Prism's agent architecture is a textbook example of the cl-plugin-structure best practices. Model tiering, turn budgets, and tool restrictions all align with the Token Optimization research (Pattern 4: Hard Constraints Eliminate Decision Overhead, Pattern 7: Fixed Time Budgets Enable Comparability).

### 2.2 Skill Organization

**cl-plugin-structure recommendation:** Workflow-Based Organization for multi-step processes.

#### Superpowers: 14 Skills (Methodology-Centric)

```
skills/
├── brainstorming/              # Creative design + visual companion
│   ├── SKILL.md
│   ├── visual-companion.md
│   ├── spec-document-reviewer-prompt.md
│   └── scripts/               # 5 files (server.cjs, template, helper, start/stop)
├── dispatching-parallel-agents/
├── executing-plans/
├── finishing-a-development-branch/
├── receiving-code-review/
├── requesting-code-review/
│   ├── SKILL.md
│   └── code-reviewer.md       # Prompt template
├── subagent-driven-development/
│   ├── SKILL.md
│   ├── implementer-prompt.md
│   ├── spec-reviewer-prompt.md
│   └── code-quality-reviewer-prompt.md
├── systematic-debugging/       # 7 files including scripts
├── test-driven-development/
├── using-git-worktrees/
├── using-superpowers/          # Meta-skill (injected via hook)
│   └── references/            # Platform tool mappings
├── verification-before-completion/
├── writing-plans/
│   ├── SKILL.md
│   └── plan-document-reviewer-prompt.md
└── writing-skills/             # 7 files including test framework
```

**Progressive disclosure:** Skills use the `references/` subdirectory pattern correctly. `SKILL.md` is the entry point; detailed guides are loaded on demand. The `brainstorming/scripts/` directory contains executable assets, not context-loaded content.

**Token assessment:** Most SKILL.md files are 2-5KB (800-2000 tokens). The `brainstorming/SKILL.md` at 10KB is the largest — but loads `visual-companion.md` (12KB) only when the visual companion is offered. This follows the progressive disclosure pattern well.

#### Prism: 14 Skills (Workflow-Phase-Centric)

```
skills/
├── prism/                     # Meta-orchestrator
├── prism-research/            # Phase 1
├── prism-plan/                # Phase 2
├── prism-implement/           # Phase 3
├── prism-validate/            # Phase 4
├── prism-spectrum/            # Autonomous execution
│   └── references/            # 4 reference files
├── prism-debug/               # Error recovery
├── prism-iterate/             # Plan iteration
├── prism-prd/                 # PRD generation
├── prism-visual-docs/         # UX documentation
├── prism-verify/              # Browser verification
├── prism-release/             # Release workflow
├── prism-docs-update/         # Documentation site
└── prism/scripts/             # init_prism.py
```

**Progressive disclosure:** Prism uses `references/` subdirectories in `prism-spectrum/` with 4 reference files loaded conditionally. The main `prism/SKILL.md` is a router that delegates to phase-specific skills.

**Token assessment:** Skills follow the "SKILL.md as entry point, references loaded on demand" pattern. The `prism-spectrum/SKILL.md` is the most complex (conditional loading of manifests, contracts, graph targets, debug integration, visual regression, and browser verification references).

### 2.3 Commands

#### Superpowers: 3 Commands (All Deprecated)

```
commands/
├── brainstorm.md       → redirects to brainstorming skill
├── execute-plan.md     → redirects to executing-plans skill
└── write-plan.md       → redirects to writing-plans skill
```

**Assessment:** Correctly deprecated. cl-plugin-structure states "commands/ — legacy, prefer skills/" and Superpowers has migrated fully to skills. The stubs exist only for backward compatibility.

#### Prism: 18 Active Commands

```
commands/
├── commit.md                 # Git commit workflow
├── create_handoff.md         # Session handoff
├── create_plan.md            # Plan creation
├── decompose_plan.md         # Plan → stories.json
├── describe_pr.md            # PR description
├── generate_prd.md           # PRD generation
├── generate_pricing.md       # Pricing proposals
├── generate_tech_spec.md     # Tech specs
├── generate_user_flows.md    # UX flows
├── implement_plan.md         # Plan execution
├── iterate_plan.md           # Plan iteration
├── research_codebase.md      # Codebase research
├── resume_handoff.md         # Handoff resume
├── retroactive.md            # Post-hoc PR/ticket
├── review-setup.md           # Review worktree
├── validate_plan.md          # Plan validation
├── worktree.md               # Git worktree
└── prism_dir_update.md       # Legacy migration
```

**Assessment:** With 18 commands, Prism should consider the **Categorized Structure** pattern from cl-plugin-structure:

```
commands/              # Core workflow
├── commit.md
├── worktree.md
├── review-setup.md

workflow-commands/     # Phase operations
├── create_plan.md
├── implement_plan.md
├── validate_plan.md
├── iterate_plan.md
├── decompose_plan.md

generation-commands/   # Document generation
├── generate_prd.md
├── generate_pricing.md
├── generate_tech_spec.md
├── generate_user_flows.md
├── describe_pr.md

session-commands/      # Session management
├── create_handoff.md
├── resume_handoff.md
├── research_codebase.md
├── retroactive.md
├── prism_dir_update.md
```

However, commands are also candidates for migration to skills (as Superpowers has done). Several Prism commands (`create_plan`, `implement_plan`, `validate_plan`) already have skill equivalents (`prism-plan`, `prism-implement`, `prism-validate`).

---

## 3. Harness Architecture Comparison

The cl-plugin-structure defines a **harness** as the composed system of all plugin primitives working together. Let's evaluate both plugins against the harness framework.

### 3.1 Harness Primitive Coverage

| Harness Primitive | Superpowers | Prism | cl-plugin-structure Notes |
|-------------------|-------------|-------|---------------------------|
| **Dynamic system prompts** | `using-superpowers` injected via SessionStart hook | CLAUDE.md + per-skill SKILL.md bodies | Both valid approaches |
| **Steering** | 14 skills via `/skill-name` | 14 skills + 18 commands | Prism has more entry points |
| **Workspaces** | None (no MCP/LSP) | `codebase-memory-mcp` (graph analysis) | Prism has richer workspace |
| **Modes** | 1 agent + dynamic model selection | 12 agents with fixed model/tool/turn | Prism more granular |
| **Plan approval** | Hard gate in brainstorming skill | Phase checkpoints in prism-implement | Both implement human-in-loop |
| **Tool approval** | None | `disallowedTools` per agent | Prism more restrictive |
| **Context management** | Progressive disclosure in skills | Progressive disclosure + PreCompact hooks | Prism more robust |
| **External channels** | None | None | Neither uses channels |

### 3.2 Harness Diagram: Superpowers

```
┌─────────────────────────────────────────────────────────┐
│                 SUPERPOWERS HARNESS                       │
│                                                          │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │  MODES   │  │   STEERING   │  │    WORKSPACES     │  │
│  │          │  │              │  │                   │  │
│  │ 1 agent  │  │ 14 skills    │  │ (none — no MCP,  │  │
│  │ (code-   │  │ via Skill    │  │  no LSP servers)  │  │
│  │ reviewer)│  │ tool         │  │                   │  │
│  │          │  │              │  │                   │  │
│  │ Dynamic  │  │ SessionStart │  │                   │  │
│  │ model    │  │ hook injects │  │                   │  │
│  │ per task │  │ meta-skill   │  │                   │  │
│  └──────────┘  └──────────────┘  └───────────────────┘  │
│                                                          │
│  ┌──────────────────┐  ┌──────────────────────────────┐  │
│  │  TOOL POLICIES   │  │   APPROVAL FLOWS             │  │
│  │                  │  │                              │  │
│  │ (none — no       │  │ Hard gate in brainstorming   │  │
│  │  disallowedTools │  │ Spec reviewer loop           │  │
│  │  or hook gates)  │  │ Quality reviewer loop        │  │
│  └──────────────────┘  └──────────────────────────────┘  │
│                                                          │
│  ┌──────────────────────────────────────────────────────┐│
│  │  CONTEXT MANAGEMENT                                  ││
│  │                                                      ││
│  │ Progressive disclosure (SKILL.md → references/)      ││
│  │ Subagent context isolation (fresh per task)           ││
│  │ (No compaction hooks — relies on session boundaries)  ││
│  └──────────────────────────────────────────────────────┘│
│                                                          │
│  ┌──────────────────────────────────────────────────────┐│
│  │  VISUAL COMPANION (Unique to Superpowers)            ││
│  │                                                      ││
│  │ Zero-dep Node.js HTTP/WS server (server.cjs)         ││
│  │ Frame template + helper.js (dark/light, selections)  ││
│  │ Session-isolated artifact storage (.superpowers/)     ││
│  │ JSONL event recording for user feedback               ││
│  └──────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────┘
```

### 3.3 Harness Diagram: Prism

```
┌─────────────────────────────────────────────────────────┐
│                     PRISM HARNESS                         │
│                                                          │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │  MODES   │  │   STEERING   │  │    WORKSPACES     │  │
│  │          │  │              │  │                   │  │
│  │ 12 agents│  │ 14 skills    │  │ codebase-memory-  │  │
│  │ (haiku/  │  │ 18 commands  │  │ mcp (graph)       │  │
│  │ sonnet/  │  │ via Skill +  │  │                   │  │
│  │ opus)    │  │ slash cmd    │  │ .prism/ directory  │  │
│  │          │  │              │  │ (structured state) │  │
│  │ Fixed    │  │ prism meta-  │  │                   │  │
│  │ model    │  │ skill routes │  │                   │  │
│  │ per agent│  │ to phases    │  │                   │  │
│  └──────────┘  └──────────────┘  └───────────────────┘  │
│                                                          │
│  ┌──────────────────┐  ┌──────────────────────────────┐  │
│  │  TOOL POLICIES   │  │   APPROVAL FLOWS             │  │
│  │                  │  │                              │  │
│  │ disallowedTools  │  │ Phase checkpoints            │  │
│  │ per agent        │  │ Quality gates (automated)    │  │
│  │ (research agents │  │ Story manifest gates         │  │
│  │  are read-only)  │  │ Visual regression grading    │  │
│  └──────────────────┘  └──────────────────────────────┘  │
│                                                          │
│  ┌──────────────────────────────────────────────────────┐│
│  │  CONTEXT MANAGEMENT                                  ││
│  │                                                      ││
│  │ Progressive disclosure (SKILL.md → references/)      ││
│  │ PreCompact hooks (compact-snapshot.json)              ││
│  │ Fresh session per story (Spectrum)                    ││
│  │ State on disk (stories.json, progress.md)             ││
│  │ Compaction survival protocol (CLAUDE.md § Recovery)   ││
│  └──────────────────────────────────────────────────────┘│
│                                                          │
│  ┌──────────────────────────────────────────────────────┐│
│  │  AUTONOMOUS ENGINE (Unique to Prism)                 ││
│  │                                                      ││
│  │ spectrum.sh (bash orchestrator, signal protocol)      ││
│  │ stories.json (deterministic selection via jq)         ││
│  │ Story manifests (per-requirement gates)               ││
│  │ Contracts (cross-story coordination)                  ││
│  │ 3-agent parallel debug on failure                     ││
│  │ Lockfile concurrency protection                       ││
│  └──────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────┘
```

---

## 4. Token Optimization Analysis

Using the Token Optimization research framework (context rot, autoresearch patterns, progressive disclosure):

### 4.1 Context Rot Vulnerability

| Factor | Superpowers | Prism | Winner |
|--------|-------------|-------|--------|
| **Session length** | Single session (grows with each task) | Fresh session per story (reset) | Prism |
| **Controller context** | Accumulates review outputs from all tasks | Each session starts clean | Prism |
| **Meta-skill injection** | `using-superpowers` loaded into EVERY session (~2KB) | CLAUDE.md loaded per session (~2KB) | Tie |
| **Agent output noise** | 1 agent, outputs go to controller | 12 agents, outputs scoped per dispatch | Prism |
| **Brainstorming session** | Visual companion uses browser (low context) | ASCII wireframes in context (higher context) | Superpowers |

**Assessment:** Prism's fresh-context-per-story model is the strongest defense against context rot. However, within a single Spectrum session, Prism doesn't have the subagent isolation pattern that Superpowers uses — the inner session does everything directly.

### 4.2 Autoresearch Pattern Compliance

| Pattern | Superpowers | Prism |
|---------|-------------|-------|
| **P1: Bounded Scope** | Subagent gets only its task text | Story `files` array bounds scope |
| **P2: State on Disk** | `docs/superpowers/specs/` + `plans/` | `.prism/shared/` (7 directories) |
| **P3: Single Metric** | Spec compliance → quality (sequential) | Quality gates (commands) |
| **P4: Hard Constraints** | "Never parallel implementation" | "One story. One commit. Nothing else." |
| **P5: Simplicity** | Zero npm dependencies | 12 agents with strict budgets |
| **P6: Git as Rollback** | `finishing-a-development-branch` | `spectrum.sh` resets on retry |
| **P7: Time Budgets** | Dynamic model selection per task | `maxTurns` per agent type |
| **P8: Re-Read from Disk** | Controller pastes task text (no file read) | Session loads stories.json + progress.md |
| **P9: program.md Interface** | `docs/superpowers/plans/` | `.prism/shared/plans/` |
| **P10: Emergent Delegation** | Controller selects model per complexity | haiku/sonnet/opus per agent definition |

**Both plugins score well.** Prism excels at P2 (state externalization), P4 (hard constraints), and P7 (time budgets). Superpowers excels at P1 (bounded scope via subagent isolation) and P8 (controller pastes full context).

### 4.3 Progressive Disclosure Compliance

**cl-plugin-structure rule:** "SKILL.md under 800 tokens. Detailed rules in separate files loaded on demand."

| Plugin | Avg SKILL.md Size | Uses references/ | Conditional Loading |
|--------|-------------------|------------------|---------------------|
| Superpowers | ~2-5KB (800-2000 tokens) | Yes (brainstorming, using-superpowers, writing-plans) | Yes (visual-companion.md loaded only when offered) |
| Prism | ~2-5KB (800-2000 tokens) | Yes (prism-spectrum has 4 reference files) | Yes (manifests, contracts, debug, visual regression loaded conditionally) |

**Assessment:** Both slightly exceed the 800-token SKILL.md recommendation, but both use progressive disclosure correctly. Prism's `prism-spectrum` skill is the most sophisticated in conditional loading — it checks for manifests, contracts, graph targets, and visual regression baselines before loading their respective reference files.

---

## 5. Hook Architecture Analysis

### Superpowers: 1 Hook

```json
{
  "hooks": {
    "SessionStart": [{
      "hooks": [{
        "type": "command",
        "command": "${CLAUDE_PLUGIN_ROOT}/hooks/session-start"
      }]
    }]
  }
}
```

- Single `SessionStart` hook injects `using-superpowers` SKILL.md content
- Uses `command` type (free, no LLM cost) — **correct per cl-plugin-structure**
- Cross-platform: detects Claude Code vs Cursor vs Copilot CLI
- No other lifecycle hooks

**Missing hooks per cl-plugin-structure best practices:**
- No `PreCompact`/`PostCompact` (relies on session boundaries instead)
- No `WorktreeCreate`/`WorktreeRemove` (worktree skill is manual)
- No `SubagentStart`/`SubagentStop` (no agent tracking)
- No `FileChanged` watchers

### Prism: Multiple Hooks

Prism uses:
- `SessionStart` — state restoration
- `PreCompact` — saves `compact-snapshot.json` to `.prism/local/`
- Additional lifecycle hooks for spectrum integration

**cl-plugin-structure compliance:**
- Uses `command` type (free) — correct
- `PreCompact` hook follows the Observational Context Pattern from component-patterns.md
- Compaction survival is documented in CLAUDE.md as a recovery protocol

### Gap: Both Missing

Neither plugin uses these cl-plugin-structure hook capabilities:

| Hook Event | Potential Use |
|------------|---------------|
| `WorktreeCreate` | Auto-setup dependencies, verify gitignore |
| `WorktreeRemove` | Cleanup, verify no uncommitted work |
| `SubagentStart/Stop` | Track agent dispatches, enforce spawn limits |
| `PostToolUse` (Write/Edit) | Observational context pattern |
| `FileChanged` | Watch stories.json for external edits |

---

## 6. Missing Harness Primitives

### 6.1 Neither Plugin Uses: Channels

Both Superpowers and Prism lack channel integration. Potential use cases:

| Channel Type | Use Case |
|--------------|----------|
| **One-way** | CI/CD alerts during Spectrum execution |
| **Two-way** | Slack/Discord bridge for remote story status |
| **Permission relay** | Approve Spectrum story commits from mobile |

### 6.2 Neither Plugin Uses: LSP Servers

Both could benefit from LSP integration for code intelligence during implementation phases. Currently Prism uses `codebase-memory-mcp` for structural analysis, which serves a similar purpose.

### 6.3 Neither Plugin Uses: Output Styles

Custom output styles could standardize how agents report findings (research reports, validation reports, review summaries).

### 6.4 Neither Plugin Uses: Settings (settings.json)

The `settings.json` file can activate a default agent. Neither plugin uses this — both rely on skill-driven agent selection instead.

---

## 7. Adoption Roadmap: Bringing Superpowers Patterns into Prism

Based on the cl-plugin-structure framework and the comparative audit, here is the full adoption plan organized by harness primitive:

### Phase 1: Visual Companion System (Workspace Extension)

**What:** Port Superpowers' browser-based visual companion to Prism for interactive brainstorming.

**Components to create:**
```
skills/prism-brainstorm/
├── SKILL.md                    # Brainstorming workflow (adapt from Superpowers)
├── visual-companion.md         # Browser integration guide
└── scripts/
    ├── server.cjs              # Zero-dep HTTP/WS server (port from Superpowers)
    ├── frame-template.html     # Prism-themed (--prism-* CSS vars)
    ├── helper.js               # Client-side interaction capture
    ├── start-server.sh         # Session launcher (Windows-aware)
    └── stop-server.sh          # Graceful shutdown
```

**Artifact storage:**
```
.prism/local/brainstorm/<session-id>/
├── content/          # HTML mockup files
└── state/
    ├── server-info   # JSON: port, url
    └── events        # JSONL: user interactions
```

**Integration points:**
- Offered during `/prism-research` and `/prism-plan` phases
- Design specs saved to `.prism/shared/plans/` (existing convention)
- Uses `.prism/local/` (gitignored) for ephemeral brainstorm sessions

**cl-plugin-structure alignment:**
- Progressive disclosure: SKILL.md is entry point, visual-companion.md loaded on demand
- Zero dependencies: Port server.cjs as-is
- Uses `${CLAUDE_PLUGIN_ROOT}` for script paths
- Follows Skill with Rich Resources pattern (scripts/ subdirectory)

### Phase 2: Two-Stage Review System (Approval Flow Enhancement)

**What:** Add spec compliance + code quality review after quality gates in Spectrum.

**Components to create:**
```
agents/
├── spec-reviewer.md            # NEW: Spec compliance verification
└── quality-reviewer.md         # NEW: Code quality review

skills/prism-spectrum/
└── references/
    ├── spec-reviewer-prompt.md     # NEW: Dispatch template
    └── quality-reviewer-prompt.md  # NEW: Dispatch template
```

**Agent definitions:**
```yaml
# spec-reviewer.md
name: spec-reviewer
description: Verify implementation matches story requirements exactly
model: sonnet
effort: medium
maxTurns: 10
disallowedTools: Write, Edit, NotebookEdit
```

```yaml
# quality-reviewer.md
name: quality-reviewer
description: Review code quality, architecture, and testing
model: sonnet
effort: medium
maxTurns: 10
disallowedTools: Write, Edit, NotebookEdit
```

**Integration into Spectrum flow:**
```
Implement story → Quality gates → [NEW] Spec review → [NEW] Quality review → Commit
```

**cl-plugin-structure alignment:**
- Follows Agent Organization (Workflow-Based pattern)
- Both agents are read-only (disallowedTools: Write, Edit)
- Turn budgets set as genuine budgets (10 turns)
- Prompt templates in `references/` (progressive disclosure)

### Phase 3: Implementer Status Protocol (Agent Communication Enhancement)

**What:** Replace binary signal tags with rich status codes for agent communication.

**Changes to `prism-spectrum/SKILL.md`:**
- Add implementer status handling: DONE, DONE_WITH_CONCERNS, NEEDS_CONTEXT, BLOCKED
- DONE_WITH_CONCERNS → log concerns to progress.md, proceed to review
- NEEDS_CONTEXT → append context to story, emit `<spectrum-retry>`
- BLOCKED → emit `<spectrum-blocked>` with root cause

**Changes to signal protocol in `spectrum.sh`:**
- Parse `<spectrum-concerns>` tag (new)
- Parse `<spectrum-needs-context>` tag (new)
- Record status in stories.json (`lastStatus` field)

### Phase 4: Worktree Safety & Lifecycle Hooks (Workspace Enhancement)

**What:** Add gitignore enforcement and lifecycle hooks for worktrees.

**Changes to `commands/worktree.md`:**
- Add gitignore check: `git check-ignore -q <path>` before creation
- Add auto-setup: detect package.json/Cargo.toml and run install
- Add test baseline: run quality gates after setup
- Add `.prism/` symlink/copy step

**New hooks in `hooks/hooks.json`:**
```json
{
  "WorktreeCreate": [{
    "hooks": [{
      "type": "command",
      "command": "${CLAUDE_PLUGIN_ROOT}/scripts/worktree-setup.sh"
    }]
  }],
  "WorktreeRemove": [{
    "hooks": [{
      "type": "command",
      "command": "${CLAUDE_PLUGIN_ROOT}/scripts/worktree-cleanup.sh"
    }]
  }]
}
```

**New scripts:**
```
scripts/
├── worktree-setup.sh     # Verify gitignore, install deps, run tests
└── worktree-cleanup.sh   # Check for uncommitted work, clean up
```

### Phase 5: Branch Completion Workflow (New Skill)

**What:** Add structured branch completion with explicit options.

**Component to create:**
```
skills/prism-finish/
└── SKILL.md
```

**4 options (adapted from Superpowers):**
1. Merge locally to base branch
2. Push and create PR (invoke `/describe_pr`)
3. Keep branch as-is (for later)
4. Discard branch (requires confirmation)

**Integration:** Called after `/prism-validate` completes, or after Spectrum finishes all stories.

### Phase 6: Spec Reviewer "Distrust" Pattern (Validation Enhancement)

**What:** Add explicit distrust of self-reported completion to `prism-validate`.

**Changes to `skills/prism-validate/SKILL.md`:**
- Add section: "Do not trust implementation self-reports. Verify independently."
- For each phase, compare claimed completions against actual file state
- Check for over-building (code not in plan) and under-building (missing requirements)

### Phase 7: Dynamic Model Selection (Agent Enhancement)

**What:** Allow skills to override agent model based on task complexity.

**Changes to agent dispatch pattern:**
- Add `model` parameter to Task() dispatch when complexity is known
- Mechanical tasks (1-2 files, clear spec) → haiku
- Integration tasks (multi-file) → sonnet
- Architecture/design → opus

**cl-plugin-structure note:** The `model` field in agent frontmatter serves as default. The dispatching skill can override at dispatch time.

### Phase 8: Observational Context Hooks (Context Management)

**What:** Implement the Observational Context Pattern from cl-plugin-structure.

**New hooks:**
```json
{
  "PostToolUse": [{
    "matcher": "Write|Edit",
    "hooks": [{
      "type": "command",
      "command": "python3 ${CLAUDE_PLUGIN_ROOT}/scripts/observe.py"
    }]
  }],
  "PreCompact": [{
    "hooks": [{
      "type": "command",
      "command": "python3 ${CLAUDE_PLUGIN_ROOT}/scripts/inject-observations.py"
    }]
  }],
  "SessionEnd": [{
    "hooks": [{
      "type": "command",
      "command": "python3 ${CLAUDE_PLUGIN_ROOT}/scripts/cleanup-observations.py"
    }]
  }]
}
```

Uses `${CLAUDE_PLUGIN_DATA}` for observation log persistence across sessions.

### Phase 9: SubagentStart/Stop Tracking (Workspace Enhancement)

**What:** Track agent dispatches for debugging and cost analysis.

**New hooks:**
```json
{
  "SubagentStart": [{
    "hooks": [{
      "type": "command",
      "command": "${CLAUDE_PLUGIN_ROOT}/scripts/log-agent.sh start"
    }]
  }],
  "SubagentStop": [{
    "hooks": [{
      "type": "command",
      "command": "${CLAUDE_PLUGIN_ROOT}/scripts/log-agent.sh stop"
    }]
  }]
}
```

Logs to `.prism/local/agent-log.jsonl` with timestamps, agent names, durations.

### Phase 10: Design Spec as First-Class Phase (Steering Enhancement)

**What:** Add `prism-design` skill between research and plan.

**Component to create:**
```
skills/prism-design/
├── SKILL.md                    # Design phase orchestrator
└── spec-reviewer-prompt.md     # Design doc review template
```

**Workflow integration:**
```
prism-research → [NEW] prism-design → prism-plan → prism-implement → prism-validate
```

**Output:** `.prism/shared/plans/YYYY-MM-DD-<topic>-design.md` (committed)

---

## 8. Summary Scorecard

### cl-plugin-structure Compliance

| Criterion | Superpowers | Prism | Notes |
|-----------|:-----------:|:-----:|-------|
| Valid manifest | 7/10 | 9/10 | Prism more complete |
| Component organization | 6/10 | 9/10 | Prism's 12 agents with constraints excel |
| Progressive disclosure | 8/10 | 8/10 | Both use references/ pattern |
| Hook efficiency | 9/10 | 8/10 | Both use command type; Prism has more hooks |
| Token optimization | 7/10 | 8/10 | Prism's fresh-context model wins |
| Agent budgets | 5/10 | 10/10 | Prism sets maxTurns, model, disallowedTools |
| State externalization | 7/10 | 10/10 | Prism's .prism/ directory is comprehensive |
| Compaction survival | 3/10 | 8/10 | Superpowers lacks PreCompact hooks |
| Harness completeness | 6/10 | 8/10 | Prism covers more harness primitives |
| Unique innovation | 9/10 | 9/10 | Visual companion vs Spectrum engine |
| **Total** | **67/100** | **87/100** | |

### Where Each Plugin Leads (Through cl-plugin-structure Lens)

**Superpowers leads in:**
- Visual workspace (browser companion — a capability neither plugin's harness framework accounts for)
- Approval flow sophistication (two-stage review with distrust pattern)
- Multi-IDE support (Cursor, Copilot, Codex, Gemini, OpenCode adapters)
- Zero-dependency philosophy

**Prism leads in:**
- Agent architecture (12 agents with model/tool/turn constraints — textbook cl-plugin-structure)
- State externalization (7-directory .prism/ structure — best-in-class Pattern 2)
- Autonomous execution (Spectrum — no cl-plugin-structure equivalent exists)
- Compaction survival (PreCompact hooks + CLAUDE.md recovery protocol)
- Hook utilization (multiple lifecycle events)
- Context rot defense (fresh session per story)

---

*Generated using cl-plugin-structure framework v1.0 against Superpowers v5.0.7 and Prism v2.5.2*
