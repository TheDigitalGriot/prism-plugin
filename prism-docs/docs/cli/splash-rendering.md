---
title: Splash Screen Rendering
description: Procedural splash animation rendering pipeline — icosahedron mesh, beam particles, spectral wave field, and ANSI encoding.
outline: [2, 3]
---

# Splash Screen Rendering Pipeline

The splash screen (`splash/splash.go`) is a fully procedural animation rendered to ANSI true-color.

## Components

| Component | Parameters | Description |
|-----------|-----------|-------------|
| Icosahedron mesh | 444 verts, 360 faces, pos(0.36, 0.50), scale 0.11 | Rotating 3D wireframe mesh |
| Beam particles | 200 particles, 4 rays, width 0.015 | Horizontal light beam |
| Spectral wave field | freq 34.0/26.0, speed 1.0 | Background wave pattern |
| Title | "P R I S M" | Centered text in near-white |
| Gradient bar | 4-stop spectrum gradient | Horizontal bar below title |

## Spectral Gradient (used throughout)

```
#3B82F6 ───▶ #14B8A6 ───▶ #22C55E ───▶ #F59E0B
 Blue          Teal         Green        Amber
```

## ASCII Density Ramp

```
{ ' ', '.', ',', ':', '-', '=', '+', '*', '#', '%', '@' }
```

11 characters from empty to full density, used for wave field and mesh rendering.

## Rendering Phases

1. Rotate and project 444 mesh vertices (Y/X/Z rotation + perspective distance 3.5)
2. Rasterize 360 triangles with barycentric interpolation + back-face culling
3. Build beam light grid from particle positions with Gaussian glow
4. Compute layout for title, bar, and subtitle (centered)
5. Per-cell compositing: wave field + beam particles + mesh overlay + halo dimming
6. Stamp title (232, 232, 240 near-white)
7. Stamp gradient bar
8. Stamp subtitle with atmospheric offset
9. Convert to ANSI string (batch same-color runs, reset per line)
