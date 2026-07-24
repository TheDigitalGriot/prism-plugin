---
name: prism-decompose
description: "Decompose large specifications (500k+ tokens) into user stories, bundle into epics, emit a spectrum-ready work queue. Use after a Greenfield-style spec generation, before /prism-spectrum. Triggers on 'decompose this spec', 'turn this into stories', 'epic this', 'break down this spec'."
model: opus
color: cyan
effort: xhigh
maxTurns: 15
---

# Prism Decompose

Turn a large specification into a structured, spectrum-ready work queue. One behavioral requirement per story. Zero requirements dropped.

## When To Use

| Scenario | Use |
|----------|-----|
| Large spec (500k+ tokens) → stories.json for autonomous execution | **prism-decompose** ← here |
| Approved plan (normal size) → stories.json | [`decompose_plan` command](../../commands/decompose_plan.md) |
| Single story → implementation | [`prism-spectrum`](../prism-spectrum/SKILL.md) or [`prism-implement`](../prism-implement/SKILL.md) |

The key distinction: `decompose_plan` takes a Prism plan document (the output of `/prism-plan`) and parses its tasks into stories. `prism-decompose` takes a large, potentially unstructured specification — a greenfield design doc, a Figma export, a product requirements document — and extracts behavioral requirements from it at scale.

## Chunking Discipline

This skill applies the chunking discipline from [Iterative Development](https://github.com/prime-radiant-inc/iterative-development):

- **One behavioral requirement per story.** A behavioral requirement describes one observable behavior of the system (e.g., "User can upload a profile photo and see it reflected immediately"). Implementation details are inside the story's `steps[]`; the requirement is what's observable from outside.
- **No requirement is dropped during chunking.** Every behavioral requirement maps to exactly one story — partial coverage is a failure mode, not an acceptable tradeoff.
- **Epics are execution-context containers.** An epic is a set of stories that fit within a single spectrum session (≈200K context: stories.json + progress.md + CLAUDE.md + one story at a time). When requirements exceed this, split into multiple epics with explicit dependency ordering.

## Process

### Step 1: Read the Full Spec

Read the specification in its entirety before decomposing. Do not skim.

- If the spec is a file: read it completely
- If it's a URL: fetch and read it
- If it's pasted text: read every section

Build a **behavioral requirement inventory** — an enumerated list of every distinct observable behavior the spec describes. Number them. This list is your coverage contract.

### Step 2: Parse Into User Stories

For each behavioral requirement in the inventory:

1. Write one story with `id: "STORY-NNN"` (zero-padded, sequential)
2. `title`: short verb phrase describing the behavior
3. `description`: the full behavioral requirement — what a user does and what they observe
4. `steps[]`: implementation sub-steps (ordered, fine-grained, technical)
5. `context.why`: why this requirement exists (product intent)
6. `context.risks[]`: edge cases or failure modes to watch for
7. `context.patterns[]`: implementation patterns to follow (cite specific file:line references if known)
8. `blockedBy`: story ID of a dependency, or `null`

### Step 3: Bundle Into Epics

Group stories into epics such that:
- Each epic's full context (stories + progress + code) fits in ≈200K tokens
- Stories within an epic are topologically ordered (dependencies before dependents)
- Epics are ordered by dependency (if epic B depends on epic A's output, A runs first)

Assign a slug to each epic: `epic-<topic>` (e.g., `epic-auth`, `epic-data-layer`).

### Step 4: Graph-Informed Risk Ordering (if codebase-memory-mcp available)

If the codebase is already indexed:

```
For each story with known file targets:
  trace_call_path(function_name, direction="inbound")
  → Count callers; higher blast radius = implement earlier within the epic
```

Risk-order stories within each epic: high blast radius first. Surface the ordering rationale in `context.risks[]`.

If graph is not available, order by: (1) foundation/infrastructure stories, (2) feature stories, (3) polish/UX stories.

### Step 5: Emit stories.json + Coverage Report

**For each epic**, write two files:

1. **`stories.json`** at `.prism/stories/<epic-slug>/stories.json` — conforming to spectrum's schema (see below)
2. **`coverage.md`** at `.prism/stories/<epic-slug>/coverage.md` — the coverage contract (see below)

Then present the user with a summary table:

```markdown
| Epic | Stories | Blocked | Key risks |
|------|---------|---------|-----------|
| epic-auth | 12 stories | 3 (wait for data-layer) | Token refresh race condition |
| epic-data-layer | 8 stories | 0 | Migration rollback path |
```

## stories.json Schema

Conforms to the Prism `stories.json` schema (see `CLAUDE.md` §stories.json Schema):

```json
{
  "epic": {
    "name": "Epic Name",
    "source": "path/to/spec.md",
    "qualityGates": ["npm test", "npm run typecheck"],
    "decisions": ["Architectural decisions that all stories must respect"],
    "references": ["path/to/relevant/docs"],
    "outOfScope": ["Explicit exclusions"],
    "risks": ["Epic-level risks"]
  },
  "stories": [
    {
      "id": "STORY-001",
      "title": "Short verb phrase",
      "description": "Full behavioral requirement",
      "priority": 1,
      "status": "pending",
      "blockedBy": null,
      "files": [
        {"path": "src/auth/login.ts", "action": "modify"}
      ],
      "steps": [
        {"description": "Step 1", "done": false}
      ],
      "context": {
        "why": "Why this requirement exists",
        "risks": ["Edge cases to watch for"],
        "edgeCases": ["Specific edge cases to handle explicitly"],
        "patterns": ["Implementation patterns to follow"],
        "graphTargets": ["qualified::name#Function"]
      }
    }
  ]
}
```

## coverage.md Schema

```markdown
# Coverage Report: <epic-slug>

**Source spec**: path/to/spec.md
**Generated**: YYYY-MM-DD
**Requirements found**: N
**Stories emitted**: N
**Coverage**: 100% (N/N requirements mapped)

## Requirement → Story Mapping

| # | Requirement (from spec §section) | Story ID | Notes |
|---|----------------------------------|----------|-------|
| 1 | User can log in with email/password | STORY-001 | |
| 2 | Session persists across browser reload | STORY-002 | |
...

## Intentional Exclusions

If any requirements from the spec are intentionally excluded (e.g., out of scope for this release),
list them here with the reason. An empty section means 100% of spec requirements are covered.
```

**Coverage invariant**: `Requirements found` MUST equal `Stories emitted` (plus intentional exclusions). Any gap is a decomposition failure.

## Iron Laws

```
ONE BEHAVIORAL REQUIREMENT PER STORY. NO BUNDLING.
EVERY REQUIREMENT MAPS TO EXACTLY ONE STORY. NO DROPS.
COVERAGE REPORT IS MANDATORY. NO REPORT = DECOMPOSITION IS NOT DONE.
EPICS ARE SIZED FOR SPECTRUM'S CONTEXT WINDOW. 200K TOKENS MAX PER EPIC.
```

## Integration

- **Precedes:** `/prism-spectrum` — run spectrum against each epic's `stories.json` in dependency order
- **Use instead of:** `decompose_plan` when the input is a large/unstructured spec rather than a Prism plan
- **Graph-aware:** if codebase-memory-mcp is available, blast radius informs story ordering within epics

> See also: [prism-spectrum](../prism-spectrum/SKILL.md) — the execution engine that processes the output of this skill.
> Reference: [Iterative Development](https://github.com/prime-radiant-inc/iterative-development) — chunking discipline origin.
