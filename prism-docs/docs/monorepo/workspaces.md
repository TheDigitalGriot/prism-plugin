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
    "packages/*",
    "apps/prism-vscode",
    "apps/prism-vscode/webview-ui",
    "apps/prism-vscode/webview-office",
    "apps/prism-vscode/webview-panel",
    "apps/prism-electron",
    "apps/prism-electron/webview-ui",
    "apps/prism-installer"
  ]
}
```
