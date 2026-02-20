# electron-store API Reference

## Installation
```bash
npm install electron-store
```

## Basic Usage
```typescript
import Store from 'electron-store';

interface Settings {
  theme: 'light' | 'dark' | 'system';
  fontSize: number;
  startOnBoot: boolean;
}

const store = new Store<Settings>({
  defaults: {
    theme: 'system',
    fontSize: 14,
    startOnBoot: false
  }
});

// Get
const theme = store.get('theme');

// Set
store.set('theme', 'dark');

// Delete
store.delete('theme');

// Has
store.has('theme');

// Reset
store.clear();
```

## Schema Validation
```typescript
const store = new Store({
  schema: {
    theme: {
      type: 'string',
      enum: ['light', 'dark', 'system'],
      default: 'system'
    },
    fontSize: {
      type: 'number',
      minimum: 10,
      maximum: 24,
      default: 14
    }
  }
});
```

## Change Events
```typescript
store.onDidChange('theme', (newValue, oldValue) => {
  console.log(`Theme changed: ${oldValue} → ${newValue}`);
});

store.onDidAnyChange((newValue, oldValue) => {
  console.log('Settings changed:', newValue);
});
```

## Migrations
```typescript
const store = new Store({
  migrations: {
    '1.0.0': (store) => {
      store.set('fontSize', store.get('fontSize') || 14);
    }
  }
});
```
