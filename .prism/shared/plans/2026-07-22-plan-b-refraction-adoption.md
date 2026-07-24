# Plan B — Ecosystem refraction-surface adoption (via cl-plugin-structure)

**Date:** 2026-07-22
**Home:** Prism `.prism/shared/plans` (the standard's home) — a meta rollout plan
**Scope:** methodology + rollout. **Uses** `/prism:cl-plugin-structure` (never edits it).

## Intent

Bring each Griot-suite multi-surface tool up to the **refraction surface** — interactive widgets whose buttons drive the agent (`sendPrompt()` / `drive()`), model routing, cowork channels, artifact-popouts, inherited meta-skills — using `/prism:cl-plugin-structure` as the fixed gold standard and `/prism:fragment-sync` to reconcile each tool across surfaces. *Refract creative work patterns onto multiple surfaces.* Cloud brain, local muscle.

## Stories

### STORY-B1 — Refraction-surface conformance checklist
Extend the cl-plugin-structure adoption checklist (the B8/B9 pattern) with a **refraction-surface** section: interactive `drive()`/`sendPrompt` buttons; model routing (Opus / Haiku / Fable-5, HITL-gated); cowork channels; artifact-popouts; inherited meta-skills.
- **Acceptance:** a checklist a tool can be graded against; referenced by `fragment-sync`.

### STORY-B2 — Cinopsis pilot ( = Plan C )
Bring Cinopsis onto the refraction surface as the first instance. The concrete work **is Plan C** (viewer + `drive()` buttons). Prove the pattern once, end to end.
- **Acceptance:** Cinopsis passes the B1 checklist; Plan C C1–C4 done.
- **Blocked by:** B1.

### STORY-B3 — Rollout via fragment-sync
Sequence the remaining tools — order taken from the `00791624` consolidation decisions (Lucid/`idea_init`, ModelMaker, SkillForge, Audion, Synaptiq …) — reconciling each to the standard with `/prism:fragment-sync`. One tool per pass; log what's dropped.
- **Acceptance:** a sequenced rollout list; each tool run through fragment-sync against the B1 checklist.
- **Blocked by:** B2.

## Guardrails
- Never edit `/prism:cl-plugin-structure`; **use** it. Reconcile via `/prism:fragment-sync`.
- MVP per tool; generalize via Fragment — don't hand-edit each surface twice.
- Local deps (uv / ComfyUI / Flask / ML models / sound libraries / GPU) are **orchestrated from the widget through the device bridge**, not embedded in the cloud.

## Reference
- Prism CHANGELOG 4.4.0 — click-to-drive generalized; `fragment-sync`.
- Session `00791624` (Lucid griot-suite consolidation) — tool inventory, decisions, widget patterns.
- `refraction-pattern` artifact — the thesis.
