# Research: Settings UI Patterns in Desktop Applications

**Date**: 2026-02-09
**Topic**: Common settings page layouts and interaction patterns in desktop apps

## Reference Applications Studied

### VS Code Settings
- Two-mode settings: GUI form and JSON editor
- Search bar filters settings in real-time across all categories
- Sidebar categories with nested subcategories
- Individual setting reset buttons (gear icon → reset)
- Modified indicator dot on changed settings

### Figma Desktop Settings
- Modal overlay settings page
- Left sidebar with category icons
- Clean, minimal form controls
- Theme preview shows live before/after

### Slack Desktop Settings
- Full-page navigation (replaces main content)
- Sidebar categories with descriptions
- Toggle switches for boolean settings
- Dropdown selects for enum settings

## Common Patterns

### Layout
- **Sidebar + Content**: Most common. Sidebar lists categories, content area shows settings for selected category.
- **Width**: Settings pages typically 600-800px content area with sidebar.
- **Scroll**: Content area scrolls independently, sidebar stays fixed.

### Controls by Setting Type
| Type | Control |
|------|---------|
| Boolean | Toggle switch |
| Enum | Radio group or dropdown |
| Range | Slider with value label |
| Text | Input field |
| Key binding | Click-to-record button |
| Color | Color picker swatch |

### Keyboard Shortcuts Panel
- Table layout: Action name → Current binding → Edit button
- Click "Edit" → modal captures next keypress
- Conflict detection shows warning inline
- Reset to default per-binding
