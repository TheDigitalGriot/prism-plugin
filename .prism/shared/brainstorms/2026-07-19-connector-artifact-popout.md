# Claude Connector + Artifact Popout — Brainstorm Decisions Ledger

**Date:** 2026-07-19
**Status:** Complete — ready for `prism-design` / `prism-plan` phase
**Scope guardrail:** This brainstorm decided. It did not implement.
**Research inputs:** `.prism/shared/research/2026-07-18-claude-connector-artifact-popout.md` · `.prism/shared/research/2026-07-19-griot-tracks-readiness.md`

---

## §1 · Locked Decisions

### Q1 · Framing → **one feature** (not two)
A **connector whose tools render their own popouts** (inline card + fullscreen). The "artifact popout" is the connector's presentation layer, not a separate build. Rationale: every innovative connector shipping today (Figma, Hex, Amplitude, Runway) *is* a connector whose tools render UI — "two features" was a false split that doubled the work.

### Q2 · Target → **C · directory-grade, built once** (no staged B→C)
The public **directory-grade throne** is the single build target, not a "studio-now, promote-later" staging. The directory gauntlet (OAuth 2.1, remote HTTPS endpoint, privacy policy, security review, 3–5 screenshot carousel) is **in v1 scope**. Rationale: staged "promote later" work is *choice-deferral* — the exact mechanism by which things (e.g. Fragment) get lost. Build-once beats build-twice; C is the *less-gets-lost* path even though it's larger upfront. Aligns with the do-it-right-once principle.

### Q3 · Breadth → **full Griot suite, reality-gated via the live registry**
Expose the full breadth through the broker's live registry (`POST /register` → probe → broadcast); the connector fronts whatever's registered. **v1 = the 7 ready Tier-1 services** (agent-run, code-intel, knowledge, design-gen, 3d-gen, cinopsis, notebooks — Lucid's asset backend already in via `3d-gen`). Everything else appears as its adapter/refresh lands. Rationale: this is *reality-gating* (blocked by external track state), **not** choice-deferral — and every gated item is tracked in the readiness doc.

### Q3a · agent-run controls → **auto · manual · interrupt**
agent-run stays in v1 core with **Claude-Code-style permission controls**, not a single gate: **auto** (trusted auto-approve — a mode flag), **manual** (approve each run — MCP `elicitation`), **interrupt** (stop a running agent — Tasks `tasks/cancel`). Rationale: no connector today exposes agent orchestration; gating it *richly* is what makes it both novel and directory-reviewable.

### Q4 · Substrate → **ext-apps MCP App**
The popout render substrate is **`@modelcontextprotocol/ext-apps`** — the directory-grade path (renders Desktop + web + Cowork; inline card or fullscreen via `ui/request-display-mode`). `show_widget` (Cowork, proven) and the native localhost+Chrome companion (CLI, proven) are **free optional enhancements** over the same Griotwave HTML contract — not milestones. Rationale: directory-bound (Q2) makes ext-apps the floor; the shared content contract makes the others a cheap add later, not a rewrite.

### Q5 · Reach → **Desktop + web + Cowork**
Covered out-of-the-box by the ext-apps substrate. IDE parity via Prism's native VS Code/Electron webviews is **optional, not scoped for v1** (Claude Code CLI does not render MCP Apps).

### Q6 · Primitives → **Tasks + elicitation** (+ Live-Artifact opportunistically)
Build to the **Tasks** extension (long-running jobs — indexing, agent runs, 3D/video renders — plus the interrupt for agent-run) and **elicitation** (manual human-in-the-loop approval). Adopt **Live Artifacts** where a persistent, auto-refreshing dashboard adds value (e.g. a live graph/registry view). Rationale: these are what C requires, not optional choices; Tasks + elicitation are also what Q3a's agent-run controls map onto.

---

## §2 · Deferred Concerns (parking lot) — reality-blocked, tracked, NOT lost

1. **Fragment → `/fragment-sync`** — from Q3
   - Concern: Fragment (`create-fragment` + `fragment-plugin`) is frozen since ~April 2026, ~a full standard-generation behind `cl-plugin-structure` v0.7.2 (no Cowork/channels/model-config, missing required `color` field). Re-sync must precede its connector exposure — else it scaffolds stale, non-"Prism-image" projects. Also gates **idea_init** (built by `create-fragment`).
   - Revisit: its own short design thread. The readiness doc's staleness diff **is** its spec. Proposed: a callable Prism skill (`/fragment-sync`) — a spec→generator conformance bridge, on-demand with a possible drift-check hook later.

2. **Valence refresh** — from Q3
   - Concern: Valence v2 is functionally complete but stale (last commit 2026-03-31); under refresh evaluation. Exposing now surfaces stale capability.
   - Revisit: slot into the registry when the refresh lands.

3. **Tier-2 readiness map** — from Q3
   - Concern: Meridian needs a broker adapter (new substrate); idea_init is a seed bundle (unbuilt, gated behind the Fragment refactor, the design-intent front of the Lucid⇄idea_init pipeline); ModelMaker is not in any local repo (Cowork-only).
   - Revisit: see `2026-07-19-griot-tracks-readiness.md`; each slots in via the registry as it matures.

4. **Prism's own stale surfaces** — from Q3
   - Concern: Prism's EAS/mobile app + Claude Cowork patterns are un-upgraded — a separate Prism-internal upgrade track. The connector must not depend on un-upgraded surfaces.
   - Revisit: separate upgrade track + plan-phase sequencing.

**Housekeeping note (from Q3 research):** Lucid's canonical repo is a **migration orphan** at `Developer/lucid-ai-gen/` and should be relocated into `GriotApps/` (check `griot-ecosystem-viz` `location:` refs after moving).

---

## §3 · Reference Artifacts

**Visual companion session:** `.prism/local/brainstorm/1399-1784445402/`
**Final hi-fi screen:** `.prism/local/brainstorm/1399-1784445402/content/one-target-c-locked.html`
**Decisions state:** `.prism/local/brainstorm/1399-1784445402/state/decisions.json`
**External references:**
- `.prism/shared/research/2026-07-18-claude-connector-artifact-popout.md` (connector/MCP-Apps research + innovation landscape)
- `.prism/shared/research/2026-07-19-griot-tracks-readiness.md` (Fragment staleness + Valence/Lucid⇄idea_init/ModelMaker readiness)

**Design tokens (Griotwave baseline):**
```yaml
design_tokens:
  palette: { void: "#000", neural: "#3B82F6", bio: "#10B981", violet: "#A855F7", voltage: "#C6F91F", solar: "#F97316" }
  surface: glassmorphic   # backdrop-filter: blur(40px) saturate(140%)
  typography: { display: Inter, eyebrow: "JetBrains Mono" }
  motion: { language: ember-bloom, easing: "spring 50/22" }
```
*No palette/typeface/motion overrides were decided — Griotwave defaults hold. The ext-apps popout UIs should map these onto the MCP-Apps host CSS variables (`--color-*`, `--font-*`).*

---

## §4 · Implementation Handoff Notes

When the next session runs `/prism-design` or `/prism-plan` against this ledger, it should:

1. Preserve §1 decisions verbatim as "Locked Decisions."
2. Carry §2 Deferred Concerns forward as a first-class appendix (they are reality-blocked, not optional).
3. Architect the connector as **one plugin-bundled MCP server** fronting the broker's `POST /call` + `welcome` registry snapshot (dynamic tool listing), with **ext-apps** tool UIs (single-file Vite bundle, Griotwave-themed), **Tasks** for long-running work, and **elicitation** for agent-run manual approval.
4. Treat **`/fragment-sync`** as a sibling short design thread — it is the prerequisite that unlocks Fragment (and idea_init) exposure.
5. Sequence the directory-gauntlet work (OAuth, remote HTTPS, privacy policy, review, screenshots) into the v1 build order.
6. Confront the **Cowork cloud-routing constraint** explicitly for any filesystem-touching tool (Fragment scaffolding): local-stdio, or emit a downloadable artifact.

**Two-category success criteria and the build order are the plan phase's job — this ledger sets the scope, not the schedule.**

---

## §5 · Emergent direction (noted, not decided)

**A robust, shared visualization engine across all Prism surfaces.** The current brainstorm companion (static `frame-template.html` fragments + Griotwave tokens, no layout/motion engine) is first-gen and has real ceilings. Gavin is upgrading the underlying visualization mechanisms in a separate session stream, with the intent that **one robust viz engine** underpins *all* Prism chat/canvas surfaces — `prism-brainstorm`'s companion **and** Prism VS Code chat, Desktop chat, and mobile chat — not just the companion. Relates to the §2 "Prism stale surfaces" concern (Cowork/mobile chat). Track for when the new engine lands: the connector's **ext-apps popouts** and the brainstorm companion should both ride it, sharing one Griotwave-native render layer rather than each surface reinventing it.
