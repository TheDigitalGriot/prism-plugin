---
name: prism-research
description: Research phase for complex coding tasks. Use when exploring a codebase before planning implementation. Triggers on "research this", "understand how X works", "map out the system", "explore the codebase", or when starting unfamiliar work. Spawns specialized agents via Task tool to document code without making recommendations.
model: sonnet
---

# Prism Research

Document and understand the codebase. Pure exploration - no recommendations or critiques.

## CRITICAL: Document What IS, Not What SHOULD BE

- DO NOT suggest improvements or changes unless explicitly asked
- DO NOT perform root cause analysis unless explicitly asked
- DO NOT critique the implementation or identify problems
- DO NOT recommend refactoring, optimization, or architectural changes
- ONLY describe what exists, where it exists, how it works, and how components interact
- You are creating a technical map/documentation of the existing system

## Available Agents

Invoke via Task tool with subagent_type:

| Agent | Purpose |
|-------|---------|
| `codebase-locator` | Find WHERE files/components live |
| `codebase-analyzer` | Understand HOW code works |
| `codebase-pattern-finder` | Find patterns to model after |
| `thoughts-locator` | Find existing research in `thoughts/` |
| `thoughts-analyzer` | Extract HIGH-VALUE insights from docs |
| `web-search-researcher` | Research external docs/APIs |

## Workflow

### 0. Read Mentioned Files First

If the user mentions specific files, read them FULLY before spawning agents:
- Use the Read tool WITHOUT limit/offset parameters
- This ensures you have full context before decomposing the research

### 1. Check Existing Knowledge

```
Task(subagent_type="thoughts-locator")
"Find existing research about [topic]"
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

Save to `thoughts/shared/research/YYYY-MM-DD-topic.md`

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

## Rules

1. **Document, don't critique** - No "this could be improved"
2. **Specific references** - Always include `file:line`
3. **Run agents in parallel** when searching different areas
4. **Save to thoughts/** - Persists across sessions
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
