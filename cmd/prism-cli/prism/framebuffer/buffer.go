package framebuffer

import (
	"image"
	"image/color"
)

// Framebuffer is the application-facing drawing surface.
type Framebuffer struct {
	Pixels *image.RGBA
	Width  int
	Height int
	Dirty  image.Rectangle
	prev   *image.RGBA
}

// Option configures a Framebuffer
type Option func(*Framebuffer)

// WithFixedSize sets explicit pixel dimensions
func WithFixedSize(width, height int) Option {
	return func(fb *Framebuffer) {
		fb.Width = width
		fb.Height = height
	}
}

// New creates a new Framebuffer with the given options.
func New(opts ...Option) *Framebuffer {
	fb := &Framebuffer{
		Width:  160,
		Height: 80,
	}
	for _, opt := range opts {
		opt(fb)
	}
	fb.allocate()
	return fb
}

func (fb *Framebuffer) allocate() {
	bounds := image.Rect(0, 0, fb.Width, fb.Height)
	fb.Pixels = image.NewRGBA(bounds)
	fb.prev = image.NewRGBA(bounds)
	fb.Dirty = bounds
}

// Resize changes the framebuffer dimensions.
func (fb *Framebuffer) Resize(width, height int) {
	if width == fb.Width && height == fb.Height {
		return
	}
	fb.Width = width
	fb.Height = height
	fb.allocate()
}

// SetPixel sets a single pixel.
func (fb *Framebuffer) SetPixel(x, y int, c color.RGBA) {
	if x >= 0 && x < fb.Width && y >= 0 && y < fb.Height {
		fb.Pixels.SetRGBA(x, y, c)
	}
}
