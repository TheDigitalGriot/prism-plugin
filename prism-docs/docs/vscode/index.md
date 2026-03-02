---
title: VS Code Extension Overview
description: The Prism VS Code Extension — sidebar chat, Spectrum execution, native tree views, Office visualization, and plugin skill routing.
outline: [2, 3]
---

# VS Code Extension Overview

The Prism VS Code Extension (`cmd/prism-vscode/`) brings the full 4-phase workflow directly into the IDE. It provides a sidebar chat interface, tree views for research/plans/stories, Spectrum autonomous execution, an Office pixel-art visualization, a Monitor dashboard, and Workspaces management — all without leaving VS Code.

## Key Features

- **Sidebar chat**: Interactive Claude chat with streaming tool visualization, phase-aware system prompts
- **Spectrum execution**: Autonomous story execution with real-time progress, logs, and signal handling
- **Native tree views**: Research, Plans, and Stories tree providers in the activity bar with context menus
- **Bottom panel**: Three-view system (Monitor, Office, Workspaces) in a unified panel
- **Office visualization**: Pixel-art office with animated agent characters, furniture placement editor
- **Plugin skill routing**: Seamless bridging between SDK chat and CLI plugin skills (`/prism-research`, `/prism-plan`, etc.)
- **Workflow state machine**: Validated phase transitions (Idle → Research → Plan → Implement → Validate)
- **Status bar integration**: Workflow phase, story progress, and Spectrum status indicators
- **33 commands**: Workflow phases, Spectrum control, tree operations, Office/Monitor actions
- **7 configurable settings**: Model selection, Spectrum parameters, auto-approval options

## Extension Metadata

| Field | Value |
|-------|-------|
| Name | Prism |
| Version | 2.3.0 |
| Publisher | prism |
| Categories | AI, Programming Languages, Other |
| Min VS Code | 1.84.0 |
| Activation | `onView:prism.sidebar`, `onStartupFinished` |
| Entry Point | `./dist/extension.js` |
