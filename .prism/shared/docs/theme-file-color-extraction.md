# Theme File Color Extraction Research

**Date:** 2026-02-13
**Branch:** feat/spectrum-migration
**Context:** The TUI splash screen detects the terminal background via IDE theme files, but currently only extracts the background color. This document maps the full detection pipeline and catalogs all extractable colors for expanding the palette.

## Current Detection Pipeline

### Fallback Chain (`terminal/detect.go:266-316`)

The background color resolves through four approaches in order:

1. **OSC 11 terminal query** — sends escape sequence to terminal. In Cursor's integrated terminal, returns `(0,0,0)` (black), treated as unavailable.
2. **settings.json colorCustomizations** — checks `workbench.colorCustomizations` for user overrides (`terminal.background`, `editor.background`, `panel.background`). Falls through if absent.
3. **Theme file parsing** — scans IDE extension directories for the active theme's JSON file, extracts `terminal.background`. **This is what succeeds** → `#191c22` via `theme-file[Cursor Dark Midnight]`.
4. **Hardcoded lookup table** — last resort fallback with known theme→color mappings.

### How the Theme File Is Found

1. `readIDEConfig("Cursor")` reads `%APPDATA%\Cursor\User\settings.json`
2. Extracts `workbench.colorTheme` → `"Cursor Dark Midnight"`
3. `ideExtensionDirs("Cursor")` generates search paths:
   - `C:\Users\{user}\AppData\Local\Programs\cursor\resources\app\extensions` (per-user)
   - `C:\Program Files\cursor\resources\app\extensions` (system-wide) ← **found here**
   - `C:\Users\{user}\.cursor\extensions` (marketplace themes)
4. `searchThemeInDir()` scans each dir for `package.json` → `contributes.themes[].label` matching the active theme
5. Resolves to: `C:\Program Files\cursor\resources\app\extensions\theme-cursor\themes\Cursor Dark Midnight-color-theme.json`

### Current Limitation

`parseThemeFile()` only checks 3 keys and returns a single RGB triplet:

```go
for _, key := range []string{"terminal.background", "editor.background", "panel.background"} {
    if bg, ok := theme.Colors[key]; ok {
        if r, g, b, ok := parseHexColor(bg); ok {
            return r, g, b, true
        }
    }
}
```

The `Info` struct only carries `BgR`, `BgG`, `BgB` — no other colors.

## Available Colors in Cursor Dark Midnight

The theme file contains ~200 color keys. Below are the ones most relevant for TUI palette extraction, organized by semantic role.

### Accent / Primary Color

All map to the same value — this is the theme's accent:

| Key | Value | Notes |
|-----|-------|-------|
| `button.background` | `#88c0d0` | Primary action color |
| `activityBarBadge.background` | `#88c0d0` | Badge highlight |
| `progressBar.background` | `#88c0d0` | Progress indicator |
| `list.highlightForeground` | `#88c0d0` | Search match highlight |
| `editorSuggestWidget.highlightForeground` | `#88c0d0` | Autocomplete match |
| `editorLink.activeForeground` | `#88c0d0` | Clickable links |
| `inputOption.activeBorder` | `#88c0d0` | Active input border |
| `editorWidget.resizeBorder` | `#88c0d0` | Widget resize handle |
| `notificationLink.foreground` | `#88c0d0` | Notification links |
| `terminal.ansiCyan` | `#88c0d0` | Terminal ANSI cyan |

**Consensus accent color: `#88c0d0`**

### Background Colors

| Key | Value | Notes |
|-----|-------|-------|
| `terminal.background` | `#191c22` | **Currently extracted** |
| `editor.background` | `#1e2127` | Editor pane (slightly lighter) |
| `panel.background` | `#191c22` | Bottom panel |
| `sideBar.background` | `#191c22` | Sidebar |
| `activityBar.background` | `#191c22` | Activity bar |
| `tab.activeBackground` | `#1e2127` | Active tab |
| `tab.inactiveBackground` | `#191c22` | Inactive tab |
| `dropdown.background` | `#191c22` | Dropdown menus |

Two distinct bg values: `#191c22` (chrome) and `#1e2127` (editor surface).

### Foreground Colors

| Key | Value | Notes |
|-----|-------|-------|
| `terminal.foreground` | `#d8dee9` | Terminal text (bright) |
| `foreground` | `#7b88a1` | General UI text (muted) |
| `editor.foreground` | `#7b88a1` | Editor text (same as general) |
| `sideBar.foreground` | `#7c818e` | Sidebar text |
| `tab.activeForeground` | `#d8dee9` | Active tab text |
| `tab.inactiveForeground` | `#4b5163` | Inactive/dim text |
| `statusBar.foreground` | `#4b5163` | Status bar (very dim) |
| `editorLineNumber.foreground` | `#4c566a` | Line numbers |
| `editorLineNumber.activeForeground` | `#687692` | Active line number |

Three tiers: bright (`#d8dee9`), muted (`#7b88a1`), dim (`#4b5163`).

### Semantic Status Colors

| Key | Value | Semantic |
|-----|-------|----------|
| `errorForeground` | `#bf616a` | Error / red |
| `editorWarning.foreground` | `#ebcb8b` | Warning / yellow |
| `editorError.foreground` | `#bf616a` | Error (redundant) |
| `gitDecoration.addedResourceForeground` | `#a3be8c` | Success / green |
| `gitDecoration.modifiedResourceForeground` | `#ebcb8b` | Modified / yellow |
| `gitDecoration.deletedResourceForeground` | `#bf616a` | Deleted / red |
| `gitDecoration.untrackedResourceForeground` | `#88c0d0` | New / cyan (accent) |
| `gitDecoration.ignoredResourceForeground` | `#4b5163` | Ignored / dim |

### Terminal ANSI Palette

| ANSI Color | Normal | Bright |
|------------|--------|--------|
| Black | `#272c36` | `#4c566a` |
| Red | `#bf616a` | `#bf616a` |
| Green | `#a3be8c` | `#a3be8c` |
| Yellow | `#ebcb8b` | `#ebcb8b` |
| Blue | `#81a1c1` | `#81a1c1` |
| Magenta | `#7d7c9b` | `#b48ead` |
| Cyan | `#88c0d0` | `#8fbcbb` |
| White | `#e5e9f0` | `#eceff4` |

### Syntax Token Colors (from `tokenColors`)

| Scope | Color | Role |
|-------|-------|------|
| `keyword` | `#81A1C1` | Keywords, operators, storage |
| `string` | `#A3BE8C` | String literals |
| `entity.name.function` | `#88C0D0` | Function names |
| `constant.numeric` | `#B48EAD` | Numbers, booleans |
| `entity.name.class` | `#8FBCBB` | Types, classes |
| `constant.character` | `#EBCB8B` | Character constants, regex |
| `comment` | `#8597BCA6` | Comments (italic, transparent) |
| `entity.name.tag` | `#81A1C1` | HTML/XML tags |
| `meta.preprocessor` | `#5E81AC` | Preprocessor directives |
| `storage.type.annotation` | `#D08770` | Decorators, annotations |
| `invalid.illegal` | `#BF616A` | Invalid/error tokens |
| `punctuation` | `#ECEFF4` | Punctuation (near-white) |

## Proposed Semantic Mapping

Map theme file keys to TUI palette roles:

| TUI Role | Theme Key(s) | Cursor Dark Midnight | Current Hardcoded |
|----------|-------------|---------------------|-------------------|
| **Primary** | `button.background` | `#88c0d0` | `#7C3AED` (purple) |
| **Success** | `gitDecoration.addedResourceForeground` | `#a3be8c` | `#10B981` |
| **Warning** | `editorWarning.foreground` | `#ebcb8b` | `#F59E0B` |
| **Error** | `errorForeground` | `#bf616a` | `#EF4444` |
| **Info** | `terminal.ansiBlue` | `#81a1c1` | `#3B82F6` |
| **Dim** | `tab.inactiveForeground` | `#4b5163` | `#6B7280` |
| **Background** | `terminal.background` | `#191c22` | `#1F2937` |
| **White** | `terminal.foreground` | `#d8dee9` | `#FFFFFF` |

## Integration Points

### Where colors are consumed today

1. **Splash screen** (`splash/splash.go:280-283`) — uses `BgR/BgG/BgB` for atmospheric blending
2. **Styles system** (`styles/theme.go:6-14`) — hardcoded palette, **no connection** to detection

### What would need to change

1. **`parseThemeFile()`** — return a map of colors instead of single RGB
2. **`Info` struct** — add fields for accent, foreground, error, success, warning, dim
3. **`styles/theme.go`** — accept overrides from `Info` so the TUI adapts to active IDE theme
4. **Fallback behavior** — keep hardcoded values as defaults when theme detection fails

### Color priority chain for each role

```
User settings.json colorCustomizations → Theme file colors → Hardcoded defaults
```

## Cross-IDE Compatibility

The same keys exist in VS Code and Windsurf theme files (they share the VS Code extension format). The detection code already supports all three IDEs via `ideExtensionDirs()` and `ideSettingsPath()`. Extracting additional colors would work across all supported IDEs without code changes.

## Notes

- The theme's accent color (`#88c0d0`) is a cool cyan — quite different from the hardcoded purple (`#7C3AED`). Switching would change the TUI's visual identity significantly.
- The theme palette is Nord-inspired (blues, cyans, muted pastels). The hardcoded palette is more saturated/modern.
- Consider offering both: theme-adaptive mode and branded mode, with a config toggle.
