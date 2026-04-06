---
title: Development Workflow
description: Commands to install, type-check, and build all monorepo packages.
outline: [2, 3]
---

# Development Workflow

```bash
# Install all workspaces
npm install

# Type-check shared packages
cd packages/prism-core && npm run typecheck
cd packages/prism-ui   && npm run typecheck

# Build VS Code extension
cd apps/prism-vscode && npm run compile
cd apps/prism-vscode/webview-ui && npm run build

# Build Electron app
cd apps/prism-electron && npm run make
```
