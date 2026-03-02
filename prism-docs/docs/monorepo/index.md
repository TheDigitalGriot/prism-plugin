---
title: Repository Structure
description: The prism-plugin monorepo structure after the v2.3.5 npm workspaces restructuring.
outline: [2, 3]
---

# Repository Structure (v2.3.5)

The repository was restructured from two independent applications with fragile path aliases into a proper npm workspaces monorepo in v2.3.5.

```
prism-plugin/
├── packages/
│   ├── prism-core/          # Shared Node.js/TypeScript business logic
│   └── prism-ui/            # Shared React component library
├── cmd/
│   ├── prism-vscode/        # VS Code extension (thin platform shell)
│   ├── prism-electron/      # Electron desktop app (thin platform shell)
│   └── prism-cli/           # Go TUI dashboard (standalone)
├── package.json             # Root — npm workspaces config
└── .prism/                  # Shared workflow artifacts
```
