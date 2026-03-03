---
title: Agent Screen
description: Chat interface with conversation history browsing, message rendering, and the multi-adapter Claude session scanner.
outline: [2, 3]
---

# Agent Screen

A chat interface with conversation history browsing, message rendering, and text input. Uses the **adapter system** (`app/adapter/`) to scan AI agent conversation files from disk. Supports wide mode (sidebar + chat) and compact mode (chat only).

## Adapter System

The Agent screen uses a pluggable `Adapter` interface to discover conversation sessions:

| Adapter | ID | Data Source | Format |
|---------|----|-------------|--------|
| `ClaudeAdapter` | `"claude"` | `~/.claude/projects/` | `.jsonl` per session |

Each adapter implements: `ID()`, `Name()`, `Available()`, `ScanSessions()`, `LoadMessages(path)`.

**Session** metadata includes: ID, Title (first user message excerpt), Path, ProjectPath, CreatedAt, UpdatedAt, MessageCount, TokenCount, Model.

The sidebar groups sessions by date (Today, Yesterday, This Week, etc.). `ClaudeAdapter.decodeProjectPath()` converts Claude's directory encoding (`c--Users-digit-Developer-prism-plugin`) back to filesystem paths.

**Message rendering** (`chat/renderer.go`) supports:
- **User messages**: `"> "` prompt prefix with blue styling
- **Assistant messages**: Left accent bar (`▎`) with dark background, Glamour markdown rendering
- **Tool messages**: Compact single-line status (▸ running, ✓ complete, ✗ error)

## UI Layout — Wide Mode

```
╭──────── 1/3 ────────╮╭─────────────── 2/3 ──────────────────────────────────╮
│ CONVERSATIONS        ││                                                       │
│ ────────────────    ││   How do I implement authentication?                  │
│ ── Today ─────────  ││                          ┌──────────────────────────┐ │
│ > Fix auth bug       ││                          │ ▎ Use OAuth2 + JWT.     │ │
│   Add dark mode      ││                          │ ▎ Here's the approach:  │ │
│ ── Yesterday ─────  ││                          │ ▎ ...                   │ │
│   Refactor API       ││                          └──────────────────────────┘ │
│                      ││ ┌──────────────────────────────────────────────────┐  │
│                      ││ │ Type a message... (Ctrl+Enter to send)          │  │
│                      ││ └──────────────────────────────────────────────────┘  │
╰──────────────────────╯╰──────────────────────────────────────────────────────╯
```

## UI Layout — Compact Mode

When `WideMode == false` or terminal width < 60 columns, the sidebar is hidden and the chat fills the full width:

```
╭──────────────────────────────────────────────────────────────────────────────╮
│                                                                              │
│   How do I implement authentication?                                        │
│                          ┌──────────────────────────────────────────────┐    │
│                          │ ▎ Use OAuth2 + JWT. Here's the approach:    │    │
│                          │ ▎                                           │    │
│                          │ ▎ 1. Set up passport.js middleware          │    │
│                          │ ▎ 2. Configure JWT token signing            │    │
│                          │ ▎ 3. Add refresh token rotation             │    │
│                          └──────────────────────────────────────────────┘    │
│                                                                              │
│ ┌──────────────────────────────────────────────────────────────────────────┐ │
│ │ Type a message... (Ctrl+Enter to send)                                  │ │
│ └──────────────────────────────────────────────────────────────────────────┘ │
╰──────────────────────────────────────────────────────────────────────────────╯
```

## UI Layout — Analytics View

Toggle with `a`. In wide mode, the analytics panel replaces the chat pane (sidebar stays visible):

```
╭──────── 1/3 ────────╮╭─────────────── 2/3 ──────────────────────────────────╮
│ CONVERSATIONS        ││ Usage Analytics                                      │
│ ────────────────    ││ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
│ ── Today ─────────  ││ 12 sessions  |  1,247 messages  |  Feb 4 - Feb 28   │
│ > Fix auth bug       ││                                                      │
│   Add dark mode      ││ Model Usage                                          │
│ ── Yesterday ─────  ││ ──────────────────────────────────────────────────   │
│   Refactor API       ││ Opus     ████████████████████░░░░  847,231 tokens    │
│                      ││ Sonnet   ████████████░░░░░░░░░░░░  512,108 tokens    │
│                      ││ Haiku    ████░░░░░░░░░░░░░░░░░░░░  128,450 tokens    │
│                      ││                                                      │
│                      ││ Estimated Cost                                       │
│                      ││ ──────────────────────────────────────────────────   │
│                      ││ Opus:   $31.78   Sonnet: $3.84   Haiku: $0.05       │
│                      ││ Total:  $35.67                                       │
╰──────────────────────╯╰──────────────────────────────────────────────────────╯
```

### Analytics Pricing

| Model | Input Cost | Output Cost | Per |
|-------|-----------|-------------|-----|
| Opus | $15.00 | $75.00 | 1M tokens |
| Sonnet | $3.00 | $15.00 | 1M tokens |
| Haiku | $0.25 | $1.25 | 1M tokens |

## Key Bindings

| Key | Action |
|-----|--------|
| `Ctrl+B` | Toggle wide/compact mode |
| `Ctrl+Enter` | Send message |
| `j` / `k` | Navigate conversations (sidebar) or scroll messages (chat) |
| `Enter` | Load selected conversation |
| `m` | Toggle Glamour/lite markdown rendering |
| `a` | Toggle analytics view |
| `Tab` | Toggle sidebar ↔ input focus |
| `Esc` / `Backspace` | Focus Home |
