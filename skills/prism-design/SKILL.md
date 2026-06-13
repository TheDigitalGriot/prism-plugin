---
name: prism-design
description: Design phase that turns a brainstorm decision ledger into an architectural design — adds mermaid diagrams, interface contracts, data models, and materializes a visual prototype via the Prism Design Engine (forked open-design). Triggers on "design this", "create a design", "design the architecture", or after a brainstorm ledger is approved. REQUIRES a brainstorm ledger by default — flip `require_brainstorm: false` for exploratory mode.
model: opus
effort: xhigh
require_brainstorm: true
inputs:
  required:
    - .prism/shared/brainstorms/
  optional:
    - .prism/shared/research/
    - .prism/shared/plans/
    - .prism/shared/designs/design_prompt.yaml
---

# Prism Design Phase

Turn an approved brainstorm decision ledger into an architectural design the planning phase can execute against. The brainstorm locked the *decisions*. This phase adds the *structure* — mermaid diagrams, interface contracts, data models — and renders a visual prototype via the Prism Design Engine.

Brainstorm decided. Design architects. Plan executes.

## Skill Graph

```
prism-research          (optional — codebase mapping)
       ↓
prism-brainstorm        (DECIDES — Q1..Qn locked picks + parked concerns)
       ↓ writes
.prism/shared/brainstorms/<date>-<topic>.md       ← REQUIRED INPUT
       ↓ reads
prism-design            (YOU ARE HERE — architects on top of decisions)
       ↓ writes always
.prism/shared/designs/<date>-<topic>-design.md    ← markdown sidecar (read by prism-plan)
       ↓ sends to
Prism Design Engine     (localhost:7456 — forked TheDigitalGriot/prism-design-engine)
       ↓ renders
.prism/shared/designs/<date>-<topic>/             ← artifact bundle (HTML/PDF/PPTX/MP4)
       ↓ reads markdown sidecar
prism-plan              (turns design into actionable phases)
```

**Brainstorm is upstream of Design.** Do NOT call `/prism-brainstorm` as a sub-step.

## Design Engine (Primary Path)

The **Prism Design Engine** is a fork of [nexu-io/open-design](https://github.com/nexu-io/open-design) integrated as a first-class prism plugin app (`apps/prism-design-studio/`). It runs locally at `http://localhost:7456` and is launched/managed by the prism-design-studio relay at `http://localhost:7457`.

- **Repo:** `TheDigitalGriot/prism-design-engine`
- **Daemon port:** 7456 (open-design REST API + MCP server)
- **Relay port:** 7457 (prism's sidecar bridge)
- **Panel view:** "Design" tab in the prism VSCode panel (✦ Design)
- **Input:** `design_prompt.yaml` (from idea_init) or structured brief built from the ledger
- **Output:** HTML prototype, PDF, PPTX, MP4 (HyperFrames), ZIP
- **Design system:** `griotwave` (default)
- **Local models:** ComfyUI, Ollama, any OpenAI-compatible proxy via BYOK

## When to Use

- After `/prism-brainstorm` has produced a ledger and the user is ready to architect
- When a feature needs visual prototype work alongside the architectural markdown

Skip when the approach is trivial and the ledger is sufficient for `/prism-plan` directly.

## `require_brainstorm`

Default `true` — ledger is required. If no ledger exists in `.prism/shared/brainstorms/`, error and direct to `/prism-brainstorm` first. Set `false` for exploratory mode.

## Workflow

### 1. Load Ledger

Read the most recent (or user-named) ledger from `.prism/shared/brainstorms/`. Error and redirect if `require_brainstorm: true` and none found.

### 2. Load Supporting Context

Read `.prism/shared/research/` and `.prism/shared/plans/` if present. If a `design_prompt.yaml` exists in `.prism/shared/designs/` (emitted by idea_init), read it — it carries locked decisions, design tokens, and handoff notes that enrich the brief. Summarize and confirm before proceeding.

### 3. Choose Visual Rendering Path

Ask once — before architecture work begins:

> "I'll use the Prism Design Engine by default (localhost:7456). Need to change this?
>
> **A — Prism Design Engine** — `localhost:7456` · images, video, HTML/PPTX/MP4 · local models (ComfyUI/Ollama) · griotwave design system *(default)*
> **B — Claude Design** — `design_prompt.yaml` pasted into `claude.ai/design` · cloud-based · manual seam
> **C — Markdown sidecar only** — no visual artifact"

Default to **A**. If the user confirms, skip the question. Only ask if the user has expressed a preference.

### 4. Architect

Add the structural layer the brainstorm did NOT cover:
- Mermaid diagrams — runtime topology, state flow, sequence interactions
- Interface contracts — function signatures, message shapes, file schemas
- Data models — entities, relationships, validation rules
- Module/file boundaries

Do NOT re-litigate locked decisions. The picks are final. Architecture sits on top of them.

### 5. Carry Deferred Concerns

Preserve ledger §2 verbatim into a "Deferred Concerns" appendix in both outputs.

### 6. Materialize Markdown Sidecar

Save to `.prism/shared/designs/YYYY-MM-DD-<topic>-design.md`:

```markdown
# {Topic} Design

**Date:** {date}
**Status:** Draft
**Ledger:** .prism/shared/brainstorms/YYYY-MM-DD-<topic>.md
**Visual:** {engine artifact dir | claude-design-prompt.yaml | none}
**Engine:** Prism Design Engine (localhost:7456) | Claude Design | none

## Locked Decisions (from ledger §1)
## Architecture
## Interface Contracts
## Data Models
## Deferred Concerns (from ledger §2)
## Reference Artifacts
```

### 7. Materialize Visual Output

**If A (Prism Design Engine):**

1. Check if engine relay is running: `GET http://localhost:7457/status`
2. If not running, instruct user: "Launch the Design Engine from the ✦ Design tab in the Prism panel, or run `npm start` in `apps/prism-design-studio/`"
3. Build the brief from the ledger + any `design_prompt.yaml`:
   ```json
   {
     "brief": "<ledger decisions + architecture as structured brief>",
     "design_system": "griotwave",
     "type": "prototype",
     "source": "prism-design",
     "ledger": "<path to .md ledger>"
   }
   ```
4. `POST http://localhost:7456/api/chat` with the brief
5. Artifacts output to `.prism/shared/designs/<date>-<topic>/`
6. Update sidecar `**Visual:**` field with the artifact directory

**If B (Claude Design):**
Load `references/claude-design-emit.md` — emit a `design_prompt.yaml` and instruct the user to paste it into `claude.ai/design`.

**If C (Markdown only):**
Skip. Note `**Visual:** none` in the sidecar.

### 8. Transition to Planning

After sidecar is written, offer:
- `/prism-plan` — reads the markdown sidecar and produces an implementation plan

## Integration

- **Required Input:** `.prism/shared/brainstorms/<date>-<topic>.md`
- **Optional Input:** `.prism/shared/research/`, `.prism/shared/plans/`, `.prism/shared/designs/design_prompt.yaml`
- **Output (always):** `<date>-<topic>-design.md` — architectural prose, read by `prism-plan`
- **Output (primary):** `<date>-<topic>/` artifact bundle from Prism Design Engine
- **Output (fallback):** `<date>-<topic>-claude-design-prompt.yaml` for Claude Design path
- **Next:** `/prism-plan`

## Design Engine Installation

If the engine isn't installed:

```bash
# Clone the fork
git clone git@github.com:TheDigitalGriot/prism-design-engine.git ~/Developer/prism-design-engine

# Install dependencies
cd ~/Developer/prism-design-engine
pnpm install

# Start the daemon
cd apps/daemon
pnpm daemon
# → Listening at http://localhost:7456
```

Or use the prism-design-studio relay:
```bash
cd apps/prism-design-studio
npm start
```

## Rules

1. **Decisions, not implementation** — this phase produces design, not code
2. **Ledger is locked** — do not re-litigate brainstorm picks during design
3. **Carry parked items** — Deferred Concerns survive into both outputs verbatim
4. **Markdown sidecar is always written** — visual artifact is path-dependent
5. **Brainstorm is upstream** — do NOT call `/prism-brainstorm` as a sub-step
6. **Default to Prism Design Engine** — ask only if the user has expressed a path preference
7. **design_prompt.yaml enriches the brief** — if idea_init emitted one, use it
