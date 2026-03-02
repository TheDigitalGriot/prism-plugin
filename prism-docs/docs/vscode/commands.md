---
title: Commands & Keybindings
description: All 33 VS Code commands — workflow phases, Spectrum control, tree operations, Office/Monitor actions.
outline: [2, 3]
---

# Commands & Keybindings

## Workflow Phase Commands

| Command | Keybinding | Description |
|---------|------------|-------------|
| `prism.research` | `Ctrl+Shift+R` | Start Research phase |
| `prism.plan` | `Ctrl+Shift+Alt+P` | Start Plan phase |
| `prism.implement` | `Ctrl+Shift+I` | Start Implement phase |
| `prism.validate` | `Ctrl+Shift+V` | Start Validate phase |

## Spectrum Execution Commands

| Command | Keybinding | Description |
|---------|------------|-------------|
| `prism.spectrum.start` | `Ctrl+Shift+S` | Begin autonomous execution |
| `prism.spectrum.pause` | — | Pause execution |
| `prism.spectrum.stop` | — | Stop execution |

## Initialization & Navigation

| Command | Description |
|---------|-------------|
| `prism.openSidebar` | Focus Prism sidebar |
| `prism.initPrism` | Initialize `.prism/` directory structure |

## Plugin Skill Commands

| Command | Skill | Description |
|---------|-------|-------------|
| `prism.commit` | `/commit` | Create a Prism commit |
| `prism.decompose` | `/decompose_plan` | Convert plan to stories.json |
| `prism.handoff` | `/create_handoff` | Create session handoff document |
| `prism.describePR` | `/describe_pr` | Generate PR description |

## Research Tree Commands

| Command | Description |
|---------|-------------|
| `prism.research.open` | Open research document |
| `prism.research.delete` | Delete research document |
| `prism.research.refresh` | Refresh research list |

## Plans Tree Commands

| Command | Description |
|---------|-------------|
| `prism.plans.open` | Open plan document |
| `prism.plans.decompose` | Decompose plan to stories |
| `prism.plans.implement` | Implement from plan |
| `prism.plans.delete` | Delete plan |
| `prism.plans.refresh` | Refresh plans list |

## Stories Tree Commands

| Command | Description |
|---------|-------------|
| `prism.stories.execute` | Run specific story |
| `prism.stories.markComplete` | Mark story as complete |
| `prism.stories.refresh` | Refresh stories list |

## Office & Monitor Commands

| Command | Description |
|---------|-------------|
| `prism.office.show` | Show Office view |
| `prism.office.launchAgent` | Launch new agent terminal |
| `prism.office.exportLayout` | Export office layout |
| `prism.monitor.runGate` | Run single quality gate |
| `prism.monitor.runAllGates` | Run all quality gates |

## Workspaces Commands

| Command | Description |
|---------|-------------|
| `prism.workspaces.openProject` | Open project folder |
| `prism.workspaces.newWorktree` | Create git worktree |
| `prism.workspaces.deleteWorktree` | Delete worktree |
