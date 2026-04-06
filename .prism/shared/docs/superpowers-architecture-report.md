# Superpowers Plugin Architecture Report

**Date**: 2026-04-03
**Version Analyzed**: 5.0.7
**Author**: Jesse Vincent (jesse@fsck.com)
**License**: MIT
**Repository**: https://github.com/obra/superpowers
**Assessment Framework**: cl-plugin-structure (Claude Code plugin specification)

---

## 1. Plugin Identity

Superpowers is a zero-dependency Claude Code plugin that implements a structured software development methodology through behavioral skills. Its core thesis: AI agents skip steps, produce shallow work, and claim success without verification. Superpowers intervenes at every decision point with rigid process gates, rationalization prevention tables, and mandatory verification loops.

The plugin's CLAUDE.md states its philosophical stance explicitly:

> "Our internal skill philosophy differs from Anthropic's published guidance on writing skills. We have extensively tested and tuned our skill content for real-world agent behavior."

This is a plugin that has been battle-tested against AI failure modes and evolved its prompt engineering accordingly.

---

## 2. Structural Inventory

### Component Counts

| Component | Count | Notes |
|-----------|-------|-------|
| Skills | 14 | Core workflow pipeline + orthogonal utilities |
| Agents | 1 | `code-reviewer` (model: inherit) |
| Hooks | 1 event | `SessionStart` only (command type, sync) |
| Commands | 3 | All deprecated, redirect to skills |
| MCP Servers | 0 | — |
| LSP Servers | 0 | — |
| Output Styles | 0 | — |
| Scripts | 6 | Brainstorm server + helpers + version bump |
| Test Suites | 5 | Server, integration, skill triggering, platform, e2e |

### Directory Layout

```
superpowers/5.0.7/
├── .claude-plugin/
│   ├── plugin.json              # Manifest
│   └── marketplace.json         # Distribution metadata
├── .cursor-plugin/
│   └── plugin.json              # Cursor-specific manifest
├── .opencode/
│   └── plugins/superpowers.js   # OpenCode ES module adapter
├── agents/
│   └── code-reviewer.md         # Single agent (model: inherit)
├── commands/                    # 3 deprecated redirects
├── hooks/
│   ├── hooks.json               # SessionStart hook
│   ├── hooks-cursor.json        # Cursor variant
│   ├── run-hook.cmd             # Polyglot batch/bash wrapper
│   └── session-start            # Bootstrap script
├── skills/                      # 14 skill directories
│   ├── brainstorming/           # 7 files (visual companion system)
│   ├── dispatching-parallel-agents/
│   ├── executing-plans/
│   ├── finishing-a-development-branch/
│   ├── receiving-code-review/
│   ├── requesting-code-review/  # 2 files
│   ├── subagent-driven-development/  # 4 files (3 dispatch templates)
│   ├── systematic-debugging/    # 10 files (extensive supporting material)
│   ├── test-driven-development/ # 2 files
│   ├── using-git-worktrees/
│   ├── using-superpowers/       # 4 files (bootstrap + platform refs)
│   ├── verification-before-completion/
│   ├── writing-plans/           # 2 files
│   └── writing-skills/          # 7 files (meta-skill for skill creation)
├── scripts/
│   └── bump-version.sh          # Version management
├── tests/                       # 5 test suites (~50 files)
└── docs/                        # Plans, specs, platform guides
```

### Manifest Analysis

**`plugin.json`** is minimal (4 fields: name, version, author, description). No explicit hooks, agents, or skills declarations — relies entirely on convention-based auto-discovery.

**`marketplace.json`** exists for distribution. No custom component paths declared.

**Notable absence**: No `settings.json`, no `.mcp.json`, no `.lsp.json`. The plugin is pure prompt engineering + one Node.js server.

---

## 3. Hook Architecture

### SessionStart Bootstrap

Superpowers uses a single hook event (`SessionStart`) to inject the `using-superpowers` skill content at conversation start. This is the entire hook system.

**Execution chain:**
```
SessionStart event
  → hooks.json (matcher: "startup|clear|compact")
  → run-hook.cmd (polyglot batch/bash)
    → hooks/session-start (bash script)
      → cat skills/using-superpowers/SKILL.md
      → JSON-escape content
      → Wrap in <EXTREMELY_IMPORTANT> tags
      → Output platform-specific JSON
```

**Platform detection** in `session-start`:
- Cursor: `additional_context` (snake_case)
- Claude Code: `hookSpecificOutput.additionalContext` (nested)
- Copilot CLI / others: `additionalContext` (top-level)

**Cross-platform `run-hook.cmd`**: A polyglot file that works as both Windows CMD and Unix bash. The Windows portion searches for Git Bash at standard paths, then falls back to `bash` on PATH. If no bash found, exits silently (graceful degradation — the plugin works without hooks, just without forced skill invocation).

### What Hooks Are NOT Used For

- No `PreCompact`/`PostCompact` hooks (no compaction survival)
- No `PostToolUse` hooks (no observational context)
- No `PreToolUse` hooks (no deterministic validation)

This is a deliberate choice: the plugin's compaction strategy is to keep skills short enough that they survive in Claude's compressed summary, not to externalize state through hooks.

---

## 4. Agent Architecture

### Single Agent: `code-reviewer`

```yaml
name: code-reviewer
model: inherit
```

The `model: inherit` field is notable — the reviewer uses whatever model the parent session is running. No `maxTurns`, `effort`, or `disallowedTools` declared.

**Six review dimensions:**
1. Plan Alignment Analysis
2. Code Quality Assessment
3. Architecture and Design Review
4. Documentation and Standards
5. Issue Identification (Critical/Important/Suggestions)
6. Communication Protocol

The agent is dispatched exclusively through the `requesting-code-review` skill, which constructs reviewer context from git SHAs. The reviewer never sees the session's conversational history — it gets a clean, crafted briefing.

### Subagent-as-Prompt Pattern

Rather than defining multiple agents, Superpowers uses **dispatch templates** — markdown files that serve as structured prompts for `Task` tool invocations:

| Template | Purpose | Dispatched By |
|----------|---------|---------------|
| `implementer-prompt.md` | Execute a single plan task | subagent-driven-development |
| `spec-reviewer-prompt.md` | Verify spec compliance | subagent-driven-development |
| `code-quality-reviewer-prompt.md` | Code quality check | subagent-driven-development |
| `plan-document-reviewer-prompt.md` | Review plan document | writing-plans |
| `spec-document-reviewer-prompt.md` | Review spec document | brainstorming |
| `code-reviewer.md` (skill-local) | Detailed review template | requesting-code-review |

This is an architectural choice: instead of 6 agents with frontmatter, Superpowers has 1 agent + 5 prompt templates injected into generic `Task` calls. The templates provide the same behavioral constraints (output format, escalation rules, review dimensions) but without the frontmatter-level `maxTurns`/`effort`/`disallowedTools` enforcement.

**Trade-off**: More flexible (any model, any turn count per invocation) but less token-efficient (no tool restrictions at the execution/orchestrator level — each subagent must self-enforce read-only behavior through prose).

---

## 5. Skill Architecture

### The Pipeline

Skills form a directed acyclic graph with one primary path and four orthogonal utilities:

```
using-superpowers (injected at SessionStart)
    │
    ▼
brainstorming ──── HARD-GATE: no code until design approved
    │
    ▼ (terminal state: ONLY writing-plans)
writing-plans
    │
    ├──▶ subagent-driven-development (recommended path)
    │        │
    │        ├── implementer-prompt.md (per task)
    │        ├── spec-reviewer-prompt.md (per task, after implementer)
    │        ├── code-quality-reviewer-prompt.md (per task, after spec review)
    │        │
    │        ▼
    │   finishing-a-development-branch
    │
    └──▶ executing-plans (alternative path)
             │
             ▼
        finishing-a-development-branch
```

**Orthogonal skills** (invocable at any point):
- `systematic-debugging` — triggered by any bug/failure
- `test-driven-development` — enforced during implementation
- `verification-before-completion` — enforced before completion claims
- `dispatching-parallel-agents` — for independent parallel work
- `receiving-code-review` — when feedback arrives
- `requesting-code-review` — dispatches code-reviewer agent
- `using-git-worktrees` — workspace isolation

### Skill Size Analysis

| Skill | Lines | Supporting Files | Token Estimate |
|-------|-------|-----------------|----------------|
| test-driven-development | 371 | 1 | ~2,800 |
| systematic-debugging | 296 | 4 | ~2,200 |
| visual-companion.md | 287 | (loaded by brainstorming) | ~2,100 |
| subagent-driven-development | 277 | 3 | ~2,000 |
| finishing-a-development-branch | 200 | 0 | ~1,500 |
| receiving-code-review | 213 | 0 | ~1,600 |
| dispatching-parallel-agents | 182 | 0 | ~1,400 |
| brainstorming | 164 | 2 (+ scripts) | ~1,200 |
| writing-plans | 152 | 1 | ~1,100 |
| verification-before-completion | 139 | 0 | ~1,000 |
| using-superpowers | 117 | 3 (platform refs) | ~900 |
| requesting-code-review | 105 | 1 | ~800 |
| executing-plans | 70 | 0 | ~500 |

**Note**: Several skills exceed the cl-plugin-structure recommendation of "SKILL.md under 800 tokens." However, the plugin's philosophy explicitly departs from Anthropic's published guidance, investing in extensive rationalization prevention that inflates line counts but (per the author's testing) improves behavioral compliance.

### The Three "Iron Laws"

Three skills use identical structural phrasing — a prominently displayed rule in a code block that forms an absolute behavioral constraint:

1. **TDD**: `"NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST"`
2. **Debugging**: `"NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST"`
3. **Verification**: `"NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE"`

Each is followed by: *"'Violating the letter of this rule while adhering to the spirit' is violating the spirit."* This constitutional-amendment-style phrasing prevents the AI from finding creative loopholes.

### Rationalization Prevention

Six skills include explicit tables mapping common AI rationalizations to corrective realities. This is Superpowers' signature prompt engineering pattern — targeting specific AI failure modes (sycophancy, shortcutting, premature completion) that emerge from testing.

Example from `using-superpowers`:
| Rationalization | Reality |
|----------------|---------|
| "This is just a simple question" | Questions are tasks. Check for skills. |
| "I need more context first" | Skill check comes BEFORE clarifying questions. |
| "This doesn't need a formal skill" | If a skill exists, use it. |

### XML Tag System

Superpowers uses custom XML tags as prompt-engineering constructs:
- `<HARD-GATE>` — Absolute behavioral constraint (used in brainstorming)
- `<SUBAGENT-STOP>` — Prevents recursive skill loading in subagents
- `<EXTREMELY-IMPORTANT>` / `<EXTREMELY_IMPORTANT>` — Maximum-attention directives
- `<Good>` / `<Bad>` — Concrete code examples with labels
- `<example>` / `<commentary>` — In agent descriptions for trigger context

### Progressive Disclosure

Skills load supporting files conditionally:
- `brainstorming` loads `visual-companion.md` only if user accepts the offer
- `subagent-driven-development` loads dispatch templates per task
- `systematic-debugging` references 4 supporting files for specific diagnostic patterns
- `using-superpowers` references 3 platform-specific tool mapping files

However, the main SKILL.md files themselves are not progressively disclosed — they load in full when invoked. The plugin trades token cost for behavioral reliability.

---

## 6. Visual Brainstorming System

The standout differentiator. A complete browser-based visual companion for design exploration.

### Architecture

```
Claude (terminal)                    Browser
    │                                   │
    ├── starts server.cjs ──────────────┤
    │   (zero-dep Node.js,              │
    │    hand-rolled WebSocket)         │
    │                                   │
    ├── writes HTML fragments ──────────┤── auto-reloads via WebSocket
    │   to screen_dir/                  │
    │                                   │
    │   ◄── reads click events ─────────┤── user clicks data-choice elements
    │       from state_dir/events       │
    │                                   │
    └── writes "waiting" screen ────────┤── when returning to terminal-only
        between visual questions        │
```

### Server (`server.cjs` — 354 lines)

- **Zero dependencies**: Hand-rolled HTTP server and WebSocket (RFC 6455) implementation
- **Ephemeral port**: Random port in 49152-65535 range (or `BRAINSTORM_PORT` env)
- **File watching**: `fs.watch` with 100ms debounce; new files clear events, updates just reload
- **Owner PID monitoring**: Exits if parent process dies (60-second polling)
- **30-minute idle timeout**: Auto-shutdown for forgotten sessions
- **Content model**: HTML fragments auto-wrapped in `frame-template.html`; full documents served as-is

### Client (`helper.js` — 88 lines)

- WebSocket auto-reconnect with 1-second delay
- Event queue for pre-connection messages
- Click delegation on `[data-choice]` elements
- Single-select and multi-select mode support
- Public API: `window.brainstorm.send()` and `window.brainstorm.choice()`

### Visual Decision Protocol

Each brainstorming question is independently evaluated:
- **Use browser**: UI mockups, architecture diagrams, side-by-side comparisons, layout proposals
- **Use terminal**: Requirements clarification, trade-off discussions, conceptual A/B/C choices

### CSS Component Library

Pre-built classes in `frame-template.html`:
- `.options` / `.cards` — Selection grids
- `.mockup` — UI wireframe containers
- `.split` / `.pros-cons` — Comparison layouts
- `.placeholder` — Wireframe placeholders
- `.mock-nav`, `.mock-sidebar`, `.mock-content`, `.mock-button`, `.mock-input` — UI component mocks

### Theme System

CSS custom properties with automatic light/dark via `prefers-color-scheme`. Apple-inspired design (system-ui font, rounded corners). Connected status indicator in header.

---

## 7. State Management

### File Persistence Model

| Artifact | Location | Lifecycle |
|----------|----------|-----------|
| Design specs | `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md` | Created by brainstorming |
| Implementation plans | `docs/superpowers/plans/YYYY-MM-DD-<topic>-plan.md` | Created by writing-plans |
| Brainstorm screens | `.superpowers/brainstorm/` | Ephemeral, per-session |
| Task completion state | TodoWrite tool + plan checkboxes | Per-session |

### Compaction Strategy

Superpowers has **no compaction survival hooks**. Its strategy is:
1. Keep skills short enough to survive Claude's compressed summary
2. Persist critical artifacts (specs, plans) to disk as they're created
3. Use TodoWrite for in-session task tracking (survives compaction natively)

This works because the plugin targets interactive sessions, not long autonomous loops. The `using-superpowers` skill is re-injected on every `compact` event (matcher includes "compact"), which is the most important piece — the meta-rules survive.

---

## 8. Platform Support

Superpowers targets 5 platforms:

| Platform | Integration Method | Hook Mechanism |
|----------|-------------------|----------------|
| **Claude Code** | Official marketplace | `hooks.json` → `run-hook.cmd` |
| **Cursor** | `.cursor-plugin/plugin.json` | `hooks-cursor.json` |
| **Codex** | Manual symlink | Native skill discovery |
| **OpenCode** | ES module plugin | `superpowers.js` adapter |
| **Gemini** | Extension system | `gemini-extension.json` + `GEMINI.md` |

The `run-hook.cmd` polyglot and platform detection in `session-start` are the core cross-platform mechanisms. The OpenCode adapter (`superpowers.js`, 113 lines) is the most complex — it maps Claude Code tool names to OpenCode equivalents and injects the using-superpowers skill into the first user message.

---

## 9. Testing Infrastructure

Five test suites covering different concerns:

| Suite | Files | Tests |
|-------|-------|-------|
| `tests/brainstorm-server/` | 5 | WebSocket protocol, server lifecycle, Windows behavior |
| `tests/claude-code/` | 7 | Skill integration, document review, SDD workflow, token analysis |
| `tests/explicit-skill-requests/` | 19 | 9 test prompts verifying skill triggering from various phrasings |
| `tests/skill-triggering/` | 8 | 6 test prompts for activation verification |
| `tests/opencode/` | 5 | Plugin loading, priority, tool mapping |

Notable: `analyze-token-usage.py` in `tests/claude-code/` — the plugin has tooling for measuring its own token cost, confirming the author's emphasis on tested/tuned behavior.

---

## 10. Terminology and Philosophy

### "Your Human Partner"

Used throughout instead of "user" or "the person." The CLAUDE.md contributor guide states this is deliberate and not interchangeable. This frames the relationship as collaborative rather than service-oriented, which aligns with the plugin's emphasis on mutual accountability (the AI should push back when the human is wrong).

### Anti-Sycophancy Enforcement

The `receiving-code-review` skill contains the most aggressive anti-sycophancy measures:
- Forbidden: "You're absolutely right!", "Great point!", "Let me implement that now" (before verification)
- Forbidden: ANY gratitude expression. "If you catch yourself about to write 'Thanks': DELETE IT."
- Secret pushback signal: "Strange things are afoot at the Circle K" (Bill & Ted reference as covert escalation)

### Behavioral Over Structural

Superpowers invests heavily in behavioral engineering (rationalization prevention, Iron Laws, HARD-GATEs) rather than structural enforcement (maxTurns, disallowedTools, hooks). The plugin trusts that well-crafted prose constraints, battle-tested against real failure modes, are more effective than mechanical restrictions.

This is a philosophical bet: prose instructions cost tokens but handle edge cases gracefully, while frontmatter restrictions are free but brittle (an agent blocked from writing when it legitimately needs to is stuck).

---

## 11. Assessment Against cl-plugin-structure

### What Superpowers Does Well

1. **Skill-driven workflow**: The 14-skill pipeline is comprehensive and forms a coherent DAG
2. **Visual brainstorming**: Unique capability — no other prompt-engineering plugin has a browser-based companion
3. **Anti-sycophancy engineering**: Deep understanding of AI failure modes, battle-tested
4. **Cross-platform support**: 5 platforms with graceful degradation
5. **Zero dependencies**: Pure prompt engineering + vanilla Node.js server
6. **Testing infrastructure**: Token analysis, integration tests, platform tests
7. **File persistence**: Design docs and plans survive sessions

### Where It Diverges from Spec Recommendations

1. **No agent frontmatter optimization**: Single agent with no `maxTurns`, `effort`, or `disallowedTools`
2. **No compaction hooks**: Relies on skill brevity and file persistence instead
3. **No observational context**: No `PostToolUse` logging
4. **Skill sizes exceed recommendations**: Multiple skills > 800 tokens (deliberate — behavioral reliability over token cost)
5. **Dispatch templates vs. agents**: 5 dispatch templates that could be agents with proper frontmatter
6. **No progressive disclosure in skills**: Skills load fully, not conditionally (again, behavioral reliability)

### Net Posture

Superpowers prioritizes **behavioral correctness** over **token efficiency**. Every design decision trades tokens for reliability. This is a valid strategy when the primary failure mode is AI misbehavior (skipping steps, sycophancy, shallow work) rather than context window exhaustion.

The plugin is optimized for interactive sessions with a human partner, not for autonomous multi-story execution. It has no equivalent to Spectrum's fresh-context-per-iteration pattern because its sessions are inherently human-paced and human-supervised.
