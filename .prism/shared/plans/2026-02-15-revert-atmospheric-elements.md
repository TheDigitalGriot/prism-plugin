# Revert Splash Screen Atmospheric Elements

**Date:** 2026-02-15
**Status:** Draft
**Research:** `.prism/shared/research/2026-02-15-splash-atmospheric-elements-history.md`

---

## Goal

Revert the splash screen atmospheric elements rendering to the original density-based algorithm (from `splash_original.go.bak`), removing the broken debug workarounds added in commit c42424e, while keeping all new features (EnvLines, ANSI blocks, theme color integration, BoostColors tuning).

## Scope

**Single file:** `cmd/prism-cli/splash/splash.go`

### What We're NOT Doing
- Not removing AccentR/AccentG/AccentB or AtmoR/AtmoG/AtmoB fields from the Model struct
- Not modifying model.go, terminal/detect.go, terminal/theme.go, or styles/theme.go
- Not changing EnvLines, ANSI color blocks, BoostColors, or background detection logic
- Not deleting splash_original.go.bak (keep as reference)

---

## Phase 1: Revert Cell Struct

**File:** `cmd/prism-cli/splash/splash.go:137-144`

**Change:** Remove the explicit background color fields from the cell struct.

**Current (lines 137-144):**
```go
type cell struct {
	ch      rune
	r, g, b uint8
	// Explicit background color — bypasses terminal minimumContrastRatio
	// which only boosts foreground when bg is implicit.
	useBg         bool
	bgR, bgG, bgB uint8
}
```

**Target:**
```go
type cell struct {
	ch      rune
	r, g, b uint8
}
```

**Verification:** `cd cmd/prism-cli && go build ./...` — will show compile errors for references to removed fields, which are fixed in Phases 2 and 3.

---

## Phase 2: Restore Density-Based Atmospheric Color

**File:** `cmd/prism-cli/splash/splash.go:460-574`

Three edits within the Phase 5 per-cell rendering loop:

### Edit 2a: Remove `useExplicitBg` variable (line 463)

**Current:**
```go
		beamMix := 1.0 - waveMix
		useExplicitBg := false
```

**Target:**
```go
		beamMix := 1.0 - waveMix
```

### Edit 2b: Restore beam region color generation (lines 498-514)

This is the core fix. Replace the hardcoded `(30, 33, 39)` + `useExplicitBg` with the original density-based algorithm from the backup file.

**Current (lines 498-514):**
```go
		if beamMix > 0 {
			bVal := m.beamGrid[row*cols+col]
			if bVal > 0.01 {
				beamDensity = math.Min(1.0, bVal)
			} else {
				adx := nx - entryX
				ady := (ny - icoY) * ySquash
				aDist := math.Sqrt(adx*adx + ady*ady)
				ambientWave := math.Sin(aDist*20-phase*0.4)*0.5 + 0.5
				ambientDensity := ambientWave * 0.25 * math.Max(0.1, 1.0-aDist*0.8)
				beamDensity = ambientDensity
			}
			bR = 30
			bG = 33
			bB = 39
			useExplicitBg = true
		}
```

**Target (from splash_original.go.bak:495-524):**
```go
		if beamMix > 0 {
			bVal := m.beamGrid[row*cols+col]
			if bVal > 0.01 {
				// Active beam particle glow.
				// No greyMin floor — low beam values fade smoothly to bg
				// instead of jumping +13 RGB (greyMin*255=12.75).
				beamDensity = math.Min(1.0, bVal)
				grey := beamDensity * greyMax
				bR = aBgR + grey*255 + (175-128)*beamDensity*cBeamTint
				bG = aBgG + grey*255 + (172-128)*beamDensity*cBeamTint
				bB = aBgB + grey*255 + (195-128)*beamDensity*cBeamTint
			} else {
				// Ambient atmosphere — minimal RGB increment above bg.
				// Color ramp shows +1 RGB/step is the smallest truecolor
				// delta. density drives character selection as before;
				// color is a direct small offset from terminal background.
				adx := nx - entryX
				ady := (ny - icoY) * ySquash
				aDist := math.Sqrt(adx*adx + ady*ady)
				ambientWave := math.Sin(aDist*20-phase*0.4)*0.5 + 0.5
				ambientDensity := ambientWave * 0.25 * math.Max(0.1, 1.0-aDist*0.8)
				beamDensity = ambientDensity

				// Direct offset: density 0..0.25 → 0..~3 RGB units above bg.
				offset := ambientDensity * 12.0
				bR = aBgR + offset
				bG = aBgG + offset
				bB = aBgB + offset
			}
		}
```

**Key differences restored:**
- Active beam: grey ramp + lavender tint via `cBeamTint`, anchored to `aBgR/aBgG/aBgB`
- Ambient atmosphere: density-proportional offset (+0..3 RGB units above bg)
- No `useExplicitBg` flag

### Edit 2c: Remove `useExplicitBg` cell application (lines 568-573)

**Current (lines 564-574):**
```go
		c := cell{
			ch: densityChars[charIdx],
			r:  oR, g: oG, b: oB,
		}
		if useExplicitBg {
			c.useBg = true
			c.bgR = uint8(aBgR)
			c.bgG = uint8(aBgG)
			c.bgB = uint8(aBgB)
		}
		m.grid[row*cols+col] = c
```

**Target:**
```go
		m.grid[row*cols+col] = cell{
			ch: densityChars[charIdx],
			r:  oR, g: oG, b: oB,
		}
```

**Verification:** `cd cmd/prism-cli && go build ./...` — will still fail until Phase 3 removes renderGrid references.

---

## Phase 3: Simplify renderGrid

**File:** `cmd/prism-cli/splash/splash.go` — `renderGrid()` method

Remove the SGR 48 background escape sequence logic and background tracking variables.

**Current (lines 668-694):**
```go
	var lastR, lastG, lastB uint8
	var lastBgR, lastBgG, lastBgB uint8
	lastUseBg := false
	firstCell := true

	for y := 0; y < renderHeight; y++ {
		rowOff := y * m.Width
		for x := 0; x < m.Width; x++ {
			c := m.grid[rowOff+x]
			if firstCell || c.r != lastR || c.g != lastG || c.b != lastB {
				fmt.Fprintf(&b, "\x1b[38;2;%d;%d;%dm", c.r, c.g, c.b)
				lastR, lastG, lastB = c.r, c.g, c.b
				firstCell = false
			}
			// Explicit background color — tells the terminal "this is the bg",
			// which may prevent minimumContrastRatio from boosting the fg.
			if c.useBg {
				if !lastUseBg || c.bgR != lastBgR || c.bgG != lastBgG || c.bgB != lastBgB {
					fmt.Fprintf(&b, "\x1b[48;2;%d;%d;%dm", c.bgR, c.bgG, c.bgB)
					lastBgR, lastBgG, lastBgB = c.bgR, c.bgG, c.bgB
					lastUseBg = true
				}
			} else if lastUseBg {
				b.WriteString("\x1b[49m") // reset bg to default
				lastUseBg = false
			}
			b.WriteRune(c.ch)
		}
```

**Target:**
```go
	var lastR, lastG, lastB uint8
	firstCell := true

	for y := 0; y < renderHeight; y++ {
		rowOff := y * m.Width
		for x := 0; x < m.Width; x++ {
			c := m.grid[rowOff+x]
			if firstCell || c.r != lastR || c.g != lastG || c.b != lastB {
				fmt.Fprintf(&b, "\x1b[38;2;%d;%d;%dm", c.r, c.g, c.b)
				lastR, lastG, lastB = c.r, c.g, c.b
				firstCell = false
			}
			b.WriteRune(c.ch)
		}
```

**Verification:** `cd cmd/prism-cli && go build ./...` — should compile cleanly now.

---

## Success Criteria

### Automated Verification
- [ ] `cd cmd/prism-cli && go build ./...` compiles with no errors
- [ ] `cd cmd/prism-cli && go vet ./...` passes
- [ ] `cd cmd/prism-cli && make test` passes (if tests exist)

### Manual Verification
- [ ] Atmospheric elements show animated ripple texture on left side of splash
- [ ] Atmosphere colors are subtle offsets above terminal background (not flat gray)
- [ ] ANSI color blocks still display on far-left column
- [ ] EnvLines still display terminal info at top-left
- [ ] Beam particles still glow with lavender tint
- [ ] Wave field on right side still shows spectral gradient
- [ ] Title/subtitle/gradient bar still render correctly
- [ ] Theme background detection still applies (atmosphere anchored to detected bg)

---

## Risks

| Risk | Mitigation |
|------|------------|
| Compile errors from field removal | All three phases must be applied together; phases are ordered for clarity, not incremental compilation |
| Visual regression in wave field | Wave field code (lines 467-493) is untouched — zero risk |
| Loss of EnvLines/ANSI blocks | Those are in Phases 9-10 of View() — untouched by these changes |

---

## Unchanged Code (for confidence)

These sections are **not modified** by any phase:
- Lines 1-135: imports, gradient, constants, rotation, particle struct
- Lines 187-457: New(), ensureGrid(), Resize(), Tick(), updateParticles(), mesh projection, mesh rasterization, beam grid
- Lines 467-493: Wave field rendering
- Lines 530-548: Halo dimming
- Lines 578-654: Title stamping (Phase 6), gradient bar (Phase 7), subtitle (Phase 8), EnvLines (Phase 9), ANSI blocks (Phase 10)
- Lines 700-720: clampByte()
