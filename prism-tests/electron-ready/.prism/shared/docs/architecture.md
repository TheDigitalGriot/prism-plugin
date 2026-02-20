# Application Architecture

## Overview

Electron React application with TypeScript, built using Electron Forge and Vite bundler. Features a settings dashboard with persistent storage and theme system.

## Process Model

```
┌──────────────────┐     IPC      ┌──────────────────┐
│   Main Process   │◄────────────►│ Renderer Process  │
│   (Node.js)      │              │ (Chromium)        │
│                  │              │                   │
│  • Window mgmt   │              │  • React UI       │
│  • Settings store│              │  • Settings page  │
│  • Theme control │              │  • Theme engine   │
│  • System tray   │              │  • State mgmt     │
└──────────────────┘              └──────────────────┘
```

## Module Architecture

```
Main Process                     Renderer Process
─────────────                    ────────────────
store/settings.ts                components/Settings/
  └─ electron-store instance       ├─ SettingsPage.tsx
                                   ├─ SettingsSidebar.tsx
ipc/settings-handlers.ts          ├─ AppearancePanel.tsx
  └─ CRUD + broadcast              ├─ GeneralPanel.tsx
                                   ├─ ShortcutsPanel.tsx
main.ts                            └─ AboutPanel.tsx
  └─ window + menu setup
                                 themes/
preload.ts                         ├─ theme-engine.ts
  └─ contextBridge API             ├─ light.css
                                   └─ dark.css

                                 hooks/
                                   └─ useSettings.ts
```

## Data Flow

1. User changes setting in UI → `useSettings` hook calls preload API
2. Preload invokes IPC channel → main process handler updates electron-store
3. Store emits change event → main process broadcasts to all windows
4. Renderer receives broadcast → `useSettings` hook updates React state
5. Components re-render with new values

## Build System

- **Electron Forge**: Application packaging and distribution
- **Vite**: Fast bundling with separate configs per process
- **TypeScript**: Type safety across all processes
