# Application Architecture

## Overview

Electron React application with TypeScript, built using Electron Forge and Vite bundler.

## Process Model

```
┌──────────────────┐     IPC      ┌──────────────────┐
│   Main Process   │◄────────────►│ Renderer Process  │
│   (Node.js)      │              │ (Chromium)        │
│                  │              │                   │
│  • Window mgmt   │              │  • React UI       │
│  • System APIs   │              │  • User interaction│
│  • Auto-updater  │              │  • State mgmt     │
│  • File system   │              │  • Styling        │
└──────────────────┘              └──────────────────┘
        │
        │ preload.ts
        │ (contextBridge)
        │
   Security boundary
```

## Build System

- **Electron Forge**: Application packaging and distribution
- **Vite**: Fast bundling for both main and renderer processes
- **TypeScript**: Type safety across all processes

## File Structure

```
src/
├── main.ts          # Main process entry point
├── preload.ts       # Preload script (IPC bridge)
├── renderer.tsx     # Renderer process entry
├── App.tsx          # Root React component
└── index.css        # Global styles
```

## Dependencies

| Package | Purpose |
|---------|---------|
| electron | Runtime framework |
| react / react-dom | UI framework |
| electron-forge | Build and packaging |
| vite | Bundler |
| typescript | Type checking |
