---
title: Three-Layer Architecture
description: The plugin follows a strict three-layer architecture — Skills orchestrate, Commands operate, Agents specialize.
outline: [2, 3]
---

# Three-Layer Architecture

The plugin follows a strict three-layer architecture where each layer has a distinct responsibility:

```
+---------------------------------------------------------------------+
|                      USER / CLAUDE CODE                             |
|  Types "/prism-research" or Claude auto-detects task context        |
+----------------------------+----------------------------------------+
                             |
                             v
+---------------------------------------------------------------------+
|  Layer 1: SKILLS  (skills/*/SKILL.md)                               |
|                                                                     |
|  Workflow orchestrators with YAML frontmatter.                      |
|  Auto-activated by trigger patterns or invoked via /skill-name.     |
|  They decide WHAT to do: which commands to invoke, which agents     |
|  to spawn, and in what order.                                       |
|                                                                     |
|  Examples: prism, prism-research, prism-plan, prism-spectrum        |
+----------------------------+----------------------------------------+
                             |
              +--------------+--------------+
              |                             |
              v                             v
+------------------------------+  +----------------------------------+
|  Layer 2: COMMANDS           |  |  Layer 3: AGENTS                 |
|  (commands/*.md)             |  |  (agents/*.md)                   |
|                              |  |                                  |
|  Single-purpose operations.  |  |  Parallel specialists.           |
|  User-invocable via          |  |  Spawned via Task() with         |
|  /command-name.              |  |  subagent_type="agent-name".     |
|  They know HOW to do one     |  |  Run concurrently to maximize    |
|  thing well.                 |  |  throughput. Each has a model     |
|                              |  |  assignment and tool set.         |
|  Examples:                   |  |                                  |
|  /create_plan                |  |  Examples:                       |
|  /commit                     |  |  codebase-locator (haiku)        |
|  /generate_prd               |  |  codebase-analyzer (opus)        |
|  /decompose_plan             |  |  web-search-researcher (sonnet)  |
+------------------------------+  +----------------------------------+
```

**Key principle**: Skills orchestrate, commands operate, agents specialize. A skill never does the work itself — it delegates to commands and agents. Commands may also spawn agents for parallel research.
