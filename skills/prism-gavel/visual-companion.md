# Visual Companion Guide — Gavel Decision Cockpit

The gavel cockpit is a browser-based popout for **ruling on a shelf of candidates**. Unlike a passive artifact, every control on a card **wakes the agent to act with real tools** — this is the drive loop (`cockpit -> button -> channel -> agent -> reflect -> cockpit`). The cockpit shows state; the agent does the work.

> **Scaffold status.** This guide describes the intended cockpit and its integration. The server, the cockpit HTML, and the `digital-griot-mcp` channel are wired in later stories (S2-S4). Modeled on the `prism-brainstorm` visual companion — see that skill's `visual-companion.md` and `scripts/` for the reference implementation this one generalizes.

## Render in the Griotwave register

The cockpit uses the same visual language as the brainstorm companion — glass surfaces, ember-bloom, the neural/bio/violet palette. Before building or extending a cockpit screen, read:
- `prism-brainstorm/scripts/frame-template.html` — the authoritative Griotwave component vocabulary (`.diagram`, `.tool-card`, `.meta`/`.cell`, `.tag.*`, tokens).
- `prism-brainstorm/references/griotwave.md` — the canonical token values.

The cockpit adds decision-specific components on top of that baseline (candidate cards, use·role·stage button groups, the four-verb action bar, verification marks). Those are documented in [references/architecture.md](references/architecture.md).

## When to Offer

Offer the cockpit when there's a shelf of candidates to triage into rulings:
- A batch of repos or videos surfaced by `griot-potluck-search`.
- A set of projects awaiting a use·role·stage classification.
- Any list where the follow-through is "open it, rule on it, commit the batch, verify."

The offer MUST be its own message. Do not combine it with the first ruling question.

## Starting a Session (intended — server lands in S2/S3)

The start script mirrors the brainstorm companion's `start-server.sh` contract. Intended shape:

```bash
bash ${CLAUDE_PLUGIN_ROOT}/skills/prism-gavel/scripts/start-server.sh --project-dir $(pwd)
```

Expected to return JSON with `port`, `url`, a `state_dir` (the decision store), and a `screen_dir` (the cockpit content). Persistent session storage lands under `.prism/local/gavel/<session-id>/`.

## The Drive Loop (cockpit specifics)

1. Cockpit renders the shelf from the decision store (`gavel_state`).
2. User clicks a control on a card — a use·role·stage button, a note, or one of the four verbs.
3. The click is delivered to the agent over the `digital-griot-mcp` channel as a wake event (see [references/architecture.md](references/architecture.md) for the payload).
4. The agent runs the real tool (Chrome MCP open, potluck scan, plan/git commit, slug verify).
5. The agent reflects the outcome back into the store; the cockpit re-renders and the card advances.

## The Four Verbs

| Verb | Wakes the agent to... | Backing tool |
|------|-----------------------|--------------|
| **open** | open the repo / play the video | `gavel_open` -> Chrome MCP |
| **scan** | scan the shelf / pull related candidates | `gavel_scan` -> `griot-potluck-search` |
| **commit** | write the batch of rulings to plan + git (HITL) | `gavel_commit` -> `dgs-plan-update` |
| **verify** | resolve slug + stars, promote the mark (v/u/x) | `gavel_verify` |

## Session Exit (intended)

After the batch is committed and verified, package the session: record the decision-store path, stop the server, and confirm to the user. Mirrors the brainstorm companion's Session Exit sequence. The exact commands land with the server in S2/S3.

## Session Storage

- Persistent: `.prism/local/gavel/<session-id>/` (gitignored) — decision store + cockpit content.
