# Fable-Method → Prism Integration — Design Ledger

**Date:** 2026-07-18
**Status:** Exploration captured — planning session to resume later (Gavin)
**Source:** YouTube analysis (cinopsis session `d55c8dbd7bd9`, "How to Turn Opus Into a Fable-Like Long-Form Problem Solver", XTBWVVcF3Pk)
**Owner:** Gavin
**Scope:** Additive only. Do NOT rewrite existing Prism skills — these are new artifacts + minimal, backward-compatible hooks.

---

## TL;DR

Prism already **is** the productized "Fable method." The video prescribes, as an ad-hoc skill, ~4.5 of the 5 disciplines Prism formalizes as a phased workflow. We are **not** adding a "Fable mode" skill. We are closing the two places Prism is genuinely thinner than the video — both of which are the video's highest-leverage ideas:

1. **A governed Router layer** — model + effort routing is currently scattered and defaults *against* the cost lesson.
2. **A scope-adversary gate** — Prism red-teams *code* but never the *plan*.

Optionally, wrap both as a named Prism **posture** ("Fable mode") — the "it's a mode of Prism, not a loose skill" packaging.

---

## The reframe: gate → Prism coverage

| Fable gate | Prism today | Coverage |
|---|---|---|
| **Scoping** (devil's advocate over failure modes) | `prism-plan`, `prism-brainstorm` (hard-gate: no code till approved), `prism-design` | ⚠️ Planning strong; *red-teaming the plan* is not a gate |
| **Evidence before reasoning** | `prism-research` — "document the codebase **without recommendations**" | ✅ Nearly verbatim |
| **Adversarial reasoning** (attack) | `spec-reviewer` + `quality-reviewer`, reviewer isolation, no-groupthink, repeated-issue halt | ✅ …but only on *implementer code*, never the plan |
| **Verify before done** | `prism-validate`, `prism-verify`, `browser-verifier`, `visual-regression-grader` | ✅ Ahead of the video |
| **Calibrate effort/model** | `prism-dispatch` model table, `prism-subagent` haiku→sonnet→opus escalation | ⚠️ Scattered + static; defaults *against* the cost lesson |

**Verdict:** two real gaps (Scoping-attack, Calibration), everything else already present or better.

---

## Gap 1 — Model routing is scattered and points the wrong way

### Current state (observed in repo)
- `skills/prism-dispatch/SKILL.md` — a **hardcoded** model-per-task-type table (haiku / sonnet / opus).
- `skills/prism-subagent/SKILL.md` — auto-escalation haiku→sonnet→opus on `BLOCKED`; but implementer default frontmatter is **`model: opus, effort: xhigh`**.
- Every skill pins its own model in frontmatter (e.g. `prism` = sonnet, `prism-dispatch` = sonnet, `prism-subagent` = opus).
- Routing knowledge is **duplicated** across skills with no single source of truth.

### The problem
The video's core finding: **Opus orchestrator → Haiku scouts = ~3× cheaper, identical result.** Prism's `prism-subagent` default (opus/xhigh implementers) is the *opposite* posture — it pays top-tier for execution work that cheap scouts handle at parity.

### Proposed artifact: **the Router**
- **`.prism/shared/router.json`** (committed, versioned) — single model-roster manifest. Sketch:
  ```json
  {
    "models": [
      { "id": "haiku",  "tier": 1, "cost_score": 9, "intelligence": 4, "taste": 3,
        "use_when": "locate/grep/list, read+explain one file, pure pattern match", "effort_default": "medium" },
      { "id": "sonnet", "tier": 2, "cost_score": 6, "intelligence": 7, "taste": 6,
        "use_when": "trace data flow 2-3 files, subtle root cause, most implementation", "effort_default": "high" },
      { "id": "opus",   "tier": 3, "cost_score": 2, "intelligence": 9, "taste": 9,
        "use_when": "architecture/design review, orchestration, cross-cutting decisions", "effort_default": "high" }
    ],
    "role_defaults": {
      "orchestrator": "opus",
      "scout":        "haiku",
      "implementer":  "sonnet",
      "reviewer":     "sonnet",
      "verifier":     "haiku",
      "architect":    "opus"
    },
    "notes": "effort_default caps at 'high' by design — see Calibration note."
  }
  ```
  (`taste` = the video's creativity / UX / out-of-box column; keep it — it earns its place for design-heavy Griot work.)
- **`skills/prism-route/SKILL.md`** (new) — thin decision skill: given a task class / role, return `{ model, effort }` from the manifest. One place to reason about routing.

### Hooks (additive, backward-compatible)
- `prism-dispatch` — replace the hardcoded table with "consult `prism-route`" (keep the table as the fallback/default the manifest ships with).
- `prism-subagent` — source the implementer **floor** from `role_defaults.implementer` (sonnet, not opus); keep the escalation ladder intact so hard tasks still climb to opus.
- `prism-spectrum` — per-story model from the router instead of a fixed tier.

### Calibration sub-point (the "effort" half of Gate 5)
The video: higher effort ≠ better — x-high/max overthinks, second-guesses, produces worse output than high. Encode as policy: **`effort_default` caps at `high`**; `xhigh`/`max` only on explicit escalation, never as a resting default. This directly revisits `prism-subagent`'s `effort: xhigh` frontmatter.

### ⚠️ Empirical caveat
The "3× cheaper, identical quality" number is the creator's anecdotal test, not benchmarked. **Validate on real Griot workloads before hardcoding cheap-scout everywhere.** Safe rollout: make cheap-scout the *default floor* but keep the existing escalation ladder as the safety net, then measure.

---

## Gap 2 — Prism red-teams code, never the plan

### The problem
Prism's two-stage review (`spec-reviewer` → `quality-reviewer`) is genuinely adversarial — but it fires on the implementer's **diff**, *after* code exists. The video's single strongest point: **scoping ≠ planning.** Real scoping plays devil's advocate over every failure mode and unknown *before* execution. Prism has no gate that attacks the plan itself.

### Proposed artifact: **`agents/plan-adversary.md`** (new agent)
- **Input:** the plan doc only (`.prism/shared/plans/…md`) — no session history, same context-isolation discipline the reviewers use.
- **Job:** try to *break* the plan — surface unhandled failure modes, hidden/ordering dependencies, unstated assumptions, unexplored unknowns, blast-radius the plan ignores. Severity-tagged.
- **Explicitly does NOT propose fixes** — stays adversarial and independent (mirrors "reviewers see diffs, not full files"; here the adversary sees the plan, not the solution).
- **Model:** `opus` via the router's `architect` role (this is the "architecture / design review → opus" row).

### Hook
- Fire at the **plan → implement boundary** — cleanest as a final required step of `prism-plan` (or a thin new gate skill `prism-scope-attack`).
- Output → `.prism/shared/plans/YYYY-MM-DD-<feature>-ADVERSARY.md` (or appended section on the plan).
- **Open decision:** blocking gate (must resolve/ack findings before implement) vs advisory (surface + proceed). Recommend blocking for the "posture", advisory otherwise.

---

## Optional — package as a Prism posture ("Fable mode")

The "fits into Prism as a mode, not a loose skill" framing Gavin is pointing at. A named operating profile that, when toggled on for hard problems:
- sets router `role_defaults` to the cheap-scout profile,
- enables `plan-adversary` as a **required** gate,
- caps effort at `high` (calibration).

Shapes to decide between:
- `.prism/shared/postures/fable.json` + activation flag (`/prism … --posture fable`), or
- a `prism-posture` skill, or
- a field in `prism-init`.

Naming open: "Fable mode" vs a Griot-native name (optics/light family — e.g. a "focus"/"collimate" register to match the Prism metaphor).

---

## Open decisions for the planning session

1. **Router manifest location** — `.prism/shared/router.json` (committed, per-project) vs plugin-level default vs both (plugin default + project override).
2. **Router vs frontmatter** — does the router *override* each skill's pinned `model:`, or only fill role defaults where a skill defers? (Recommend: router is source of truth for *roles*; skills may still pin for special cases.)
3. **plan-adversary** — blocking gate vs advisory. (Recommend: blocking under the posture, advisory standalone.)
4. **Effort policy** — confirm `high` cap as default; where does `xhigh`/`max` remain legitimate?
5. **Posture packaging** — flag vs skill vs init field; and the name.
6. **Validation plan** — pick 2–3 recent real Prism tasks to A/B (opus-implementers vs sonnet/haiku-scouts) and actually measure the cost/quality delta before committing the default flip.

---

## Concrete touch-point checklist (for later)

**New files**
- `.prism/shared/router.json` — model roster + role defaults
- `skills/prism-route/SKILL.md` — routing decision skill
- `agents/plan-adversary.md` — plan red-team agent
- *(posture)* `.prism/shared/postures/fable.json` **or** `skills/prism-posture/SKILL.md`

**Additive edits (backward-compatible)**
- `skills/prism-dispatch/SKILL.md` — "Choosing Models Per Agent" → consult `prism-route` (ship current table as fallback)
- `skills/prism-subagent/SKILL.md` — implementer floor from router (sonnet), effort cap `high`, keep escalation ladder
- `skills/prism-spectrum/SKILL.md` — per-story model from router
- `skills/prism-plan/SKILL.md` — final step invokes `plan-adversary` gate

---

*Captured by Claude (Cowork) from the cinopsis digest. Nothing built yet — additive-only plan awaiting Gavin's planning session.*
