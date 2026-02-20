# Plan: Settings Dashboard with Theme System

**Date**: 2026-02-10
**Feature**: Full settings page with theme support, keyboard shortcuts, and persistent preferences

## Overview

Build a comprehensive settings dashboard for the Electron application featuring a tabbed layout with General, Appearance, Keyboard Shortcuts, and About panels. Includes a CSS custom properties theme system with light/dark/system modes.

## Architecture

```
┌─────────────────────────────────────────────────┐
│               Main Process                       │
│  ┌────────────┐  ┌───────────────────────────┐  │
│  │ settings.ts │  │ settings-handlers.ts      │  │
│  │ (store)     │──│ (IPC registration)        │  │
│  └────────────┘  └───────────────────────────┘  │
│                         │                        │
├─────────────────────────┤────────────────────────┤
│                    IPC Bridge                     │
├─────────────────────────┤────────────────────────┤
│               Renderer Process                    │
│  ┌──────────────────────────────────────────┐    │
│  │            SettingsPage                    │    │
│  │  ┌────────────┐  ┌───────────────────┐   │    │
│  │  │ Sidebar     │  │  Content Panel     │   │    │
│  │  │ - General   │  │  (swaps by tab)    │   │    │
│  │  │ - Appearance│  │                    │   │    │
│  │  │ - Shortcuts │  │  [GeneralPanel]    │   │    │
│  │  │ - About     │  │  [AppearancePanel] │   │    │
│  │  └────────────┘  │  [ShortcutsPanel]  │   │    │
│  │                   │  [AboutPanel]      │   │    │
│  │                   └───────────────────┘   │    │
│  └──────────────────────────────────────────┘    │
│                                                   │
│  ┌──────────────────────────────────────────┐    │
│  │           Theme Engine                     │    │
│  │  CSS Custom Properties + system detection  │    │
│  └──────────────────────────────────────────┘    │
└─────────────────────────────────────────────────┘
```

## Phases

### Phase 1: Data Layer (Stories 1-2)
- electron-store with typed schema
- IPC handlers for settings CRUD
- Preload API exposure

### Phase 2: Theme System (Story 3)
- CSS custom property tokens
- Light and dark theme files
- System preference detection
- Smooth transition animations

### Phase 3: Settings UI Shell (Story 4)
- SettingsPage container layout
- Sidebar tab navigation
- SettingsPanel content wrapper
- Keyboard tab navigation

### Phase 4: Settings Panels (Stories 5-6)
- AppearancePanel with live theme preview
- GeneralPanel with startup/notification settings
- ShortcutsPanel with key capture

### Phase 5: Polish (Stories 7-8)
- Settings search with fuzzy matching
- Reset to defaults
- App menu and tray integration

## Success Criteria

### Automated Verification
- `npm run lint` passes with no errors
- `npm run build` produces working distributables
- All TypeScript types resolve cleanly

### Manual Verification
- Theme switches between light/dark/system modes with smooth transitions
- Settings persist after app restart
- Keyboard shortcuts can be rebound without conflicts
- Settings search filters across all tabs
- Reset to defaults works per-section and globally
- Cmd/Ctrl+, opens settings from anywhere in the app
