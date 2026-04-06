# Prism vs Superpowers: Comparative Analysis

**Date**: 2026-04-03
**Prism Version**: 2.5.2
**Superpowers Version**: 5.0.7
**Assessment Framework**: cl-plugin-structure (Claude Code plugin specification)

---

## 1. Origin Stories and DNA

### Prism

Prism's DNA traces to the **HumanLayer RPIV workflow** — Research, Plan, Implement, Validate. This four-phase structure is Prism's skeleton, and it remains visible in every layer of the plugin. The divine inspiration was the insight that AI agents produce better work when they are forced through deliberate phases of understanding before acting.

From RPIV, Prism evolved its own innovations:
- **Spectrum autonomous execution**: Fresh Claude sessions per story, eliminating context rot entirely
- **State externalization**: `stories.json`, `progress.md`, contracts, manifests — memory persists through files, not AI context
- **Three-layer architecture**: Skills → Commands → Agents, with model tiering (Opus/Sonnet/Haiku)
- **"Documentarian, Not Critic"**: Research agents describe what exists without editorializing

### Superpowers

Superpowers emerged from a different pressure: **AI behavioral failure modes**. Jesse Vincent's approach was to identify specific ways AI agents fail (sycophancy, step-skipping, premature completion, shallow work) and engineer prompt-level countermeasures through extensive testing.

Key DNA:
- **Iron Laws**: Absolute behavioral constraints that cannot be violated
- **Rationalization prevention**: Tables mapping AI excuses to corrective realities
- **Anti-sycophancy engineering**: Forbidden phrases, no-gratitude rules, adversarial reviewer framing
- **Visual brainstorming**: Browser-based design companion with WebSocket server
- **"Your human partner"**: Framing that enforces collaborative accountability

### The Common Ancestor

Both plugins solve the same fundamental problem: **AI agents produce shallow, unreliable work when given unstructured freedom.** They diverge in their primary mechanism:
- **Prism** constrains through **structure** — phases, agents, state files, automated gates
- **Superpowers** constrains through **behavioral engineering** — Iron Laws, rationalization tables, HARD-GATEs, anti-sycophancy rules

---

## 2. Architecture Comparison

### Scale

| Dimension | Prism | Superpowers |
|-----------|-------|-------------|
| Skills | 14+ (phase-specific + utilities) | 14 (pipeline + orthogonal) |
| Agents | 12 (specialist roles, model-tiered) | 1 (`code-reviewer`, model: inherit) |
| Hooks | 0 (identified as top gap) | 1 event (SessionStart only) |
| Commands | 20+ (user-invocable operations) | 3 (all deprecated) |
| Scripts | 5 (spectrum.sh, visual-regression.sh, etc.) | 6 (brainstorm server + helpers + version) |
| State Files | Complex (stories.json, manifests, contracts, progress.md) | Light (specs, plans, TodoWrite) |
| CLI Dashboard | Full Go TUI (Bubble Tea, 3D prism, spring animations) | None |
| Test Suites | Go tests for CLI | 5 suites (server, integration, triggering, platform, e2e) |

### Workflow Pipelines

**Prism's RPIV Pipeline:**
```
Research ──▶ Plan ──▶ Implement ──▶ Validate
    │           │          │            │
    ▼           ▼          ▼            ▼
5 parallel   Interactive   Phase-by-   Success
agents       approval      phase with   criteria
             loops         checkpoints  verification
```

**Superpowers' Pipeline:**
```
Brainstorm ──▶ Write Plan ──▶ Implement ──▶ Finish Branch
    │              │              │              │
    ▼              ▼              ▼              ▼
Visual          Self-review    Per-task:        4 options:
companion       + user         Implement →      merge/PR/
(browser)       approval       Spec review →    keep/discard
                               Code review
```

**Key structural difference**: Prism's pipeline has an explicit **Research** phase with 5 parallel specialist agents before any planning happens. Superpowers goes straight to **Brainstorming** — a human-interactive design exploration that serves as both research and ideation simultaneously.

### Agent Strategy

| Aspect | Prism | Superpowers |
|--------|-------|-------------|
| Agent count | 12 specialist agents | 1 agent + 5 dispatch templates |
| Model assignment | Explicit per agent (haiku/sonnet/opus) | `inherit` (matches parent session) |
| Tool restrictions | Planned via frontmatter (currently prose-only) | None (prose-only) |
| Turn limits | Planned via frontmatter (currently unbounded) | None |
| Effort calibration | Planned via frontmatter (currently uncalibrated) | None |
| Read-only enforcement | Prose instructions | Prose instructions |
| Dispatch mechanism | `Task(subagent_type="agent-name")` | `Task` with full prompt template injected |

**Prism's bet**: Many specialists with tight constraints yield better results than few generalists. A haiku locator that can't write is cheaper and more focused than an inherited-model generalist that must self-enforce read-only behavior.

**Superpowers' bet**: Fewer agents with richer behavioral prompts (the dispatch templates are 26-113 lines each) produce more nuanced work. The implementer prompt includes escalation rules, self-review checklists, and the explicit permission to say "this is too hard for me."

### State Management

| Aspect | Prism | Superpowers |
|--------|-------|-------------|
| State location | `.prism/shared/` (committed) + `.prism/local/` (gitignored) | `docs/superpowers/` (committed) + `.superpowers/` (ephemeral) |
| Story tracking | `stories.json` with status, priority, blockers, files, steps | TodoWrite (in-session) + plan checkboxes |
| Contract system | `.prism/shared/contracts/` (interfaces, APIs, deps, tests) | None |
| Manifest system | Per-story manifests with requirements, dependencies, gates | None |
| Progress journal | `progress.md` (accumulated cross-session learnings) | None |
| Session handoffs | `.prism/shared/handoffs/` (structured handoff docs) | None (interactive sessions only) |
| Compaction survival | None (identified as gap; planned via hooks) | SessionStart re-injection on compact event |

**Prism is dramatically more stateful.** This is because Prism targets autonomous execution (Spectrum), where state must survive across fresh Claude sessions with zero conversational continuity. Superpowers targets interactive sessions where the human provides continuity.

---

## 3. Behavioral Engineering

### Superpowers' Innovations (Not Present in Prism)

**1. Iron Laws**
Three skills use an identical pattern — a prominently displayed absolute constraint:
- `"NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST"`
- `"NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST"`
- `"NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE"`

Each followed by: *"'Violating the letter of this rule while adhering to the spirit' is violating the spirit."*

Prism has no equivalent — its constraints are expressed as principles ("Documentarian, Not Critic", "Interactive Planning") rather than Iron Laws with constitutional language.

**2. Rationalization Prevention Tables**
Six Superpowers skills include explicit tables mapping AI rationalizations to corrective realities. These target specific observed failure modes:

| Rationalization | Reality |
|----------------|---------|
| "This is just a simple question" | Questions are tasks. Check for skills. |
| "I need more context first" | Skill check comes BEFORE clarifying questions. |
| "The skill is overkill" | Simple things become complex. Use it. |

Prism has no rationalization prevention tables. Its skills assume agents will follow instructions without needing to be told why they might resist.

**3. Anti-Sycophancy Engineering**
Superpowers' `receiving-code-review` skill:
- Forbids gratitude expressions entirely
- Forbids agreement without verification
- Uses adversarial framing ("The implementer finished suspiciously quickly. Their report may be incomplete.")
- Includes a secret pushback signal ("Strange things are afoot at the Circle K")

Prism's agents have no anti-sycophancy measures. The "Documentarian, Not Critic" principle addresses the opposite concern — preventing agents from being too critical.

**4. HARD-GATE Pattern**
The brainstorming skill uses `<HARD-GATE>` XML tags to create absolute process gates:
> "Do NOT invoke any implementation skill, write any code, scaffold any project, or take any implementation action until you have presented a design and the user has approved it."

Prism's skills don't use XML-tag-based gates — they rely on sequential phase ordering enforced by the skill invocation chain.

**5. Human Frustration Detection**
The `systematic-debugging` skill detects 5 user frustration signals ("Is that not happening?", "Stop guessing", "We're stuck?") and maps them to "Return to Phase 1." This acknowledges that debugging failures are a relationship problem, not just a technical one.

Prism has no frustration detection — Spectrum iterations are autonomous (no human present), and interactive sessions don't have explicit frustration handling.

### Prism's Innovations (Not Present in Superpowers)

**1. Spectrum Fresh-Context-Per-Iteration**
Prism's most powerful anti-degradation pattern: spawn a new Claude session for every story. Context rot becomes impossible because there is no accumulated context. State persists through files and git commits.

Superpowers has no autonomous execution capability. Every session requires human interaction.

**2. Three-Tier Model Assignment**
Prism explicitly assigns models based on task complexity:
- **Opus**: Deep analysis (codebase-analyzer, prism-analyzer)
- **Sonnet**: General work (pattern-finder, web-search)
- **Haiku**: Fast lookups (locators, investigators)

Superpowers uses `model: inherit` for its single agent and doesn't specify models for dispatch template subagents.

**3. Parallel Research Agents**
Prism's research phase spawns 5 agents simultaneously:
- codebase-locator (haiku)
- codebase-analyzer (opus)
- codebase-pattern-finder (sonnet)
- prism-locator (haiku)
- web-search-researcher (sonnet)

Superpowers' brainstorming is sequential and human-interactive — it asks questions one at a time.

**4. Contract System**
Prism has a formal contract system (`.prism/shared/contracts/`) for cross-story interfaces:
- `interfaces.json`, `api-endpoints.json`, `component-props.json`
- Lifecycle: Proposed → Agreed → Verified
- Transport: git commits

Superpowers has no inter-task contract mechanism.

**5. Story Manifest System**
Per-story manifests with requirements, dependencies, gates, and session tracking. Enables incremental progress across multiple sessions on the same story.

Superpowers tracks task completion through TodoWrite and plan checkboxes — adequate for single-session work but not for multi-session persistence.

**6. CLI Dashboard**
A full Go TUI (Bubble Tea) with multi-screen views, 3D rotating prism, spring-based animations, and real-time Spectrum execution monitoring. This is a visual layer on top of the workflow that Superpowers doesn't attempt.

---

## 4. Visual Brainstorming Deep Dive

Superpowers' visual brainstorming system is its most distinctive feature and the one that inspired this comparison. Here's what it does and how Prism could learn from it.

### What It Is

A browser-based visual companion that runs alongside the terminal during brainstorming sessions. Claude writes HTML fragments to a screen directory; a zero-dependency Node.js server auto-wraps them in a themed template and pushes them to the browser via WebSocket. User clicks are recorded as JSONL events that Claude reads on the next turn.

### Architecture Strengths

1. **Zero-dependency server**: Hand-rolled HTTP + WebSocket in 354 lines of vanilla Node.js. No npm install needed.
2. **Fragment model**: Claude writes HTML snippets, not full pages. The frame template provides consistent chrome, theme, and styling.
3. **CSS component library**: Pre-built classes (`options`, `cards`, `mockup`, `split`, `pros-cons`) let Claude produce professional-looking UI mockups without CSS expertise.
4. **Per-question evaluation**: Each brainstorming question is independently judged — visual for mockups and diagrams, terminal for trade-offs and requirements. Not all-or-nothing.
5. **Event capture**: Click history preserved as JSONL, giving Claude both the final selection and the exploration path.
6. **Platform-aware startup**: Different launch strategies for macOS, Linux, Windows, Codex, and Gemini CLI.

### What Prism Could Adopt

The visual brainstorming system fills a gap in Prism's research and planning phases. Currently:
- **Prism Research** produces markdown documents — comprehensive but text-only
- **Prism Plan** is interactive but terminal-only — trade-offs are discussed in text
- **Spectrum** is fully autonomous — no visual component needed

A visual companion would be most valuable during **Prism Plan** (interactive planning), where showing architecture diagrams, component layouts, and side-by-side approach comparisons visually would accelerate user buy-in. It could also enhance **Prism Research** by producing visual codebase maps.

### What Superpowers Could Learn from Prism

Superpowers' brainstorming doesn't produce structured state files that downstream skills can consume programmatically. The design spec is a markdown document — rich for humans but opaque to automated story decomposition. Prism's `stories.json` schema + contract system + manifest system create machine-readable artifacts that enable autonomous execution.

---

## 5. Token Economy

### Philosophy Divergence

| Dimension | Prism | Superpowers |
|-----------|-------|-------------|
| Primary concern | Context window exhaustion (autonomous execution) | AI behavioral failure (interactive sessions) |
| Token strategy | Minimize waste, maximize agent efficiency | Invest tokens in behavioral reliability |
| Agent budget | Planned: maxTurns, effort, disallowedTools | None — trusts prose constraints |
| Skill size | Moderate (122-291 lines), progressive disclosure planned | Large (70-371 lines), fully loaded |
| Compaction | Planned: PreCompact/PostCompact hooks | SessionStart re-injection only |
| State reading | Agents re-read state files before acting | Skills trust conversational context |

### Token Cost Profiles

**Prism per-story (Spectrum):**
```
SKILL.md loaded:     ~291 lines (prism-spectrum)
Agents spawned:      0-5 per story (haiku/sonnet/opus mix)
State files read:    stories.json + progress.md + plan + manifests
State files written: stories.json update + progress.md append + commit
```

**Superpowers per-task (Subagent-Driven):**
```
Skills loaded:       ~277 lines (SDD) + ~371 (TDD) + ~139 (verification)
Subagents spawned:   3 per task (implementer + spec reviewer + code reviewer)
State files read:    Plan document
State files written: Design spec + plan document + TodoWrite updates
```

Prism's Spectrum model is more token-efficient per-iteration because each session starts clean. Superpowers accumulates context across the full interactive session, making later tasks more expensive.

---

## 6. Complementary Strengths Matrix

| Capability | Prism Strength | Superpowers Strength | Best of Both |
|------------|---------------|---------------------|--------------|
| **Pre-implementation thinking** | Parallel agent research | Visual brainstorming with browser companion | Visual research + parallel agents |
| **Planning** | Interactive planning with user approval loops | Self-reviewing plans with placeholder scanning | Interactive plans with self-review + visual companion |
| **Implementation** | Phase-by-phase with Spectrum autonomy | Per-task with spec + code review loop | Spectrum autonomy with per-task review gates |
| **Verification** | Two-category success criteria (automated + manual) | Iron Law verification with evidence requirements | Two-category criteria with Iron Law enforcement |
| **Debugging** | 3 parallel debug agents (git/log/state) | 4-phase systematic methodology with frustration detection | Parallel agents following systematic methodology |
| **Code Review** | Not formalized | Full lifecycle (request → dispatch → receive → respond) | Adopt Superpowers' review lifecycle |
| **State Persistence** | Comprehensive (stories, contracts, manifests, progress) | Light (specs, plans, TodoWrite) | Prism's state system |
| **Autonomous Execution** | Spectrum (fresh sessions, story-per-iteration) | None | Prism's Spectrum |
| **Behavioral Guardrails** | Minimal (principles, agent instructions) | Extensive (Iron Laws, rationalization tables, anti-sycophancy) | Superpowers' behavioral engineering |
| **Cross-Platform** | Partial (bash scripts, Go CLI) | Strong (5 platforms, polyglot hooks) | Superpowers' platform approach |
| **TDD** | Not formalized | Full Red-Green-Refactor with anti-patterns | Adopt Superpowers' TDD skill |
| **Visual Tools** | CLI dashboard (Go TUI, 3D prism) | Browser brainstorming companion | Both (different purposes) |

---

## 7. What Prism Should Consider Adopting

### High Value, Low Effort

1. **Iron Law Pattern**: Add absolute constraints to key skills. Prism's "Documentarian, Not Critic" principle could become: `"NO SUGGESTIONS, CRITIQUES, OR IMPROVEMENTS — DESCRIBE WHAT EXISTS"` with the constitutional clause.

2. **Rationalization Prevention Tables**: Add to `prism-spectrum`, `prism-implement`, and `prism-validate`. Target observed failure modes specific to Prism's autonomous execution (e.g., "I'll just fix this small thing while I'm here" → "One story. One commit. Nothing else.").

3. **Verification Evidence Requirements**: Adopt the `verification-before-completion` skill's claims-to-evidence mapping. Prism's quality gates already run commands — but the Iron Law framing ("NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE") would strengthen the enforcement.

4. **HARD-GATE XML Tags**: Use in `prism-plan` to prevent implementation before plan approval, and in `prism-research` to prevent suggestions.

### High Value, Medium Effort

5. **Visual Brainstorming Companion**: Integrate during the Plan phase for architecture visualization. Could reuse Superpowers' server infrastructure (it's zero-dependency, MIT-licensed) or build a Prism-themed variant. The CSS component library would need Prism theming.

6. **Code Review Lifecycle**: Prism has no formalized code review. Adopt Superpowers' three-skill approach: `requesting-code-review` → `code-reviewer` agent → `receiving-code-review`. Integrate with Spectrum by adding a review gate between implementation and commit.

7. **TDD Skill**: Prism has no TDD enforcement. The `test-driven-development` skill (or a Prism-flavored variant) could be invoked during `prism-implement` for stories that modify behavior.

### Consider But Evaluate

8. **Anti-Sycophancy Engineering**: Valuable for code review scenarios but potentially counterproductive for Spectrum autonomous execution where no human is present. Apply selectively to interactive skills only.

9. **"Your Human Partner" Terminology**: A philosophical choice. Prism's documentation uses "user" throughout. Adopting "human partner" would signal a collaborative rather than service relationship. Worth discussing.

10. **Subagent Dispatch Templates**: Superpowers' implementer-prompt.md includes escalation rules ("It is always OK to stop and say 'this is too hard for me'") and self-review checklists. These could enhance Prism's Spectrum stories with richer per-story context.

---

## 8. What Superpowers Could Learn from Prism

1. **Autonomous Execution**: Spectrum's fresh-context-per-iteration pattern solves the context rot problem entirely. Superpowers has no answer for large features requiring 10+ tasks.

2. **Agent Specialization**: 12 specialist agents with model tiering vs. 1 generalist agent. For cost-sensitive workloads, haiku agents at 5-8 turns are dramatically cheaper than inherited-model generalists.

3. **State Architecture**: `stories.json` + contracts + manifests enable machine-readable progress tracking. Superpowers' TodoWrite + plan checkboxes don't survive session boundaries.

4. **Parallel Research**: 5 simultaneous agents exploring different dimensions of a codebase is faster than sequential human-interactive questioning.

5. **Compaction Hooks**: Prism's planned PreCompact/PostCompact hooks (audit remediation plan) would benefit Superpowers' long interactive sessions just as much.

---

## 9. Philosophical Synthesis

Prism and Superpowers represent two valid responses to the same problem. Their approaches are more complementary than competing:

| Prism's Thesis | Superpowers' Thesis |
|---------------|-------------------|
| Structure prevents chaos | Behavioral engineering prevents failure |
| Agents should be specialized and constrained | Agents should be flexible with rich guidance |
| Autonomy requires external state | Interaction requires behavioral guardrails |
| Fresh context beats context management | Skill injection beats context management |
| Research before planning, planning before implementation | Brainstorming before planning, planning before implementation |
| The machine should run without supervision | The human partner should always be in the loop |

The ideal synthesis: **Prism's structural rigor with Superpowers' behavioral safeguards.** Use Prism's agent architecture, state system, and Spectrum execution — but infuse skills with Iron Laws, rationalization prevention, and verification evidence requirements. Add visual brainstorming for interactive planning sessions. Add code review lifecycle for quality assurance.

Both plugins honor the same deeper truth that inspired Prism's RPIV roots: **deliberate phases of understanding before action produce better outcomes than unstructured AI freedom.**

---

## Appendix: Feature Matrix

| Feature | Prism | Superpowers |
|---------|-------|-------------|
| Structured workflow phases | Research → Plan → Implement → Validate | Brainstorm → Plan → Implement → Finish |
| Autonomous execution | Spectrum (fresh sessions per story) | — |
| Visual brainstorming | — | Browser companion (WebSocket + HTML fragments) |
| CLI dashboard | Go TUI (Bubble Tea, 3D, animations) | — |
| Agent count | 12 | 1 |
| Agent model tiering | Opus / Sonnet / Haiku | Inherit |
| Agent frontmatter (maxTurns, effort, disallowed) | Planned | — |
| Hooks | Planned (audit remediation) | SessionStart only |
| State persistence | stories.json, contracts, manifests, progress.md | Specs, plans (markdown) |
| Session handoffs | Structured handoff documents | — |
| Contract system | Interface/API/component/dependency/test contracts | — |
| Code review lifecycle | — | Request → Review → Receive → Respond |
| TDD enforcement | — | Full Red-Green-Refactor skill |
| Systematic debugging | 3 parallel agents (git/log/state) | 4-phase methodology with frustration detection |
| Anti-sycophancy measures | — | Iron Laws, forbidden phrases, adversarial framing |
| Rationalization prevention | — | Tables in 6 skills |
| Verification evidence | Quality gates (automated commands) | Claims-to-evidence mapping with Iron Law |
| Cross-platform scripts | Partial (bash + planned Python) | Polyglot batch/bash + 5 platform adapters |
| Testing infrastructure | Go tests for CLI | 5 suites including token analysis |
| Progressive disclosure | Planned (spectrum sub-protocols) | Partial (visual companion loaded on demand) |
| Graph-based code intelligence | codebase-memory-mcp integration | — |
| RPIV heritage | Direct (HumanLayer) | — |
| Version management | bump-version.py (Python, cross-platform) | bump-version.sh (bash) |
| Plugin validation | `claude plugin validate .` | — |
