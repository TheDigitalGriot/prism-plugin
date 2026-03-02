---
title: Plugin Skill Integration
description: ModeBridge, PluginBridge, and skill detection flow for routing chat messages to CLI plugin skills.
outline: [2, 3]
---

# Plugin Skill Integration

## ModeBridge

Detects when user messages reference Prism plugin skills and switches from SDK chat mode to CLI plugin mode:

| Chat Mode | Description |
|-----------|-------------|
| `sdk` | Direct Claude Agent SDK chat (default) |
| `plugin` | CLI-based skill execution (auto-detected or manual) |

## PluginBridge

Routes skill invocations to the Claude CLI:

| Skill Name | CLI Command |
|------------|-------------|
| `prism-research` | `/prism-research` |
| `prism-plan` | `/prism-plan` |
| `prism-implement` | `/prism-implement` |
| `prism-validate` | `/prism-validate` |
| `commit` | `/commit` |
| `decompose_plan` | `/decompose_plan` |
| `create_handoff` | `/create_handoff` |
| `describe_pr` | `/describe_pr` |

## Skill Detection Flow

```
User types message in chat
    │
    ▼
ModeBridge.detectSkillTrigger(message)
    │
    ├── No match → SDK chat mode (Claude Agent SDK)
    │
    └── Match found → Switch to plugin mode
        │
        ▼
    PluginBridge.executeSkill(skillName)
        │
        ▼
    ClaudeRunner.spawn("claude ... /skill-name")
        │
        ▼
    OutputParser → stream tools + signals to UI
```
