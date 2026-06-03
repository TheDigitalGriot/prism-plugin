---
name: prism-design
description: Design phase that turns a brainstorm decision ledger into an architectural design — adds mermaid diagrams, interface contracts, data models, and materializes a `.pen` visual layout. Triggers on "design this", "create a design", "design the architecture", or after a brainstorm ledger is approved. REQUIRES a brainstorm ledger by default — flip `require_brainstorm: false` for exploratory mode.
model: opus
effort: xhigh
require_brainstorm: true
inputs:
  required:
    - .prism/shared/brainstorms/
  optional:
    - .prism/shared/research/
    - .prism/shared/plans/
---

# Prism Design Phase

Turn an approved brainstorm decision ledger into an architectural design that the planning phase can execute against. The brainstorm has already locked the *decisions*. This phase adds the *structure* — mermaid diagrams, interface contracts, data models — and materializes a `.pen` visual layout next to a markdown sidecar.

Brainstorm decided. Design architects. Plan executes.

## Skill Graph (Corrected — 2026-04-08)

```
prism-research          (optional — codebase mapping)
       ↓
prism-brainstorm        (DECIDES — Q1..Qn locked picks + parked concerns)
       ↓ writes
.prism/shared/brainstorms/<date>-<topic>.md       ← REQUIRED INPUT
       ↓ reads
prism-design            (YOU ARE HERE — architects on top of decisions)
       ↓ writes both
.prism/shared/designs/<date>-<topic>-design.md    ← markdown sidecar (architectural prose)
.prism/shared/designs/<date>-<topic>.pen          ← pencil layout (visual reference)
       ↓ reads markdown sidecar
prism-plan              (turns design into actionable phases)
       ↓
prism-implement → prism-validate
```

**Brainstorm is upstream of Design.** This is a 2026-04-08 correction — earlier docs had brainstorm as a downstream sub-step inside design, which was the inverse of how the skill is actually used.

## When to Use

- After `/prism-brainstorm` has produced a ledger and the user is ready to architect
- When a feature has architectural decisions to make on top of the brainstorm picks
- When the user explicitly asks to "design" something

Skip this phase only when:
- The implementation approach is trivial and obvious from the ledger
- The feature is a one-line fix where architecture is overkill
- The user explicitly wants to go straight to `/prism-plan`

## `require_brainstorm` — Default vs Exploratory Mode

The frontmatter flag `require_brainstorm: true` (default) makes a brainstorm ledger a **required input**. If no ledger exists in `.prism/shared/brainstorms/`, error and direct the user to `/prism-brainstorm` first.

Flip to `require_brainstorm: false` for **exploratory mode**: design without a ledger, useful for spike-style architectural sketches before committing to a brainstorm. This is a dormant-but-tested code path. The default is REQUIRED.

```yaml
# Override per-project in .prism/shared/config.yaml or per-session in skill frontmatter
require_brainstorm: false
```

## Workflow

### 1. Load Ledger (REQUIRED in default mode)

1. Read the most recent ledger from `.prism/shared/brainstorms/` (or the user-named ledger)
2. If `require_brainstorm: true` and no ledger found:
   ```
   Error: prism-design requires a brainstorm ledger by default.
   Run /prism-brainstorm first, or set require_brainstorm: false for exploratory mode.
   ```
3. If `require_brainstorm: false` and no ledger: proceed in exploratory mode; skip §1's Locked Decisions section in the output

### 2. Load Supporting Context

1. Read research from `.prism/shared/research/` (if present)
2. Read PRD from `.prism/shared/plans/` (if present)
3. Summarize what's loaded and confirm with user before architecting

### 3. Architect

For each decision in the ledger, add the architectural layer the brainstorm did NOT cover:
- Mermaid diagrams for runtime topology, state flow, sequence interactions
- Interface contracts (function signatures, message shapes, file schemas)
- Data models (entities, relationships, validation rules)
- Module/file boundaries

Do NOT re-litigate the ledger's decisions. The picks are locked. Architecture sits on top of them.

### 4. Carry Deferred Concerns

Preserve the ledger's `parked` items verbatim into a "Deferred Concerns" appendix in both output files. They are first-class — not unanswered, deferred on purpose.

### 5. Materialize Markdown Sidecar

Save to `.prism/shared/designs/YYYY-MM-DD-<topic>-design.md` with:

```markdown
# {Topic} Design

**Date:** {date}
**Status:** Approved | Draft
**Ledger:** .prism/shared/brainstorms/YYYY-MM-DD-<topic>.md
**Pen:** .prism/shared/designs/YYYY-MM-DD-<topic>.pen

## Locked Decisions (from ledger §1)
{verbatim copy of ledger's locked decisions}

## Architecture
{mermaid diagrams + prose}

## Interface Contracts
{function signatures, message shapes, file schemas}

## Data Models
{entities + relationships}

## Deferred Concerns (from ledger §2)
{verbatim copy of ledger's parked items}

## Reference Artifacts
{links to ledger §3 reference HTML, etc.}
```

### 6. Materialize `.pen` Visual Layout

Use the pencil MCP to write `.prism/shared/designs/YYYY-MM-DD-<topic>.pen`:

1. Call `mcp__pencil__get_guidelines()` first to refresh on the canonical pen format
2. Call `mcp__pencil__open_document("new")` to create a fresh document
3. Use the ledger's reference HTML (final hi-fi screen path in §3) as **visual layout reference** — html guides the eye, md carries the meaning
4. Call `mcp__pencil__batch_design()` with the operations to lay out the architecture diagrams, screen mockups, and component boundaries
5. Save to `.prism/shared/designs/YYYY-MM-DD-<topic>.pen`

The `.pen` is the **visual reference** for downstream phases. The markdown sidecar carries the meaning that `prism-plan` reads.

### 7. Transition to Planning

After both files are written, offer:
- `/prism-plan` — reads the markdown sidecar from `.prism/shared/designs/` and produces an implementation plan

## Integration

```
prism-brainstorm → prism-design → prism-plan → prism-implement → prism-validate
                    ↑ YOU ARE HERE
```

- **Required Input:** `.prism/shared/brainstorms/<date>-<topic>.md` (default: `require_brainstorm: true`)
- **Optional Input:** `.prism/shared/research/`, `.prism/shared/plans/` (PRDs)
- **Output:** Dual artifacts in `.prism/shared/designs/`:
  - `<date>-<topic>-design.md` — architectural prose (read by `prism-plan`)
  - `<date>-<topic>.pen` — pencil layout (visual reference)
- **Next:** `/prism-plan` reads the markdown sidecar

## Rules

1. **Decisions, not implementation** — Phase produces design, not code
2. **Ledger is locked** — Do not re-litigate brainstorm picks during design
3. **Carry parked items** — Deferred Concerns survive into both outputs verbatim
4. **Dual output is the contract** — Markdown sidecar is read; `.pen` is reference
5. **Honor the corrected graph** — Brainstorm is upstream; do NOT call `/prism-brainstorm` as a sub-step
6. **Exploratory mode is dormant-but-tested** — Default stays REQUIRED
