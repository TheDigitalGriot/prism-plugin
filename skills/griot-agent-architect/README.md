# Plugin Structure Skill

Guidance on Claude Code plugin architecture, directory layout, and best practices.

**Version:** 0.4.0

## Files

### SKILL.md (~800 tokens at activation)

Lean router covering directory structure, component table, agent frontmatter, hook config, portable paths, and development workflow. Links to references and examples on demand.

### References (loaded when deeper detail needed)

- [manifest-reference.md](references/manifest-reference.md) — Complete plugin.json field reference, userConfig, channels, path resolution, validation
- [component-patterns.md](references/component-patterns.md) — Organization patterns for all component types, lifecycle, cross-component patterns, harness architecture, channel integration
- [hook-events.md](references/hook-events.md) — All 25+ lifecycle events, 4 hook types with examples, efficiency patterns, channel-related hook events
- [channel-patterns.md](references/channel-patterns.md) — Channel architecture, 3 capability tiers, server implementation, notification format, reply tools, permission relay protocol, security (sender gating, pairing flows), development/testing workflow

### Theory & Research

- [token-optimization-research.md](references/token-optimization-research.md) — Context engineering research: context rot, autoresearch patterns, attention residuals, observational memory, progressive disclosure, hook efficiency, agent design, compaction survival, audit checklist

### Examples (loaded when building a specific plugin)

- [minimal-plugin.md](examples/minimal-plugin.md) — Simplest possible plugin (single skill, bare manifest)
- [standard-plugin.md](examples/standard-plugin.md) — Production plugin with agents, skills, hooks, proper frontmatter
- [advanced-plugin.md](examples/advanced-plugin.md) — Enterprise-grade: MCP/LSP servers, userConfig, channels, all 4 hook types, persistent data

## Progressive Disclosure

1. **Discovery** (~80 tokens): Frontmatter `name` + `description` matched against task context
2. **Activation** (~800 tokens): SKILL.md body loaded — component table, agent template, hook config, paths, dev workflow
3. **Execution** (on demand): References and examples loaded individually via file path links

## Maintenance

1. Keep SKILL.md under 1,000 tokens — it loads on every activation
2. Move detailed content to references/
3. Validate examples against current Claude Code plugin API
4. Update version in SKILL.md frontmatter
5. Cross-reference against official docs at code.claude.com/docs/en/plugins-reference and code.claude.com/docs/en/channels-reference
