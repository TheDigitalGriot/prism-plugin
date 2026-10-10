---
name: cl-plugin-structure
description: DEPRECATED ALIAS — renamed to griot-agent-architect. Use when creating, scaffolding, structuring, or validating plugins for Claude Code or Claude Cowork. Covers the .claude-plugin/plugin.json + marketplace manifest, component organization (agents, skills, slash commands, hooks, MCP/LSP servers, channels), agent/command/hook frontmatter, the .local.md per-project settings pattern, portable paths, surface compatibility, bundled validator scripts, and development workflow. Use this whenever the user mentions building a plugin, a skill, a slash command, a hook, an MCP server, a marketplace, or asks about plugin.json/SKILL.md structure — even if they don't say "plugin" explicitly. Prefer griot-agent-architect; this name is kept so existing invocations, docs, and muscle memory keep resolving.
version: 0.8.0
---

# cl-plugin-structure → griot-agent-architect (deprecation alias)

**This skill was renamed. The canonical skill is [`griot-agent-architect`](../griot-agent-architect/SKILL.md).**

`cl-plugin-structure` still resolves — every existing invocation (`/prism:cl-plugin-structure`),
document reference, and habit keeps working. Nothing was deleted. This file is a thin pointer so
the old name never breaks.

## What to do

**Read [`../griot-agent-architect/SKILL.md`](../griot-agent-architect/SKILL.md) now and follow it.**
That file carries the full standard; this one carries nothing but the redirect.

Everything lives under the new name:

| You want | Path |
|---|---|
| The standard itself | `../griot-agent-architect/SKILL.md` |
| Manifest reference | `../griot-agent-architect/references/manifest-reference.md` |
| Component patterns | `../griot-agent-architect/references/component-patterns.md` |
| Command patterns | `../griot-agent-architect/references/command-patterns.md` |
| Channel patterns | `../griot-agent-architect/references/channel-patterns.md` |
| Hook events | `../griot-agent-architect/references/hook-events.md` |
| MCP patterns | `../griot-agent-architect/references/mcp-patterns.md` |
| Model config | `../griot-agent-architect/references/model-config.md` |
| Cowork compatibility | `../griot-agent-architect/references/cowork-compatibility.md` |
| Folder-architecture routing | `../griot-agent-architect/references/folder-architecture-routing.md` |
| `.local.md` settings pattern | `../griot-agent-architect/references/settings-local-md.md` |
| Statusline model | `../griot-agent-architect/references/statusline-model.md` |
| Token-optimization research | `../griot-agent-architect/references/token-optimization-research.md` |
| Validator scripts | `../griot-agent-architect/scripts/` |
| Examples (minimal / standard / advanced) | `../griot-agent-architect/examples/` |

## Why the rename

`cl-plugin-structure` described a file layout. The skill outgrew that: it is the Griot suite's
gold standard for **agent architecture** across surfaces — plugins, skills, commands, hooks, MCP
servers, channels, model routing, and multi-agent systems. `griot-agent-architect` names what it
actually does.

The rename was **additive**. Both names resolve; the old one is not going away.
