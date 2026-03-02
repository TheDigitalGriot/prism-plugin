---
title: Plugin Overview
description: The Prism Claude Code plugin — pure markdown-based prompt engineering that extends Claude Code with structured 4-phase workflows.
outline: [2, 3]
---

# Part I — Claude Plugin Architecture (Prompt Engineering)

The Prism Claude Code plugin is the foundation that underpins every platform — the CLI dashboard, VS Code extension, and Electron app all exist to visualize and control workflows that the plugin defines. The plugin itself is **pure markdown-based prompt engineering** with zero build step. It extends Claude Code with structured workflows, specialized agents, and orchestration skills that transform raw AI capability into a disciplined development methodology.

## Plugin Overview

The Prism plugin registers with Claude Code through a conventional directory layout that is automatically discovered at startup. It provides:

- **25 commands** — User-invocable operations via `/command-name` (3,729 lines)
- **10 agents** — Specialized subprocesses spawned via `Task(subagent_type="agent-name")` (1,365 lines)
- **11 skills** — Auto-activating workflow orchestrators with trigger patterns (1,823 lines)
- **4 scripts** — Shell and Python automation (947 lines)
- **No hooks or MCP servers** — The plugin relies entirely on prompt engineering, not runtime hooks

## What Makes It Different

Unlike traditional software plugins that extend functionality through code, Prism extends Claude Code's behavior through carefully structured natural language instructions. Each `.md` file is a prompt that shapes how Claude approaches a task — what agents to spawn, what questions to ask, what output format to use, and what behavioral constraints to follow. The prompt engineering is the product.
