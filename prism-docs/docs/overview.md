---
title: Overview
description: Prism ships as three complementary interfaces for the same 4-phase workflow (Research → Plan → Implement → Validate).
outline: [2, 3]
---

# Overview

Prism ships as three complementary interfaces for the same 4-phase workflow (Research → Plan → Implement → Validate):

| Interface | Location | Tech Stack | Best For |
|-----------|----------|------------|----------|
| **CLI Dashboard** | `apps/prism-cli/` | Go 1.23, Bubble Tea, FauxGL | Terminal-native, full-screen TUI, Spectrum execution |
| **VS Code Extension** | `apps/prism-vscode/` | TypeScript, React 18, Vite | IDE-integrated, chat-driven, visual office & monitor |
| **Electron Desktop App** | `apps/prism-electron/` | TypeScript, React 19, Electron 40, Vite | Standalone desktop app, IDE-independent, native menus |

All three share the same `.prism/` directory structure, `stories.json` schema, signal protocol, and Claude CLI integration. They can be used independently or side-by-side. The Electron app shares all business logic, React UI components, and the gRPC-over-postMessage protocol with the VS Code extension via a proper npm monorepo with `packages/prism-core` and `packages/prism-ui` shared packages (see [Part V — Monorepo Architecture](/monorepo/)).
