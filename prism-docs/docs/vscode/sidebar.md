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

## Webview Loading (v3.7.0)

The webview HTML resolves dev-vs-production at view-resolve time: in development it can load from the Vite HMR dev server; in production it loads the built bundle from `webview-ui/build/`.

As of **v3.7.0** the provider **probes the advertised dev-server port for liveness** before choosing HMR — a stale `.vite-port` left by a dead `vite dev` no longer routes the webview at a dead `localhost` (which previously rendered the sidebar blank). A dead or absent port falls back to the production build. Shared helper `src/hosts/vscode/viteDevServer.ts` (`resolveLiveViteServer`) backs the sidebar, bottom-panel, and Office providers; base `WebviewProvider.getHtmlContent` is `string | Promise<string>`.

::: tip Engine floor
The extension declares `engines.vscode: ^1.84.0` so it loads on Cursor and other editors whose VS Code base predates the latest stable. (`^1.109.0` previously excluded it — the editor silently skipped loading, leaving the sidebar and panel absent.)
:::
