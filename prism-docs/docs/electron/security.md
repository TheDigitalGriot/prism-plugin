---
title: Security Hardening
description: Context isolation settings, Electron Fuses, and IPC channel restrictions.
outline: [2, 3]
---

# Security Hardening

## Context Isolation

The Electron app enforces strict process isolation:

| Setting | Value | Effect |
|---------|-------|--------|
| `contextIsolation` | `true` | Renderer cannot access Node.js APIs directly |
| `nodeIntegration` | `false` | No `require()` available in renderer |
| `sandbox` | default | Renderer runs in Chromium sandbox |

All communication between renderer and main process goes through the `contextBridge` preload script.

## Electron Fuses

Compile-time security toggles via `@electron/fuses`:

| Fuse | Setting | Effect |
|------|---------|--------|
| `RunAsNode` | Disabled | Prevents `ELECTRON_RUN_AS_NODE` env var abuse |
| `EnableCookieEncryption` | Enabled | Encrypts cookies at rest |
| `EnableNodeOptionsEnvironmentVariable` | Disabled | Blocks `NODE_OPTIONS` injection |
| `EnableNodeCliInspectArguments` | Disabled | Blocks `--inspect` debugging in production |
| `OnlyLoadAppFromAsar` | Enabled | Only loads code from ASAR bundle (no filesystem bypass) |

## IPC Channel Restrictions

The preload script only forwards specific, known IPC channels. The renderer cannot send arbitrary messages to the main process — it can only use `send`, `on`, and `invoke` through the `electronAPI` bridge.
