---
name: cl-plugin-structure
description: Use when creating, scaffolding, structuring, or validating plugins for Claude Code or Claude Cowork. Covers the .claude-plugin/plugin.json + marketplace manifest, component organization (agents, skills, slash commands, hooks, MCP/LSP servers, channels), agent/command/hook frontmatter, the .local.md per-project settings pattern, portable paths, surface compatibility, bundled validator scripts, and development workflow. Use this whenever the user mentions building a plugin, a skill, a slash command, a hook, an MCP server, a marketplace, or asks about plugin.json/SKILL.md structure — even if they don't say "plugin" explicitly.
version: 0.7.6
---

# Plugin Structure for Claude Code and Cowork

Claude Code and Cowork share the **same plugin format** — `plugin.json`, `marketplace.json`, skills, and MCP server configs are identical across both surfaces. What differs is which *components* are meaningful on each surface. Cowork is a desktop chat product with no Bash tool or tool-call lifecycle, so hooks, LSP, and `bin/` executables have nothing to bind to there. See the Components table below for the per-component compatibility matrix, and [references/cowork-compatibility.md](./references/cowork-compatibility.md) for the full rationale.

## Directory Structure

```
plugin-name/
├── .claude-plugin/
│   └── plugin.json          # Manifest (optional but recommended)
├── agents/                  # Subagent definitions (.md files)
├── skills/                  # Skills (subdirectories with SKILL.md)
│   └── skill-name/
│       └── SKILL.md
├── hooks/
│   └── hooks.json           # Event handler configuration
├── commands/                # Slash commands (.md) — token-efficient parametric invocations
├── output-styles/           # Output style definitions (.md)
├── .mcp.json                # MCP server definitions
├── .lsp.json                # LSP server configurations
├── settings.json            # Default settings (e.g., activate an agent)
└── scripts/                 # Helper scripts and utilities
```

**Rules:** Manifest goes in `.claude-plugin/`. All component dirs at plugin root. Only create dirs you use. Kebab-case everything. Custom component paths in `plugin.json` **supplement** the default directories — both load; they do **not** replace defaults. (To exclude a default, omit it deliberately; there is no auto-replace.)

## Plugin Manifest (`.claude-plugin/plugin.json`)

`name` is the only required *field*, but the manifest file itself is **required** — Claude Code will not recognize a plugin without `.claude-plugin/plugin.json`. For full field reference: [references/manifest-reference.md](./references/manifest-reference.md)

```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "description": "Brief explanation",
  "author": { "name": "Author" },
  "keywords": ["topic"]
}
```

**Valid root-level fields:** `name` (required), `version`, `description`, `author`, `homepage`, `repository`, `license`, `keywords`, `commands`, `agents`, `skills`, `hooks`, `mcpServers`, `lspServers`, `outputStyles`, `userConfig`, `channels`

## Marketplace Manifest (`.claude-plugin/marketplace.json`)

Required when distributing via a marketplace. Different schema from plugin.json.

```json
{
  "name": "my-marketplace",
  "metadata": {
    "description": "What this marketplace provides",
    "version": "1.0.0",
    "pluginRoot": "./plugins"
  },
  "owner": {
    "name": "Author Name",
    "email": "author@example.com"
  },
  "plugins": [
    {
      "name": "my-plugin",
      "source": "./plugins/my-plugin",
      "description": "What this plugin does"
    }
  ]
}
```

**Valid root-level fields:** `name` (required), `owner` (required), `plugins` (required), `metadata` (optional object)

**`metadata` fields:** `description`, `version`, `pluginRoot`

**`owner` fields:** `name` (required), `email` (optional)

**`plugins` entry required fields:** `name`, `source`

**`plugins` entry optional fields:** `description`, `version`, `author`, `homepage`, `repository`, `license`, `keywords`, `category`, `tags`, `strict`, `commands`, `agents`, `hooks`, `mcpServers`, `lspServers`

**IMPORTANT:** `description` goes inside `metadata`, NOT at the root level. `$schema` is NOT a valid field. The marketplace schema is stricter than plugin.json — unrecognized root keys cause validation failure.

## Components

| Component | Location | Format | CC | Cowork | Notes |
|-----------|----------|--------|----|--------|-------|
| **Agents** | `agents/*.md` | MD + YAML frontmatter | ✅ | ⚠️ | model, effort, maxTurns, disallowedTools. Cowork lists sub-agents as a plugin ingredient but UI surface is unverified |
| **Skills** | `skills/name/SKILL.md` | MD + YAML frontmatter | ✅ | ✅ | Primary Cowork surface — users invoke via `/` or `+` button |
| **Hooks** | `hooks/hooks.json` | JSON | ✅ | ❌ | 4 types: command, http, prompt, agent. Cowork has no tool-call lifecycle events |
| **Commands** | `commands/*.md` | MD + YAML frontmatter | ✅ | ❌ | First-class + **token-efficient** — a fixed prompt with no skill-load overhead. Best for parametric / interactive slash UX. Only the top-level `.claude/commands/` *layout* is legacy vs `skills/name/` — not commands. Cowork owns `/` as the skill picker → unsupported there. See [references/command-patterns.md](./references/command-patterns.md) |
| **MCP Servers (local stdio)** | `.mcp.json` | JSON | ✅ | ✅ | Auto-start on enable. Runs locally with user's permissions |
| **MCP Servers (remote/HTTP connector)** | `.mcp.json` | JSON | ✅ | ☁️ | **Cowork routes connectors through Anthropic's cloud** — must be publicly internet-reachable, not LAN/firewalled |
| **LSP Servers** | `.lsp.json` | JSON | ✅ | ❌ | Requires binary in PATH. No Cowork editor surface |
| **Output Styles** | `output-styles/*.md` | MD | ✅ | ❌ | Claude Code-specific formatting concept |
| **Channels** | `plugin.json` + MCP server | JSON + TS/JS | ✅ | ✅ | Bound to mcpServers entry; 3 push tiers + a transport axis -- passive file-bus (tools:{}) runs headless/Cowork, live-push is interactive-only |
| **`bin/` executables** | `bin/*` | Any | ✅ | ❌ | Added to Bash tool PATH. Cowork has no Bash tool |
| **Settings** | `settings.json` | JSON | ✅ | ⚠️ | Currently only `agent` key |
| **userConfig** | `plugin.json` | JSON | ✅ | ✅ | Enable-time prompts. Cowork surfaces via Customize menu |

Legend: ✅ supported · ❌ not supported · ☁️ works with cloud-routing caveat · ⚠️ partial/unverified · ❓ undocumented

For detailed component patterns: [references/component-patterns.md](./references/component-patterns.md). For the full Cowork compatibility rationale and gotchas: [references/cowork-compatibility.md](./references/cowork-compatibility.md).

## Agent Frontmatter

```yaml
name: my-agent
description: When to invoke this agent — name 2-4 trigger scenarios (proactive + reactive)
model: inherit         # REQUIRED — inherit | sonnet | opus | haiku  (inherit = same as parent, recommended)
                       #   (claude-fable-5-1 is enabled but HITL-gated — never a resting default; see Model Configuration below)
color: cyan            # REQUIRED — blue | cyan | green | yellow | magenta | red  (UI identifier)
effort: medium         # low | medium | high
maxTurns: 15           # haiku: 5-8, sonnet: 12-18, opus: 12-15
disallowedTools: Write, Edit  # restrict unnecessary capabilities
```

`model` and `color` are **required**. Other optional fields: `tools`, `skills`, `memory`, `background`, `isolation` ("worktree" → the agent gets its own git worktree). Plugin agents **cannot** use `hooks`, `mcpServers`, or `permissionMode`. Convention: put 2-4 worked trigger scenarios under a **"When to invoke"** section in the agent body and reference it from the description — it ties triggering to verifiable scenarios.

## Hook Configuration

```json
{
  "hooks": {
    "PostToolUse": [{
      "matcher": "Write|Edit",
      "hooks": [{
        "type": "command",
        "command": "${CLAUDE_PLUGIN_ROOT}/scripts/format-code.sh"
      }]
    }]
  }
}
```

**Default to `command` type** — a shell script with zero LLM cost; the right call for deterministic checks (lint, format, path/secret guards). This is the house default for token efficiency.

**Request a `prompt` hook when you need semantic judgment** the shell can't make ("is this Bash command destructive?", "does this edit violate the style guide *in spirit*?"). Prompt hooks fire an LLM call but return a structured decision rather than just an exit code:

- **PreToolUse** → `{"hookSpecificOutput": {"permissionDecision": "allow"|"deny"|"ask", "updatedInput": {...}}, "systemMessage": "..."}`
- **Stop / SubagentStop** → `{"decision": "approve"|"block", "reason": "...", "systemMessage": "..."}`
- `command` hooks signal via exit code (0 = pass, 2 = block) and may also print this JSON on stdout.

`agent` hooks delegate to a full subagent for multi-step judgment. **Reach for `command` first; escalate to `prompt`/`agent` deliberately.** For the events table, exit-code vs JSON protocol, and the hook-pattern library: [references/hook-events.md](./references/hook-events.md). Validate + test hooks with the bundled `scripts/hook-linter.sh`, `scripts/test-hook.sh`, and `scripts/validate-hook-schema.sh`.

## Slash Commands (`commands/*.md`)

Token-efficient: a `/foo` command runs a fixed prompt with **no skill-load overhead** — the right tool for parametric, repeatable, or interactive workflows. Skills are for discoverable knowledge modules that load context; commands are for "do this exact thing, now."

```yaml
---
description: Deploy to an environment        # shown in the / picker
argument-hint: <env> [--dry-run]             # UX hint after the command name
allowed-tools: Bash(git:*), Bash(npm:*), Read   # capability gate (tool filters)
model: haiku                                 # cheap/fast for mechanical commands
disable-model-invocation: false              # true = manual-only (safety gate)
---
Deploy $1 to $2. Current status: !`git status --short`. Config: @config/$1.json
```

Key techniques: `$ARGUMENTS` / `$1` / `$2` (positional + remaining), `!`​`cmd`​`` for **bash injection** (live context), `@path` for **file references** (static or dynamic `@$1`), and `AskUserQuestion` for interactive multi-select / conditional flows. Full frontmatter + interactive patterns: [references/command-patterns.md](./references/command-patterns.md).

## Settings — `settings.json` and the `.local.md` pattern

Two distinct mechanisms:
- **`settings.json`** (plugin root) — plugin defaults (e.g. activate an `agent` on enable).
- **`.claude/<plugin-name>.local.md`** (per-project, user-authored) — YAML frontmatter + markdown body for **per-project, user-configurable** plugin state/behavior, read from hooks/commands at runtime. Parse with `scripts/parse-frontmatter.sh`; validate with `scripts/validate-settings.sh`. Full pattern + parsing recipes: [references/settings-local-md.md](./references/settings-local-md.md).

## MCP Servers (`.mcp.json`)

Local stdio (auto-start on enable, runs with user permissions) or remote SSE/HTTP/WebSocket connectors. Plugin MCP tools are namespaced `mcp__plugin_<plugin>_<server>__<tool>`. Use `${CLAUDE_PLUGIN_ROOT}` for server paths. **Cowork routes remote connectors through Anthropic's cloud** — they must be publicly reachable (see Components table). Server types, OAuth/token auth, and tool-naming details: [references/mcp-patterns.md](./references/mcp-patterns.md).

**Shelling out from a local stdio server?** Keep stdout pure JSON-RPC, pass `stdin=subprocess.DEVNULL` to every child, sanitize proxy env, prefer the interpreter's own binaries, and bind spawned servers to a kill-on-close Job Object - or the server hangs and orphans on Windows. Full recipe: [references/mcp-patterns.md § Local stdio server hygiene](./references/mcp-patterns.md).

## Channels

Channels are MCP servers that push external events into Claude's context. Three capability tiers:

| Tier | What It Enables |
|---|---|
| **One-way** (`claude/channel`) | Push alerts/events. Claude reads but can't respond. |
| **Two-way** (+ `tools`) | Above + Claude calls a reply tool to send messages back. |
| **Permission relay** (+ `claude/channel/permission`) | Above + remote tool approval from phone. v2.1.81+ |

**Transport axis (orthogonal to the tiers):** how events *move*. **Passive bus** -- declare only `capabilities:{tools:{}}` and move events through the filesystem (`$SCREEN_DIR` out / `$STATE_DIR/events` in); runs unchanged headless and in Cowork cloud (what `digital-griot-mcp` uses, and why brainstorm/gavel run headless). **Live-push** -- `claude/channel` + `notifications/claude/channel`; needs an interactive consumer, so it is inert headless. **Griot rule: build on the bus first; layer push on only for interactive surfaces, and never gate skill correctness on a pushed reply.** Bind to an MCP server in `plugin.json`:

```json
{
  "channels": [{ "server": "my-mcp-server" }]
}
```

For transport modes (passive bus vs live-push), the cloud->local headless invocation contract, server implementation patterns, security (sender gating, pairing flows), permission relay protocol, and integration with hooks/skills: [references/channel-patterns.md](./references/channel-patterns.md)

## Portable Paths

| Variable | Resolves To | Survives Updates |
|----------|------------|-----------------|
| `${CLAUDE_PLUGIN_ROOT}` | Plugin install directory | No |
| `${CLAUDE_PLUGIN_DATA}` | `~/.claude/plugins/data/{id}/` | Yes |

Use `PLUGIN_DATA` for persisted deps (node_modules, venvs, caches). Use `PLUGIN_ROOT` for bundled scripts and configs. **Never** use hardcoded or relative paths.

## Cloud / device resource resolution

A skill's bundled `references/` `scripts/` `assets/` are not equally reachable everywhere. Two independent facts about a **Cowork cloud** session decide how to resolve them — apply the matrix, and bake the matching block into any resource-bundled skill:

| | Read a bundled doc | Run a bundled script |
|---|---|---|
| **Standalone skill** (distributed via `save_skill` -> SKILL.md only) | device-side · `Get-Content ~/.claude/skills/<name>/<path>` | device-side · Windows-MCP PowerShell / `claude.exe -p` |
| **Plugin skill** (installed via a plugin) | `PLUGIN_ROOT/<path>` — ships with the plugin, present in the cloud | device-side · Cowork has **no Bash tool** |

Why: (1) `save_skill` uploads only the SKILL.md, so a standalone skill's bundled files never travel to the cloud account — they live on-device (`~/.claude/skills/<name>/`) and in the source repo. A plugin ships its whole folder, so its files resolve via `PLUGIN_ROOT`. (2) Cowork has **no Bash tool** (see the Components table), so **no** skill can *execute* a bundled script in-cloud — scripts always run device-side via the Windows-MCP PowerShell bridge or `claude.exe -p` headless. On **desktop / CLI** everything is local and the resolution is a no-op.

**Required block.** Any skill that bundles files MUST carry a short "Resources — cloud / device resolution" block near the top, in the variant that matches how it is distributed:

- **Standalone variant** (skills shipped via `save_skill`): read + execute both route device-side to `~/.claude/skills/<name>/…`.
- **Plugin variant** (skills shipped inside a plugin): read via `PLUGIN_ROOT/<path>`; execute device-side (Cowork has no Bash). Never assume a relative `scripts/…` path executes in the cloud.

If the device bridge is unavailable, say so and fall back to the inline instructions — never silently fail. `create-fragment` emits the correct variant automatically for scaffolded skills.

## Development Workflow

### Claude Code

```bash
claude --plugin-dir ./my-plugin    # Test locally
/reload-plugins                     # Hot-reload changes
claude plugin validate .            # Check for errors (path required)

# Channel testing (research preview — custom channels require this flag)
claude --dangerously-load-development-channels plugin:name@marketplace
```

**MANDATORY: Always run `claude plugin validate .` after generating or modifying a plugin.** This catches schema errors in plugin.json, marketplace.json, frontmatter, and hooks.json that will silently prevent the plugin from loading. Do not consider a plugin complete until validation passes clean. Validation is authoritative for both Claude Code and Cowork since the schema is shared.

CLI: `claude plugin install|uninstall|enable|disable|update <plugin> [--scope user|project|local]`

### Cowork

Cowork users install and manage plugins through the **Customize** menu in the Cowork sidebar — there is no equivalent CLI surface. For authoring, Cowork ships a built-in **Plugin Create** plugin that walks users through scaffolding. When shipping the same plugin to both surfaces, author with `claude --plugin-dir` for fast iteration, then test the Cowork-visible components (skills + MCP servers) through the Customize install flow.

## Token Optimization

Every plugin should minimize token waste and maximize output quality. Apply these principles during design and audit:

- **Progressive disclosure**: SKILL.md under 800 tokens by default, with detailed rules in separate files loaded on demand. Exceed this **only with concrete evidence** that most invocations need the full content, or that inlining prevents recurring configuration errors. Reliability beats ceremony — but the default is discipline.
- **Hook efficiency**: Default to `command` type (zero LLM cost). Use `prompt`/`agent` only when semantic judgment is genuinely required.
- **Agent budgets**: Set `maxTurns` as genuine budgets (haiku 5-8, sonnet 12-18, opus 12-15). Restrict tools via `disallowedTools`.
- **State on disk**: Agents re-read structured state files before acting. Don't trust conversational memory past 10+ turns.
- **Compaction survival**: Use `PreCompact`/`PostCompact` hooks to preserve critical state. Consider observational context patterns for long sessions.

For the full research and patterns: [references/token-optimization-research.md](./references/token-optimization-research.md)


## Folder Architecture: The Routing-Table Pattern (Project-Level Context)

When users install plugins into a project, the project's CLAUDE.md decides which skills get used and when. A well-formed plugin makes that routing decision easy. The pattern at the project level:

**Layer 1 — The Map (CLAUDE.md)**: identity + folder structure + naming conventions + a **routing table** that names, for each task type, the files to read and the skills to use. Replaces both "read everything just in case" (token-expensive) and "guess what's relevant" (wrong-output-expensive) with a deterministic load list.

**Layer 2 — The Rooms (per-workspace context files)**: each workspace folder gets its own CONTEXT.md (or directory-scoped CLAUDE.md) describing what that room is for, its process, and which skills are wired into it. Loads only when the routing table names it.

**Layer 3 — The Tools (skills + MCP servers)**: wired per-room via the routing table, not preloaded globally. The same progressive-disclosure principle that governs SKILL.md ([token-optimization-research.md §3](./references/token-optimization-research.md#3-progressive-disclosure-the-highest-leverage-fix)).

**Plugin implication:** the plugin doesn't ship a CLAUDE.md — projects do. The plugin's job is to make its skills cleanly **routable**: precise description: frontmatter so a routing table can name the skill confidently, tight SKILL.md bodies so loading the skill doesn't blow the budget, and on-demand references so the skill itself does progressive disclosure inside it. Consider shipping example CLAUDE.md snippets in examples/ that show how to route to the plugin's skills.

For the four-leaks audit framing, full routing-table syntax, room-file examples, and naming-convention patterns: [references/folder-architecture-routing.md](./references/folder-architecture-routing.md).

## Model Configuration (Claude Code current model line)

As of September 2026, all five tiers are enabled — four for routine routing, plus Fable 5.1 as a HITL-gated escalation:

| Tier | Frontmatter | When to reach for it |
|---|---|---|
| **Opus 5** | `model: opus` | Deep analysis, planning, critical reasoning — the **routine ceiling** for all standard work (`opus`/`best` now resolve here; the flip has landed) |
| **Opus 4.8** | `model: opus48` | Legacy, kept explicitly reachable for A/B eval and reproducible pins — not a routing target |
| **Sonnet 5** | `model: sonnet` | General work, implementation, pattern-finding — now **$2 / $10**, a 33% cut vs Sonnet 4.6 |
| **Haiku 4.5** | `model: haiku` | Fast lookups, locators, mechanical commands — the only tier with **no** effort support |
| **Fable 5.1** | `model: claude-fable-5-1` | **Gated escalation only** — enabled under Max subscription, but reached via the HITL gate, never a resting agent default (see below) |

> ⚠️ **Fable 5.1 is enabled but HITL-gated — never a resting default.** It is reachable under the Max/Team Premium subscription, but every use passes a human-in-the-loop gate (`.prism/local/fable.flag` + a confirm/deny modal in the app, and the `fable-gate.sh` PreToolUse hook on Task dispatches). No agent or skill sets `model: claude-fable-5-1` as a resting default, and nothing in routing auto-escalates to it — it is a deliberate, confirmed escalation. Opus 5 stays the routine ceiling. Fable has **no alias** (always pin the full ID), a different API surface (always-on thinking, `refusal` stop reason, current tokenizer, 30-day retention) — read [references/model-config.md §5](./references/model-config.md) first — and draws on a *capped weekly Max allowance* (≈2.6× Opus 5 if metered on the API), which is exactly what the gate protects. The gate must match Fable IDs by **prefix**, not exact string, or a point release like `claude-fable-5-1` slips through ungated.

For the Opus/Sonnet/Haiku aliases: from Claude 4.6 onward, dateless IDs like `claude-opus-5` are **pinned snapshots**, not evergreen aliases — use the alias form (`model: opus`) for auto-updates, the full ID for pinning. Haiku is the only current tier that still has real alias→dated-snapshot indirection. **Keep the two `opus` namespaces distinct:** policy keys are `fable5` / `opus5` / `opus48` (no bare `opus`); SDK aliases keep `opus` → Opus 5.

Effort levels: `low`, `medium`, `high`, `xhigh`, `max` on Fable 5.1, Opus 5, Opus 4.8, and **Sonnet 5** (`xhigh` is new in Sonnet 5). **Haiku 4.5 supports none.** Default is `high` everywhere it is supported — but `high` is **not comparable across models**; Anthropic re-allocated the tokens behind each label, so re-sweep rather than porting a setting between tiers. On **Opus 5**, `low`/`medium` are strong enough for most routine dispatch — lower the effort dial for cost rather than dropping to a weaker tier, and keep thinking ON. Note that effort no longer reliably shortens *visible* output on Opus 5 — prompt explicitly for concision as a second lever. Reserve `max` for one-shot critical work (it's session-only). On Opus 5, `effort: xhigh|max` triggers a **one-shot confirm** — a per-call effort guard (headless-aware, always emits a visibility event), categorically **not** a Fable-style model gate; Opus 5 has no gate and no flag. The `ultrathink` keyword anywhere in a prompt triggers deeper reasoning on a single turn without changing session effort.

Every current tier except Haiku 4.5 ships a **native 1M context window**, so the `[1m]` suffix is now a no-op on this line — it only matters when pinning an older model that gated 1M behind it (e.g. `claude-sonnet-4-6[1m]`).

⚠️ **Thinking is ON by default on Opus 5** where Opus 4.8 defaulted to off. Thinking tokens bill as output *and* count against `max_tokens` — a workload tuned for a no-thinking baseline can now **truncate**, not merely cost more. Re-baseline `max_tokens` before flipping anything to Opus 5.

**Fable 5.1 requires Claude Code v2.1.257+. Opus 5 requires v2.1.219+. Sonnet 5 requires v2.1.197+.** Run `claude update` before relying on any of them.

For the full per-provider alias resolution table, dateless-snapshot rule, effort-level matrix, Fable 5.1 API differences, the Mythos 5.1 non-routable note, currency-check protocol, and provider-specific env-var pins: [references/model-config.md](./references/model-config.md).
## Harness Architecture (load when building composed systems)

When building or optimizing a **harness** — a composed system of skills + agents + hooks + modes + workspaces + tool policies — load [references/component-patterns.md § Harness Architecture](./references/component-patterns.md) for the full architectural framework and observation hook patterns.

## Examples

- Minimal plugin: [examples/minimal-plugin.md](./examples/minimal-plugin.md)
- Standard plugin: [examples/standard-plugin.md](./examples/standard-plugin.md)
- Advanced plugin: [examples/advanced-plugin.md](./examples/advanced-plugin.md)

