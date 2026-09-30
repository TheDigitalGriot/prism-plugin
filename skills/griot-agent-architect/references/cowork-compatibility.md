# Cowork Compatibility Reference

Rationale, gotchas, and open questions behind the Cowork column in the Components table in [SKILL.md](../SKILL.md). SKILL.md is the canonical source for which components work where — this file explains *why*.

Claude Code and Cowork share the same plugin format — `plugin.json`, `marketplace.json`, and component schemas are identical. The Cowork help article explicitly defers to the Claude Code plugins reference for structural details. What differs is which components do anything on each surface, because Cowork is a desktop chat product with no Bash tool, no editor, and no tool-call lifecycle.

## Quick Decision Guide

- **Building for Cowork only?** Focus on `skills/` + `.mcp.json`. Skip hooks, LSP, `bin/`, output-styles.
- **Building for Claude Code only?** Use everything. The original structure doc applies as-is.
- **Building for both?** Author with the full component set, but keep Cowork-visible behavior in skills and MCP servers. Hooks/LSP/bin silently no-op in Cowork — they won't break anything, they just won't run.

## Why Each Component Has Its Status

Statuses live in SKILL.md's Components table. The reasoning:

- **Skills** — Cowork's primary plugin surface. Users invoke via `/` or `+` button. Same SKILL.md format as Claude Code.
- **MCP servers (local stdio)** — Cowork explicitly allows plugins to "include local MCP servers that run on your computer with the same permissions as any other program you run." Works identically to Claude Code.
- **MCP servers (remote connector)** — Marked ☁️ because of the cloud-routing gotcha below. Not a yes/no; it works, but with a significant constraint.
- **userConfig** — Prompted via Cowork's Customize menu instead of the Claude Code enable flow. Same data, different surface.
- **Agents** — Marked ⚠️ because the Cowork article lists "sub-agents" as a plugin ingredient but shows no invocation UI and no documentation of how they surface to users. Ship and test empirically.
- **Marketplaces** — Cowork references "a growing library of plugins" browseable via Customize. Schema is presumed shared with Claude Code but not explicitly documented.
- **Hooks** — Marked ❌ because Cowork has no `PostToolUse`/`PreToolUse`/`WorktreeCreate`/`PreCompact` lifecycle. Events have nothing to bind to in a chat UI. Not advertised by Cowork docs.
- **LSP servers** — Marked ❌ because Cowork has no in-editor code intelligence surface. The whole point of LSP is IDE integration.
- **`bin/` executables** — Marked ❌ because `bin/` files get added to the Bash tool's PATH. Cowork has no Bash tool, so there's no PATH to extend.
- **`commands/` slash commands** — Marked ❌ because Cowork already owns `/` as the skill picker. Legacy in Claude Code anyway; use skills instead.
- **Output styles** — Claude Code-specific formatting concept with no documented Cowork equivalent.
- **Channels** — Marked ❓ because channels are MCP-server-backed, so the MCP half should work, but the notification/hook integration is CC-flavored and Cowork surface behavior is undocumented.

## Connector Cloud Routing (The Critical Gotcha)

The single biggest architectural difference for plugin authors shipping remote MCP connectors:

> "Connectors in Cowork reach external services through Anthropic's cloud, not through your local network."

**What this means in practice:**

- A local stdio MCP server bundled with your plugin works the same in both surfaces — it runs on the user's machine with their permissions.
- A remote HTTP/SSE MCP connector that you expect to reach must be **publicly internet-reachable** when running in Cowork. Anthropic's cloud is making the connection, not the user's machine.
- Self-hosted, firewalled, LAN-only, or VPN-gated MCP servers will **not work** in Cowork without additional network configuration (public ingress, tunneling, etc.).
- The same plugin in Claude Code will happily connect to `localhost:4000` or a LAN host — this is a Cowork-specific constraint.

**Design implication:** If your plugin's value depends on private-network access (internal APIs, on-prem databases, dev servers), either ship a local stdio server or treat Cowork as unsupported for that plugin.

## Cowork-Specific Surfaces

### Plugin Create
A built-in Cowork plugin that walks users through authoring a custom plugin from scratch. This is the Cowork-side authoring on-ramp for users without the Claude Code CLI. The Claude Code equivalent is `claude --plugin-dir ./my-plugin` + `claude plugin validate .`.

### Customize Menu
Cowork's install/enable/disable/configure UI. Functionally equivalent to `claude plugin install|enable|disable` but exposed as a GUI in the Cowork sidebar. `userConfig` fields declared in `plugin.json` surface here as enable-time prompts.

## Validation

`claude plugin validate .` validates the shared schema and is authoritative for both surfaces. It does **not** catch Cowork-specific issues like:

- Depending on a remote connector that isn't publicly reachable
- Relying on hooks or LSP that silently no-op in Cowork
- Using `${CLAUDE_PLUGIN_ROOT}` to launch binaries that only work with a Bash tool present

Manual testing in both surfaces is required for dual-surface plugins.

## Open Questions

These are unverified as of the research date (2026-04-09) and worth confirming empirically before relying on them:

1. Whether plugin-shipped agents appear in any Cowork UI
2. Whether any hooks fire in Cowork (assumed no, but unconfirmed)
3. Whether channels integrate with Cowork notifications at all
4. Whether marketplace.json semantics (scopes, strict mode, etc.) are fully mirrored
