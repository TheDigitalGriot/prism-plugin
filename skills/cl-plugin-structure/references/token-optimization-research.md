# Token Optimization & Context Engineering for Claude Code Plugins

> Research compiled from Karpathy's autoresearch, Chroma's context rot study, Anthropic's context engineering blog, and community practitioner findings. Intended as a reference for auditing and fixing token efficiency across any Claude Code plugin.

---

## Table of Contents

1. [Context Rot: The Core Problem](#1-context-rot-the-core-problem)
2. [Autoresearch: Architectural Lessons](#2-autoresearch-architectural-lessons)
2.5. [Attention Residuals: Theoretical Foundation for Selective Context](#25-attention-residuals-theoretical-foundation-for-selective-context)
3. [Progressive Disclosure: The Highest-Leverage Fix](#3-progressive-disclosure-the-highest-leverage-fix)
4. [Hook Efficiency: Eliminating Wasted LLM Calls](#4-hook-efficiency-eliminating-wasted-llm-calls)
5. [Agent Design: Bounded Execution](#5-agent-design-bounded-execution)
6. [State Externalization: Disk Over Conversation](#6-state-externalization-disk-over-conversation)
6.5. [Observational Memory: Cache-Aware Compression](#65-observational-memory-cache-aware-compression)
7. [Compaction Survival: Designing for Memory Loss](#7-compaction-survival-designing-for-memory-loss)
8. [CLAUDE.md Hygiene](#8-claudemd-hygiene)
9. [MCP Server Token Patterns](#9-mcp-server-token-patterns)
10. [Plugin Audit Checklist](#10-plugin-audit-checklist)
11. [Sources & Further Reading](#11-sources--further-reading)

---

## 1. Context Rot: The Core Problem

### What It Is

Context rot is the measurable degradation in LLM output quality as input context length grows. It is not a capability gap that can be trained away — it is a structural property of how transformer attention works. Every token in the context competes for attention. In a short context, relevant tokens dominate. In a long one (hundreds of messages, failed debug attempts, entire files), relevant tokens get buried in noise.

### When It Starts

Chroma's 2025 systematic study tested 18 frontier models across eight input lengths and 11 needle positions. Key findings:

| Threshold | What Happens |
|---|---|
| **500–750 tokens** of noise | Degradation begins for Gemini models on random word generation tasks |
| **2,500 tokens** of noise | Task refusals and pre-task observation loops begin in Claude Opus 4 |
| **5,000+ tokens** of noise | Hallucinations and task refusals increase across all model families |
| **50K+ tokens** | Significant degradation even in 200K-context models — well before limits |

**Critical insight:** Rot happens well before context limits. A 200K-token model can exhibit significant degradation at 50K tokens. The problem is not capacity — it is signal-to-noise ratio.

### Which Tasks Are Most Vulnerable

Ranked by vulnerability (most vulnerable first):

1. **Semantic retrieval** — non-lexical matching (finding information that isn't an exact keyword match) degrades fastest
2. **Distractor handling** — even a single irrelevant document reduces performance; multiple compound exponentially
3. **Text replication** — even trivial repetition tasks fail as context grows
4. **Conversational Q&A over long history** — LongMemEval benchmarks showed dramatic gaps between focused (~300 token) and full context (~113K token) variants. Mastra's observational memory system scored 94.9% with GPT-4o mini and 84.2% with GPT-4o on LongMemEval (500 questions, 57M tokens) — exceeding the oracle baseline of 82.4% and the raw-context baseline of 60% — by replacing retrieval with continuous background compression (see Section 6.5)

### Why This Matters for Plugins

An OpenReview study on token consumption confirmed that **input tokens dominate overall cost in agentic tasks**, with some runs consuming 10x more tokens than equivalent others. The variance was almost entirely driven by search efficiency: agents that located the right code quickly used fewer tokens, accumulated less noise, and produced better results.

**The problem is not coding ability — it is orientation overhead.**

Every token of irrelevant context loaded by your plugin (bloated SKILL.md, unnecessary hook evaluations, verbose agent outputs) directly competes with the tokens that actually matter for the user's task.

---

## 2. Autoresearch: Architectural Lessons

### Background

Andrej Karpathy released autoresearch on March 7, 2026 — a 630-line framework that gives an AI coding agent a real LLM training setup and lets it run autonomous ML experiments overnight. It accumulated 53,000+ stars within weeks and became a reference design for efficient autonomous agent workflows.

The core loop: read strategy → hypothesize → modify code → commit → run (5-min budget) → evaluate single metric → keep or revert → repeat.

### The 10 Patterns Worth Stealing

#### Pattern 1: Bounded Scope = Bounded Context

The entire editable codebase is 630 lines intentionally. The agent reads the complete relevant state before every modification. Because the scope is bounded, this is always feasible.

**Application to plugins:** Each agent should receive only the files relevant to its task. Don't load the entire project state when only one scene needs building. Scope the agent's readable surface.

#### Pattern 2: State on Disk, Not in Conversation

`results.tsv` is an append-only tabular log. The agent never retains experimental history in its context window — it re-reads from disk. State lives on the filesystem, not in the conversation.

**Application to plugins:** Use a structured JSON file (like `lucid-project.json`) as the single source of truth. Agents write findings to the file, read from the file. The conversation window becomes stateless between actions.

#### Pattern 3: Single Metric Prevents Multi-Objective Thrashing

Multiple competing objectives cause agents to produce verbose, hedged reasoning and unstable decisions. Autoresearch uses `val_bpb` as the single arbiter.

**Application to plugins:** Each agent dispatch should have one clear success criterion. "Build scene-03 from the beat map" not "build scene-03 and also consider the visual philosophy and check if the transitions work with scene-02."

#### Pattern 4: Hard Constraints Eliminate Decision Overhead

Every hard constraint (5-minute budget, single file, no new packages, immutable evaluation) removes an entire category of agent deliberation. The agent never deliberates about *whether* to extend a run or refactor across files.

**Application to plugins:** Constrain agent scope explicitly in their system prompts. "You may only modify files in `src/scenes/scene-03-*/`" eliminates the agent's deliberation about what to touch.

#### Pattern 5: Simplicity as a First-Class Constraint

The explicit rule: "A small improvement that adds ugly complexity is not worth it. Removing something and getting equal or better results is a great outcome." This keeps the codebase within the agent's reasoning capacity.

**Application to plugins:** Add simplicity constraints to builder agents. "Keep scene files under 200 lines. Split into sub-components if exceeding." This prevents progressive code growth that exceeds the agent's ability to reason coherently.

#### Pattern 6: Git as Free Rollback and Diff Layer

`git reset --hard HEAD~1` is the discard mechanism. No custom state management needed. The experiment history is inspectable, each change is a reviewable diff.

**Application to plugins:** Use git commits as checkpoints. If a scene build fails, revert rather than trying to fix in-context. The conversation doesn't need to remember the failed attempt.

#### Pattern 7: Fixed Time Budgets Enable Comparability

The 5-minute wall-clock constraint creates the invariant that makes every experiment directly comparable. Without it, the agent reasons about whether a better result came from a better idea or more compute.

**Application to plugins:** Set `maxTurns` as a genuine budget, not a safety net. An agent with 10 turns will be more decisive than one with 30 turns — the constraint forces prioritization.

#### Pattern 8: Re-Read from Disk at Every Cycle Start

A critical community-discovered technique for long sessions: "Re-read all state from disk at the start of every cycle. Files are the source of truth, not conversational memory."

**Application to plugins:** Every agent prompt should start with "Read `lucid-project.json` before taking any action." Don't trust conversational memory of the project state — it degrades after 10+ turns.

#### Pattern 9: The `program.md` as Human-Agent Interface

A persistent, version-controlled document the agent reads at session start. It carries instructions, constraints, and stopping criteria. Human course-corrections happen by editing this file — not by interrupting the agent.

**Application to plugins:** The CLAUDE.md in each project directory serves this role. Keep it lean, focused, and authoritative. The agent reads it once and operates from it.

#### Pattern 10: Emergent Delegation Under Constraints

When given a GPU cluster, autoresearch agents self-organized into a two-tier workflow: cheap screening on H100s → promoted confirmation on H200s. This was not instructed — it emerged from the constraints.

**Application to plugins:** Model-targeted agents (haiku for fast tasks, sonnet for building, opus for reasoning) create a natural cost hierarchy. The agent routing table in your skill definition is the equivalent.

---

## 2.5. Attention Residuals: Theoretical Foundation for Selective Context

### The Structural Analogy

The Kimi team's Attention Residuals paper ([arxiv.org/abs/2603.15031](https://arxiv.org/abs/2603.15031), March 2026) provides architectural evidence for why progressive disclosure and selective context loading outperform monolithic context dumps — from inside the model itself.

**The problem they identified:** Standard residual connections (introduced in 2015 to solve vanishing gradients) accumulate every layer's output into one growing signal. Later layers dominate; early-layer information gets diluted. The paper calls this "PreNorm dilution" — the model literally forgets what it learned in early layers because depth creates noise.

**Their fix:** Replace the additive residual highway with attention-based depth connections. Each layer issues a query; prior layers expose keys and values; only the most relevant prior representations get mixed in. Selective retrieval over cumulative accumulation.

**Results:** 1.25x compute reduction for equivalent performance, +7.5 points on GPQA Diamond (graduate-level science reasoning), consistent gains on MMLU, math, and coding. Evaluated on the Kimi Linear architecture (48B total / 3B activated MoE, trained on 1.4T tokens). Outperforms DeepSeek's MHC (Manifold-Constrained Hyper-Connections) at comparable scale.

### Why This Matters for Context Engineering

The paper's finding maps directly to plugin context management:

| Model Architecture (Attention Residuals) | Plugin Context Engineering |
|---|---|
| Additive residual (dump all layer outputs) | Monolithic SKILL.md (dump all instructions) |
| Attention residual (selectively query prior layers) | Progressive disclosure (load context on demand) |
| PreNorm dilution (early signals buried by depth) | Context rot (relevant tokens buried by noise) |
| Block Attention Residuals (group layers into communication-efficient blocks) | Agent routing tiers (haiku/sonnet/opus as compute blocks) |
| Emergent layer specialization (short-term memory vs. global coordinators) | Agent specialization (scouts for lookups, builders for code, architects for reasoning) |
| 1.25x compute reduction | 85-100x token reduction via progressive disclosure |

The core insight is the same at both levels: **selective retrieval outperforms cumulative accumulation.** Loading all instructions upfront (additive residual) dilutes signal. Loading context on demand (attention over depth) preserves it.

### Block Attention Residuals and Agent Tiers

The paper's practical deployment variant — Block Attention Residuals — groups layers into server-rack-aligned blocks. Attention runs freely within each block, but only compressed summaries pass between blocks. This solves the cross-server traffic explosion that would otherwise make full attention impractical at trillion-parameter scale.

This mirrors the agent tier pattern exactly. Within a tier (e.g., a sonnet builder agent), the agent has full access to its scoped context. Between tiers (e.g., haiku scout → sonnet builder → opus architect), only structured summaries pass — not raw context. The block boundaries in the model are analogous to agent boundaries in the plugin.

### Emergent Structure

The paper's most striking finding: visualizing attention patterns across layers reveals emergent structure that was never explicitly trained. Most layers attend locally (sequential processing), but some deep layers spontaneously form long-range skip connections back to early layers. Some layers specialize as short-term memory; others become global coordinators. The model builds custom retrieval pathways per input and discards them — a functional analog to neuroplasticity.

This validates autoresearch's Pattern 10 (Emergent Delegation Under Constraints): when you provide the right structural constraints without over-specifying behavior, useful specialization emerges. In plugins, this manifests as agents developing efficient patterns within their scope constraints — the same principle, applied at the orchestration layer rather than the attention layer.

---

## 3. Progressive Disclosure: The Highest-Leverage Fix

### The Three-Tier Architecture

Progressive disclosure — showing only what's necessary and loading more on demand — is the single most impactful token optimization for plugins.

**Layer 1: Discovery (~80 tokens per skill)**
The platform reads only `name` and `description` from YAML frontmatter at startup. Across Anthropic's 17 official skills, the range is ~55 tokens (webapp-testing) to ~235 tokens (xlsx). All 17 skills together cost ~1,700 tokens — less than a single activated skill.

**Layer 2: Activation (275–8,000 tokens)**
When the model determines a skill is relevant, the full SKILL.md body loads. Median is ~2,000 tokens.

**Layer 3: Execution (on demand)**
Supporting scripts, reference docs, and templates load only during task execution, via file path references.

### The Numbers

From Matthew Kruczek's benchmark of five MCP progressive disclosure patterns:

| Pattern | Token Reduction |
|---|---|
| Two-Stage (names upfront, schemas on-demand) | 96% |
| Strata (4-stage funnel: intent → category → action → schema) | 83%+ |
| Skills (3-level: metadata → instructions → resources) | 85–100x |
| Code-as-tools implementation | 98.7% |

Flagship example: a 400-tool enterprise MCP server reduced from **405,100 tokens to ~4,000–5,000 tokens**.

### How to Apply to a Plugin Skill

**Before (monolithic SKILL.md — everything loads on activation):**
```markdown
---
name: my-workflow
description: Does everything
---

# Full Workflow
[2,500+ tokens of instructions, agent routing, conventions, all project types, examples...]
```

**After (progressive SKILL.md — lean router with on-demand rules):**
```markdown
---
name: my-workflow
description: Does everything
---

# My Workflow

Route tasks to the right agent:
| Task | Agent | Model |
|------|-------|-------|
| Creative direction | architect | opus |
| Code generation | builder | sonnet |
| File lookups | scout | haiku |

## Detailed Rules (load on demand)
- When doing creative work, load [./rules/spec-writing.md](./rules/spec-writing.md)
- When building components, load [./rules/build-conventions.md](./rules/build-conventions.md)
- When working with 3D, load [./rules/three-fiber.md](./rules/three-fiber.md)
- When polishing animations, load [./rules/motion-principles.md](./rules/motion-principles.md)

[~400 tokens total at activation]
```

The key insight: the `description:` field in frontmatter is what the model reads to make the activation decision. It must be precise enough to activate correctly from ~80 tokens.

### What Goes in Each Tier

| Tier | Content | Token Budget |
|---|---|---|
| Discovery (frontmatter) | Name + description with trigger phrases | ~80 tokens |
| Activation (SKILL.md body) | Agent routing table, pipeline overview, file path references to rules | ~400-800 tokens |
| Execution (rule files) | Detailed instructions, code examples, API patterns, conventions | ~500-2,000 per file, loaded individually |

---

## 4. Hook Efficiency: Eliminating Wasted LLM Calls

### The Three Hook Types and Their Cost

| Type | Mechanism | Cost | Use When |
|---|---|---|---|
| `command` | Shell script, stdin/stdout/exit codes | **Free** (CPU only) | Deterministic rules: path matching, syntax checks, blocklists |
| `prompt` | Single-turn LLM call (Haiku by default) | **API cost per invocation** | Judgment required but no codebase access needed |
| `agent` | Multi-turn subagent with tools (up to 50 turns, 60s timeout) | **Highest cost** | Verification requiring file reads or command execution |

### The Cardinal Rule

**`command` hooks are free. `prompt` and `agent` hooks cost tokens and latency on every matched tool call.** Use LLM evaluation only when the decision genuinely requires semantic understanding.

### Anti-Pattern: Promiscuous Prompt Hooks

```json
{
  "PostToolUse": [{
    "matcher": "Bash",
    "hooks": [{
      "type": "prompt",
      "prompt": "If the Bash tool just ran one of our scripts..."
    }]
  }]
}
```

This fires an LLM evaluation on **every** Bash call — `git status`, `npm install`, `ls`, everything. In a session with 40 Bash calls, that's 40 unnecessary API calls at ~1,000 tokens each = **40,000 wasted tokens**.

### Fix: Deterministic Command Hooks with File-Path Matching

```json
{
  "PostToolUse": [{
    "matcher": "Bash",
    "hooks": [{
      "type": "command",
      "command": "INPUT=$(cat); TOOL_INPUT=$(echo \"$INPUT\" | jq -r '.tool_input.command // empty'); case \"$TOOL_INPUT\" in *scaffold-project*|*serve-viewer*|*remotion\\ render*) echo \"Lucid script detected: $TOOL_INPUT\";; esac"
    }]
  }]
}
```

This does exact string matching on the command — **zero LLM cost**. Only when a match is found does the output go into Claude's context.

### The `if` Field (Claude Code v2.1.85+)

The `if` field filters by tool name AND arguments simultaneously, preventing unnecessary hook process spawns entirely:

```json
{
  "PreToolUse": [{
    "matcher": "Bash",
    "hooks": [{
      "type": "command",
      "if": "Bash(git *)",
      "command": ".claude/hooks/check-git-policy.sh"
    }]
  }]
}
```

Without `if`, the hook process spawns on every Bash call. With `if: "Bash(git *)"`, it only spawns when the command starts with `git`.

### Hook Efficiency Patterns for Multi-Agent Orchestrators

| Event | Type to Use | Pattern |
|---|---|---|
| `SubagentStart` / `SubagentStop` | `command` | Log subagent activity to a file; enforce spawn limits via exit codes |
| `TaskCreated` / `TaskCompleted` | `command` | Maintain a lightweight task log file outside the context window |
| `PreCompact` | `command` | Write a "compaction snapshot" to disk before history is summarized |
| `PostCompact` | `command` | Reload minimum necessary orchestration state from disk |
| `PostToolUse` (Bash) | `command` | Match specific script names deterministically, not via LLM |
| `PostToolUse` (Write\|Edit) | `command` | Match specific file paths (e.g., `*lucid-project.json*`), not via LLM |
| `Stop` | Avoid `prompt` type | `Stop` fires on every response, not just task completion — a prompt-type Stop hook evaluating "are all tasks done?" fires after every message |

### Anti-Pattern: Promiscuous Stop Hooks

`Stop` hooks fire whenever Claude finishes responding — not just at task completion. Guard against accidental re-entry:

```bash
INPUT=$(cat)
if [ "$(echo "$INPUT" | jq -r '.stop_hook_active')" = "true" ]; then
  exit 0  # Already active, don't re-trigger
fi
```

---

## 5. Agent Design: Bounded Execution

### The Problem with High maxTurns

An opus agent with `maxTurns: 30` can consume 200K+ tokens in a single dispatch. It will explore, reconsider, re-read files, and deliberate — because it has the budget to do so.

Autoresearch's insight: **hard constraints force prioritization.** An agent with a tight turn budget makes faster decisions, produces less verbose output, and finishes with a clearer result.

### Recommended maxTurns by Model

| Model | Role | Recommended maxTurns | Rationale |
|---|---|---|---|
| haiku | Fast lookups, scaffolding | 5–8 | Should finish in 2-3 turns; 5-8 is a safety net |
| sonnet | Code generation, iteration | 12–18 | Enough for a full scene build with 2-3 iteration cycles |
| opus | Creative reasoning, analysis | 12–15 | Enough for deep thinking; 15 prevents runaway exploration |

### Scope Constraints Per Agent

Each agent should have explicit boundaries:

```markdown
## Scope Constraints
- You may only modify files in `src/scenes/scene-XX-*/`
- You must read `lucid-project.json` before taking any action
- You must update `buildStatus` in the JSON when done
- Do NOT read or modify files outside your assigned scope
```

This eliminates entire categories of deliberation (autoresearch pattern 4).

### Effort Calibration

The `effort` frontmatter field controls how deeply the agent reasons:

| Effort | When to Use |
|---|---|
| `low` | Lookups, scaffolding, file listing — answers should be immediate |
| `medium` | Code generation, following established patterns — balanced |
| `high` | Creative reasoning, architectural decisions, cross-cutting analysis |

Don't use `effort: high` on a haiku agent — it wastes the reasoning budget on a model that can't use it. Don't use `effort: low` on an opus agent doing creative work — you're paying for opus and not using its strength.

### disallowedTools as Context Reduction

Every tool available to an agent adds to its decision space. Restrict tools to what the agent actually needs:

```markdown
---
disallowedTools: Write, Edit, NotebookEdit, Agent
---
```

A read-only agent (like an asset scout) that can't write files will never waste turns deliberating about whether to create or modify something.

---

## 6. State Externalization: Disk Over Conversation

### The Principle

From autoresearch: "State lives on disk, not in the conversation." From Anthropic: "Find the smallest set of high-signal tokens that maximize the likelihood of the desired outcome at each inference step."

The conversation window should be **stateless between actions**. Everything the agent needs to know should be reconstructible from files on disk.

### The Pattern

1. **Before any action:** Agent reads the structured state file (`project.json`, `results.tsv`, `status.md`)
2. **During the action:** Agent works in its context window normally
3. **After the action:** Agent writes results back to the state file on disk
4. **The conversation doesn't need to remember** what happened — the file remembers

### What to Externalize

| State | Where to Store | Why |
|---|---|---|
| Project status (which scenes are built) | `lucid-project.json` buildStatus field | Survives compaction, readable by any agent |
| Visual philosophy decisions | `lucid-project.json` visualPhilosophy | One-time creative decision, shouldn't re-derive |
| Build progress | `lucid-project.json` stats | Computed from scene data, not conversation history |
| Agent dispatch history | `.lucid/dispatch-log.jsonl` | Append-only log, never needs to be in context |
| Error history | `.lucid/errors.log` | Read only when debugging, not loaded by default |

### The Re-Read Discipline

Every agent instruction should include:

```markdown
## First Action (Every Time)
Read `lucid-project.json` and verify the current project state before taking any action.
Do NOT trust your memory of the project state from earlier in this conversation.
The JSON file is the source of truth.
```

This prevents context rot in long sessions where the agent's memory of the project state degrades after 10+ turns of code generation.

### Large Payload Externalization

Any tool response expected to exceed 5,000 tokens should be written to a temp file and summarized before entering the context window:

**The pattern (from Pierre-Emmanuel Féga's MCP analyzer):**
1. Invoke tool → receive large response
2. Immediately write output to a timestamped `/tmp/` file
3. Use a specialized skill to parse and filter
4. Return a compact summary (~300-500 tokens) to the conversation
5. Clean up temp file at session end

**Measured savings:** 95–97% token reduction on large tool responses.

---

## 6.5. Observational Memory: Cache-Aware Compression

### The Problem with Retrieve-and-Inject

Standard memory systems follow a per-turn retrieval loop: embed query → vector DB → rerank → inject into context. This has three compounding costs:

1. **Cache invalidation**: Every injected retrieval result changes the prompt prefix, invalidating the KV cache. The model re-processes the entire context from scratch on every turn.
2. **Latency**: The embed → search → rerank pipeline adds 200-500ms per turn before the model even starts generating.
3. **Fragmentation**: Retrieved snippets are contextless fragments. The model sees isolated facts, not a continuous narrative — the same "PreNorm dilution" problem identified in the Attention Residuals paper (Section 2.5), but at the orchestration layer.

Claude Code's built-in compaction (Section 7) is the most visible symptom: the agent pauses, the context is summarized, and nuance is lost. But compaction is a recovery mechanism, not a solution. The real question is: **can you avoid needing compaction in the first place?**

### Observational Memory: The Pattern

Mastra's observational memory (demonstrated at their 2026 talk, scoring #1 on LongMemEval) replaces retrieval with two background compression agents:

| Agent | Role | Trigger | Output |
|---|---|---|---|
| **Observer** | Incremental compression | After each message | Short observation (~50-100 tokens) appended to observation block |
| **Reflector** | Deep compression | Periodically (e.g., every 10 messages) | Rewrites the full observation block into a tighter summary |

**The key insight:** Observations stack linearly at the **top** of the context window. They form a growing-but-stable prefix. New user/assistant messages append below. Because the observation block only changes when the Reflector runs (infrequently), it stays in the KV cache across turns — preserving **8-10x cache cost savings**.

```
┌─────────────────────────────────────────┐
│  OBSERVATION BLOCK (cached prefix)       │  ← Stable, grows slowly
│  - Observation 1: User is building...    │
│  - Observation 2: Decided to use...      │
│  - Observation 3: Error in auth was...   │
│  [Reflector periodically compresses]     │
├─────────────────────────────────────────┤
│  RECENT MESSAGES (uncached, small)       │  ← Only these tokens are "new"
│  - User: Can you fix the test?           │
│  - Assistant: Reading test file...       │
└─────────────────────────────────────────┘
```

### Why It Beats Retrieval

| Dimension | Retrieve-and-Inject | Observational Memory |
|---|---|---|
| Cache compatibility | Breaks cache every turn | Preserves cache (8-10x savings) |
| Context continuity | Fragmented snippets | Continuous narrative |
| Latency per turn | +200-500ms (embed/search/rerank) | Zero (no retrieval step) |
| Main thread blocking | Yes (waits for retrieval) | No (Observer/Reflector run in background) |
| LongMemEval score | ~60% (raw context baseline) | 94.9% (GPT-4o mini), 84.2% (GPT-4o) — exceeds oracle baseline of 82.4% |

### Connection to Autoresearch (Section 2)

Observational memory is not a departure from the autoresearch patterns — it is what happens when you apply several of them simultaneously to the context management problem:

| Autoresearch Pattern | Observational Memory Implementation |
|---|---|
| **Pattern 2: State on Disk** — `results.tsv` is append-only; agent re-reads, never retains in context | `observations.log` is append-only; agent re-reads compressed observations, not raw conversation |
| **Pattern 8: Re-Read from Disk at Cycle Start** — files are truth, not conversational memory | On compaction, observations are re-injected from disk — the log *is* the reconstructed memory |
| **Pattern 4: Hard Constraints** — every constraint removes a category of deliberation | Observer constrained to short observations (~50-100 tokens). Reflector constrained to periodic runs. Neither blocks the main thread. The constraints eliminate deliberation about *when* or *how much* to compress |
| **Pattern 1: Bounded Scope** — 630 lines means the agent can always read the full state | Continuous compression keeps the observation block bounded — the agent always has a complete (compressed) view of session history, no matter how long the session runs |
| **Pattern 10: Emergent Delegation** — cheap H100 screening → expensive H200 confirmation | Observer (cheap/frequent, haiku-class) → Reflector (expensive/periodic, deeper compression). The same two-tier cost hierarchy, applied to compression rather than evaluation |
| **Pattern 6: Git as Rollback** — `git reset --hard HEAD~1` discards failed experiments | Observations are append-only and can be truncated. A failed approach is compressed into "Attempted X, failed because Y" — one line instead of 50 turns of debug noise |

The critical insight: autoresearch solves context management by keeping the **codebase** small enough to re-read entirely. Observational memory solves context management by keeping the **conversation history** small enough to re-read entirely. Same principle, different target. Autoresearch bounds the input; observational memory compresses the accumulation.

### Connection to Attention Residuals (Section 2.5)

Observational memory is the practical implementation of the Attention Residuals insight at the agent orchestration layer:

| Attention Residuals (Model Architecture) | Observational Memory (Agent Orchestration) |
|---|---|
| Additive residual (accumulate all layer outputs) | Raw conversation history (accumulate all messages) |
| Attention residual (selectively query prior layers) | Observer/Reflector (selectively compress prior messages) |
| Block boundaries (compressed summaries between server racks) | Observation block (compressed summary between agent turns) |
| 1.25x compute reduction | 8-10x cache cost savings |

### The Three Pillars Together

The research now forms a coherent arc:

1. **Autoresearch (Section 2)** provides the **design patterns** — state on disk, re-read discipline, bounded scope, hard constraints, two-tier delegation. These are empirically validated by 53K+ stars and Karpathy's overnight autonomous runs.

2. **Attention Residuals (Section 2.5)** provides the **theoretical foundation** — selective retrieval outperforms cumulative accumulation, at the model architecture level. The math explains *why* progressive disclosure and compression work: you're mimicking what the best-performing attention mechanisms do internally.

3. **Observational Memory (this section)** provides the **practical implementation** that validates both — applying autoresearch's patterns and Attention Residuals' theory to the specific problem of long-running agent context. The LongMemEval results (94.9%, beating the oracle baseline) are empirical proof that the theory holds at the orchestration layer, not just the architecture layer.

For your harness, this means the three approaches are not competing alternatives — they are layers of the same strategy:
- Use autoresearch patterns to **design** your agents (bounded scope, disk state, hard constraints)
- Use progressive disclosure to **load** context selectively (the Attention Residuals principle)
- Use observational memory to **compress** what accumulates over time (Observer/Reflector or deterministic hooks)

### Application to Plugins

The observational memory pattern can be approximated at the plugin level using deterministic command hooks — no LLM cost. A `PostToolUse` hook appends one-line observations to a log file on disk; a `PreCompact` hook injects that log into context before compaction summarizes history. Even without LLM-powered compression, this captures the core benefit: **structured, append-only context that survives compaction without retrieval overhead.**

For a ready-to-use cross-platform hook configuration and escalation path to LLM-powered observation, see [component-patterns.md § Observational Context Pattern](./component-patterns.md).

---

## 7. Compaction Survival: Designing for Memory Loss

### What Compaction Does

When Claude Code's conversation approaches context limits, it automatically compresses prior messages. This is not optional — it will happen during any non-trivial session. The compression summarizes conversation history while attempting to preserve key information.

### What Gets Lost

- Specific file paths and line numbers from earlier discussion
- Nuanced reasoning about architectural decisions
- Agent dispatch history and which stages are complete
- Error messages and their resolutions
- The visual philosophy's emotional justification (keeps the values, loses the "why")

### The PreCompact Snapshot Pattern

Write a "compaction snapshot" to disk before history is summarized:

```json
{
  "hooks": {
    "PreCompact": [{
      "hooks": [{
        "type": "command",
        "command": "cat lucid-project.json | jq '{status: .project.status, scenes_built: [.scenes[] | select(.buildStatus==\"built\") | .id], scenes_pending: [.scenes[] | select(.buildStatus!=\"built\") | .id], current_stage: .project.status}' > .lucid/compaction-snapshot.json && echo 'Snapshot saved to .lucid/compaction-snapshot.json'"
      }]
    }]
  }
}
```

### The PostCompact Re-Injection Pattern

Re-inject critical orchestration state after compaction:

```json
{
  "hooks": {
    "PostCompact": [{
      "hooks": [{
        "type": "command",
        "command": "if [ -f .lucid/compaction-snapshot.json ]; then echo '--- LUCID PIPELINE STATE (restored after compaction) ---'; cat .lucid/compaction-snapshot.json; echo '--- END STATE ---'; fi"
      }]
    }]
  }
}
```

Anything written to stdout by a hook is injected into Claude's context. This means after compaction, the agent immediately sees the pipeline state without needing to re-read the full project JSON.

### What Must Survive Compaction

Document in CLAUDE.md what must survive summarization:

```markdown
## Compaction Notes
When context is compacted, the following MUST be preserved:
- Current pipeline stage (scripted/specced/building/built/rendered)
- List of scenes and their build status
- Active agent assignments
- Any unresolved errors or blockers
```

### The SessionStart Re-Read Pattern

As a fallback, always re-read state at session start:

```json
{
  "hooks": {
    "SessionStart": [{
      "hooks": [{
        "type": "command",
        "command": "if [ -f lucid-project.json ]; then echo 'Lucid project found:'; cat lucid-project.json | jq '{name: .project.name, status: .project.status, scenes: (.scenes | length), built: [.scenes[] | select(.buildStatus==\"built\")] | length}'; fi"
      }]
    }]
  }
}
```

---

## 8. CLAUDE.md Hygiene

> **See also:** [folder-architecture-routing.md](./folder-architecture-routing.md) reframes the hygiene rules below as a positive pattern - `CLAUDE.md` as a **routing table** (Layer 1) that names per-task file loads, with workspace context files (Layer 2) and per-room skill wiring (Layer 3). The hygiene rules tell you what to *exclude*; the routing-table pattern tells you what to *include*. They're the same principle from opposite sides. Framing adapted from Clief Sundberg's Quantum Quill Lyceum, Section 3 - local archive lessons cited in the folder-architecture reference.


### The Rule

Claude Code's official guidance: **bloated CLAUDE.md files cause Claude to ignore your actual instructions.**

### Token Budget

Keep CLAUDE.md under **5,000 tokens total**.

The test for each line: "Would removing this cause Claude to make mistakes?" If the answer is no, delete it.

### What to Include vs. Exclude

| Include | Exclude |
|---|---|
| Bash commands Claude can't guess | Anything Claude can infer from code |
| Code style rules that differ from defaults | Standard conventions Claude already knows |
| Testing instructions and test runners | Detailed API docs (link to files instead) |
| Repo etiquette (branch naming, PR conventions) | File-by-file codebase descriptions |
| Architectural decisions specific to your project | Long explanations or tutorials |
| Compaction survival instructions | Ephemeral session state |

### Directory-Scoped CLAUDE.md

Child directory CLAUDE.md files load **on demand** when Claude works in those directories. Use this to layer context:

```
project/
├── CLAUDE.md                    # 500 tokens — project-wide rules only
├── src/
│   └── scenes/
│       └── CLAUDE.md            # 300 tokens — scene-specific conventions
└── scripts/
    └── CLAUDE.md                # 200 tokens — script-specific instructions
```

This is progressive disclosure applied to project instructions.

### Anti-Pattern: The Knowledge Dump

```markdown
# CLAUDE.md — 15,000 tokens
## Project Overview (2,000 tokens)
## Architecture Decisions (3,000 tokens)
## API Reference (4,000 tokens)
## Code Conventions (2,000 tokens)
## Troubleshooting Guide (2,000 tokens)
## Team Contacts (500 tokens)
## Historical Context (1,500 tokens)
```

This loads 15,000 tokens into every single interaction. Move everything except the 500-token essentials into `docs/` files referenced by path.

---

## 9. MCP Server Token Patterns

### The Problem

MCP servers expose tool definitions that load into the model's context. A server with 50 tools, each with a 200-token schema, adds 10,000 tokens to every conversation — whether or not those tools are used.

### The Two-Stage Pattern (96% reduction)

**Stage 1:** Expose a single `list_tools` meta-tool that returns tool names and one-line descriptions.
**Stage 2:** When the model identifies a relevant tool, it calls `get_tool_schema(tool_name)` to load the full schema.

**Before:** 50 tools × 200 tokens = 10,000 tokens upfront
**After:** 1 meta-tool (100 tokens) + 1 schema load per used tool (200 tokens) = ~500 tokens for a typical 2-tool interaction

### The Skills Pattern (85–100x reduction)

Three-level hierarchy:
1. **Metadata** (loaded at startup): name + description (~80 tokens each)
2. **Instructions** (loaded on activation): full SKILL.md body (~2,000 tokens)
3. **Resources** (loaded on execution): reference files, scripts (~500-2,000 tokens each)

### Token Budget Per MCP Tool

| Component | Budget |
|---|---|
| Tool name | 5 tokens |
| Tool description | 30-50 tokens |
| Parameter schema | 50-150 tokens |
| Total per tool | 85-205 tokens |

Keep descriptions actionable and trigger-precise. The description is the model's activation signal — vague descriptions cause false activations (loading schemas unnecessarily).

---

## 10. Plugin Audit Checklist

Use this checklist when auditing any Claude Code plugin for token efficiency.

### SKILL.md Audit

- [ ] **Is the SKILL.md under 800 tokens at the activation layer?** If over 800, split into a lean router + rule files.
- [ ] **Does the `description:` field contain precise trigger phrases?** Vague descriptions cause false activations.
- [ ] **Are detailed instructions in separate rule files loaded on demand?** Use `[./rules/topic.md](./rules/topic.md)` references.
- [ ] **Are code examples in rule files, not the main SKILL.md?** Examples are high-token, low-frequency — load only when needed.

### Hook Audit

- [ ] **Are all hooks `command` type by default?** Only use `prompt`/`agent` where semantic judgment is genuinely required.
- [ ] **Do PostToolUse hooks have narrow matchers?** `matcher: "Bash"` is too broad; add deterministic filtering in the command.
- [ ] **Do hooks use the `if` field where available?** Prevents unnecessary process spawning.
- [ ] **Is there a PreCompact hook saving state?** Essential for sessions over 30 minutes.
- [ ] **Is there a PostCompact hook restoring state?** Re-inject minimum viable orchestration context.
- [ ] **Are there any `prompt`-type Stop hooks?** These fire on every response — extremely expensive.
- [ ] **Does every prompt hook genuinely require LLM judgment?** If the decision can be made with string matching, use `command` type.

### Agent Audit

- [ ] **Are maxTurns set as genuine budgets, not safety nets?** haiku: 5-8, sonnet: 12-18, opus: 12-15.
- [ ] **Does each agent have explicit scope constraints?** "You may only modify files in X directory."
- [ ] **Is effort level matched to model and task?** Don't put `effort: high` on haiku or `effort: low` on opus for creative work.
- [ ] **Are disallowedTools set to restrict unnecessary capabilities?** Read-only agents shouldn't have Write/Edit.
- [ ] **Does each agent re-read state from disk before acting?** "Read project.json before taking any action."

### State Management Audit

- [ ] **Is there a single source of truth file (JSON/TSV)?** All agents read from and write to this file.
- [ ] **Do agents re-read state at the start of each action?** Don't trust conversational memory.
- [ ] **Are large payloads externalized to files?** Any response over 5,000 tokens should be written to disk and summarized.
- [ ] **Is agent dispatch history logged to a file, not kept in conversation?** Use append-only logs.

### CLAUDE.md Audit

- [ ] **Is the CLAUDE.md under 5,000 tokens?** If over, move non-essential content to `docs/` files.
- [ ] **Does every line pass the "would removing this cause mistakes?" test?** Delete anything Claude can infer from code.
- [ ] **Are child directory CLAUDE.md files used for scoped context?** Layer context by directory.
- [ ] **Are compaction survival instructions included?** Document what must survive summarization.

### Overall Architecture Audit

- [ ] **Are subagents used for context isolation?** Exploration noise should never enter the orchestrator's context.
- [ ] **Does the plugin survive compaction?** Test by running `/compact` mid-session and verifying the plugin still works.
- [ ] **Is there a clear cost hierarchy?** haiku for fast tasks → sonnet for building → opus for reasoning.
- [ ] **Can each agent reconstruct full context from disk alone?** If the conversation is wiped, can the agent pick up where it left off by reading files?

---

## 11. Sources & Further Reading

### Primary Research

- **[Context Rot — Chroma Research (2025)](https://www.trychroma.com/research/context-rot)** — The foundational empirical study. Tests 18 models, 8 lengths, 11 positions. Primary citation for when and how degradation occurs.
- **[Effective Context Engineering for AI Agents — Anthropic Engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)** — Anthropic's internal playbook. System prompt calibration, tool design, compaction strategy, subagent patterns.
- **[GitHub — karpathy/autoresearch](https://github.com/karpathy/autoresearch)** — 630-line autonomous experiment framework. 53K+ stars. The reference design for bounded, efficient autonomous agent loops.
- **[Attention Residuals — Moonshot AI / Kimi (2026)](https://arxiv.org/abs/2603.15031)** — Architectural proof that selective retrieval over depth outperforms cumulative accumulation. 1.25x compute reduction, +7.5 GPQA Diamond. Block variant enables pipeline-parallel deployment. Theoretical foundation for progressive disclosure in context engineering. [GitHub](https://github.com/MoonshotAI/Attention-Residuals)

- **[How We Used Observational Memory To Build A Coding Agent — Mastra (2026)](https://youtu.be/VWsJjyk1lBM)** — Introduces observational memory: two background sub-agents (Observer + Reflector) that replace retrieve-and-inject with linear, cache-compatible compression. #1 on LongMemEval (94.9% GPT-4o mini, 84.2% GPT-4o, exceeding 82.4% oracle baseline). Also formalizes the "agent harness" concept — the full stack of primitives (modes, workspaces, steering, tool policies) beyond model + tools. Live demo shows 12x compression with zero main-thread blocking.

### Benchmarks and Measurements

- **[Progressive Disclosure MCP — matthewkruczek.ai](https://matthewkruczek.ai/blog/progressive-disclosure-mcp-servers.html)** — Most rigorous benchmark of MCP token patterns. Five implementation patterns with specific reduction numbers (85–100x).
- **[Agent Skills: Progressive Disclosure — SwirlAI Newsletter](https://www.newsletter.swirlai.com/p/agent-skills-progressive-disclosure)** — Most precise published token counts per tier (55–235 at discovery; 275–8,000 at activation).
- **[Skills: The Art of Progressive Disclosure — Marcel Castro](https://marcelcastrobr.github.io/posts/2026-01-29-Skills-Context-Engineering.html)** — Technical walkthrough of three-tier architecture with token counts from Anthropic's official skill library.

### Community Patterns

- **[The Code Agent Orchestra — Addy Osmani](https://addyosmani.com/blog/code-agent-orchestra/)** — Multi-agent architectural patterns. "3–5 teammates is the sweet spot. Token costs scale linearly with team size."
- **[Building Internal Agents: Progressive Disclosure and Large Files — Will Larson](https://lethain.com/agents-large-files/)** — Three-tool file management pattern (load, peek, extract).
- **[The Context Window Problem — Factory.ai](https://factory.ai/news/context-window-problem)** — OS-memory analogy for context management with hierarchical memory design.
- **[Optimizing Token Efficiency in Claude Code — Pierre-Emmanuel Féga](https://medium.com/@pierreyohann16/optimizing-token-efficiency-in-claude-code-workflows-managing-large-model-context-protocol-f41eafdab423)** — 95–97% token reduction via MCP response externalization.
- **[Practical Workflow for Reducing Token Usage — dholdaway](https://gist.github.com/dholdaway/8009f089d3407e14f3d753f2a70eb63e)** — Ready-to-use compaction workflow and modular context patterns.

### Autoresearch Ecosystem

- **[DeepWiki — autoresearch analysis](https://deepwiki.com/karpathy/autoresearch)** — Structured architectural breakdown.
- **[awesome-autoresearch](https://github.com/alvinreal/awesome-autoresearch)** — Curated ecosystem of forks and derivatives.
- **[Scaling autoresearch — SkyPilot Blog](https://blog.skypilot.co/scaling-autoresearch/)** — What happens when autoresearch gets a GPU cluster (9x speedup, emergent two-tier delegation).
- **[autoresearch-101 Builder's Playbook — Sid Saladi](https://sidsaladi.substack.com/p/autoresearch-101-builders-playbook)** — Generalizing the pattern to non-ML use cases.
- **[Fortune — The Karpathy Loop](https://fortune.com/2026/03/17/andrej-karpathy-loop-autonomous-ai-agents-future/)** — Broader implications framing.
- **[Simon Willison — Shopify Liquid PR](https://simonwillison.net/2026/Mar/13/liquid/)** — Concrete evidence: 53% faster parse+render, 61% fewer allocations from 93 automated commits.

### Tools and References

- **[claude-token-efficient — GitHub](https://github.com/drona23/claude-token-efficient)** — Drop-in CLAUDE.md that enforces terse responses and reduces output verbosity.
- **[claude-code-hooks-mastery — GitHub](https://github.com/disler/claude-code-hooks-mastery)** — Reference implementations for production hook patterns.
- **[Claude Code Best Practices — Official Docs](https://code.claude.com/docs/en/best-practices)** — Subagent context isolation, compaction strategies.
- **[Claude Code Hooks Guide — Official Docs](https://code.claude.com/docs/en/hooks-guide)** — Hook types, events, performance considerations.
- **[State of Context Engineering in 2026 — SwirlAI Newsletter](https://www.newsletter.swirlai.com/p/state-of-context-engineering-in-2026)** — Five converging patterns: progressive disclosure, compression, routing, agentic RAG, tool management.

---

*Last updated: 2026-04-03. Research compiled from web search, primary source reading, and cross-referencing across autoresearch ecosystem, Anthropic engineering, Kimi/Moonshot AI attention residuals paper, and independent practitioner findings.*
