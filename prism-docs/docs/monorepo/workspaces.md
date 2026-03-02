---
title: npm Workspaces
description: Root package.json workspace configuration registering all 8 packages.
outline: [2, 3]
---

# npm Workspaces

Root `package.json` registers 8 workspaces — run `npm install` from the repo root:

```json
{
  "name": "prism-plugin",
  "private": true,
  "workspaces": [
    "packages/prism-core",
    "packages/prism-ui",
    "cmd/prism-vscode",
    "cmd/prism-vscode/webview-ui",
    "cmd/prism-vscode/webview-office",
    "cmd/prism-vscode/webview-panel",
    "cmd/prism-electron",
    "cmd/prism-electron/webview-ui"
  ]
}
```
