// Package prism renders an animated 3D prism model using FauxGL, encoded
// as half-block characters for Bubble Tea header displays.
//
// Usage:
//
//	p := prism.New(30, 3)       // 30 columns, 3 cell rows
//	p.Tick()                    // advance animation (call each frame)
//	header := p.String()        // ANSI-encoded string ready for stdout
//	p.Resize(40, 3)             // handle terminal resize
package prism

import (
	_ "embed"
	"fmt"
	"image"
	"image/color"
	"math"
	"os"
	"path/filepath"
	"strings"

	"github.com/fogleman/fauxgl"
	"github.com/prism-plugin/prism-cli/prism/framebuffer"
)

//go:embed prism-test.obj
var objData []byte

//go:embed prism-test.mtl
var mtlData []byte

// Renderer produces animated 3D prism frames.
type Renderer struct {
	fb    *framebuffer.Framebuffer
	frame int
	w, h  int // pixel dimensions (w = cols, h = rows*2)
	cols  int
	rows  int

	// 3D state
	mesh *fauxgl.Mesh
}

// New creates a renderer for the given terminal width (columns) and height
// (cell rows). Each cell row produces 2 vertical pixels via half-block
// encoding.
func New(cols, rows int) *Renderer {
	if cols < 1 {
		cols = 1
	}
	if rows < 1 {
		rows = 1
	}
	w := cols
	h := rows * 2

	r := &Renderer{
		fb:   framebuffer.New(framebuffer.WithFixedSize(w, h)),
		w:    w,
		h:    h,
		cols: cols,
		rows: rows,
	}

	r.mesh = loadEmbeddedMesh()
	return r
}

// loadEmbeddedMesh writes embedded OBJ/MTL to a temp dir, loads via fauxgl,
// then cleans up.
func loadEmbeddedMesh() *fauxgl.Mesh {
	dir, err := os.MkdirTemp("", "prism-model")
	if err != nil {
		return nil
	}
	defer os.RemoveAll(dir)

	objPath := filepath.Join(dir, "prism-test.obj")
	mtlPath := filepath.Join(dir, "prism-test.mtl")

	if err := os.WriteFile(objPath, objData, 0644); err != nil {
		return nil
	}
	if err := os.WriteFile(mtlPath, mtlData, 0644); err != nil {
		return nil
	}

	mesh, err := fauxgl.LoadOBJ(objPath)
	if err != nil {
		return nil
	}
	mesh.BiUnitCube()
	return mesh
}

// Resize updates the renderer to a new width and row count.
func (r *Renderer) Resize(cols, rows int) {
	if cols < 1 {
		cols = 1
	}
	if rows < 1 {
		rows = 1
	}
	r.cols = cols
	r.rows = rows
	r.w = cols
	r.h = rows * 2
	r.fb.Resize(r.w, r.h)
}

// Tick advances the animation by one frame.
func (r *Renderer) Tick() {
	r.frame++
}

// Width returns the current width in columns.
func (r *Renderer) Width() int { return r.cols }

// Rows returns the current height in cell rows.
func (r *Renderer) Rows() int { return r.rows }

// String renders the current frame and returns the ANSI-encoded half-block
// string.
func (r *Renderer) String() string {
	r.render()
	return r.encode()
}

const fps = 30.0

// flatShader implements fauxgl.Shader with Lambertian diffuse lighting.
type flatShader struct {
	matrix fauxgl.Matrix
	lights []light
}

type light struct {
	dir       fauxgl.Vector
	color     fauxgl.Color
	intensity float64
}

func (s *flatShader) Vertex(v fauxgl.Vertex) fauxgl.Vertex {
	v.Output = s.matrix.MulPositionW(v.Position)
	return v
}

func (s *flatShader) Fragment(v fauxgl.Vertex) fauxgl.Color {
	c := fauxgl.Color{R: 0, G: 0, B: 0, A: 1}
	normal := v.Normal.Normalize()

	for _, l := range s.lights {
		dot := normal.Dot(l.dir)
		if dot < 0 {
			dot = 0
		}
		c.R += l.color.R * l.intensity * dot
		c.G += l.color.G * l.intensity * dot
		c.B += l.color.B * l.intensity * dot
	}

	c.R = math.Min(1, c.R)
	c.G = math.Min(1, c.G)
	c.B = math.Min(1, c.B)
	return c
}

func (r *Renderer) render() {
	if r.w <= 0 || r.h <= 0 || r.mesh == nil {
		return
	}

	t := float64(r.frame) / fps
	w, h := r.w, r.h

	// Set up fauxgl context at pixel resolution
	ctx := fauxgl.NewContext(w, h)
	ambient := fauxgl.Color{R: 0.05, G: 0.04, B: 0.08, A: 1}
	ctx.ClearColorBufferWith(ambient)
	ctx.ClearDepthBuffer()

	// Camera
	eye := fauxgl.V(0, 0, 3)
	center := fauxgl.V(0, 0, 0)
	up := fauxgl.V(0, 1, 0)

	aspect := float64(w) / float64(h)
	viewMatrix := fauxgl.LookAt(eye, center, up)
	projMatrix := fauxgl.Perspective(50, aspect, 0.1, 100)

	// Model rotation: slow spin with gentle wobble
	angle := t * 0.6
	tilt := 0.3 + 0.15*math.Sin(angle*0.7)
	rx := fauxgl.Rotate(fauxgl.V(1, 0, 0), tilt)
	ry := fauxgl.Rotate(fauxgl.V(0, 1, 0), angle)
	rz := fauxgl.Rotate(fauxgl.V(0, 0, 1), 0.1*math.Sin(angle*0.5))
	modelMatrix := rz.Mul(ry).Mul(rx)

	mvp := projMatrix.Mul(viewMatrix).Mul(modelMatrix)

	// Lights: cool key + warm fill (same as pixel_prism)
	lights := []light{
		{fauxgl.V(0.6, 0.5, 1).Normalize(), fauxgl.Color{R: 0.9, G: 0.92, B: 1.0, A: 1}, 0.85},
		{fauxgl.V(-0.4, -0.3, 0.5).Normalize(), fauxgl.Color{R: 1.0, G: 0.85, B: 0.7, A: 1}, 0.3},
	}

	ctx.Shader = &flatShader{matrix: mvp, lights: lights}
	ctx.DrawMesh(r.mesh)

	// Copy rendered pixels into framebuffer
	img := ctx.Image()
	r.copyToFramebuffer(img, w, h)
}

func (r *Renderer) copyToFramebuffer(img image.Image, w, h int) {
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			c := img.At(x, y)
			rr, gg, bb, _ := c.RGBA()
			r.fb.SetPixel(x, y, color.RGBA{
				R: uint8(rr >> 8),
				G: uint8(gg >> 8),
				B: uint8(bb >> 8),
				A: 255,
			})
		}
	}
}

func (r *Renderer) encode() string {
	var buf strings.Builder
	buf.Grow(r.cols * r.rows * 30)

	var lastFG, lastBG color.RGBA
	for row := 0; row < r.rows; row++ {
		first := true
		for col := 0; col < r.cols; col++ {
			topY := row * 2
			botY := row*2 + 1
			var top, bot color.RGBA
			if topY < r.fb.Height && col < r.fb.Width {
				top = r.fb.Pixels.RGBAAt(col, topY)
			}
			if botY < r.fb.Height && col < r.fb.Width {
				bot = r.fb.Pixels.RGBAAt(col, botY)
			}
			if first || top != lastFG {
				fmt.Fprintf(&buf, "\x1b[38;2;%d;%d;%dm", top.R, top.G, top.B)
				lastFG = top
			}
			if first || bot != lastBG {
				fmt.Fprintf(&buf, "\x1b[48;2;%d;%d;%dm", bot.R, bot.G, bot.B)
				lastBG = bot
			}
			buf.WriteString("\u2580")
			first = false
		}
		buf.WriteString("\x1b[0m")
		lastFG = color.RGBA{}
		lastBG = color.RGBA{}
		if row < r.rows-1 {
			buf.WriteByte('\n')
		}
	}
	return buf.String()
}
