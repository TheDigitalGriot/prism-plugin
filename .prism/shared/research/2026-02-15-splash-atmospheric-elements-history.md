# Splash Screen Atmospheric Elements History

**Date:** 2026-02-15
**Research Question:** What changed in the splash screen atmospheric elements generation, and what should be reverted vs. kept?

---

## Summary

The splash screen atmospheric elements generation was modified across three commits to debug rendering issues in IDE terminals (Cursor). The changes attempted to work around terminal `minimumContrastRatio` settings by using explicit background colors and hardcoded atmosphere colors. However, the issue was actually the **Cursor terminal settings**, not the rendering code. We need to **revert the atmospheric color generation** to the original algorithm while **keeping the new features** (EnvLines display, ANSI color blocks, cursor theme color integration, and detected background blending).

---

## Git History

### Three Relevant Commits

1. **4f2a697** - "splash screen prism integration" (baseline)
   - Added EnvLines, BoostColors, and BgR/BgG/BgB fields to splash Model
   - Atmospheric elements used density-based color gradients anchored to terminal background

2. **7dcaa7a** - "prism cli ide hardcoded theme"
   - Added AccentR/AccentG/AccentB and AtmoR/AtmoG/AtmoB fields
   - Changed ambient atmosphere to use smaller RGB offsets (+12 max instead of larger gradients)
   - Introduced `cBeamTint` parameter for active beam coloring

3. **c42424e** - "debug atmospheric ascii" (current)
   - Added explicit background color mechanism (useBg, bgR, bgG, bgB fields in cell struct)
   - **BROKE atmospheric rendering**: hardcoded atmosphere to flat (30, 33, 39) color
   - Removed density-based color variation in ambient atmosphere
   - Added lerp-based atmosphere color (AtmoR/AtmoG/AtmoB) but **never actually used it**

---

## File Comparison: Current vs. Backup

### Key Differences

| Aspect | Backup (splash_original.go.bak) | Current (splash.go) | Should Keep? |
|--------|--------------------------------|---------------------|--------------|
| **Ambient atmosphere color** | `aBgR + offset` (density-based) | `30, 33, 39` (hardcoded) | ❌ Revert to backup |
| **Active beam color** | Grey ramp + tinted offset | `30, 33, 39` (hardcoded) | ❌ Revert to backup |
| **Cell struct** | 3 fields (ch, r, g, b) | 6 fields (+useBg, bgR/G/B) | ✅ Keep |
| **Explicit background** | None | SGR 48 ANSI codes | ❌ Remove (not needed) |
| **EnvLines display** | ✅ Has it (Phase 9, lines 619-632) | ✅ Has it (Phase 9, lines 615-629) | ✅ Keep |
| **ANSI color blocks** | ✅ Has it (Phase 10, lines 634-654) | ✅ Has it (Phase 10, lines 631-651) | ✅ Keep |
| **Theme color integration** | Uses `aBgR/aBgG/aBgB` | Uses `aBgR/aBgG/aBgB` | ✅ Keep |
| **AtmoR/AtmoG/AtmoB fields** | Declared but unused | Declared but unused | ❌ Remove or implement |

---

## Atmospheric Elements Rendering Logic

### Original Algorithm (GOOD - from backup)

**Location:** `splash_original.go.bak:495-524`

```go
if beamMix > 0 {
    bVal := m.beamGrid[row*cols+col]
    if bVal > 0.01 {
        // Active beam particle glow
        beamDensity = math.Min(1.0, bVal)
        grey := beamDensity * greyMax
        bR = aBgR + grey*255 + (175-128)*beamDensity*cBeamTint
        bG = aBgG + grey*255 + (172-128)*beamDensity*cBeamTint
        bB = aBgB + grey*255 + (195-128)*beamDensity*cBeamTint
    } else {
        // Ambient atmosphere (no beam particles here)
        adx := nx - entryX
        ady := (ny - icoY) * ySquash
        aDist := math.Sqrt(adx*adx + ady*ady)
        ambientWave := math.Sin(aDist*20-phase*0.4)*0.5 + 0.5
        ambientDensity := ambientWave * 0.25 * math.Max(0.1, 1.0-aDist*0.8)
        beamDensity = ambientDensity

        // Color: small offset above terminal background
        offset := ambientDensity * 12.0  // 0..0.25 density → 0..3 RGB units
        bR = aBgR + offset
        bG = aBgG + offset
        bB = aBgB + offset
    }
}
```

**Why it works:**
- Density (0..0.25) drives character selection: denser areas = more solid glyphs
- Color offset scales with density: max +3 RGB units above background
- Creates subtle, animated atmospheric texture
- Anchored to detected terminal background (`aBgR/aBgG/aBgB`)

### Broken Algorithm (BAD - current)

**Location:** `splash.go:495-514`

```go
if beamMix > 0 {
    bVal := m.beamGrid[row*cols+col]
    if bVal > 0.01 {
        // Active beam (same broken approach)
        beamDensity = math.Min(1.0, bVal)
    } else {
        // Ambient atmosphere
        adx := nx - entryX
        ady := (ny - icoY) * ySquash
        aDist := math.Sqrt(adx*adx + ady*ady)
        ambientWave := math.Sin(aDist*20-phase*0.4)*0.5 + 0.5
        ambientDensity := ambientWave * 0.25 * math.Max(0.1, 1.0-aDist*0.8)
        beamDensity = ambientDensity
    }

    // WRONG: Hardcoded color for ALL beam-region cells
    bR = 30
    bG = 33
    bB = 39
    useExplicitBg = true
}
```

**Why it's broken:**
- Density still drives character selection (this part is fine)
- Color is **completely decoupled** from density: flat (30, 33, 39) for all cells
- No color variation = no visible atmospheric texture
- Explicit background mechanism was attempted workaround for Cursor terminal contrast boosting

---

## Features to KEEP

### 1. EnvLines Display

**Location:** Both files have this (Phase 9)

```go
// Phase 9: Stamp environment info lines (top-left, progressively dimmer)
for li, line := range m.EnvLines {
    lineRunes := []rune(line)
    lineRow := 1 + li
    colStart := 2
    dim := uint8(51 - li*6)
    dimB := uint8(80 - li*8)
    for i, ch := range lineRunes {
        col := colStart + i
        if col >= 0 && col < cols && lineRow >= 0 && lineRow < rows {
            m.grid[lineRow*cols+col] = cell{ch: ch, r: dim, g: dim, b: dimB}
        }
    }
}
```

**Populated by:** `app/model.go:227-236`
- Calls `termInfo.EnvLines()` to get 3 formatted lines
- Shows: terminal/shell/platform, color profile/theme, Go version/Git branch

**Status:** ✅ Keep this exactly as-is

---

### 2. ANSI Color Blocks (Left Column)

**Location:** Both files have this (Phase 10)

```go
// Phase 10: Color ramp strip — vertical column of squares on far left
{
    startR, startG, startB := aBgR, aBgG, aBgB
    for row := 0; row < rows; row++ {
        r := clampByte(startR + float64(row))
        g := clampByte(startG + float64(row))
        b := clampByte(startB + float64(row))
        m.grid[row*cols+0] = cell{ch: '█', r: r, g: g, b: b}

        hex := fmt.Sprintf(" #%02X%02X%02X", r, g, b)
        for i, ch := range hex {
            col := 1 + i
            if col < cols {
                m.grid[row*cols+col] = cell{ch: ch, r: r, g: g, b: b}
            }
        }
    }
}
```

**Purpose:** Visual debugging tool showing +1 RGB per row increments from terminal background

**Status:** ✅ Keep this exactly as-is

---

### 3. Cursor Theme Color Integration

**Model Fields (keep these):**
- `BgR, BgG, BgB` - Detected terminal background color
- `BoostColors` - IDE terminal flag for boosted vibrancy
- `EnvLines []string` - Environment info display

**Background Blending Logic (keep this):**

```go
// Use detected terminal background color for atmospheric blending
aBgR, aBgG, aBgB := float64(bgR), float64(bgG), float64(bgB)
if m.BgR+m.BgG+m.BgB > 0 {
    aBgR, aBgG, aBgB = float64(m.BgR), float64(m.BgG), float64(m.BgB)
}
```

**Color Parameter Tuning (keep this):**

```go
cIntensity := colorIntensity
cPeakBoost := peakBoost
cGreyMax := greyMax
cBeamTint := 0.3
cMeshBright := 0.85
if m.BoostColors {
    cIntensity = 0.80
    cPeakBoost = 0.40
    cGreyMax = 0.18
    cBeamTint = 0.6
    cMeshBright = 1.1
}
```

**Used in:**
- Wave field coloring (lines 487-489 in backup)
- Active beam coloring (lines 501-505 in backup)
- Mesh brightness (line 532 in backup)
- Subtitle color (lines 609-615 in backup)
- Halo dimming blend (lines 560-562 in backup)

**Status:** ✅ Keep all of this

---

## Features to REMOVE/REVERT

### 1. Explicit Background Color Mechanism

**What to remove:**
- `useBg`, `bgR`, `bgG`, `bgB` fields from `cell` struct (lines 141-144)
- `useExplicitBg` variable and logic (lines 463, 513, 568-573)
- SGR 48 ANSI codes in renderGrid (lines 684-693)
- Last background tracking variables (lines 669-670, 685-693)

**Why:** This was a failed workaround for Cursor terminal settings. Not needed.

---

### 2. Hardcoded Atmosphere Colors

**What to revert:**
Lines 510-513 in current file:
```go
bR = 30
bG = 33
bB = 39
useExplicitBg = true
```

**Replace with:**
Lines 501-522 from backup file (density-based offsets)

---

### 3. AtmoR/AtmoG/AtmoB Fields (Optional)

**Current status:**
- Declared in Model struct (lines 176 in current)
- Populated by app layer (app/model.go:244-246)
- Computed by styles.ComputeAtmosphere() (styles/theme.go:169-173)
- **Never actually used** in splash rendering

**Options:**
1. **Remove entirely** - simplest, since they're unused
2. **Implement the lerp** - use them for ambient atmosphere instead of simple offset

The git diff for c42424e shows the **intended implementation** that was never finished:

```go
atmoR := float64(m.AtmoR)
atmoG := float64(m.AtmoG)
atmoB := float64(m.AtmoB)
t := ambientDensity * 0.3
bR = aBgR + (atmoR-aBgR)*t
bG = aBgG + (atmoG-aBgG)*t
bB = aBgB + (atmoB-aBgB)*t
```

This lerps from terminal background toward AtmoR/G/B based on density. Could be kept as an enhancement over the simple offset.

---

## Recommended Approach

### Step 1: Simplify cell struct

Remove explicit background fields:

```go
type cell struct {
    ch      rune
    r, g, b uint8
}
```

### Step 2: Restore density-based atmospheric color

Replace lines 495-514 with backup logic (lines 495-524):

```go
if beamMix > 0 {
    bVal := m.beamGrid[row*cols+col]
    if bVal > 0.01 {
        // Active beam particle glow
        beamDensity = math.Min(1.0, bVal)
        grey := beamDensity * greyMax
        bR = aBgR + grey*255 + (175-128)*beamDensity*cBeamTint
        bG = aBgG + grey*255 + (172-128)*beamDensity*cBeamTint
        bB = aBgB + grey*255 + (195-128)*beamDensity*cBeamTint
    } else {
        // Ambient atmosphere
        adx := nx - entryX
        ady := (ny - icoY) * ySquash
        aDist := math.Sqrt(adx*adx + ady*ady)
        ambientWave := math.Sin(aDist*20-phase*0.4)*0.5 + 0.5
        ambientDensity := ambientWave * 0.25 * math.Max(0.1, 1.0-aDist*0.8)
        beamDensity = ambientDensity

        offset := ambientDensity * 12.0
        bR = aBgR + offset
        bG = aBgG + offset
        bB = aBgB + offset
    }
}
```

### Step 3: Simplify renderGrid

Remove explicit background ANSI logic (lines 669-670, 684-693). Return to simple foreground-only rendering like backup (lines 672-683).

### Step 4: Keep all new features

- ✅ EnvLines display (Phase 9)
- ✅ ANSI color blocks (Phase 10)
- ✅ BgR/BgG/BgB integration and `aBgR/aBgG/aBgB` blending
- ✅ BoostColors IDE parameter tuning
- ✅ All uses of `cIntensity`, `cPeakBoost`, `cGreyMax`, `cBeamTint`, `cMeshBright`

### Step 5: Decide on AtmoR/AtmoG/AtmoB

**Option A (Simple):** Remove the fields entirely since they're unused

**Option B (Enhanced):** Implement the lerp for ambient atmosphere:
```go
// Instead of: offset := ambientDensity * 12.0
atmoR := float64(m.AtmoR)
atmoG := float64(m.AtmoG)
atmoB := float64(m.AtmoB)
t := ambientDensity * 0.3
bR = aBgR + (atmoR-aBgR)*t
bG = aBgG + (atmoG-aBgG)*t
bB = aBgB + (atmoB-aBgB)*t
```

---

## Files Involved

### Core Files
- `cmd/prism-cli/splash/splash.go` - Main splash rendering (needs changes)
- `cmd/prism-cli/splash/splash_original.go.bak` - Reference for original algorithm

### Context Files (no changes needed)
- `cmd/prism-cli/app/model.go` - Initializes splash Model fields
- `cmd/prism-cli/terminal/detect.go` - Terminal background detection
- `cmd/prism-cli/terminal/theme.go` - Theme color extraction
- `cmd/prism-cli/styles/theme.go` - AtmosphereR/G/B computation

---

## Verification After Changes

1. **Visual check:** Atmospheric elements should show animated ripple texture on left side
2. **Color check:** Atmosphere should be slightly lighter than background (subtle +3 RGB offsets)
3. **ANSI blocks:** Should still show left column with incremental brightness
4. **EnvLines:** Should still show 3 info lines at top-left
5. **Theme integration:** Should use detected Cursor theme background color

---

## References

- Git commits: 4f2a697, 7dcaa7a, c42424e
- Backup file: `cmd/prism-cli/splash/splash_original.go.bak`
- Related docs: `.prism/shared/research/2026-02-13-atmosphere-rendering-findings.md`
