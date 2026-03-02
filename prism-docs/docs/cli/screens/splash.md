---
title: Splash Screen
description: Full-screen procedural animation with rotating icosahedron mesh, beam particles, and spectral wave field.
outline: [2, 3]
---

# Splash Screen

Full-screen procedural animation displayed for 5 seconds on startup (or until any key is pressed). Features a rotating icosahedron mesh, beam particle system, spectral wave field, and centered "P R I S M" title.

## UI Layout

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                                                                              ║
║        ·  .  ,  :  -  =  +  *  #  %  @                                     ║
║     (spectral wave field fills background                                    ║
║      using ASCII density ramp)                                               ║
║                                                                              ║
║              ████████                     ═══════                            ║
║            ██████████████                  ═══════════                       ║
║          ████████████████████               ═══════════════                  ║
║            ██████████████    (beam particles with glow)                      ║
║              ████████                                                        ║
║          (icosahedron mesh                                                   ║
║           with lighting)                                                     ║
║                                                                              ║
║                         P  R  I  S  M                                       ║
║                    ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬                                  ║
║                     spectrum gradient bar                                    ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

## Rendering Pipeline

1. Project 444 mesh vertices through Y/X/Z rotation + perspective
2. Rasterize 360 triangles with barycentric interpolation + back-face culling
3. Build beam light grid from particles with Gaussian glow falloff
4. Compute title layout ("P R I S M", gradient bar, subtitle)
5. Per-cell: combine wave field, beam particles, mesh overlay, halo dimming
6. Stamp title text in near-white (232, 232, 240)
7. Stamp gradient bar using 4-stop spectrum gradient
8. Convert cell grid to ANSI true-color string

## IDE Boost Mode

When running in an IDE terminal (`BoostColors=true`), color parameters are intensified for better visibility against IDE backgrounds.
