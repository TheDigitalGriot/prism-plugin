# Codex-Style ASCII Wave Background Animation

## Specification for Charm Ecosystem Implementation

---

## 1. Overview

The Codex VSCode extension features a mesmerizing ambient background animation on its splash/sign-in screen. The effect is a continuously flowing field of ASCII characters arranged in concentric wave patterns that ripple across the terminal viewport. The animation is rendered entirely with text characters at varying densities and subtle color gradations, sitting behind foreground UI elements (title text, buttons) as an atmospheric backdrop.

The overall impression is one of quiet, organic motion — like watching ripples on dark water, rendered in monospaced type. It evokes the feel of data flowing through a system while remaining unobtrusive enough to serve as a background texture.

---

## 2. Character Set & Density Ramp

The animation uses a carefully ordered ASCII density ramp where each character represents a different "brightness" or "weight" level. The mapping from lowest to highest visual density is:

```
Index:  0    1    2    3    4    5    6    7
Char:  ' '  '.'  ':'  '-'  '='  '+'  '*'  '#'
```

At the very densest wave peaks, an additional character appears:

```
Index:  8
Char:  '%'
```

**Density behavior:**
- **Troughs** (lowest wave values): empty spaces or `.` characters — nearly invisible against the dark background
- **Rising slopes**: `:` → `-` → `=` — sparse punctuation that creates a faint horizontal texture
- **Approaching peaks**: `+` → `*` — increasing visual weight, characters become more prominent
- **Peaks** (highest wave values): `#` → `%` — maximum density, block-like characters that form the bright crest of each wave

The characters are rendered in a **monospaced grid** matching the terminal's character cell dimensions. Every cell in the viewport contains exactly one character from this ramp at any given frame.

---

## 3. Wave Geometry & Mathematics

### 3.1 Primary Wave Function

The animation is driven by a **2D radial sine wave** emanating from a focal point. For each character cell at grid position `(x, y)` and at time `t`, the wave value is computed as:

```
distance = sqrt((x - cx)² + (y - cy)²)
value = sin(distance * frequency - t * speed)
```

Where:
- `(cx, cy)` is the wave origin/focal point (approximately upper-center of the viewport)
- `frequency` controls the spacing between wave rings (~0.15–0.25 radians per character cell)
- `speed` controls how fast the ripples expand outward (~0.08–0.12 radians per frame)
- The result is normalized to `[0, 1]` and mapped to the character density ramp

### 3.2 Multiple Overlapping Waves

The effect uses **2–3 superimposed wave sources** to create interference patterns that prevent the output from looking like simple concentric circles:

```
wave1 = sin(dist1 * freq1 - t * speed1)         // Primary wave, upper-center origin
wave2 = sin(dist2 * freq2 - t * speed2) * 0.5    // Secondary wave, offset origin, lower amplitude
wave3 = sin(dist3 * freq3 - t * speed3) * 0.3    // Tertiary wave, different frequency

combined = (wave1 + wave2 + wave3) / 1.8
```

The secondary and tertiary waves have:
- **Different origins** — offset from the primary by ~30–50% of viewport dimensions
- **Different frequencies** — creating beat patterns and interference fringes
- **Lower amplitudes** — so the primary wave dominates while secondary waves add organic complexity

### 3.3 Diagonal Propagation

A defining visual characteristic is that the wave crests propagate **diagonally** from upper-left toward lower-right. This is achieved by:

1. **Skewing the coordinate space** — applying a slight shear transform to `(x, y)` before computing distances
2. **Offsetting the wave origin** — placing the primary source above and to the left of viewport center
3. **Adding a directional bias** — a subtle linear gradient `(x * 0.05 + y * 0.03)` added to the phase

The result is that wave crests form elongated elliptical arcs rather than perfect circles, and they sweep across the screen on a diagonal axis.

### 3.4 Spatial Falloff

Wave amplitude **attenuates with distance** from the focal point. Characters near the viewport edges fade toward empty space:

```
falloff = max(0, 1.0 - (distance / maxRadius) * 0.7)
finalValue = combined * falloff
```

This creates a natural vignette where the wave activity is most intense near the center/upper area and fades to stillness at the periphery, particularly in the corners and bottom edge.

---

## 4. Color & Styling

### 4.1 Background

The animation renders on top of the editor's dark theme background. In the Codex implementation, this is the VS Code/Cursor sidebar panel background color — a very dark blue-grey (`~#1e1e2e` to `~#1a1a2e` range depending on the active theme).

**For a Charm TUI:** The terminal's native background color serves this role. The animation should render with `lipgloss.AdaptiveColor` to respect light/dark terminal themes.

### 4.2 Foreground Color Gradient

Characters are **not all the same color**. The foreground color varies based on wave density:

| Density Level | Characters | Color Description | Approximate Hex |
|---|---|---|---|
| Low (troughs) | `. : -` | Very dim grey, barely visible | `#3a3a4a` → `#4a4a5a` |
| Medium (slopes) | `= +` | Muted grey, slightly brighter | `#5a5a6a` → `#6a6a7a` |
| High (near peaks) | `* #` | Lighter grey with faint cool tint | `#7a7a8a` → `#8a8a9a` |
| Peak (crests) | `# %` | **Accent color** — subtle teal/cyan | `#7aa2b8` → `#88c0d0` |

The key stylistic detail: **wave peaks carry the IDE's accent color**. In the Codex implementation, the densest characters at wave crests shift from grey into a subtle teal/cyan that matches the VS Code theme's accent or link color. This creates a gentle "glow" at wave peaks that gives the animation dimensionality.

### 4.3 Theme Adaptation

The Codex implementation pulls its palette from the active IDE theme. For a Charm implementation, the equivalent approach would be:

- **Base grey**: derive from `lipgloss.Color("240")` or similar ANSI extended grey
- **Accent color**: configurable, defaulting to a teal/cyan (`lipgloss.Color("#88c0d0")` or ANSI `#6`)
- **Adaptive**: use `lipgloss.AdaptiveColor` with light-theme variants that invert appropriately

---

## 5. Animation Timing & Performance

### 5.1 Frame Rate

The Codex animation runs at approximately **15–20 effective visual FPS** (the video is 30fps but the wave movement is smooth at ~15fps of actual change). For a terminal implementation:

- **Target tick rate**: 60–80ms per frame (`~12–16 FPS`)
- This provides smooth-looking motion without excessive CPU usage
- Terminal rendering is the bottleneck, not computation

### 5.2 Phase Advancement

Each frame advances the wave phase by a small increment:

```
t += 0.08  // per frame, at ~15fps this completes one full wave cycle in ~5 seconds
```

The speed should feel **languid and meditative** — not frenetic. The waves should take approximately 4–6 seconds to complete one full oscillation cycle.

### 5.3 Seamless Looping

The animation loops seamlessly because sine waves are periodic. There is no visible jump or reset — the wave field simply continues rippling indefinitely.

### 5.4 Performance Considerations

- The wave computation is `O(width × height)` per frame — trivial for terminal dimensions
- Pre-computing the distance field on resize and only updating phase per-tick is an optimization
- String building should use `strings.Builder` and avoid per-cell allocations
- Only re-render when the tick fires, not on every Bubble Tea message

---

## 6. Composition & Layout

### 6.1 Z-Order (Back to Front)

```
┌─────────────────────────────────────┐
│  Layer 0: Terminal Background       │  (native terminal bg color)
│  Layer 1: ASCII Wave Field          │  (full-viewport character grid)
│  Layer 2: Foreground UI Elements    │  (title, buttons, text — opaque)
└─────────────────────────────────────┘
```

The wave field fills the **entire viewport** behind the UI. Foreground elements are composited on top, obscuring the wave characters beneath them.

### 6.2 Foreground Compositing

In the Codex implementation:
- The **"Codex" title** is centered vertically (~40% from top) and renders over the wave
- **Sign-in buttons** sit near the bottom, also over the wave
- The wave characters continue behind these elements (they are not masked/cleared — the foreground simply paints over them)

For a Charm splash screen, the equivalent would be rendering the wave field as the base `View()` string, then using Lip Gloss `Place()` or manual string splicing to overlay your app title and any interactive elements.

### 6.3 Viewport Responsiveness

The wave field dynamically resizes to fill whatever terminal dimensions are available. On resize:
- Recompute the distance field for the new `(width, height)`
- Adjust focal point(s) proportionally
- The wave continues animating without interruption

---

## 7. Visual Character of the Motion

### 7.1 What It Looks Like

Imagine looking down at a dark pond at night. Someone drops a stone near the center. Concentric ripples spread outward, each ring made of tiny luminous characters. As they expand, new ripples form at the center. Multiple stones dropped at slightly different locations create overlapping ring patterns that weave through each other.

The brightest rings carry a cool blue-green shimmer. The spaces between rings are nearly invisible — dark grey dots barely distinguishable from the void. The whole field drifts on a gentle diagonal current, upper-left to lower-right.

### 7.2 What It Does NOT Look Like

- **Not a scrolling text waterfall** — characters don't move; their brightness oscillates in place
- **Not Matrix-style rain** — no vertical column movement
- **Not random noise** — the pattern is clearly structured with concentric geometry
- **Not high contrast** — the entire effect is subtle, low-contrast, atmospheric
- **Not a flat plane** — the overlapping waves and color gradient create an illusion of gentle depth

### 7.3 Mood & Aesthetic

The animation communicates: *ambient intelligence, calm computation, data flowing beneath the surface*. It should feel like the visual equivalent of a quiet hum — present but not demanding, alive but not urgent.

---

## 8. Pseudocode Reference

```
constants:
    CHARS = [' ', '.', ':', '-', '=', '+', '*', '#', '%']
    BASE_GREY = ["#2a2a3a", "#3a3a4a", "#4a4a5a", "#555565", "#656575", "#757585", "#858595"]
    ACCENT    = "#88c0d0"
    FREQ1 = 0.18, FREQ2 = 0.12, FREQ3 = 0.22
    SPEED = 0.08

state:
    time: float = 0.0
    width, height: int  // terminal dimensions

per frame:
    time += SPEED
    output = StringBuilder

    for y in 0..height:
        for x in 0..width:
            // Normalized coordinates
            nx = x / width
            ny = y / height

            // Distance from primary focal point (upper-center)
            cx1, cy1 = 0.45, 0.35
            d1 = sqrt((nx - cx1)² + (ny * 0.5 - cy1)²)  // y-squash for elliptical rings

            // Distance from secondary focal point
            cx2, cy2 = 0.65, 0.55
            d2 = sqrt((nx - cx2)² + (ny * 0.5 - cy2)²)

            // Compute wave
            w1 = sin(d1 * 40.0 - time)
            w2 = sin(d2 * 28.0 - time * 1.3) * 0.5
            combined = (w1 + w2 + 1.5) / 3.0  // normalize to ~[0, 1]

            // Apply radial falloff
            falloff = clamp(1.0 - d1 * 0.8, 0.15, 1.0)
            value = combined * falloff

            // Map to character
            charIndex = clamp(int(value * len(CHARS)), 0, len(CHARS) - 1)
            char = CHARS[charIndex]

            // Map to color
            if charIndex >= 6:
                color = lerp(BASE_GREY[last], ACCENT, (charIndex - 6) / 2.0)
            else:
                color = BASE_GREY[charIndex]

            output.writeStyled(char, foreground=color)

        output.writeln()

    return output.string()
```

---

## 9. Key Implementation Notes for Charm / Bubble Tea

### 9.1 Architecture

```
SplashModel {
    time      float64
    width     int
    height    int
    distances [][]float64   // pre-computed distance fields (recomputed on resize)
    styles    []lipgloss.Style  // pre-built styles for each density level
}
```

### 9.2 Tick Command

```go
type tickMsg time.Time

func tickCmd() tea.Cmd {
    return tea.Tick(time.Millisecond*66, func(t time.Time) tea.Msg {
        return tickMsg(t)
    })
}
```

### 9.3 Lip Gloss Styling

Each density level gets a pre-built `lipgloss.Style` with its foreground color. These are created once and reused every frame to avoid allocation overhead:

```go
styles[0] = lipgloss.NewStyle().Foreground(lipgloss.Color("#2a2a3a"))  // space / barely visible
styles[1] = lipgloss.NewStyle().Foreground(lipgloss.Color("#3a3a4a"))  // dot
// ...
styles[7] = lipgloss.NewStyle().Foreground(lipgloss.Color("#7ab0c4"))  // hash - accent
styles[8] = lipgloss.NewStyle().Foreground(lipgloss.Color("#88c0d0"))  // percent - full accent
```

### 9.4 Foreground Overlay Strategy

Use Lip Gloss `Place()` to position your app title and UI elements at absolute positions within the wave field string. Alternatively, build the wave output line-by-line and splice in styled title characters at the appropriate rows:

```go
// Option A: Full overlay with Place
wave := renderWaveField(m)
title := titleStyle.Render("Prism")
return lipgloss.Place(m.width, m.height, lipgloss.Center, lipgloss.Center, title,
    lipgloss.WithWhitespaceChars(wave))

// Option B: Line-by-line splice (more control)
lines := strings.Split(renderWaveField(m), "\n")
titleLines := strings.Split(titleStyle.Render("Prism"), "\n")
// insert titleLines at vertical center of lines
```

### 9.5 Performance Tips

- Pre-compute `sin` lookups in a table if profiling shows the math as a bottleneck
- Use `strings.Builder` with pre-allocated capacity `(width * height * 20)` for ANSI escape sequences
- Consider rendering every other character on very wide terminals
- Profile with `pprof` — the bottleneck will likely be terminal I/O, not computation

---

## 10. Reference Frames

The following describes what specific moments in the animation look like, useful for visual verification during implementation:

**Sparse region (viewport corner):**
```
.   .   :   .       .   :   -   .   .       .
  .   :   -   :   .   .   -   =   -   .   .
.   -   =   -   :   .   :   -   =   -   :   .
```

**Medium density (mid-slope):**
```
: . - - = + + = = - - : . : - = + + = - :
. : - = + + * + + = - : : - = + + = = - .
: - = + * * + + = - . : - = + + * + = - :
```

**Peak region (wave crest with accent color):**
```
- = + + * * # # # * * + + = - : . : - = +
= + * * # # % % # # * * + = - : : - = + *
- + * # # % % % # # * + = - . : : - = + *
= + * * # # % % # # * * + = - : : - = + +
- = + + * * # # * * + + = - - : . : - = +
```

*In the peak region, the `#` and `%` characters would carry the teal/cyan accent color, while surrounding characters remain in graduated greys.*

---

## 11. Summary

| Property | Value |
|---|---|
| Character ramp | `' '  .  :  -  =  +  *  #  %` (9 levels) |
| Wave type | 2D radial sine, 2–3 superimposed sources |
| Propagation direction | Diagonal, upper-left → lower-right |
| Color palette | Dark grey gradient + teal/cyan accent at peaks |
| Frame rate | ~15 FPS (66ms tick interval) |
| Contrast | Very low — subtle atmospheric background |
| Mood | Ambient, meditative, "data flowing beneath the surface" |
| Looping | Seamless (sine periodicity) |
| Responsive | Fills available terminal dimensions dynamically |
