---
title: Repository Structure
description: The prism-plugin monorepo structure with npm workspaces, shared packages, and platform shells.
outline: [2, 3]
---

# Repository Structure

The repository was restructured from two independent applications with fragile path aliases into a proper npm workspaces monorepo in v2.3.5.

```
prism-plugin/
├── packages/
│   ├── prism-core/          # @prism/core — Shared Node.js/TypeScript business logic
│   └── prism-ui/            # @prism/ui — Shared React component library
├── cmd/
│   ├── prism-vscode/        # VS Code extension (thin platform shell)
│   ├── prism-electron/      # Electron desktop app (thin platform shell)
│   ├── prism-cli/           # Go TUI dashboard (standalone)
│   └── prism-installer/     # Tauri v2 cross-platform installer (Rust + React 19)
├── prism-docs/              # VitePress documentation site
├── package.json             # Root — npm workspaces config
└── .prism/                  # Shared workflow artifacts
```
