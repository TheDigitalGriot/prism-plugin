---
title: Production Hardening (v2.4.1+)
description: Hardening measures across office renderer, Claude CLI detection, layout persistence, quality gates, and workspace discovery.
outline: [2, 3]
---

# Production Hardening (v2.4.1+)

| Area | Hardening |
|------|-----------|
| **Office renderer** | React `OfficeErrorBoundary` wraps `OfficeApp` in both platforms — canvas crash shows fallback UI with Retry |
| **Claude CLI detection** | `ElectronAgentManager` detects `ENOENT` spawn errors and shows user-friendly install instructions |
| **JSONL detection timeout** | 10-second timeout warns renderer if Claude transcript file never appears |
| **Layout persistence** | Validates parsed JSON is a non-null object; renames corrupted files to `.corrupted.<timestamp>` |
| **Layout watcher** | Validates external layout changes before forwarding to renderer |
| **Quality gate cancellation** | `executeGate` accepts `AbortSignal`; `prism:cancelGate` IPC; Cancel button in `MonitorPanel` |
| **Workspace discovery** | 50-entry sibling directory cap; graceful `git` not found; 5s/10s/15s git command timeouts |
