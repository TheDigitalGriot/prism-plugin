# Brand System Reference

Load during Phase 3 (System) of prism-brand — when applying the approved mark to build the full brand system.

## Color derivation from the ember

Every brand has one ember — the primary accent that all other system colors derive from. Process:

1. **Identify the ember** — what is the brand's primary accent? (picked during Phase 2 refinement)
2. **Map to griotwave semantic names** — even if the brand uses different names, maintain the semantic structure:

```yaml
design_tokens:
  palette:
    void:    "#000"           # always dark substrate
    neural:  "{brand ember}"  # primary accent — replaces neural blue
    bio:     "{derived}"      # affirmative / success — derive from ember at +30° hue
    violet:  "{derived}"      # secondary accent — derive from ember at -30° hue or brand complement
```

3. **Derive the tint/shade ramp** — from the brand ember, generate `{ember}1f` (12% opacity), `{ember}38` (22%), `{ember}55` (33%), `{ember}66` (40%) for bloom, wash, and rim values.
4. **Test the rim catchlight** — `rgba(255,255,255,.13)` works universally; verify it reads against the brand's lightest surface.

## Typography pairing rules

Two typefaces: **display** (headlines, UI labels) + **code/eyebrow** (metadata, technical labels, mono contexts).

| Pair type | Display | Code/eyebrow | Character |
|---|---|---|---|
| Classic | Inter | JetBrains Mono | Griotwave default — neutral authority |
| Warm | Plus Jakarta Sans | IBM Plex Mono | Approachable, editorial |
| Sharp | Neue Haas Grotesk | Fira Code | Technical precision |
| Cultural | Afrik | JetBrains Mono | Identity-first |

**Pairing rationale** — justify the choice against the brainstorm's locked brand values. "We chose Plus Jakarta Sans because the brand locked 'approachable' in Q2 — Inter reads colder."

## Motion language assignment

| Language | Character | Easing | Use when |
|---|---|---|---|
| `ember-bloom` | Warm, organic expansion | `spring 50/22` | Default griotwave — most brands |
| `cinematic` | Slow, deliberate, high-end | `cubic-bezier(.76,0,.24,1)` | Luxury, editorial, fashion |
| `technical` | Precise, instant, mechanical | `cubic-bezier(.4,0,.2,1)` | SaaS, tooling, developer-focused |
| `playful` | Bouncy, energetic | `spring 200/20` | Consumer, gaming, youth |

## Design tokens output block

The final token override block written to the brand spec — this is what prism-design's §3 and the design_prompt.yaml consume:

```yaml
design_tokens:
  palette:
    void:    "#000"
    neural:  "{brand ember hex}"
    bio:     "{derived success hex}"
    violet:  "{derived secondary hex}"
  surface: glassmorphic
  typography:
    display:  "{chosen display face}"
    eyebrow:  "{chosen mono face}"
  motion:
    language: "{assigned language}"
    easing:   "{easing curve}"
```
