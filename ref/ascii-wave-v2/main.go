package main

import (
	"fmt"
	"math"
	"os"
	"strings"
	"time"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
)

// ─────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────

// ASCII density ramp: space → densest
var densityChars = []rune{' ', '.', '·', ':', '-', '=', '+', '*', '#', '%', '@'}

// Palette definition
type palette struct {
	name   string
	bg     string   // background / invisible character color
	ramp   []string // foreground colors matching density ramp
	accent string   // peak highlight color
	title  string   // title text color
	sub    string   // subtitle text color
	halo   string   // dimmed halo around title
}

var palettes = map[string]palette{
	"teal": {
		name:   "Codex Teal",
		bg:     "#1e1e2e",
		ramp:   []string{"#1e1e2e", "#22223a", "#2a2a44", "#35354f", "#42425e", "#50506e", "#60607e", "#707090", "#7aa8be", "#88c0d0", "#96d4e4"},
		accent: "#88c0d0",
		title:  "#cdd6f4",
		sub:    "#585878",
		halo:   "#1e1e2e",
	},
	"purple": {
		name:   "Prism Purple",
		bg:     "#1a1a2e",
		ramp:   []string{"#1a1a2e", "#222238", "#2a2a45", "#353552", "#424260", "#50506e", "#5f5f80", "#707094", "#9078b8", "#a888d0", "#b898e0"},
		accent: "#b48eda",
		title:  "#e0d0f0",
		sub:    "#5a5878",
		halo:   "#1a1a2e",
	},
	"green": {
		name:   "Terminal Green",
		bg:     "#0c140c",
		ramp:   []string{"#0c140c", "#142014", "#1e2e1e", "#283c28", "#344a34", "#405840", "#4e6a4e", "#5e7e5e", "#70a870", "#80c880", "#90e090"},
		accent: "#88d888",
		title:  "#c0e8c0",
		sub:    "#3a5a3a",
		halo:   "#0c140c",
	},
	"spectrum": {
		name:   "Spectrum",
		bg:     "#121220",
		ramp:   []string{"#121220", "#1a1a30", "#242444", "#303058", "#3e3e6c", "#4e4e80", "#606096", "#7272ac", "#6ea8cc", "#5ec0e0", "#50d8f0"},
		accent: "#5ec4e8",
		title:  "#d0dff0",
		sub:    "#4a4a70",
		halo:   "#121220",
	},
}

var paletteOrder = []string{"teal", "purple", "green", "spectrum"}

// Wave source configuration
type waveSource struct {
	cx, cy float64 // focal point (normalized 0–1)
	freq   float64 // spatial frequency
	speed  float64 // phase speed multiplier
	amp    float64 // amplitude weight
}

var waveSources = []waveSource{
	{cx: 0.40, cy: 0.30, freq: 38.0, speed: 1.0, amp: 1.0},
	{cx: 0.70, cy: 0.60, freq: 26.0, speed: 1.3, amp: 0.45},
	{cx: 0.20, cy: 0.75, freq: 32.0, speed: 0.7, amp: 0.30},
}

const (
	tickInterval = 66 * time.Millisecond // ~15 FPS
	phaseStep    = 0.10                  // phase increment per tick
	falloffPower = 0.70                  // radial edge fade strength
	ySquash      = 0.45                  // compensate terminal char aspect ratio (~2:1)
)

// Title halo — dims surrounding wave cells for readability
const (
	haloPadX  = 3 // horizontal cell padding around text
	haloPadY  = 1 // vertical row padding around text
	haloFadeX = 8 // horizontal gradient fade distance
	haloFadeY = 3 // vertical gradient fade distance
)

// ─────────────────────────────────────────────────────
// Cell-based rendering grid
// ─────────────────────────────────────────────────────

type cell struct {
	ch       rune
	colorIdx int // index into waveStyles, or -1 for overlay
	style    lipgloss.Style
}

// ─────────────────────────────────────────────────────
// Overlay text definitions
// ─────────────────────────────────────────────────────

type overlayLine struct {
	text  string
	row   int // row offset from vertical center (negative = above)
	style lipgloss.Style
}

// ─────────────────────────────────────────────────────
// Model
// ─────────────────────────────────────────────────────

type model struct {
	width      int
	height     int
	phase      float64
	palKey     string
	pal        palette
	waveStyles []lipgloss.Style // pre-built per density level
	grid       [][]cell         // reusable cell grid [y][x]
	totalAmp   float64          // sum of wave amplitudes (constant)
}

type tickMsg time.Time

func tickCmd() tea.Cmd {
	return tea.Tick(tickInterval, func(t time.Time) tea.Msg {
		return tickMsg(t)
	})
}

func initialModel() model {
	m := model{palKey: "teal"}
	m.setPalette("teal")
	for _, src := range waveSources {
		m.totalAmp += src.amp
	}
	return m
}

func (m *model) setPalette(key string) {
	m.palKey = key
	m.pal = palettes[key]
	m.waveStyles = make([]lipgloss.Style, len(densityChars))
	for i, c := range m.pal.ramp {
		m.waveStyles[i] = lipgloss.NewStyle().Foreground(lipgloss.Color(c))
	}
}

func (m *model) ensureGrid() {
	if len(m.grid) == m.height && (m.height == 0 || len(m.grid[0]) == m.width) {
		return
	}
	m.grid = make([][]cell, m.height)
	for y := range m.grid {
		m.grid[y] = make([]cell, m.width)
	}
}

// ─────────────────────────────────────────────────────
// Bubble Tea lifecycle
// ─────────────────────────────────────────────────────

func (m model) Init() tea.Cmd {
	return tickCmd()
}

func (m model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.KeyMsg:
		switch msg.String() {
		case "q", "esc", "ctrl+c":
			return m, tea.Quit
		case "1":
			m.setPalette("teal")
		case "2":
			m.setPalette("purple")
		case "3":
			m.setPalette("green")
		case "4":
			m.setPalette("spectrum")
		case "tab":
			for i, k := range paletteOrder {
				if k == m.palKey {
					m.setPalette(paletteOrder[(i+1)%len(paletteOrder)])
					break
				}
			}
		}
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
		m.ensureGrid()
	case tickMsg:
		m.phase += phaseStep
		return m, tickCmd()
	}
	return m, nil
}

func (m model) View() string {
	if m.width < 4 || m.height < 4 {
		return ""
	}
	m.ensureGrid()

	// Phase 1 — fill grid with wave data
	m.renderWaveField()

	// Phase 2 — build overlay text layout
	overlays := m.buildOverlays()

	// Phase 3 — apply halo dimming around overlay text
	m.applyHalo(overlays)

	// Phase 4 — stamp overlay characters into the grid
	m.stampOverlays(overlays)

	// Phase 5 — render grid to styled string
	return m.renderGrid()
}

// ─────────────────────────────────────────────────────
// Phase 1: Wave field — fills every cell with wave data
// ─────────────────────────────────────────────────────

func (m *model) renderWaveField() {
	numChars := len(densityChars)
	w := float64(m.width)
	h := float64(m.height)
	invTotalAmp := 1.0 / (2.0 * m.totalAmp)

	for y := 0; y < m.height; y++ {
		ny := float64(y) / h
		for x := 0; x < m.width; x++ {
			nx := float64(x) / w

			var combined, primaryDist float64
			for i, src := range waveSources {
				dx := nx - src.cx
				dy := (ny - src.cy) * ySquash
				dist := math.Sqrt(dx*dx + dy*dy)
				if i == 0 {
					primaryDist = dist
				}
				combined += math.Sin(dist*src.freq-m.phase*src.speed) * src.amp
			}

			normalized := (combined + m.totalAmp) * invTotalAmp
			falloff := math.Max(0.08, 1.0-primaryDist*falloffPower)
			value := normalized * falloff

			idx := int(value * float64(numChars))
			if idx < 0 {
				idx = 0
			} else if idx >= numChars {
				idx = numChars - 1
			}

			m.grid[y][x] = cell{
				ch:       densityChars[idx],
				colorIdx: idx,
				style:    m.waveStyles[idx],
			}
		}
	}
}

// ─────────────────────────────────────────────────────
// Phase 2: Build overlay definitions
// ─────────────────────────────────────────────────────

func (m model) buildOverlays() []overlayLine {
	titleStyle := lipgloss.NewStyle().
		Foreground(lipgloss.Color(m.pal.title)).
		Bold(true)

	subStyle := lipgloss.NewStyle().
		Foreground(lipgloss.Color(m.pal.sub))

	return []overlayLine{
		{text: "P R I S M", row: -1, style: titleStyle},
		{text: "─── spectrum cli ───", row: 1, style: subStyle},
	}
}

// ─────────────────────────────────────────────────────
// Phase 3: Halo — smooth radial dim around overlay text
//
// Creates a soft vignette that transitions from fully
// dimmed (near the text) through a gradient back to the
// unmodified wave field. This ensures the title is
// always readable regardless of wave phase.
// ─────────────────────────────────────────────────────

func (m *model) applyHalo(overlays []overlayLine) {
	if len(overlays) == 0 {
		return
	}

	centerY := m.height / 2

	// Bounding box of all overlay text
	minRow, maxRow := math.MaxInt32, math.MinInt32
	minCol, maxCol := math.MaxInt32, math.MinInt32

	for _, ol := range overlays {
		row := centerY + ol.row
		runes := []rune(ol.text)
		colStart := (m.width - len(runes)) / 2
		colEnd := colStart + len(runes) - 1

		if row < minRow {
			minRow = row
		}
		if row > maxRow {
			maxRow = row
		}
		if colStart < minCol {
			minCol = colStart
		}
		if colEnd > maxCol {
			maxCol = colEnd
		}
	}

	// Scan the full affected area: padding + fade
	y0 := max(0, minRow-haloPadY-haloFadeY)
	y1 := min(m.height-1, maxRow+haloPadY+haloFadeY)
	x0 := max(0, minCol-haloPadX-haloFadeX)
	x1 := min(m.width-1, maxCol+haloPadX+haloFadeX)

	for y := y0; y <= y1; y++ {
		for x := x0; x <= x1; x++ {
			// Signed distance from inner padding rect
			var dx, dy float64
			if x < minCol-haloPadX {
				dx = float64(minCol-haloPadX-x) / float64(haloFadeX)
			} else if x > maxCol+haloPadX {
				dx = float64(x-maxCol-haloPadX) / float64(haloFadeX)
			}
			if y < minRow-haloPadY {
				dy = float64(minRow-haloPadY-y) / float64(haloFadeY)
			} else if y > maxRow+haloPadY {
				dy = float64(y-maxRow-haloPadY) / float64(haloFadeY)
			}

			dist := math.Sqrt(dx*dx + dy*dy)
			if dist >= 1.0 {
				continue // outside fade — wave untouched
			}

			// dimFactor: 0 = deep inside halo, 1 = edge of fade
			dimFactor := dist

			c := m.grid[y][x]
			currentIdx := c.colorIdx
			if currentIdx < 0 {
				currentIdx = 0
			}

			// Scale density index down toward zero based on dimFactor
			newIdx := int(math.Round(float64(currentIdx) * dimFactor))
			if newIdx < 0 {
				newIdx = 0
			}

			m.grid[y][x] = cell{
				ch:       densityChars[newIdx],
				colorIdx: newIdx,
				style:    m.waveStyles[newIdx],
			}
		}
	}
}

// ─────────────────────────────────────────────────────
// Phase 4: Stamp — write overlay chars into exact cells
//
// Only the character positions occupied by overlay text
// are replaced. Wave cells on either side remain as-is,
// giving the composited look where waves flow around
// and behind the title.
// ─────────────────────────────────────────────────────

func (m *model) stampOverlays(overlays []overlayLine) {
	centerY := m.height / 2

	for _, ol := range overlays {
		row := centerY + ol.row
		if row < 0 || row >= m.height {
			continue
		}

		runes := []rune(ol.text)
		colStart := (m.width - len(runes)) / 2

		for i, ch := range runes {
			col := colStart + i
			if col < 0 || col >= m.width {
				continue
			}
			m.grid[row][col] = cell{
				ch:       ch,
				colorIdx: -1, // mark as overlay
				style:    ol.style,
			}
		}
	}
}

// ─────────────────────────────────────────────────────
// Phase 5: Grid → string with style-run batching
//
// Adjacent cells sharing the same foreground color are
// batched into a single lipgloss.Render() call, which
// dramatically reduces ANSI escape sequence overhead
// and improves rendering throughput.
// ─────────────────────────────────────────────────────

func (m model) renderGrid() string {
	var b strings.Builder
	b.Grow(m.width * m.height * 16)

	// Reserve last line for status bar
	renderHeight := m.height - 1
	if renderHeight < 1 {
		renderHeight = 1
	}

	for y := 0; y < renderHeight; y++ {
		row := m.grid[y]
		runStart := 0

		for runStart < m.width {
			// Batch consecutive cells with same colorIdx (same style)
			runEnd := runStart + 1
			startColor := row[runStart].colorIdx
			startStyle := row[runStart].style
			for runEnd < m.width && row[runEnd].colorIdx == startColor {
				runEnd++
			}

			// Build character run
			var run strings.Builder
			for i := runStart; i < runEnd; i++ {
				run.WriteRune(row[i].ch)
			}

			b.WriteString(startStyle.Render(run.String()))
			runStart = runEnd
		}

		if y < renderHeight-1 {
			b.WriteByte('\n')
		}
	}

	// Status bar
	b.WriteByte('\n')
	hint := lipgloss.NewStyle().
		Foreground(lipgloss.Color("#444460")).
		Render(fmt.Sprintf("  [1-4] palette: %s  [tab] cycle  [q] quit", m.pal.name))
	b.WriteString(hint)

	return b.String()
}

// ─────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────

func main() {
	p := tea.NewProgram(initialModel(), tea.WithAltScreen())
	if _, err := p.Run(); err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}
}
