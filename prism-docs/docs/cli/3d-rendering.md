---
title: 3D Prism Rendering Pipeline
description: FauxGL-based 3D prism rendering with half-block Unicode ANSI encoding, animated rotation, and fallback text styles.
outline: [2, 3]
---

# 3D Prism Rendering Pipeline

## Pipeline Overview

```
┌─────────────────┐
│  Embedded OBJ   │  444 vertices, 360 triangular faces
│  (go:embed)     │  Blender 4.2.16 LTS export
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  FauxGL Loader  │  LoadOBJ() → Mesh
│  BiUnitCube()   │  Normalize to [-1, +1] cube
└────────┬────────┘
         │
         ▼
┌─────────────────┐  Camera: eye(0,0,3) center(0,0,0) up(0,1,0)
│  Scene Setup    │  FOV: 50°  Aspect: w/h  Near: 0.1  Far: 100
│  Projection     │  Clear: RGB(0.05, 0.04, 0.08) dark purple-black
└────────┬────────┘
         │
         ▼
┌─────────────────┐  Y-spin: angle = t × 0.6 rad/s
│  Model Transform│  X-tilt: 0.3 ± 0.15 × sin(angle × 0.7)
│  (animated)     │  Z-roll: ±0.1 × sin(angle × 0.5)
└────────┬────────┘  Matrix order: Rz × Ry × Rx
         │
         ▼
┌─────────────────┐  Key: dir(0.6, 0.5, 1) color(0.9, 0.92, 1.0) @0.85
│  Two-Light      │  Fill: dir(-0.4, -0.3, 0.5) color(1.0, 0.85, 0.7) @0.3
│  Lambertian     │
└────────┬────────┘  Fragment: Σ(color × intensity × max(0, N·L))
         │
         ▼
┌─────────────────┐
│  ctx.DrawMesh() │  Rasterize 360 triangles → pixel buffer
└────────┬────────┘
         │
         ▼
┌─────────────────┐  Each terminal row = 2 pixel rows
│  Half-Block     │  Top pixel → foreground ANSI color
│  ANSI Encoding  │  Bottom pixel → background ANSI color
│                 │  Character: ▀ (U+2580)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Terminal Output │  ANSI 24-bit color: \x1b[38;2;R;G;Bm
│  (string)       │  Optimization: skip redundant color codes
└─────────────────┘
```

## Resize Behavior

```
Terminal Width    Prism Columns    Formula
─────────────    ─────────────    ───────────────────────
< 80              20              min(max(width/4, 20), 40)
80                20              80/4 = 20
100               25              100/4 = 25
120               30              120/4 = 30
160               40              max = 40
200               40              clamped at 40

Prism rows: always 5 (fixed)
```

## Text Prism Fallback Variants

When the 3D renderer is unavailable (`m.Prism == nil`), a text-based prism is used:

```
Style: gradient (default, 1 line) — Spring-animated ray lengths with gradient
─◁◆▷▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬

Style: simple (1 line)
-<>====

Style: braille (3 lines)
  ─⢀⣠⣤⣄⡀
━━⣾⣿⣿⣿⣷
  ⠈⠉⠛⠛⠛⠛⠛⠛

Style: ascii (5 lines)
        ╱╲
   ━━━╱  ╲
      ╱    ╲━━━
     ╱______╲══════
               ▬▬▬▬▬▬

Style: fancy (1 line)
─◁◆▷▬▬▬▬

Style: compact (1 line)
─◆▬▬
```
