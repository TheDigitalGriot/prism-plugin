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

## Key Bindings

| Key | Action |
|-----|--------|
| `Ctrl+B` | Toggle wide/compact mode |
| `Ctrl+Enter` | Send message |
| `j` / `k` | Navigate conversations (sidebar) or scroll messages (chat) |
| `Enter` | Load selected conversation |
| `Esc` / `Backspace` | Focus Home |
