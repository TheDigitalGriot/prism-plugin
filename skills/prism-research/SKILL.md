---
name: prism-research
description: Research phase for complex coding tasks. Use when exploring a codebase before planning implementation. Triggers on "research this", "understand how X works", "map out the system", "explore the codebase", or when starting unfamiliar work. Spawns specialized agents via Task tool to document code without making recommendations.
model: sonnet
---

# Prism Research

Document and understand the codebase. Pure exploration - no recommendations or critiques.

> **Stuck Protocol (device/cloud recovery — non-negotiable):** if any device/cloud tool returns empty/`[]`/"not connected"/"no DOM"/403 or fails first-call, do NOT report it blocked. Retry 2-3x -> switch surface (built-in pane <-> Claude-in-Chrome; native Windows PowerShell when the sandbox has no route; the Gmail *browser* when the *connector* is the wrong account) -> replay the logs (session_info -> last successful run -> copy its exact tool sequence) -> then ask Gavin ONE direct question. Gavin's word about his own machine is GROUND TRUTH. "Blocked" without those steps is a DEFINED ERROR; a forced skip = INCOMPLETE run. Full ladder: this plugin's CLAUDE.md "Stuck Protocol" section.
## Iron Law

```
NO SUGGESTIONS, CRITIQUES, OR IMPROVEMENTS — DESCRIBE WHAT EXISTS
```

"Violating the letter of this rule while adhering to the spirit" is violating the spirit.

<HARD-GATE>
Do NOT suggest improvements, identify problems, recommend refactoring, critique architecture, or propose changes unless the user EXPLICITLY asks. You are creating a technical map — a documentary, not a review.
</HARD-GATE>

| Rationalization | Reality |
|----------------|---------|
| "I should mention this could be improved" | You are a documentarian, not a critic. Describe what IS. |
| "This pattern has a known issue" | Document the pattern. Do not editorialize. |
| "I'll just note one small suggestion" | One suggestion becomes five. Zero suggestions. |
| "The user would want to know about this problem" | If they want critique, they will ask for critique. |

## Available Agents

Invoke via Task tool with subagent_type:

| Agent | Purpose |
|-------|---------|
| `graph-navigator` | Structural analysis via knowledge graph |
| `codebase-locator` | Find WHERE files/components live |
| `codebase-analyzer` | Understand HOW code works |
| `codebase-pattern-finder` | Find patterns to model after |
| `prism-locator` | Find existing research in `.prism/` |
| `prism-analyzer` | Extract HIGH-VALUE insights from docs |
| `web-search-researcher` | Research external docs/APIs |

### Model Selection

When the research scope is narrow (single file, specific function), consider overriding agent models down to haiku for faster, cheaper results. When the scope is broad (full subsystem, cross-cutting concern), use default models. See `references/model-selection.md` in `spectrum` for the full guide.

## Workflow

> **ICM run-contract — read first.** If this run was launched with a stage contract (a `*-CONTEXT.md` in `.prism/shared/plans/`, or the path in `$PRISM_ICM_CONTRACT`), read it first and honor its Inputs / Locked Decisions / Success criteria before anything else. See `skills/spectrum-architect/references/prism-run-contract.md`.

### 0. Delegate Bulk Reading — Do NOT Read Large Files in the Main Thread

If the user mentions specific files, **dispatch an agent to map them**; do not read them
into this context. The main thread holds the *map*, never the contents.

- **Small files (< ~200 lines)** — read directly. Cheap, no delegation needed.
- **Anything larger** — dispatch `codebase-analyzer` (how it works) or `codebase-locator`
  (where things are) and require a distilled map **with file:line references, not file contents**.
- Reading a 2,000-line file into the main thread costs ~25k tokens and poisons every later
  step. The same read, delegated, returns a ~1k-token map. Measured on a real session:
  **~560k tokens read inside agents returned ~12k to the orchestrator — 45:1.**
- Exception: a file the user explicitly asks you to read verbatim, or a file you must edit.

### 1. Check Existing Knowledge

```
Task(subagent_type="prism-locator")
"Find existing research about [topic]"
```

### 1b. Structural Orientation (if codebase-memory-mcp available)

```
Task(subagent_type="graph-navigator")
"Index repository and provide structural overview: schema, key modules, function counts, relationship patterns for [topic]"
```

### 2. Locate Code

```
Task(subagent_type="codebase-locator")
"Find files related to [feature]. Look for [patterns, names]"
```

### 3. Analyze Components

```
Task(subagent_type="codebase-analyzer")
"Analyze [file]. Explain how it works, trace data flow."
```

### 4. Find Patterns

```
Task(subagent_type="codebase-pattern-finder")
"Find similar implementations to [feature]. Show examples."
```

### 5. External Research (if needed)

```
Task(subagent_type="web-search-researcher")
"Research [library/API]. Find docs and examples."
```

### 6. Save Findings

Save to `.prism/shared/research/YYYY-MM-DD-topic.md`

Use TodoWrite to track open questions.

## Output

See [references/research-template.md](references/research-template.md) for full template.

Key sections:
- Research Question
- Summary (2-3 sentences)
- Files Discovered (table with paths)
- Component Analysis (how things work)
- Patterns Found (with file:line refs)
- Open Questions (for TodoWrite)

## Research Output Contract (non-negotiable)

Two rules make research usable later instead of evaporating with the session.

### 1. Write-through — always emit the document
After presenting findings in chat, **always** write
`.prism/shared/research/YYYY-MM-DD-<topic>.md`. This is not optional and not a separate ask.
Research that lives only in a conversation dies at the next compaction. The chat is the
presentation; the file is the record.

### 2. Verdict contract — a decision, not a survey
Every research brief must name a **falsifiable question** and a **deliverable shape**, and the
answer must end in a verdict. Without this you get an encyclopedia entry; with it you get a
decision.

A brief that works:
- states the question so it *can* come back "no" — e.g. *"Is a git-lane graph sufficient, or a
  poor fit that will break down? If nothing beats it, say so plainly."*
- names the deliverable — *"a table of X vs Y, the specific conventions worth stealing, an
  honest verdict, primary-source citations."*
- demands **primary sources** — specs, canonical papers, official docs. Never a summary blog.

Report structure: findings table -> recommendation with reasoning -> concrete details worth
reusing -> honest verdict -> cited sources.


## Rules

1. **Document, don't critique** - No "this could be improved"
2. **Specific references** - Always include `file:line`
3. **Run agents in parallel** when searching different areas
4. **Save to .prism/** - Persists across sessions
5. **Read files first** - Always read mentioned files before spawning agents
6. **Wait for completion** - Wait for ALL agents before synthesizing

## Follow-up Research

If user has follow-up questions:
- Append to the same research document
- Add new section: `## Follow-up Research [timestamp]`
- Update frontmatter with `last_updated` field
- Spawn new agents as needed

## Exploration Patterns

For bash-based exploration, see [references/exploration-patterns.md](references/exploration-patterns.md).

> See also: [griot-agent-architect/references/folder-architecture-routing.md](../griot-agent-architect/references/folder-architecture-routing.md) for efficient context loading via the routing-table pattern (Layer 1/2/3).
