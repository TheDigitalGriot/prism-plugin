# Settings API Documentation

## Preload API (window.electronSettings)

### Methods

#### `get(key: string): Promise<any>`
Retrieve a setting value by key.
```typescript
const theme = await window.electronSettings.get('theme');
```

#### `set(key: string, value: any): Promise<void>`
Set a setting value.
```typescript
await window.electronSettings.set('theme', 'dark');
```

#### `getAll(): Promise<Settings>`
Retrieve all settings as a typed object.
```typescript
const settings = await window.electronSettings.getAll();
```

#### `reset(key?: string): Promise<void>`
Reset a specific setting or all settings to defaults.
```typescript
await window.electronSettings.reset('theme');    // Single
await window.electronSettings.reset();           // All
```

#### `onChanged(callback: (settings: Settings) => void): () => void`
Subscribe to settings changes. Returns unsubscribe function.
```typescript
const unsub = window.electronSettings.onChanged((settings) => {
  console.log('Settings updated:', settings);
});
// Later: unsub();
```

## React Hook: useSettings

```typescript
import { useSettings } from '../hooks/useSettings';

function MyComponent() {
  const { settings, updateSetting, resetSetting } = useSettings();

  return (
    <select
      value={settings.theme}
      onChange={(e) => updateSetting('theme', e.target.value)}
    >
      <option value="light">Light</option>
      <option value="dark">Dark</option>
      <option value="system">System</option>
    </select>
  );
}
```

## Settings Schema

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `theme` | `'light' \| 'dark' \| 'system'` | `'system'` | Color theme mode |
| `fontSize` | `number (10-24)` | `14` | Base font size in pixels |
| `startOnBoot` | `boolean` | `false` | Launch on system startup |
| `notifications` | `boolean` | `true` | Show desktop notifications |
| `language` | `string` | `'en'` | UI language code |
| `shortcuts` | `Record<string, string>` | `{}` | Custom keyboard bindings |
