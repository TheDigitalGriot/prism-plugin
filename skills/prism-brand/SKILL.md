---
name: prism-brand
description: Brand identity workflow — logo ideation (12 divergent seeds), mark refinement, and full system (color, type, motion). Use when designing a brand identity, logo, or design system from scratch. Triggers on "logo ideation", "brand identity", "design system", "what should the wordmark look like", or after a brainstorm has established brand direction. Follows prism-brainstorm; precedes prism-design.
model: opus
effort: xhigh
---

# Prism Brand

Three-phase brand identity workflow: Ideation (maximum divergence) → Refinement (2-3 seeds developed) → System (tokens locked). Each phase gates on user approval. Outputs a brand spec the planning and design phases consume.

Brainstorm decided the direction. Brand builds the mark, type, and system on top of it.

## Skill Graph

```
prism-brainstorm     (DECIDES direction — brand values, target feeling, references)
       ↓
prism-brand          (YOU ARE HERE — mark · type · color · motion)
       ↓ writes
.prism/shared/designs/<date>-<topic>-brand.md     ← brand spec (read by prism-design)
       ↓
prism-design         (ARCHITECTS on top of the brand spec)
```

## When to Use

- Brand-new identity work — logo, wordmark, design system
- After `/prism-brainstorm` has locked brand values and direction
- When the user asks for logo ideation, type pairing, or a complete design system

Skip for UI/UX work that isn't brand identity — use `/prism-design` directly.

## Phase 1 · Ideation

Generate **12 logo concepts** in the visual companion at `lo` fidelity. Rules:

- **Maximum spread** — no two concepts share a form factor
- **Single-colour silhouettes only** — colour and type are Phase 3, not Phase 1
- Cover the full range: geometric · organic · typographic · abstract · literal · symbolic
- Include at least one wordmark-first concept

Present all 12. Ask the user to pick 2–3. Do not advance until picks are confirmed.

## Phase 2 · Refinement

For each selected seed, render at `mid` fidelity:
1. Developed mark — proportion, weight, visual tension resolved
2. Two contexts: isolated on dark background + simple lockup with placeholder name
3. A/B variations if the seed has directional ambiguity

Get explicit approval on **one** direction before Phase 3.

## Phase 3 · System

Apply the approved mark. **Load [references/brand-system.md](references/brand-system.md)** for the color derivation process, type pairing rules, motion language assignment table, and the design_tokens output block format.

Render the final lockup (mark + wordmark + tagline if any) at `hi` fidelity — this is the ceremonial close.

## Output

Save to `.prism/shared/designs/YYYY-MM-DD-<topic>-brand.md`:

```markdown
# {Brand} Identity Spec

**Date:** {date}
**Status:** Approved
**Source brainstorm:** .prism/shared/brainstorms/{ledger}

## Mark
{approved mark — form, weight, construction principle}

## Color System
{palette — hex values + semantic names}

## Typography
{display face + mono/eyebrow face + pairing rationale tied to brand values}

## Motion Language
{language name + easing curve + characteristic behaviors}

## Design Tokens (override block)
{YAML block — overrides to the griotwave baseline for this brand}
```

The `Design Tokens (override block)` is what prism-design's §3 and the design_prompt.yaml consume — it replaces the griotwave baseline for this project.

## Rules

1. **Divergence before convergence** — Phase 1 generates 12, never fewer
2. **Silhouettes first** — colour is Phase 3, not Phase 1
3. **Gate on picks** — never proceed to refinement without confirmed picks from Phase 1
4. **System follows mark** — derive all tokens from the approved mark's primary ember
5. **Override, don't reinvent** — brand tokens are overrides to the griotwave baseline, not a separate system

> See also: [prism-brainstorm/references/griotwave.md](../prism-brainstorm/references/griotwave.md) for the full Griotwave token vocabulary this skill overrides.
