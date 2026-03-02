---
title: Sidebar Webview
description: React-based sidebar webview — Chat, Spectrum, and Welcome views with streaming Claude chat.
outline: [2, 3]
---

# Sidebar Webview

Built with React 18 + Vite + Tailwind CSS. Provides the primary interaction surface in the activity bar.

## Views

| View | Component | Description |
|------|-----------|-------------|
| **Chat** | `ChatView.tsx` | Streaming Claude chat with phase-aware system prompts, tool visualization, markdown rendering |
| **Spectrum** | `SpectrumView.tsx` | Real-time dashboard with story progress, activity feed, logs, start/pause/stop controls |
| **Welcome** | `WelcomeView.tsx` | First-time onboarding when `.prism/` is not detected |

## Chat View Features

- Streaming assistant responses with typing indicator
- Tool call visualization (Read, Edit, Write, Bash, Glob, Grep, etc.)
- Phase indicator with spectral glow effect
- Markdown rendering with syntax highlighting
- Tool approval flow for pending permissions
- Automatic skill detection in user messages (routes to CLI)

## Spectrum View Features

- Story list with color-coded status badges (complete/active/pending/blocked)
- Progress bar with percentage
- Real-time activity feed (last 50 tool calls)
- Log output (last 200 entries)
- Start/Pause/Resume/Stop controls
- Iteration counter and elapsed time
