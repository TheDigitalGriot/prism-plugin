# CSS Custom Properties Theme Reference

## Token Naming Convention
```
--color-{category}-{variant}
--spacing-{size}
--font-{property}-{variant}
--radius-{size}
```

## Complete Token Set

### Surface Colors
```css
--color-bg-primary       /* Main background */
--color-bg-secondary     /* Sidebar, panels */
--color-bg-elevated      /* Cards, dropdowns */
--color-bg-inset         /* Input fields */
```

### Text Colors
```css
--color-text-primary     /* Body text */
--color-text-secondary   /* Descriptions, labels */
--color-text-muted       /* Placeholder, disabled */
--color-text-inverse     /* Text on accent backgrounds */
```

### Interactive Colors
```css
--color-accent           /* Primary action */
--color-accent-hover     /* Primary action hover */
--color-accent-active    /* Primary action pressed */
--color-danger           /* Destructive action */
--color-success          /* Success state */
--color-warning          /* Warning state */
```

### Border Colors
```css
--color-border           /* Default borders */
--color-border-strong    /* Emphasized borders */
--color-border-focus     /* Focus ring */
```

## Theme Application
```css
[data-theme="light"] { /* light values */ }
[data-theme="dark"]  { /* dark values */ }
```

## System Preference Detection
```typescript
// Renderer
window.matchMedia('(prefers-color-scheme: dark)');

// Main process
const { nativeTheme } = require('electron');
nativeTheme.shouldUseDarkColors; // boolean
```
