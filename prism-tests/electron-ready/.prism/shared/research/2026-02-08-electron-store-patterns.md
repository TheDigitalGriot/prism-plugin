# Research: Electron Persistent Storage Patterns

**Date**: 2026-02-08
**Topic**: Storage solutions for Electron application settings

## Current State

The application is an Electron + React + TypeScript starter using Electron Forge with Vite. No persistent storage is implemented — all state is ephemeral.

### Stack Details
- **Electron**: v40.0.0
- **Build Tool**: Electron Forge v7.11.1
- **Bundler**: Vite v5.4.21
- **Framework**: React 19 with TypeScript

## Findings

### electron-store
- Simple key-value store for Electron apps
- JSON file backed, stored in `app.getPath('userData')`
- Built-in schema validation with JSON Schema
- TypeScript support with generics
- Automatic atomic writes (no corruption on crash)
- Migration support between versions

### conf (by same author)
- Lower-level, works outside Electron too
- Same API surface as electron-store
- Less Electron-specific convenience methods

### lowdb
- JSON file database with lodash-like API
- More powerful queries but heavier
- Overkill for simple settings storage

## Storage Location

`electron-store` writes to platform-specific paths:
- **Windows**: `%APPDATA%/electron-react-vite-ts-starter/config.json`
- **macOS**: `~/Library/Application Support/electron-react-vite-ts-starter/config.json`
- **Linux**: `~/.config/electron-react-vite-ts-starter/config.json`

## Schema Validation Pattern

```typescript
const store = new Store({
  schema: {
    theme: { type: 'string', enum: ['light', 'dark', 'system'], default: 'system' },
    fontSize: { type: 'number', minimum: 10, maximum: 24, default: 14 }
  }
});
```

## IPC Access Pattern

Settings store should live in the main process. Renderer accesses via IPC:
1. Main process creates and manages the store instance
2. Preload exposes get/set/subscribe methods via contextBridge
3. Renderer uses a custom React hook (`useSettings`) for reactive access
