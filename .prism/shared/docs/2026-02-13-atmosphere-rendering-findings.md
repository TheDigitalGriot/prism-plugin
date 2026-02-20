# Atmosphere Rendering Findings

## Date: 2026-02-13

## Status: In Progress — Not Yet Solved

## Problem

The splash screen's ambient atmosphere (left side, where there are no beam particles) needs to be subtly visible — matching the barely-there quality of the JSX reference (`ref/tui-theming/prism-splash-final.jsx`). Every attempt has been either too visible or completely invisible.

## What Works

- **Theme detection pipeline**: `terminal/theme.go` correctly detects accent colors via `DetectThemeColors()`. Confirmed working with `theme-file[Cursor Dark Midnight]`.
- **Style overrides**: `styles.ApplyTheme()` correctly applies accent color to tabs, headers, titles. Visually confirmed.
- **Spectral wave field** (right side): Uses the original additive formula (`grey*255 + (sr-128)*colorAmt`). Vivid colors are correct. Do NOT change this.
- **Beam particles**: Beam glow rendering is untouched and working correctly.
- **Background detection**: `bg(25,28,34)` confirmed via debug env line. Correct for Cursor Dark Midnight theme (#191c22).
- **Atmosphere values passing through**: `atmo(75,78,94)` confirmed via debug env line when using +50/+50/+60 offsets.

## What Doesn't Work

The ambient atmosphere section in `splash.go` (the `else` branch inside `beamMix > 0` when `bVal <= 0.01`) cannot achieve a subtle "barely there" look.

## The Core Issue: Terminal vs Canvas Rendering

The JSX reference renders in a browser `<canvas>` where characters are **anti-aliased** — each character pixel blends smoothly with the background at sub-pixel level. This naturally makes subtle colors look soft and atmospheric.

Terminal rendering is **binary**: each character pixel is either 100% foreground color or 100% background. There is no anti-aliasing. This means:

- Even a small color delta (e.g., +4 RGB above background) creates **sharp, fully-opaque** character shapes
- The `·` (middle dot, charIdx=2) has enough visual weight to be clearly visible at ANY color above background
- The `.` (period, charIdx=1) is so small it's effectively invisible at subtle colors
- There is a **cliff** between charIdx=2 (visible) and charIdx=1 (invisible) — no gradual fade

## What Was Tried

### Attempt 1: atmosphereTint lerp (from ref/tui-theming/splash.go)
- Lerped from bg toward accent midpoint with maxOpacity caps
- Result: Either flat uniform color (no variation) or too visible
- Problem: The lerp approach with very low opacity produces values so close to bg that all cells are identical

### Attempt 2: Original JSX formula (grey * 160/170)
- `grey = greyMin + ambientDensity*(cGreyMax-greyMin)*0.5; bR = bgR + grey*160`
- Result: Visible grey dots, user said "closer to white"
- Problem: `grey * 160` adds 10-30 units which terminal renders as clearly visible dots

### Attempt 3: Theme-driven atmosphere via styles.ComputeAtmosphere
- Defined atmosphere target in `styles/theme.go` as `bg + offset`
- Splash lerps from bg toward target: `bR = bgR + (atmoR - bgR) * t`
- **Offset +50, density 0.25**: Too visible. Peak color bg+12.5. charIdx=2 (·) → clearly visible dots
- **Offset +8, density 0.10**: Invisible. Peak color bg+0.8. charIdx=1 (.) → nothing visible
- **Offset +25, density 0.18**: Still invisible. Peak color bg+4.5. charIdx=1 (.) → nothing visible

### Attempt 4: Decoupled character density from color
- Density 0.25 for character selection (charIdx), color uses `t = ambientDensity * 0.3`
- Peak: charIdx=2 (·) visible, color at bg+3.75
- Result: **Not yet tested by user** — session paused here

## Key Insight: The Density-Character Cliff

```
densityChars = {' ', '.', '·', ':', '-', '=', '+', '*', '#', '%', '@'}
                 0    1    2    3    4    5    6    7    8    9   10
```

- charIdx=0 (space): invisible regardless of color
- charIdx=1 (period): nearly invisible — too small to see at subtle colors
- charIdx=2 (middle dot ·): ALWAYS visible — has centered visual weight

The jump from charIdx=1 → charIdx=2 is where visibility flips on. This means `density * 11` crossing the threshold of ~0.18 (charIdx=2) is the inflection point.

## Current State of Code

### splash.go — Ambient section (lines ~522-542)
```go
// Density drives character selection; color is lerped
// independently at a smaller fraction
ambientDensity := ambientWave * 0.25 * math.Max(0.1, 1.0-aDist*0.8)
beamDensity = ambientDensity  // → charIdx via density * 11

t := ambientDensity * 0.3     // color fraction, decoupled
bR = aBgR + (atmoR-aBgR)*t
bG = aBgG + (atmoG-aBgG)*t
bB = aBgB + (atmoB-aBgB)*t
```

### styles/theme.go — Atmosphere vars
```go
var (
    AtmosphereR uint8 = 60  // default for hardcoded bg (10,9,16)
    AtmosphereG uint8 = 59
    AtmosphereB uint8 = 76
)
func ComputeAtmosphere(bgR, bgG, bgB uint8) {
    AtmosphereR = clampU8(int(bgR) + 50)
    AtmosphereG = clampU8(int(bgG) + 50)
    AtmosphereB = clampU8(int(bgB) + 60)
}
```

### model.go — Wiring
- Calls `styles.ComputeAtmosphere(termInfo.BgR, ...)` when bg detected
- Passes `styles.AtmosphereR/G/B` → `splashModel.AtmoR/G/B`
- Debug env line shows `bg(R,G,B) atmo(R,G,B)` — keep this for tuning

### Tuning knobs
- `0.25` in splash.go: density multiplier (controls wave pattern + character selection)
- `0.3` in splash.go: color fraction (controls how much color shifts from bg toward atmo target)
- `+50/+50/+60` in theme.go: bg-to-atmosphere offset

## Possible Approaches to Explore

1. **Tune the color fraction (0.3)**: The decoupled approach (attempt 4) hasn't been visually tested yet. Adjust the 0.3 multiplier until the `·` dots are barely distinguishable from background.

2. **Use background-colored characters**: Instead of trying to make the foreground color subtle, render atmosphere chars with the BACKGROUND color set to the atmosphere color and foreground as a space or block char. This might give smoother blending since terminal bg fill is continuous, not character-shaped.

3. **Use half-block characters**: Unicode half-blocks (`▀`, `▄`, `░`, `▒`) provide partial coverage that could simulate the anti-aliasing effect. `░` (light shade) at a color close to bg might look more atmospheric than `·`.

4. **Accept the terminal limitation**: The JSX canvas look may not be achievable 1:1 in a terminal. A different visual approach (e.g., very sparse single dots with more spacing, or a different wave pattern) might work better than trying to replicate the canvas atmosphere.

5. **Investigate Cursor's terminal rendering**: Cursor's integrated terminal might apply its own color adjustments (minimum contrast, font smoothing). Testing in a different terminal (Windows Terminal, iTerm2) would confirm if the issue is Cursor-specific.

## Files Modified

| File | Changes |
|------|---------|
| `cmd/prism-cli/terminal/theme.go` | NEW — ThemeColors detection, accent extraction, known theme lookups |
| `cmd/prism-cli/styles/theme.go` | Added ApplyTheme(), AtmosphereR/G/B, ComputeAtmosphere() |
| `cmd/prism-cli/splash/splash.go` | Added AtmoR/G/B fields, modified ambient section, removed lerpColor/atmosphereTint |
| `cmd/prism-cli/app/model.go` | Wired theme detection → styles → splash, debug env line |

## Files NOT Modified (confirmed working, do not touch)

- Wave field rendering (right side spectral colors)
- Beam particle rendering
- Icosahedron mesh rendering
- Title/bar/subtitle rendering
