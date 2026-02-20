# Research: CSS Theme Systems for Electron Apps

**Date**: 2026-02-08
**Topic**: Theme engine approaches for light/dark/system mode support

## Current State

The application uses a single `index.css` file with no theme support. All colors are hardcoded.

## Findings

### Approach 1: CSS Custom Properties (Recommended)
- Define color tokens as CSS variables on `:root`
- Swap variable values via data attribute: `[data-theme="dark"]`
- Zero JS runtime cost after initial application
- Smooth transitions with `transition: color 0.2s, background-color 0.2s`

### Approach 2: CSS-in-JS (styled-components / emotion)
- Theme object passed through React context
- Dynamic at component level
- Larger bundle size and runtime overhead
- Adds dependency complexity

### Approach 3: Tailwind Dark Mode
- Utility-first approach with `dark:` prefix
- Requires Tailwind setup (not currently in project)
- Good for utility-first projects, overhead for this starter

## System Preference Detection

```typescript
// Main process — detect system theme
const { nativeTheme } = require('electron');
nativeTheme.themeSource = 'system'; // 'light' | 'dark' | 'system'
nativeTheme.on('updated', () => {
  // Broadcast to renderer
});

// Renderer — CSS media query
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
prefersDark.addEventListener('change', (e) => { ... });
```

## Token Structure

```css
:root {
  /* Surface colors */
  --color-bg-primary: #ffffff;
  --color-bg-secondary: #f5f5f5;
  --color-bg-elevated: #ffffff;

  /* Text colors */
  --color-text-primary: #1a1a1a;
  --color-text-secondary: #666666;
  --color-text-muted: #999999;

  /* Accent colors */
  --color-accent: #3b82f6;
  --color-accent-hover: #2563eb;

  /* Border colors */
  --color-border: #e5e5e5;
  --color-border-strong: #d4d4d4;
}
```

## Transition Strategy

Apply transitions only to color properties to avoid layout thrashing:
```css
* {
  transition: color 0.15s ease, background-color 0.15s ease, border-color 0.15s ease;
}
```
