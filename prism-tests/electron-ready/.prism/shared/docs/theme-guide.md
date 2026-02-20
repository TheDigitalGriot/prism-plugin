# Theme System Guide

## How It Works

The theme system uses CSS Custom Properties (CSS variables) with a data attribute on the root element. The theme engine detects system preferences and applies the correct theme.

## Switching Themes

### Programmatically
```typescript
import { setTheme } from '../themes/theme-engine';

setTheme('dark');   // Force dark
setTheme('light');  // Force light
setTheme('system'); // Follow OS preference
```

### Via Settings
```typescript
const { updateSetting } = useSettings();
updateSetting('theme', 'dark');
// Theme engine reacts automatically
```

## Adding Custom Themes

1. Create a new CSS file in `src/themes/`:
```css
/* src/themes/midnight.css */
[data-theme="midnight"] {
  --color-bg-primary: #0d1117;
  --color-bg-secondary: #161b22;
  --color-text-primary: #c9d1d9;
  --color-accent: #58a6ff;
  /* ... all tokens */
}
```

2. Import in `index.css`:
```css
@import './themes/midnight.css';
```

3. Add to settings schema enum:
```typescript
theme: { type: 'string', enum: ['light', 'dark', 'system', 'midnight'] }
```

## Using Theme Tokens in Components

```css
.my-component {
  background: var(--color-bg-elevated);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}

.my-component:hover {
  background: var(--color-bg-secondary);
}
```

## Transition Behavior

Theme transitions are applied globally:
```css
* {
  transition: color 0.15s ease,
              background-color 0.15s ease,
              border-color 0.15s ease;
}
```

This ensures smooth visual transitions when switching themes without affecting layout or transform animations.
