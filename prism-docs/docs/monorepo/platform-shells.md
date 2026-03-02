---
title: Platform Shell Responsibilities
description: What each platform shell provides vs what is shared from packages/prism-core and packages/prism-ui.
outline: [2, 3]
---

# Platform Shell Responsibilities

| Responsibility | VS Code | Electron |
|----------------|---------|----------|
| Window | `vscode.WebviewViewProvider` | `BrowserWindow` + `ipcMain` |
| Terminal/process | `vscode.Terminal` | `child_process.spawn` |
| Secret storage | `vscode.SecretStorage` | `safeStorage` (`ElectronSecretStorage`) |
| File watching | `vscode.workspace.createFileSystemWatcher` | `chokidar` |
| Tree views | `vscode.TreeDataProvider` | React panels in `ContentRail` |
| Status bar | `vscode.StatusBarItem` | `BottomStatusBar.tsx` |
