# prism-gavel/scripts — placeholder

This directory is the home for the gavel cockpit's runtime, mirroring
`prism-brainstorm/scripts/`. It is intentionally a **scaffold placeholder** — the
runtime is delivered in later stories (S2-S4). Nothing here executes yet.

## What lands here (intended)

| File | Story | Mirrors (in prism-brainstorm) | Purpose |
|------|-------|-------------------------------|---------|
| `digital-griot-mcp.ts` | S2 | `brainstorm-channel.ts` | Generalized wake channel — delivers cockpit clicks to the agent as wake events. |
| `server.cjs` | S3 | `server.cjs` | Serves the cockpit, watches the decision store, broadcasts state updates over WebSocket. |
| `cockpit-template.html` | S3 | `frame-template.html` | The cockpit shell in the Griotwave register (candidate cards, use/role/stage buttons, four-verb bar). |
| `helper.js` | S3 | `helper.js` | Client-side: renders the store, wires button clicks to the channel. |
| `start-server.sh` / `stop-server.sh` | S3 | same | Session lifecycle. |

The six MCP tools (`gavel_state`, `gavel_decide`, `gavel_open`, `gavel_scan`,
`gavel_commit`, `gavel_verify`) and the verb wiring land in S4.

See `../references/architecture.md` for the store shape, the wake-event payload, the
reflection protocol, and the HITL gate these scripts implement.
