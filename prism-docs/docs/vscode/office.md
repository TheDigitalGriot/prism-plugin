---
title: Office Visualization
description: Pixel-art office visualization — components, agent states, and lifecycle.
outline: [2, 3]
---

# Office Visualization

The Office view provides a pixel-art visualization of AI agents working in a virtual office.

## Components

| Component | File | Description |
|-----------|------|-------------|
| Office Canvas | `OfficeCanvas.tsx` | Main 2D Canvas renderer with game loop |
| Engine | `engine/` | Game loop tick, character animation, matrix effects |
| Sprites | `sprites/` | Character sprite sheets, PNG decoding, animation frames |
| Layout | `layout/` | Furniture catalog, tile mapping, serialization |
| Editor | `office/editor/` | Interactive furniture placement editor |

## Agent States

| State | Icon | Description |
|-------|------|-------------|
| Active | `●` | Currently executing tool calls |
| Thinking | `◉` | Claude is generating response |
| Waiting | `○` | Idle, waiting for next task |
| Paused | `⏸` | Execution paused |

## Agent Lifecycle

1. Spectrum starts a story iteration → `AgentBridge` creates agent
2. Agent character appears in Office at assigned desk
3. Agent status updates in real-time as tools execute
4. Story completes → agent transitions to "done" state
5. Next iteration → new agent or reuse existing
