# Griotwave Design System

Griotwave is the visual language underlying all prism visual output — the brainstorm visual companion, the design_prompt.yaml, and Claude Design emits. Load this when you need the canonical token values or need to understand what "in the Griotwave register" means concretely.

## Token source

Canonical W3C-style tokens:
`C:\Users\digit\Developer\SkillsForge\griotwave\griotwave-library\griotwave.tokens.json`

The `port-griotwave.cjs` script in `scripts/` reads this file and rewrites the marker block in `frame-template.html`. Run it after griotwave token updates.

## Palette

```
void      #000          deepest background
ink       #030303
obsidian  #050505
graphite  #0E0F11
ash       #111

neural    #3B82F6       primary accent — neural blue (default ember)
bio       #10B981       affirmative / success — bio green
violet    #A855F7       secondary accent
solar     #F59E0B       warning / energy
beacon    #EF4444       error / critical
```

**Text opacity ladder (semantic tokens):**
```
voice     #fff                         primary text
echo      rgba(255,255,255,0.85)
whisper   rgba(255,255,255,0.60)
footstep  rgba(255,255,255,0.40)
ghost     rgba(255,255,255,0.20)
```

## Surface

```
glassmorphic    backdrop-filter: blur(40px) saturate(140%)
haze-04         rgba(255,255,255,.04)     subtle background fill
haze-05         rgba(255,255,255,.05)
rim-08          rgba(255,255,255,.08)     default border
rim-10          rgba(255,255,255,.10)
rim-15          rgba(255,255,255,.15)
```

## Typography

```
display   Inter (variable)
eyebrow   JetBrains Mono
special   Afrik (display-only, culture-specific projects)
```

## Motion

```
language    ember-bloom
easing      spring 50/22
tale        220ms var(--tale)     UI interactions
song        320ms var(--tale)     fidelity transitions, scene shifts
```

## Embers

Each project or brand has one **ember** — a primary accent color derived from its register. The neural blue `#3B82F6` is the griotwave default. Projects override this with their own:

```yaml
# Example override in design_tokens block
design_tokens:
  palette: { void: "#000", neural: "#A855F7", ... }  # violet ember for this brand
```

## The ember-bloom system

At `hi` fidelity, the primary affordance (button, CTA, key action) gets three-layer bloom:

1. `radial-gradient` behind the element: `radial-gradient(120% 90% at 100% 0%, {ember}{bloom-hex}, transparent 55%)`
2. `box-shadow` glow: `0 0 {bloom×60}px 0 {ember}{bloom-hex}`
3. CSS transition: `all 320ms var(--tale)` — escalates smoothly with fidelity level

See `fidelity-engine.md` for exact bloom opacity values per level (`lo: 0`, `mid: .26`, `hi: .55`).

## Rim catchlight principle

Every interactive surface has a rim catchlight — a subtle top-edge highlight that implies depth under ambient light. Applied via `border-top: 1px solid rgba(255,255,255,.13)` at `hi` fidelity. At `lo`, rims are dashed and desaturated. The rim is what makes a flat glass card feel like it's catching real light.
