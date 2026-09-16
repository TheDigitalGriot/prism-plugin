---
name: prism-gavel
description: Decision cockpit that wakes the agent to act — open a repo or video, scan the shelf, commit a batch, verify a slug — instead of a sandboxed artifact acting on its own. Use when triaging a shelf of candidates (repos, videos, projects) into locked use·role·stage decisions and driving the follow-through with real tools. Triggers on "gavel", "decision cockpit", "triage the shelf", "rule on these", "commit the batch", "verify the slug".
model: opus
effort: xhigh
---

# Prism Gavel

A decision **cockpit**: a browser popout where each card is a candidate awaiting a ruling, and every button on it **wakes the agent to act with real tools** — open the repo or the video, scan the potluck shelf, commit a batch of rulings to the plan + git, resolve and verify a slug. The sandboxed artifact never acts on its own; it fires an intent and the agent does the work, then reflects the result back to the cockpit.

> **Status (S4 wired).** The `digital-griot-mcp` channel (S2), the cockpit popout (S3), and the six `gavel_*` tool handlers (S4) are implemented. `gavel_state` and `gavel_verify` run server-side; `gavel_open`/`gavel_scan`/`gavel_commit` are **resolve-and-return** — the tool assembles the payload, Claude performs the external action on wake (see [On-Wake Verb Handling](#on-wake-verb-handling-s4) below). The first live `gavel_commit` write is Gavin's to trigger.

<HARD-GATE>
Gavel rulings that mutate state (commit a batch, promote a verification slug) MUST be
human-in-the-loop. A card fires an *intent*; the agent proposes the concrete action and
its blast radius, and only executes after the ruling is confirmed. Never auto-commit or
auto-promote from an unattended click.
</HARD-GATE>

## The Drive Loop

The defining pattern — a card wakes the agent instead of acting itself:

```
cockpit (popout) -> button -> sendPrompt / channel -> agent (real tools) -> reflect -> cockpit
```

1. **cockpit** — the browser popout renders the shelf of candidate cards.
2. **button** — use·role·stage buttons, the notes box, and the four verbs live on each card.
3. **sendPrompt / channel** — the click is delivered to the agent over the generalized `digital-griot-mcp` channel (a wake event, not an in-page mutation).
4. **agent (real tools)** — the agent runs the actual work: Chrome MCP to open a repo/video, `griot-potluck-search` to scan the shelf, `dgs-plan-update` to write the batch to the plan and git.
5. **reflect** — the agent writes the result back into the cockpit state so the card advances (ruled, committed, verified).

This is the brainstorm companion's click-to-wake generalized: brainstorm wakes the agent to *resume a session*; gavel wakes it to *take a real action*.

## The v1 Surface — the whole cockpit as driver

The entire cockpit is the driver. Each card exposes:

- **use** buttons — what this candidate is *for*.
- **role** buttons — how it fits the ecosystem.
- **stage** buttons — where it sits in its lifecycle.
- **notes box** — free-text rationale attached to the ruling.
- **four verbs** — open · scan · commit · verify (see the tool contract below).

A ruling is `use · role · stage · note`. The four verbs turn a shelf of candidates into a committed, verified batch.

## The Six-Tool MCP Contract (intended — wired in S3/S4)

The cockpit drives the agent through a `digital-griot-mcp` server exposing six tools. This is the **intended contract**; the implementation lands in later stories.

| Tool | Responsibility |
|------|----------------|
| `gavel_state` | Read the decision store — the current shelf, each card's ruling, and batch status. |
| `gavel_decide` | Set a card's ruling: `use · role · stage · note`. Writes to the store; the cockpit re-renders. |
| `gavel_open` | Open the candidate — a repo, or play a video — via the Chrome MCP. |
| `gavel_scan` | Route to `griot-potluck-search` to scan the shelf / find related candidates. |
| `gavel_commit` | Write a batch of rulings -> plan + git via `dgs-plan-update` (HITL-gated). |
| `gavel_verify` | Resolve a slug + stars -> promote the card's verification mark (v / u / x). |

**Reflection contract:** every verb that acts (`gavel_open`, `gavel_scan`, `gavel_commit`, `gavel_verify`) writes its outcome back through `gavel_state` so the cockpit advances the card. See [references/architecture.md](references/architecture.md) for the store shape, the wake-event payload, and the reflection protocol.

## On-Wake Verb Handling (S4)

When a cockpit verb fires, the popout POSTs `{skill:"gavel", verb, card_id, content}` to the shared `digital-griot-mcp` channel on `:52342` and Claude wakes. **Read the events file** at `$GAVEL_STATE_DIR/events` for the full event (the commit event also carries the decided `batch`). Then act by verb.

The handlers split by capability — two run fully server-side; three are **resolve-and-return** (the tool assembles the payload, *Claude* performs the external action):

### The round-trip

```text
cockpit button → POST :52342 (wake) → Claude reads events file → calls gavel_<verb>
   → server-side tools ACT and return; resolve-and-return tools RETURN a payload
   → Claude performs the external action (Chrome / potluck-search / dgs-plan-update)
   → reflect the result back so the cockpit advances the card
```

### Per-verb, on wake

- **`gavel_state`** *(server-side)* — parses `ITEMS`(undecided)/`RESOLVE` from `griot-live-artifacts/live/dgs-definitive-plan.html` at **git HEAD (read-only)** and writes the shelf JSON to the popout's `STATE_DIR/gavel-cards.json`. The cockpit fetches `/state/gavel-cards.json` and hydrates its deck (replacing the baked snapshot). Never writes the artifact. Run it to (re)load the live shelf; pass `state_dir` if the popout's dir isn't discoverable from env.

- **`gavel_open`** *(resolve-and-return)* — returns the card's `url` (repo) and optional `video_url`. **On wake, open `url` (and `video_url` if present) via the Chrome MCP** — the sandbox-safe path. The tool does not open anything itself.

- **`gavel_scan`** *(resolve-and-return)* — returns `{query, context}` framed as "does our Griot Potluck already solve this?". **On wake, run the `griot-potluck-search` skill** with that query/context and surface matches back to the shelf.

- **`gavel_verify`** *(server-side where possible)* — resolves the card's slug + GitHub stars over HTTP and returns a `verdict` (`v` verified / `u` unresolved / `x` rejected) plus `stars`. It **returns the verdict only — it never writes it back** to `griot-live-artifacts`. The promotion is persisted later, through `gavel_commit` → `dgs-plan-update`.

- **`gavel_commit`** *(resolve-and-return, HITL)* — assembles the decided `batch` (from the commit event's payload in the events file, or the `batch` arg) and returns it with `action:"run_dgs_plan_update"`, `dry_run:true`. **On wake, run the `dgs-plan-update` skill with `batch`.** This MUST route through `dgs-plan-update` — it owns the **Rule-2 anti-clobber sync gate** (stage-live vs repo HEAD; on divergence STOP + reconcile) and the artifact refresh. `gavel_commit` NEVER writes `griot-live-artifacts` directly, and the write is HITL-gated (show blast radius, confirm first).

- **`gavel_decide`** *(local)* — records a `use·role·stage·note` ruling into `STATE_DIR/gavel-cards.json`. No wake, no artifact write; the cockpit re-renders from the store.

## Workflow

- [ ] 1. **Load the shelf** — Gather the candidates to rule on (from `griot-potluck-search`, a plan, or an explicit list).
- [ ] 2. **Offer the cockpit** — If there's a shelf to triage, offer the browser cockpit (load `visual-companion.md`). This offer is its own message.
- [ ] 3. **Rule card by card** — For each candidate: set `use · role · stage`, add a note. A card fires an intent; the agent acts and reflects.
- [ ] 4. **Open / scan on demand** — Use `gavel_open` to inspect a candidate and `gavel_scan` to pull related ones onto the shelf.
- [ ] 5. **Commit the batch** — When a batch of rulings is ready, `gavel_commit` writes plan + git via `dgs-plan-update` — HITL-confirmed, with blast radius shown first.
- [ ] 6. **Verify slugs** — `gavel_verify` resolves slug + stars and promotes each card's mark (v / u / x).
- [ ] 7. **Cockpit exit ceremony** — If the cockpit ran, load `visual-companion.md` -> **"Session Exit"** for the exit sequence (state packaging, server stop, user confirmation).

## Visual Companion

The cockpit is the surface for gavel. Offer it when there's a shelf to triage:

> "You've got a shelf of candidates to rule on. I can open the decision cockpit in your browser — each card gives you use·role·stage buttons and the open/scan/commit/verify verbs, and every click wakes me to do the real work. Want me to start it?"

This offer MUST be its own message. If accepted, load `visual-companion.md` for the full integration guide.

The cockpit renders in the **Griotwave register** — same design language as the brainstorm companion (glass surfaces, ember-bloom, the neural/bio/violet palette). See [references/architecture.md](references/architecture.md) for the cockpit-specific component vocabulary.

## Rules

1. **The card wakes the agent — it never acts itself.** All mutation runs through real tools on the agent side, reflected back to the cockpit.
2. **State-mutating verbs are HITL.** `gavel_commit` and `gavel_verify` show blast radius and require confirmation.
3. **A ruling is `use · role · stage · note`.** Don't commit a partial ruling as if complete.
4. **Commit through `dgs-plan-update`.** Batches land in the plan AND git — never one without the other.
5. **Reflect every action.** After any verb acts, write the outcome back so the card advances.

## Integration

- **Channel:** the generalized `digital-griot-mcp` channel (wired in S2) delivers cockpit clicks as wake events. Modeled on `brainstorm-channel` — the brainstorm companion's active-wake mechanism, generalized surface-agnostic.
- **Scan:** `griot-potluck-search` supplies and expands the shelf.
- **Commit:** `dgs-plan-update` writes rulings to the DGS Definitive Plan + git.
- **Open:** the Chrome MCP opens repos and videos.
- **Design language:** Griotwave tokens — shared with `prism-brainstorm` (see that skill's `references/griotwave.md` for canonical values).

> **Note:** the channel, cockpit HTML, and the six MCP tools are wired in later stories. This skill is the scaffold — the contract they build to.
