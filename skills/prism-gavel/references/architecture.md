# Gavel Cockpit — Architecture Reference

Load this when building or extending the cockpit (S2-S4). It is the contract the wiring stories implement. This is a **scaffold reference**: it describes intended shapes, not shipped code.

## The Drive Loop

The cockpit is a *driver*, not an actor. A sandboxed browser artifact cannot open a repo, hit the GPU, or write git — so instead of acting, it fires an **intent** and the agent (which holds real tools) does the work, then reflects the result back:

```
cockpit (popout) -> button -> sendPrompt / channel -> agent (real tools) -> reflect -> cockpit
```

This generalizes the `prism-brainstorm` companion's click-to-wake: brainstorm wakes the agent to resume a session; gavel wakes it to take a real action (open / scan / commit / verify).

## The Decision Store (intended shape)

The cockpit renders from a single state file — analogous to the brainstorm companion's `state/decisions.json`. Intended location: `.prism/local/gavel/<session-id>/state/store.json`. `gavel_state` reads it; `gavel_decide` and the reflecting verbs write it. Intended shape:

```json
{
  "shelf": [
    {
      "id": "candidate-slug",
      "title": "...",
      "kind": "repo | video | project",
      "ruling": { "use": null, "role": null, "stage": null, "note": "" },
      "verify": { "slug": null, "stars": null, "mark": null }
    }
  ],
  "batch": { "status": "open | committing | committed", "committed": [] }
}
```

`mark` promotes to `v` (verified), `u` (unresolved), or `x` (rejected).

## The Wake-Event Payload (intended)

A click is delivered over the generalized `digital-griot-mcp` channel (wired in S2, modeled on `brainstorm-channel`). The channel notification carries a `session_id` meta key (which cockpit fired the click) and a human-readable `content` summary. Intended intent shape:

```json
{ "session_id": "<id>", "cardId": "candidate-slug", "verb": "open|scan|commit|verify|decide", "payload": { } }
```

On receiving a wake event, the agent resolves the card, runs the backing tool, and reflects.

## The Six-Tool MCP Contract

| Tool | Reads/Writes | Backing action |
|------|--------------|----------------|
| `gavel_state` | reads store | return the shelf + batch status |
| `gavel_decide` | writes ruling | set `use / role / stage / note` on a card |
| `gavel_open` | reflect | open repo / play video via Chrome MCP |
| `gavel_scan` | reflect (adds cards) | route to `griot-potluck-search` |
| `gavel_commit` | reflect (batch) | write batch -> plan + git via `dgs-plan-update` (HITL) |
| `gavel_verify` | reflect (mark) | resolve slug + stars, promote v/u/x |

## The Reflection Protocol

Every acting verb writes its outcome back through `gavel_state` so the card advances:
1. Agent receives the wake event.
2. Agent runs the backing tool (real work).
3. Agent merges the outcome into the store (read-merge-write, as the brainstorm drawer-state protocol does).
4. The server broadcasts a state update; the cockpit re-renders.

## HITL Gate

`gavel_commit` and `gavel_verify` mutate durable state (the plan, git, a promoted mark). They MUST show blast radius and require confirmation before executing — never auto-fire from an unattended click. See the HARD-GATE in `SKILL.md`.

## Component Vocabulary (intended)

Built on the Griotwave baseline (`prism-brainstorm/scripts/frame-template.html`). Cockpit-specific additions to be defined in S3: candidate cards, use/role/stage button groups, the four-verb action bar, and verification-mark pills (reusing `.tag.green|amber|volt` for v/u/x).

## What lands where

| Piece | Story | Notes |
|-------|-------|-------|
| Skill scaffold (this shell) | S1 | SKILL.md + references + scripts placeholder |
| `digital-griot-mcp` channel | S2 | generalized from `brainstorm-channel` |
| Cockpit HTML + server | S3 | mirrors brainstorm `scripts/server.cjs` + frame template |
| Six MCP tools + verb wiring | S4 | the reflection protocol above |
