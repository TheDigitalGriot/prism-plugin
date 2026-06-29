---
title: npm Workspaces
description: Root package.json workspace configuration registering all 8 packages.
outline: [2, 3]
---

# npm Workspaces

Root `package.json` registers the workspaces via the `packages/*` glob plus an explicit `apps`
list — run `npm install` from the repo root:

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

The `packages/*` glob auto-includes every package. As of **v3.7.0** that is:

| Package | Role |
|---|---|
| `@prism/core` | Shared TS — controller, gRPC seam, office, workspace, 4-phase prompts |
| `@prism/ui` | Shared React components |
| `@prism/daemon` | The [daemon-broker](/daemon/) |
| `@prism/daemon-client` | TypeScript [surface client](/daemon/clients) |
| `@prism/relay` | Sovereign [E2EE relay](/daemon/relay) (Curve25519 + NaCl box) |

> **`apps/prism-mobile` is deliberately excluded** from the workspace list — it is the vendored
> paseo monorepo (its own npm tree) and is referenced for Fragment, not hoisted. The Go CLI
> (`apps/prism-cli`) is a separate Go module and is not an npm workspace either.
