package splash

import (
	"fmt"
	"math"
	"math/rand"
	"strings"
	"time"
)

// ASCII density ramp
var densityChars = []rune{' ', '.', '\u00B7', ':', '-', '=', '+', '*', '#', '%', '@'}

// 4-stop spectral gradient: Blue -> Teal -> Green -> Amber
var spectralStops = [][3]float64{
	{0x3B, 0x82, 0xF6}, // #3B82F6 blue
	{0x14, 0xB8, 0xA6}, // #14B8A6 teal
	{0x22, 0xC5, 0x5E}, // #22C55E green
	{0xF5, 0x9E, 0x0B}, // #F59E0B amber
}

func sampleGradient(t float64) (float64, float64, float64) {
	if t < 0 {
		t = 0
	} else if t > 1 {
		t = 1
	}
	n := float64(len(spectralStops) - 1)
	idx := t * n
	i := int(math.Min(math.Floor(idx), n-1))
	frac := idx - float64(i)
	a, b := spectralStops[i], spectralStops[i+1]
	return a[0] + (b[0]-a[0])*frac,
		a[1] + (b[1]-a[1])*frac,
		a[2] + (b[2]-a[2])*frac
}

// Configuration constants
const (
	// Icosahedron mesh
	icoX         = 0.36
	icoY         = 0.50
	icoScale     = 0.11
	icoRotSpeedY = 0.15
	icoRotSpeedX = 0.08
	icoRotSpeedZ = 0.05
	icoBright    = 0.70

	// Beam
	beamWidth      = 0.015
	beamRays       = 4
	beamSpeed      = 0.010
	beamGlowRadius = 2
	beamBrightness = 0.50
	particleCount  = 200

	// Wave field
	waveFreq1     = 34.0
	waveFreq2     = 26.0
	waveSpeed     = 1.0
	waveSecondary = 0.30

	// Spectral coloring
	spectralSpread = 1.0
	colorIntensity = 0.35
	peakBoost      = 0.15
	greyMin        = 0.05
	greyMax        = 0.32

	// Global
	phaseStep       = 0.08
	speedMult       = 1.0
	falloffPower    = 0.50
	ySquash         = 0.45
	transitionWidth = 0.08

	// Halo
	haloPadX  = 4
	haloPadY  = 2
	haloFadeX = 12
	haloFadeY = 5

	// Perspective
	perspDist = 3.5

	// Mesh color: #3B82F6 (blue)
	meshColorR = 59.0
	meshColorG = 130.0
	meshColorB = 246.0
)

// Background color (dark near-black) — used when no terminal bg is detected
const (
	bgR = 10
	bgG = 9
	bgB = 16
)

// ── Atmospheric tinting ─────────────────────────────────────────────
//
// The atmosphere (wave field, ambient glow) is rendered by lerping from
// the terminal background toward spectral/accent colors rather than
// adding brightness on top of the background. This keeps atmospheric
// elements firmly anchored in the background's color space — they read
// as "ambient glow" instead of a separate layer sitting on top.

// lerpColor blends from color a toward color b by factor t (0.0–1.0).
func lerpColor(aR, aG, aB, bR, bG, bB, t float64) (float64, float64, float64) {
	return aR + (bR-aR)*t,
		aG + (bG-aG)*t,
		aB + (bB-aB)*t
}

// atmosphereTint computes a subtle atmospheric color by lerping the terminal
// background toward a target color. density (0–1) from the wave/ambient field
// controls how far we shift; maxOpacity caps the total shift so atmosphere
// can never overpower the background.
//
// Typical maxOpacity values:
//   - 0.10–0.18  wave field (visible but subordinate to beam/mesh)
//   - 0.03–0.08  ambient glow (barely perceptible warmth)
func atmosphereTint(
	bgR, bgG, bgB float64,
	targetR, targetG, targetB float64,
	density float64,
	maxOpacity float64,
) (float64, float64, float64) {
	opacity := density * maxOpacity
	return lerpColor(bgR, bgG, bgB, targetR, targetG, targetB, opacity)
}

// ── 3D rotation ─────────────────────────────────────────────────────

type vec3 [3]float64

func rotateY(v vec3, a float64) vec3 {
	c, s := math.Cos(a), math.Sin(a)
	return vec3{c*v[0] + s*v[2], v[1], -s*v[0] + c*v[2]}
}

func rotateX(v vec3, a float64) vec3 {
	c, s := math.Cos(a), math.Sin(a)
	return vec3{v[0], c*v[1] - s*v[2], s*v[1] + c*v[2]}
}

func rotateZ(v vec3, a float64) vec3 {
	c, s := math.Cos(a), math.Sin(a)
	return vec3{c*v[0] - s*v[1], s*v[0] + c*v[1], v[2]}
}

// ── Beam particle ───────────────────────────────────────────────────

type beamParticle struct {
	x, y       float64
	vx, vy     float64
	brightness float64
	life       float64
	maxLife    float64
}

func (p *beamParticle) update(dt float64) {
	p.x += p.vx * dt
	p.y += p.vy * dt
	p.life -= dt
}

func (p *beamParticle) alive() bool {
	return p.life > 0 && p.x < 1.1
}

// ── Cell grid ───────────────────────────────────────────────────────

type cell struct {
	ch      rune
	r, g, b uint8
}

// Model holds the splash screen animation state.
// It is embedded inside the main app Model.
type Model struct {
	Width     int
	Height    int
	phase     float64
	particles []beamParticle
	spawnAcc  float64
	grid      []cell // flat [y*width + x]
	rng       *rand.Rand

	// EnvLines are formatted environment info lines stamped top-left on splash.
	// Typically 3 lines: identity, rendering caps, runtime context.
	EnvLines []string

	// BoostColors enables more vivid spectral colors for IDE terminals
	// (Cursor, VS Code) whose integrated terminals render truecolor washed-out.
	BoostColors bool

	// Terminal background color (detected via fallback chain).
	// When non-zero, the splash blends atmospheric elements against
	// the actual terminal background instead of the hardcoded dark.
	BgR, BgG, BgB uint8

	// Theme accent color (from button.background or similar).
	// Used to tint the ambient atmosphere so it harmonises with the
	// user's color theme rather than defaulting to neutral grey.
	AccentR, AccentG, AccentB uint8

	// Reusable buffers
	projX    []float64
	projY    []float64
	projZ    []float64
	meshBuf  []float64
	meshDep  []float64
	beamGrid []float64
}

// New creates a new splash screen model.
func New() *Model {
	return &Model{
		rng:       rand.New(rand.NewSource(time.Now().UnixNano())),
		particles: make([]beamParticle, 0, particleCount*2),
		projX:     make([]float64, nVert),
		projY:     make([]float64, nVert),
		projZ:     make([]float64, nVert),
	}
}

func (m *Model) ensureGrid() {
	needed := m.Width * m.Height
	if len(m.grid) == needed {
		return
	}
	m.grid = make([]cell, needed)
	m.meshBuf = make([]float64, needed)
	m.meshDep = make([]float64, needed)
	m.beamGrid = make([]float64, needed)
}

// Resize updates the splash dimensions.
func (m *Model) Resize(w, h int) {
	m.Width = w
	m.Height = h
	m.ensureGrid()
}

// Tick advances the animation by one frame.
func (m *Model) Tick() {
	m.phase += phaseStep * speedMult
	m.updateParticles()
}

// Particle simulation
func (m *Model) updateParticles() {
	dt := speedMult

	alive := m.particles[:0]
	for i := range m.particles {
		m.particles[i].update(dt)
		if m.particles[i].alive() {
			alive = append(alive, m.particles[i])
		}
	}
	m.particles = alive

	entryX := icoX - icoScale*0.9
	entryY := icoY

	m.spawnAcc += float64(particleCount) * 0.12 * dt
	for m.spawnAcc >= 1 && len(m.particles) < particleCount*2 {
		m.spawnAcc -= 1

		for r := 0; r < beamRays; r++ {
			rayOff := (float64(r)/math.Max(1, float64(beamRays-1)) - 0.5) * beamWidth
			sx := -0.03 + m.rng.Float64()*0.02
			sy := entryY + rayOff + (m.rng.Float64()-0.5)*0.008

			dx := entryX - sx
			dy := (entryY + rayOff*0.15) - sy
			l := math.Sqrt(dx*dx + dy*dy)
			spd := beamSpeed * (0.8 + m.rng.Float64()*0.4)

			m.particles = append(m.particles, beamParticle{
				x:          sx,
				y:          sy,
				vx:         (dx / l) * spd,
				vy:         (dy / l) * spd,
				brightness: 0.3 + m.rng.Float64()*0.7,
				life:       l / spd * 1.2,
				maxLife:    l / spd * 1.2,
			})
		}
	}
}

// View renders the splash screen to an ANSI string.
func (m *Model) View() string {
	if m.Width < 4 || m.Height < 4 {
		return ""
	}
	m.ensureGrid()

	cols := m.Width
	rows := m.Height
	phase := m.phase
	numChars := len(densityChars)

	// Resolve color tuning parameters — IDE terminals get boosted vibrancy
	cBeamTint := 0.3
	cMeshBright := 0.85
	if m.BoostColors {
		cBeamTint = 0.6
		cMeshBright = 1.1
	}

	// ── Atmospheric opacity caps ──
	// These control how far wave/ambient cells can shift from the terminal bg.
	// IDE terminals need more push because they render truecolor washed-out.
	waveMaxOpacity := 0.14    // wave field: visible but subordinate
	ambientMaxOpacity := 0.05 // ambient glow: barely perceptible
	beamAtmoOpacity := 0.10   // beam-side atmosphere
	lumBump := 10.0           // subtle brightness lift so waves show on all themes
	if m.BoostColors {
		waveMaxOpacity = 0.26
		ambientMaxOpacity = 0.10
		beamAtmoOpacity = 0.18
		lumBump = 16.0
	}

	// Use detected terminal background color for atmospheric blending
	aBgR, aBgG, aBgB := float64(bgR), float64(bgG), float64(bgB)
	if m.BgR+m.BgG+m.BgB > 0 {
		aBgR, aBgG, aBgB = float64(m.BgR), float64(m.BgG), float64(m.BgB)
	}

	// Accent color for ambient tinting (midpoint between bg and accent gives
	// a muted tone that's harmonious but not overpowering)
	acR, acG, acB := float64(m.AccentR), float64(m.AccentG), float64(m.AccentB)
	if m.AccentR+m.AccentG+m.AccentB == 0 {
		// No accent detected — use a neutral steel-blue
		acR, acG, acB = 0x60, 0x70, 0x88
	}
	// Desaturated midpoint for ambient areas: halfway between bg and accent
	ambTargetR := (aBgR + acR) * 0.5
	ambTargetG := (aBgG + acG) * 0.5
	ambTargetB := (aBgB + acB) * 0.5

	charAspect := 0.5

	// Phase 1: Project mesh vertices
	ay := phase * icoRotSpeedY
	ax := phase*icoRotSpeedX + 0.3
	az := phase * icoRotSpeedZ

	for i := 0; i < nVert; i++ {
		v := vec3{meshVerts[i*3], meshVerts[i*3+1], meshVerts[i*3+2]}
		v = rotateY(v, ay)
		v = rotateX(v, ax)
		v = rotateZ(v, az)
		pf := perspDist / (perspDist + v[2])
		m.projX[i] = icoX + v[0]*icoScale*pf
		m.projY[i] = icoY + v[1]*icoScale*pf/charAspect
		m.projZ[i] = v[2]
	}

	// Phase 2: Rasterize mesh triangles
	total := rows * cols
	for i := 0; i < total; i++ {
		m.meshBuf[i] = 0
		m.meshDep[i] = 999
		m.beamGrid[i] = 0
	}

	fCols := float64(cols)
	fRows := float64(rows)

	for fi := 0; fi < nFace; fi++ {
		i0 := meshFaces[fi*3]
		i1 := meshFaces[fi*3+1]
		i2 := meshFaces[fi*3+2]

		x0 := m.projX[i0] * fCols
		y0 := m.projY[i0] * fRows
		x1 := m.projX[i1] * fCols
		y1 := m.projY[i1] * fRows
		x2 := m.projX[i2] * fCols
		y2 := m.projY[i2] * fRows
		z0 := m.projZ[i0]
		z1 := m.projZ[i1]
		z2 := m.projZ[i2]

		// Back-face culling
		cross := (x1-x0)*(y2-y0) - (y1-y0)*(x2-x0)
		if cross < 0 {
			continue
		}

		avgZ := (z0 + z1 + z2) / 3
		bright := (0.3 + 0.7*(perspDist/(perspDist+avgZ))) * icoBright

		minX := int(math.Max(0, math.Floor(math.Min(x0, math.Min(x1, x2)))))
		maxX := int(math.Min(fCols-1, math.Ceil(math.Max(x0, math.Max(x1, x2)))))
		minY := int(math.Max(0, math.Floor(math.Min(y0, math.Min(y1, y2)))))
		maxY := int(math.Min(fRows-1, math.Ceil(math.Max(y0, math.Max(y1, y2)))))

		denom := (y1-y2)*(x0-x2) + (x2-x1)*(y0-y2)
		if math.Abs(denom) < 0.001 {
			continue
		}
		invDenom := 1.0 / denom

		for py := minY; py <= maxY; py++ {
			fpy := float64(py)
			for px := minX; px <= maxX; px++ {
				fpx := float64(px)
				w0 := ((y1-y2)*(fpx-x2) + (x2-x1)*(fpy-y2)) * invDenom
				w1 := ((y2-y0)*(fpx-x2) + (x0-x2)*(fpy-y2)) * invDenom
				w2 := 1 - w0 - w1
				if w0 >= -0.01 && w1 >= -0.01 && w2 >= -0.01 {
					z := z0*w0 + z1*w1 + z2*w2
					idx := py*cols + px
					if idx >= 0 && idx < total && z < m.meshDep[idx] {
						m.meshDep[idx] = z
						m.meshBuf[idx] = bright
					}
				}
			}
		}
	}

	exitX := icoX + icoScale*0.9
	exitY := icoY
	entryX := icoX - icoScale*0.9

	// Phase 3: Build beam light grid
	for pi := range m.particles {
		p := &m.particles[pi]
		lifeRatio := p.life / p.maxLife
		fade := math.Min(1, (1-lifeRatio)*5) * math.Min(1, lifeRatio*4) * p.brightness * beamBrightness
		cx := int(p.x * fCols)
		cy := int(p.y * fRows)

		gr := beamGlowRadius
		for dy := -gr; dy <= gr; dy++ {
			gy := cy + dy
			if gy < 0 || gy >= rows {
				continue
			}
			for dx := -gr; dx <= gr; dx++ {
				gx := cx + dx
				if gx < 0 || gx >= cols {
					continue
				}
				dist := math.Sqrt(float64(dx*dx) + float64(dy*dy)*1.6*1.6/3.0)
				if dist > float64(gr) {
					continue
				}
				m.beamGrid[gy*cols+gx] += fade * math.Pow(math.Max(0, 1-dist/float64(gr)), 1.4)
			}
		}
	}

	// Phase 4: Title layout
	titleText := "P R I S M"
	subText := "\u2500\u2500\u2500 spectrum cli \u2500\u2500\u2500"
	barChar := '\u2501'

	titleRunes := []rune(titleText)
	subRunes := []rune(subText)

	centerRow := rows / 2

	titleTopRow := centerRow - 2
	titleRow := centerRow - 1
	titleBottomRow := centerRow
	barRow := titleBottomRow + 1
	subRow := barRow + 1

	titleColStart := (cols - len(titleRunes)) / 2

	barCharCount := 23
	barColStart := (cols - barCharCount) / 2
	barColEnd := barColStart + barCharCount - 1
	subColStart := (cols - len(subRunes)) / 2

	// Halo bounding box
	hR0 := titleTopRow
	hR1 := subRow
	hC0 := titleColStart
	hC1 := titleColStart + len(titleRunes) - 1
	if barColStart < hC0 {
		hC0 = barColStart
	}
	if barColEnd > hC1 {
		hC1 = barColEnd
	}
	if subColStart < hC0 {
		hC0 = subColStart
	}
	if se := subColStart + len(subRunes) - 1; se > hC1 {
		hC1 = se
	}

	// Phase 5: Render every cell
	for row := 0; row < rows; row++ {
		ny := float64(row) / fRows
		for col := 0; col < cols; col++ {
			nx := float64(col) / fCols

			meshIdx := row*cols + col
			totalIco := m.meshBuf[meshIdx]

			transNorm := (nx - exitX) / math.Max(0.001, transitionWidth)
			waveMix := math.Max(0, math.Min(1, transNorm))
			beamMix := 1.0 - waveMix

			var wR, wG, wB, waveDensity float64

			// ── Wave field atmosphere (right side, after prism exit) ──
			if waveMix > 0 {
				wdx := nx - exitX
				wdy := (ny - exitY) * ySquash
				wDist := math.Sqrt(wdx*wdx + wdy*wdy)
				wave1 := math.Sin(wDist*waveFreq1-phase*waveSpeed)*0.5 + 0.5

				wdx2 := nx - (exitX + 0.15)
				wdy2 := (ny - exitY) * ySquash
				wDist2 := math.Sqrt(wdx2*wdx2 + wdy2*wdy2)
				wave2 := math.Sin(wDist2*waveFreq2-phase*waveSpeed*0.7)*0.5 + 0.5

				combined := wave1*(1.0-waveSecondary) + wave2*waveSecondary
				falloff := math.Max(0.10, 1.0-wDist*falloffPower)
				waveDensity = combined * falloff

				// Sample spectral color from the brand gradient
				angle := math.Atan2(ny-exitY, nx-exitX)
				normalizedAngle := (angle / math.Pi) * spectralSpread
				gradientT := normalizedAngle*0.5 + 0.5
				sr, sg, sb := sampleGradient(gradientT)

				// Tint-toward: lerp from bg toward the spectral color
				wR, wG, wB = atmosphereTint(
					aBgR, aBgG, aBgB,
					sr, sg, sb,
					waveDensity,
					waveMaxOpacity,
				)

				// Subtle luminance bump so waves remain visible even when
				// the spectral color is close to the background hue
				bump := waveDensity * lumBump
				wR += bump
				wG += bump
				wB += bump
			}

			var bR, bG, bB float64
			var beamDensity float64

			// ── Beam-side atmosphere (left side, before prism entry) ──
			if beamMix > 0 {
				bVal := m.beamGrid[row*cols+col]
				if bVal > 0.01 {
					// Active beam particle glow — kept as-is (this is beam, not atmosphere)
					beamDensity = math.Min(1.0, bVal)
					grey := greyMin + beamDensity*(greyMax-greyMin)
					bR = aBgR + grey*255 + (175-128)*beamDensity*cBeamTint
					bG = aBgG + grey*255 + (172-128)*beamDensity*cBeamTint
					bB = aBgB + grey*255 + (195-128)*beamDensity*cBeamTint
				} else {
					// Ambient atmosphere (no beam particles here)
					// Tint toward the desaturated accent midpoint
					adx := nx - entryX
					ady := (ny - icoY) * ySquash
					aDist := math.Sqrt(adx*adx + ady*ady)
					ambientWave := math.Sin(aDist*20-phase*0.4)*0.5 + 0.5
					ambientDensity := ambientWave * 0.25 * math.Max(0.1, 1.0-aDist*0.8)
					beamDensity = ambientDensity

					bR, bG, bB = atmosphereTint(
						aBgR, aBgG, aBgB,
						ambTargetR, ambTargetG, ambTargetB,
						ambientDensity,
						ambientMaxOpacity,
					)

					// Tiny luminance lift for ambient visibility
					ambBump := ambientDensity * lumBump * 0.5
					bR += ambBump
					bG += ambBump
					bB += ambBump
				}
			}

			density := beamDensity*beamMix + waveDensity*waveMix
			finalR := bR*beamMix + wR*waveMix
			finalG := bG*beamMix + wG*waveMix
			finalB := bB*beamMix + wB*waveMix

			if totalIco > 0 {
				if totalIco*cMeshBright > density {
					density = totalIco * cMeshBright
				}
				finalR += totalIco * meshColorR
				finalG += totalIco * meshColorG
				finalB += totalIco * meshColorB
			}

			// Halo dimming
			haloMask := 1.0
			{
				var ddx, ddy float64
				if col < hC0-haloPadX {
					ddx = float64(hC0-haloPadX-col) / float64(haloFadeX)
				} else if col > hC1+haloPadX {
					ddx = float64(col-hC1-haloPadX) / float64(haloFadeX)
				}
				if row < hR0-haloPadY {
					ddy = float64(hR0-haloPadY-row) / float64(haloFadeY)
				} else if row > hR1+haloPadY {
					ddy = float64(row-hR1-haloPadY) / float64(haloFadeY)
				}
				hd := math.Sqrt(ddx*ddx + ddy*ddy)
				if hd < 1.0 {
					haloMask = hd
				}
			}

			charIdx := int(density * float64(numChars))
			if charIdx < 0 {
				charIdx = 0
			} else if charIdx >= numChars {
				charIdx = numChars - 1
			}
			if haloMask < 1.0 {
				charIdx = int(math.Max(0, math.Round(float64(charIdx)*haloMask)))
			}

			oR := clampByte(finalR*haloMask + aBgR*(1-haloMask))
			oG := clampByte(finalG*haloMask + aBgG*(1-haloMask))
			oB := clampByte(finalB*haloMask + aBgB*(1-haloMask))

			m.grid[row*cols+col] = cell{
				ch: densityChars[charIdx],
				r:  oR, g: oG, b: oB,
			}
		}
	}

	// Phase 6: Stamp title text (white)
	for i, ch := range titleRunes {
		col := titleColStart + i
		if col < 0 || col >= cols || titleRow < 0 || titleRow >= rows {
			continue
		}
		m.grid[titleRow*cols+col] = cell{ch: ch, r: 232, g: 232, b: 240}
	}

	// Phase 7: Stamp gradient bar
	for i := 0; i < barCharCount; i++ {
		col := barColStart + i
		if col < 0 || col >= cols || barRow < 0 || barRow >= rows {
			continue
		}
		t := float64(i) / math.Max(1, float64(barCharCount-1))
		gr, gg, gb := sampleGradient(t)
		m.grid[barRow*cols+col] = cell{
			ch: barChar,
			r:  clampByte(gr), g: clampByte(gg), b: clampByte(gb),
		}
	}

	// Phase 8: Stamp subtitle
	for i, ch := range subRunes {
		col := subColStart + i
		if col < 0 || col >= cols || subRow < 0 || subRow >= rows {
			continue
		}
		m.grid[subRow*cols+col] = cell{
			ch: ch,
			r:  clampByte(aBgR + 42),
			g:  clampByte(aBgG + 40),
			b:  clampByte(aBgB + 50),
		}
	}

	// Phase 9: Stamp environment info lines (top-left, progressively dimmer)
	for li, line := range m.EnvLines {
		lineRunes := []rune(line)
		lineRow := 1 + li
		colStart := 2
		// Each successive line gets slightly dimmer
		dim := uint8(51 - li*6)
		dimB := uint8(80 - li*8)
		for i, ch := range lineRunes {
			col := colStart + i
			if col >= 0 && col < cols && lineRow >= 0 && lineRow < rows {
				m.grid[lineRow*cols+col] = cell{ch: ch, r: dim, g: dim, b: dimB}
			}
		}
	}

	// Phase 10: Render grid to ANSI string
	return m.renderGrid()
}

// renderGrid converts the cell grid to an ANSI true-color string with run batching.
func (m *Model) renderGrid() string {
	var b strings.Builder
	b.Grow(m.Width * m.Height * 20)

	// Reserve last line for status hint
	renderHeight := m.Height - 1
	if renderHeight < 1 {
		renderHeight = 1
	}

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
		if y < renderHeight-1 {
			b.WriteByte('\n')
		}
	}

	// Reset color
	b.WriteString("\x1b[0m")

	// Status hint on last line
	b.WriteByte('\n')
	b.WriteString("\x1b[38;2;51;51;80m  press any key to continue\x1b[0m")

	return b.String()
}

func clampByte(v float64) uint8 {
	if v < 0 {
		return 0
	}
	if v > 255 {
		return 255
	}
	return uint8(math.Round(v))
}
