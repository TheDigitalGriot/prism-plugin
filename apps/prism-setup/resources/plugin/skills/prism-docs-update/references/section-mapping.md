# Section Mapping: Monolithic Doc → VitePress Pages

This maps sections in `PRISM-DOCUMENTATION-[version].md` to their corresponding VitePress page files in `prism-docs/docs/`.

## Part I — Claude Plugin Architecture

| Doc Section Heading | VitePress Page |
|---|---|
| `## Plugin Overview` | `plugin/index.md` |
| `## Plugin Manifest & Distribution` | `plugin/manifest.md` |
| `## Three-Layer Architecture` | `plugin/architecture.md` |
| `## Commands Reference` | `plugin/commands.md` |
| `## Agents Reference` | `plugin/agents.md` |
| `## Skills Reference` | `plugin/skills.md` |
| `## Scripts & Automation` | `plugin/scripts.md` |
| `## Model Assignment Convention` | `plugin/model-assignment.md` |
| `## Component Invocation Graph` | `plugin/invocation-graph.md` |
| `## Data Flow Through .prism/` | `plugin/data-flow.md` |
| `## Behavioral Principles` | `plugin/behavioral-principles.md` |
| `## Plugin Directory Structure` | `plugin/directory-structure.md` |
| `## Plugin Statistics` | `plugin/statistics.md` |

## Part II — CLI Dashboard

| Doc Section Heading | VitePress Page |
|---|---|
| `## Overview` (Part II) | `cli/index.md` |
| `## Architecture` (Part II) | `cli/architecture.md` |
| `## Getting Started` | `cli/getting-started.md` |
| `## Plugin System` | `cli/plugin-system.md` |
| `### 1. Splash Screen` | `cli/screens/splash.md` |
| `### 2. Onboarding Screen` | `cli/screens/onboarding.md` |
| `### 3. Home Screen` | `cli/screens/home.md` |
| `### 4. Research Screen` | `cli/screens/research.md` |
| `### 5. Plans Screen` | `cli/screens/plans.md` |
| `### 6. Spectrum Execution Dashboard` | `cli/screens/spectrum.md` |
| `### 7. Files Screen` | `cli/screens/files.md` |
| `### 8. Git Screen` | `cli/screens/git.md` |
| `### 9. Agent Screen` | `cli/screens/agent.md` |
| `### 10. Monitor Screen` | `cli/screens/monitor.md` |
| `### 11. Browser Screen` | *(no dedicated page yet — create if needed)* |
| `### 12. Workspaces Screen` | `cli/screens/workspaces.md` |
| `## App Shell` | `cli/app-shell.md` |
| `## Modal & Dialog Systems` | `cli/modals.md` |
| `## User Flow Diagrams` | `cli/user-flows.md` |
| `### Within-Screen Workflows` | `cli/user-flows.md` (appended) |
| `## Execution State Machine` | `cli/state-machine.md` |
| `## Animation System` | `cli/animation.md` |
| `## 3D Prism Rendering Pipeline` | `cli/3d-rendering.md` |
| `## Splash Screen Rendering Pipeline` | `cli/splash-rendering.md` |
| `## Domain Models` | `cli/domain-models.md` |
| `## Claude CLI Integration` | `cli/claude-integration.md` |
| `## Terminal Detection` | `cli/terminal-detection.md` |
| `## Diff System` | `cli/diff-system.md` |
| `## File Watcher, State & Registry` | `cli/file-watcher.md` |
| `## Keyboard Reference` | `cli/keyboard.md` |
| `## Styling Reference` | `cli/styling.md` |
| `## Vertical Layout & Height Budget` | `cli/layout.md` |
| `## Configuration` | `cli/configuration.md` |

## Part III — VS Code Extension

| Doc Section Heading | VitePress Page |
|---|---|
| `## VS Code Extension Overview` | `vscode/index.md` |
| `## Extension Architecture` | `vscode/architecture.md` |
| `## Extension Source Structure` | `vscode/source-structure.md` |
| `## Core Orchestrator — PrismController` | `vscode/controller.md` |
| `## IPC Architecture — gRPC-over-postMessage` | `vscode/ipc.md` |
| `## Sidebar Webview` | `vscode/sidebar.md` |
| `## Bottom Panel Webview` | `vscode/bottom-panel.md` |
| `## Native Tree Views & Status Bar` | `vscode/tree-views.md` |
| `## Commands & Keybindings` | `vscode/commands.md` |
| `## Extension Settings` | `vscode/settings.md` |
| `## Workflow State Machine (VS Code)` | `vscode/state-machine.md` |
| `## Spectrum Execution (VS Code)` | `vscode/spectrum.md` |
| `## Plugin Skill Integration` | `vscode/plugin-skills.md` |
| `## Office Visualization` | `vscode/office.md` |
| `## Extension Technology Stack` | `vscode/tech-stack.md` |

## Part IV — Electron Desktop App

| Doc Section Heading | VitePress Page |
|---|---|
| `## Electron App Overview` | `electron/index.md` |
| `## Electron Architecture` | `electron/architecture.md` |
| `## Electron Source Structure` | `electron/source-structure.md` |
| `## Main Process & Window Management` | `electron/main-process.md` |
| `## Preload & Context Bridge` | `electron/preload.md` |
| `## IPC Bridge — Electron Transport` | `electron/ipc-bridge.md` |
| `## ElectronPrismController` | `electron/controller.md` |
| `## Platform Modules (Electron)` | `electron/platform-modules.md` |
| `## Webview UI — React SPA` | `electron/webview-ui.md` |
| `## State Management (Electron)` | `electron/state-management.md` |
| `## Build & Packaging` | `electron/build.md` |
| `## Security Hardening` | `electron/security.md` |
| `## Three-Platform Feature Parity` | `electron/feature-parity.md` |

## Part V — Monorepo Architecture

| Doc Section Heading | VitePress Page |
|---|---|
| `## Repository Structure` | `monorepo/index.md` |
| `## npm Workspaces` | `monorepo/workspaces.md` |
| `## packages/prism-core` | `monorepo/prism-core.md` |
| `## packages/prism-ui` | `monorepo/prism-ui.md` |
| `## Platform Shell Responsibilities` | `monorepo/platform-shells.md` |
| `## Development Workflow` | `monorepo/dev-workflow.md` |
| `## Production Hardening` | `monorepo/production-hardening.md` |

## VitePress Frontmatter Template

When creating new pages, use this frontmatter:

```yaml
---
title: [Page Title]
description: [One-line description for SEO and navigation]
outline: [2, 3]
---
```

## VitePress Config

The sidebar navigation is defined in `prism-docs/docs/.vitepress/config.ts`. When adding new pages, add entries to the appropriate sidebar section.

## Content Conventions

- Each VitePress page corresponds to one `##`-level section from the monolithic doc
- Sub-sections (`###`, `####`) become headings within the page
- ASCII art code blocks must use triple backticks with no language identifier
- Tables, key binding references, and feature tables are preserved as-is
- Cross-references between pages use VitePress relative links: `[text](/cli/screens/research)`
