---
name: prism-spectrum
description: DEPRECATED ALIAS — renamed to spectrum. Spectrum-style single-story execution for iterative development. Executes one story per session with quality gates. Used by spectrum.sh orchestrator for autonomous feature implementation. Triggers on "spectrum", "execute story", "run spectrum", or when invoked by spectrum.sh loop. Prefer spectrum; this name is kept so existing invocations, the spectrum.sh worker prompt, docs, and muscle memory keep resolving.
model: sonnet[1m]
---

# prism-spectrum → spectrum (deprecation alias)

**This skill was renamed. The canonical skill is [`spectrum`](../spectrum/SKILL.md).**

`prism-spectrum` still resolves — every existing invocation (`/prism:prism-spectrum`), every
in-flight `scripts/spectrum.sh` worker prompt, every document reference, and habit keeps working.
Nothing was deleted. This file is a thin pointer so the old name never breaks.

## What to do

**Read [`../spectrum/SKILL.md`](../spectrum/SKILL.md) now and follow it.**
That file carries the full workflow; this one carries nothing but the redirect.

Everything lives under the new name:

| You want | Path |
|---|---|
| The workflow itself | `../spectrum/SKILL.md` |
| Story manifest schema | `../spectrum/references/story-manifest-schema.md` |
| Model selection | `../spectrum/references/model-selection.md` |
| Spec-review prompt | `../spectrum/references/spec-review-prompt.md` |
| Quality-review prompt | `../spectrum/references/quality-review-prompt.md` |
| Browser verification | `../spectrum/references/browser-verification.md` |
| Visual regression | `../spectrum/references/visual-regression.md` |
| Debug integration | `../spectrum/references/debug-integration.md` |
| Contracts convention | `../spectrum/references/contracts-convention.md` |

## Why the rename

The `prism-` prefix marked it as one phase skill among many. Spectrum is not a phase — it is the
autonomous execution *mode* of the whole workflow, and it is the name the suite uses for Griot's
implementation of ICM across CLI, desktop, and other surfaces.

Note the lineage: this skill was **already** renamed once, from `ralph` to `spectrum`
(see `CHANGELOG.md`, `scripts/ralph.sh` → `scripts/spectrum.sh`). That first rename moved the
*label* off the Ralph loop; the *architecture* stayed. Re-founding the concept off the Ralph loop
and onto ICM is tracked separately as a proposal — see
`.prism/shared/plans/2026-09-05-spectrum-refounding-PROPOSAL.md`. **This rename is additive and
mechanical only; it changes no behavior.**

The rename was additive. Both names resolve; the old one is not going away.
