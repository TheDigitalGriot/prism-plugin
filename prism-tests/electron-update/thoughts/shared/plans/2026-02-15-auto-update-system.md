# Plan: Electron Auto-Update System

**Date**: 2026-02-15
**Feature**: Implement auto-update with UI notifications and user preferences

## Overview

Add a complete auto-update system to the Electron application using `electron-updater` with GitHub Releases as the update source. The system will include a renderer UI for update notifications, download progress, and user preferences.

## Architecture

```
┌─────────────────────────────────────────┐
│           Main Process                   │
│  ┌─────────────┐  ┌──────────────────┐  │
│  │  updater.ts  │  │ ipc-handlers.ts  │  │
│  │  (lifecycle) │──│  (bridge)        │  │
│  └─────────────┘  └──────────────────┘  │
│                         │                │
├─────────────────────────┤────────────────┤
│                    IPC Bridge             │
├─────────────────────────┤────────────────┤
│           Renderer Process               │
│  ┌──────────────┐  ┌─────────────────┐  │
│  │ UpdateBanner  │  │ UpdateSettings  │  │
│  │ (notification)│  │ (preferences)   │  │
│  └──────────────┘  └─────────────────┘  │
└─────────────────────────────────────────┘
```

## Phases

### Phase 1: Foundation (Stories 1-2)
- Install electron-updater, configure Forge publisher
- Create updater.ts main process module

### Phase 2: Communication (Story 3)
- Build typed IPC channels
- Expose update API through preload contextBridge

### Phase 3: UI (Story 4)
- UpdateBanner component with states: checking, available, downloading, ready, error
- Progress bar for download visualization

### Phase 4: Polish (Stories 5-6)
- User preferences (skip version, check frequency)
- Error recovery and retry logic

## Success Criteria

### Automated Verification
- `npm run lint` passes with no errors
- `npm run build` produces working distributables
- All TypeScript types resolve without errors

### Manual Verification
- Update banner appears when update is available
- Progress bar shows accurate download percentage
- "Restart Now" button triggers app restart and update install
- "Skip This Version" persists across sessions
- Graceful error message on network failure during update
