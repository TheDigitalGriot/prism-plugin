# Terminal minimumContrastRatio Blocks Subtle Atmosphere Colors

## Date: 2026-02-13
## Status: Confirmed — Workaround Needed

## The Problem

The splash screen atmosphere on the left side (beam glow + ambient wave texture) cannot render subtle near-background colors in Cursor/VS Code integrated terminals. Characters appear at ~rgb(126,126,126) regardless of what RGB values the code outputs.

## Root Cause

VS Code / Cursor terminals have `terminal.integrated.minimumContrastRatio` defaulting to **4.3**. This setting automatically boosts any foreground color that doesn't meet a 4.3:1 WCAG contrast ratio against the terminal background.

For our terminal background of `#191C22` (rgb 25,28,34), any foreground color needs a relative luminance producing 4.3:1 contrast. That works out to approximately **rgb(126,126,126)** minimum — impossibly bright for subtle atmosphere effects.

## How We Proved It

1. Added a color ramp strip on the far left: `█` blocks from bg color incrementing +1 RGB per row with hex codes beside each block.
2. Hardcoded ALL atmosphere characters to `#1E2127` (rgb 30,33,39) — just +5 above background.
3. The `█` blocks at `#1E2127` rendered correctly (subtle, barely visible).
4. The density characters (`.`, `·`, `:`) at the SAME hardcoded color rendered bright grey — clearly boosted by the terminal.
5. Setting `minimumContrastRatio: 1` in Cursor settings made the characters render at the correct color, confirming the terminal override.

## What Doesn't Work

- **Any foreground color formula** (grey*255, bg+offset, hardcoded values) — terminal overrides them all.
- **Explicit background color** (`\x1b[48;2;R;G;Bm` set to terminal bg alongside the foreground color) — terminal still boosts the foreground. Tested with `useBg` field on cell struct and `\x1b[48;2;...` escape codes in renderGrid. No effect on contrast boosting.

## What Does Work

- **`█` (full block character)** at subtle colors renders correctly — not boosted. Proven by the color ramp strip. Likely because `█` fills the entire cell, so the terminal treats it as decorative rather than text.
- **Setting `minimumContrastRatio: 1`** disables the boost entirely. All colors render as specified.

## Why `█` Is Not the Solution

The density character ramp (`' ', '.', '·', ':', '-', '=', '+', '*', '#', '%', '@'`) is what creates the atmospheric texture effect. The varying character shapes at different density levels produce the visual pattern. Replacing them with `█` blocks would eliminate the texture entirely.

## Options to Explore

### 1. Programmatic settings override
At TUI startup (when IDE terminal is detected), write `"terminal.integrated.minimumContrastRatio": 1` to the user's `settings.json` if not already set. The terminal detection code already reads this file.

**Pros**: Transparent, automatic.
**Cons**: Modifying user settings without explicit consent is invasive. Affects all terminal text, not just the splash.

### 2. Startup check + user prompt
Detect the setting at startup. If it's not 1, show a message: "For optimal rendering, set terminal.integrated.minimumContrastRatio to 1 in your IDE settings."

**Pros**: Non-invasive, user stays in control.
**Cons**: Extra friction, user might ignore it.

### 3. Workspace-scoped setting
Write to `.vscode/settings.json` (workspace-level) instead of user-level settings. Only affects this project's terminal.

**Pros**: Less invasive than user-level.
**Cons**: Still modifying files; may not exist yet; `.vscode/` may be gitignored.

### 4. Design around the limitation
Accept that characters will be boosted to ~rgb(126+) and design the atmosphere texture to look good at that brightness. Use the density character ramp for pattern/texture but don't rely on near-background colors.

**Pros**: Works everywhere without settings changes.
**Cons**: Atmosphere won't be "barely there" subtle — it'll be clearly visible grey texture.

### 5. Hybrid approach
Use `█` for the ambient atmosphere background fill (subtle color), then overlay density characters at higher brightness for the beam glow and mesh areas where visibility is desirable.

**Pros**: Atmosphere gets subtle color, active areas get texture.
**Cons**: Two different visual styles in one screen.

## Current State of Code

### splash.go — Atmosphere section (beamMix > 0)
- Color hardcoded to rgb(30,33,39) = `#1E2127` for testing
- `useExplicitBg` flag sets cell background to terminal bg color (doesn't help)
- `cell` struct has `useBg`, `bgR`, `bgG`, `bgB` fields
- `renderGrid` emits `\x1b[48;2;R;G;Bm` for cells with `useBg=true`

### Files modified
| File | Changes |
|------|---------|
| `cmd/prism-cli/splash/splash.go` | cell struct bg fields, atmosphere hardcoded colors, renderGrid bg support |
| `cmd/prism-cli/splash/splash_original.go.bak` | Backup before gutting beam glow formula |

### Removed from beam glow path
- `greyMin`, `greyMax` multiplied by 255
- `cBeamTint` color tinting
- `grey*255 + (175-128)*beamDensity*cBeamTint` formula
- `cBeamTint` variable and BoostColors override for it

### Color ramp strip (Phase 10)
Still present — vertical `█` blocks with hex codes on far left. Useful for visual debugging. Remove when atmosphere is finalized.

## Key Numbers

| Value | Description |
|-------|-------------|
| `#191C22` | Terminal background (Cursor Dark Midnight) |
| `#1E2127` | Test atmosphere color (+5 per channel) |
| `~rgb(126,126,126)` | Minimum foreground after 4.3:1 contrast boost |
| `4.3` | Default minimumContrastRatio in VS Code/Cursor |
| `1` | Setting value that disables the boost |
