---
title: Plugin Manifest & Distribution
description: How the Prism plugin registers with Claude Code and distributes via GitHub.
outline: [2, 3]
---

# Plugin Manifest & Distribution

## `.claude-plugin/plugin.json`

```json
{
  "name": "prism",
  "description": "Structured 4-phase development workflow (Research -> Plan -> Implement -> Validate) with Spectrum-style iterative execution with TUI",
  "version": "2.3.0",
  "author": { "name": "Prism Team" }
}
```

## `.claude-plugin/marketplace.json`

```json
{
  "name": "prism-marketplace",
  "owner": { "name": "Prism Team" },
  "plugins": [{
    "name": "prism",
    "source": { "source": "github", "repo": "TheDigitalGriot/prism-plugin" },
    "description": "Structured 4-phase development workflow (Research -> Plan -> Implement -> Validate)",
    "version": "2.3.0"
  }]
}
```

| Field | Value |
|-------|-------|
| Plugin Name | `prism` |
| Version | 2.3.0 |
| Distribution | GitHub: `TheDigitalGriot/prism-plugin` |
| Build Step | None — pure markdown prompt engineering |
| Auto-Discovery | Claude Code scans `commands/`, `agents/`, `skills/*/SKILL.md` on enable |
