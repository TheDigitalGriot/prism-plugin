# Multi-Model Fleet Orchestration — Brainstorm Decisions Ledger

**Date:** 2026-07-18
**Status:** In progress — locked decisions captured, two questions open pending visual review
**Scope guardrail:** This brainstorm decided direction and documented open questions. It did not implement.
**Topic origin:** Gavin runs multiple parallel Claude streams in the Prism VS Code extension today (Deploy Daemon, PASEO audit, Connector research). The question: as the fleet grows to Claude + Codex + Gemini + custom/local models, what keeps the "quantum" workflow aligned — and which OSS tools from the `oss-tools-radar-dgs` artifact streamline it, and what does the surface look like.

---

## §1 · Locked Decisions

### Q1 · Surface topology → **One surface, both modes**
The orchestration UI spans two apps by responsibility, not two screens by navigation. **Prism runs the fleet (build); Valence watches it (observe).** They are fronted by a single surface. Rejected: a standalone Valence observatory divorced from the build surface, and a Prism-only board with no observability spine.
- Trade-off accepted: Prism and Valence must share a data spine (see Q3). More coupling, but the alternative — two apps the user context-switches between — is exactly the seam problem this is meant to solve.

### Q2 · How "observe" is realized → **Card flip, not a global mode toggle**
The reframe that made "one surface, both modes" concrete: observe is **the back of every lane card**, not a separate mode you switch the whole app into. Flip any lane → you're in Valence (replay + cost + seam health) for that stream. Build and watch are the same object at different rotations.
- Trade-off accepted: per-card state instead of one global mode is slightly more UI state to manage, but it keeps you in flow — you never leave the board to check on a run.

### Q3 · Handoff representation → **First-class edges, via `waggle` tokens**
Handoffs between agents are visible objects (edges/passports on the board), not invisible plumbing. Each is a `waggle` resolvable reference: ~30 bytes, resolves to a view sized to the receiving model, carries provenance + revocation, MCP-native. This is the differentiator — the seam where ~37% of multi-agent failures happen and ~15× token burn accrues is made **legible**.
- Rationale: the sharpest data point in the whole radar. If alignment breaks at the seam, the seam must be a first-class citizen of the UI, not a hidden step.

### Q4 · Ensemble / "quantum" status → **First-class intended workflow (NOT parked)**
Per Gavin: *"this is my intended workflow, I want this in the consideration."* The many-models-one-task pattern — superposition (N models run the same task, blind to each other) then collapse (Valence judge-panel scores, human picks or merges best-of) — is a first-class mode of the surface, not a deferred v2 research toy. It is the truest expression of the "quantum workflow aligned" framing.
- Trade-off accepted **and flagged**: this is the expensive mode (~15× tokens; `waggle` mitigates, local models via AirLLM offset). Cost control lives in §2. First-class ≠ default — see OQ1.

---

## §1b · Open Questions (documented, not yet decided)

Gavin found these too abstract to decide from prose alone and asked that they be **documented against the now-rendered visuals** rather than forced. Both have concrete mockups to decide from (see §3).

### OQ1 · Default view metaphor — **OPEN**
Which mode leads when you open the surface? Three genuine options, now visualized:
- **Lane board** (default in the mockup) — evolves the current tab-per-stream workflow; one task, one primary model per lane; parallelism via sub-lanes (Orca worktrees). Lowest friction, most buildable-now. `[prism-conductor-fleet-surface]`
- **Score-first** — the plan is always the primary object; every run starts from a conductor's score. More structure, better for large coordinated work, heavier for quick tasks. `[prism-conductor-score-ensemble]`
- **Ensemble-first** — superposition is the default, soloing one model is the exception. Boldest, most expensive, most novel. `[prism-conductor-score-ensemble]`
- **Working recommendation:** Lane default, with Score and Ensemble as invokable zoom-modes on a lane (they are zoom levels of one surface, not competitors). Revisit against the visuals.

### OQ2 · Human control point — **OPEN**
Where does the human conductor sit?
- **Merge-gate only** (shown in mockup) — agents run autonomously; you approve handoffs + merges; Valence alerts on seam degradation. Least babysitting.
- **Approve every handoff** — each `waggle` pass waits for your nod. Tightest control, most interruption — good early while trust in the seam is low.
- **Tempo-only / mostly autonomous** — you set intent + tempo; fleet self-merges via merge-queue automation; you intervene by exception.
- No recommendation locked — depends on how much you trust the seam in early use.

---

## §2 · Deferred Concerns (parking lot)

1. **Ensemble token cost** — from Q4. The ~15× multi-agent token burn concentrates in Ensemble's superposition. `waggle` (model-sized views, not full re-paste) and local/batch models (AirLLM on the P16, free tokens) are the mitigations. Revisit: set a per-task budget guard (CodeBurn / token-diet) before Ensemble ships as everyday.
2. **Collapse / judge UX is unproven** — from Q4. The scoring + merge-best-of interaction is the research bet of the whole design. No prior art on the radar does it well. Revisit: prototype the collapse step in isolation first.
3. **macOS-only tools won't run on the Windows P16** — Quotio (quota/failover proxy) and Textream (teleprompter, → Audion) are Swift/macOS. Revisit: find/port Windows equivalents for the routing + failover layer, or run them on the MacBook.
4. **App-boundary governance** — exactly what lives in Prism vs Valence vs the PASEO daemon (which hosts the fleet runtime). The daemon is the natural fleet host; Prism is the board; Valence is the observatory. Needs a clean contract. Revisit in `prism-design`.

---

## §3 · Reference Artifacts

**Visual companion session:** Cowork cloud session (browser companion not run — this session is cloud, not local Claude Code). Mockups delivered as persisted desktop artifacts instead.
**Mockups (design references for `prism-design`):**
- `prism-conductor-fleet-surface` — Lane mode hero: the board, per-card observe flip, handoff edges, Valence drawer. `/tmp/prism-conductor-mockup.html`
- `prism-conductor-score-ensemble` — Score mode (plan + assigned movements) and Ensemble mode (superposition → collapse). `/tmp/prism-conductor-score-ensemble.html`
**Source research:** `oss-tools-radar-dgs` artifact (studio OSS radar, 45 tools mapped, last extended 2026-07-18).
**Related prior research:** `.prism/shared/research/2026-03-04-agent-chat-opencode-codebuff-analysis.md` (7-backend lineage → Junction), `2026-06-12-paseo-daemon-architecture-surface-impact.md` + `2026-06-13-prism-vs-paseo-surface-architecture.md` (daemon/surface boundary), `2026-07-18-claude-connector-artifact-popout.md` (agent-run permission surface, today).

### Tool → layer bindings (from the radar — the "which tools streamline this" answer)

| Layer (the failure it closes) | Tool(s) | Suite home |
|---|---|---|
| Handoff seam (~37% of failures, ~15× tokens) | `waggle` | Valence · Prism |
| Shared context (no copy-paste) | `Tutti` | Prism |
| Parallel isolation (worktrees) | `Orca`, `DeerFlow` (harness) | Prism |
| Model routing (right model per request) | `Weave Router`, `improve` (plan/execute split) | Valence · Prism |
| Observability (replay + cost) | `Mindwalk`, `claude-replay`, `LLM Space`, `CodeBurn` | Valence |
| Shared memory (agree across sessions) | `BrainAPI2`, `codebase-memory-mcp` (already backs graph-navigator), `self-learning-skills` | Valence · Prism · SkillForge |
| In-editor surface (the front-end shape) | `Junction` (7 backends), `juggler` (branching tree) | Prism |
| Model tier for local/batch (P16, free tokens) | `AirLLM`, `llmfit`, `Kimi K3` (API) | Prism · Lucid |

**Design tokens (Griotwave baseline — command/dark register, matches mockups):**
```yaml
design_tokens:
  palette: { void: "#0c0805", ember: "#d9531e", ember2: "#b83c0e", glow: "#ff7a3c", gold: "#c98a24" }
  agent_colors: { claude: "#d9531e", codex: "#4f8cf0", gemini: "#9b6bd6", local: "#2fa392" }
  surface: glassmorphic   # backdrop-filter: blur(30px)
  typography: { display: Inter, mono: "ui-monospace" }
  motion: { language: ember-bloom, easing: "spring 50/22" }
```

---

## §4 · Implementation Handoff Notes

**This file is the handoff to `prism-design`.** When the next session runs `/prism-design` against this ledger, it should:

1. Preserve §1 locked decisions verbatim (surface topology, card-flip observe, first-class waggle edges, ensemble-is-first-class).
2. **Resolve OQ1 (default metaphor) and OQ2 (control point) first** — both have rendered mockups to decide from; they gate the layout.
3. Carry §2 deferred concerns forward as a first-class appendix — especially the Ensemble cost guard and the collapse/judge UX prototype.
4. Load the §3 hi-fi mockups as visual-layout reference for the `.pen` file.
5. Define the Prism / Valence / PASEO-daemon contract (parking-lot item 4) — mermaid + interface contracts.
6. Write `.prism/shared/designs/2026-MM-DD-fleet-orchestration-design.md` + `.pen`.
```
