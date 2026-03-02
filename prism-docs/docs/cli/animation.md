---
title: Animation System
description: Harmonica spring physics animations — progress bars, story pop effects, log slide-ins, and continuous animations.
outline: [2, 3]
---

# Animation System

All animations are driven by a 100ms tick (`TickMsg`) and use Harmonica spring physics for organic motion.

## Spring Configuration

| Animation | Stiffness | Damping | FPS | Initial | Target | Character |
|-----------|-----------|---------|-----|---------|--------|-----------|
| Progress Bar | 6.0 | 0.7 | 60 | 0.0 | `ProgressPercent()` | Snappy, slight overshoot |
| Story Pop | 8.0 | 0.5 | 60 | 0.3 (start scale) | 1.0 (normal) | Very bouncy |
| Log Slide-In | 5.0 | 0.8 | 60 | 20.0 (x-offset) | 0.0 (settled) | Smooth, minimal overshoot |
| Ray Length | 4.0 | 0.3 | 60 | `{6,5,4,3}` | Random 4–8 | Bouncy, organic |

## Animation Update Loop (per 100ms tick)

```
TickMsg received
    │
    ├── 1. Splash.Tick()                 (if splash active — advance mesh/particles)
    │
    ├── 2. Prism.Tick()                  (advance 3D rotation)
    │
    ├── 3. PrismTick++ → PrismFrame      (every 3 ticks → cycle 4 spectrum colors)
    │
    ├── 4. ShimmerPhase += 0.08          (sine wave, wraps at 2π)
    │       └── prism body brightness oscillation
    │
    ├── 5. RayLengths lerp toward targets (linear 0.1 rate, re-target randomly)
    │
    └── 6. Broadcast to all plugins:
            ├── Spectrum:
            │   ├── Spinner.Update()              (advance frame)
            │   ├── ProgressSpring.Update()       (pos, vel → target)
            │   ├── StoryPopSpring.Update()       (per-story scale → 1.0)
            │   │       └── cleanup when |scale - 1.0| < 0.01
            │   ├── PulsePhase += 0.15            (sine wave, wraps at 2π)
            │   │       └── active story icon brightness
            │   ├── LogSlideSpring.Update()       (per-entry offset → 0.0)
            │   └── RaySpring.Update()            (per-ray length → target)
            └── All other plugins (no-op for most)
```

## Continuous Animations

| Animation | Increment/Tick | Full Cycle | Effect |
|-----------|----------------|------------|--------|
| Pulse | +0.15 rad | ~4.2 seconds | Active story icon brightness oscillation (0.2 → 1.0) |
| Shimmer | +0.08 rad | ~7.85 seconds | Prism body brightness modulation (0.85 → 1.0) |
| Prism Frame | +1 every 300ms | 1.2 seconds | 4-color spectrum rotation on text prism |
| 3D Rotation | 0.6 rad/sec Y-axis | ~10.5 seconds | Full rotation of 3D prism model |
