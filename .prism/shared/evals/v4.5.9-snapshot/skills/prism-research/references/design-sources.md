# Design Sources Reference

Full catalog of UX/UI inspiration sources with ingestion strategies. Load when spawning a `web-search-researcher` agent for visual/UI research, or when assessing which sources to consult for a design or UI question.

## Code-first component libraries
Highest extraction signal — code + visual. Direct copy-paste source.

| Source | URL | Excels at | Status |
|---|---|---|---|
| 21st.dev | https://21st.dev | AI inputs, command palettes, glowing buttons, hero animations, sign-in flows | PRODUCTION — 25 captures via `21st-fetch.ps1` |
| Aceternity | https://ui.aceternity.com | Framer Motion + Tailwind, animated borders, beam effects | NEW — needs fetcher |
| React Bits | https://reactbits.dev | Animated React, CSS-only + JS-driven effects | NEW — needs fetcher |
| FreeFrontend (Three.js) | https://freefrontend.com/three-js | Three.js demos, WebGL code snippets | NEW — needs fetcher |

## Curated design galleries
Live-site links — weekly browse, two-stage capture (index page → dive into each link).

| Source | URL | Excels at | Status |
|---|---|---|---|
| Codrops | https://tympanus.net/codrops | WebGL + GSAP experiments, foundational motion reference | PRODUCTION — 6 captures via `codrops-fetch.ps1` |
| details.so | https://www.details.so/inspo | Hero sections, transitions, animations — weekly curated | NEW |
| Lapa Ninja | https://www.lapa.ninja | Landing page gallery, clean curation | NEW |
| Lapa 3D subset | https://www.lapa.ninja/category/3d-websites | 3D web — R3F-relevant | NEW |
| Designer Daily Report | https://designerdailyreport.com | Daily designer picks, newsletter format | NEW |
| OffscreenCanvas | https://offscreencanvas.com/issues | Single-issue zine, shader technique deep-dives | NEW — same shape as Codrops |

## UX pattern catalogs
Authoritative source for "what does good X look like" in production apps.

| Source | URL | Excels at | Status |
|---|---|---|---|
| Mobbin | https://mobbin.com | Mobile/web UX from real apps — onboarding, empty states, checkout, flows | NEW — auth-gated |

## Personal + social collections
Already curated — highest confidence signal.

| Source | URL | Excels at | Status |
|---|---|---|---|
| Pinterest (DigitalGriotStudio) | https://ca.pinterest.com/DigitalGriotStudio | Pre-filtered through your eye — taste-curated, highest priority NEW source | NEW |
| Dribbble | https://dribbble.com | Designer portfolios, shots, animated gifs | NEW |

## WebGL / motion scenes
Visual and technique reference — not code-portable. Aesthetic + motion character carry over.

| Source | URL | Excels at | Status |
|---|---|---|---|
| Unicorn Studio | https://unicorn.studio | Rich WebGL compositions, scene.json | PRODUCTION — `unicorn-fetch.ps1` handles individual scenes; `/inspiration` catalog crawler needed |
| OffscreenCanvas | https://offscreencanvas.com | Single-issue shader deep-dives | NEW |

## MCP audit (June 2026)

- **Chrome MCP** — universal capture path for all sources above. No purpose-built MCPs exist for Pinterest, Dribbble, Mobbin, Aceternity, ReactBits, Codrops, 21st, or Unicorn.
- **Figma MCP** (`mcp.figma.com/mcp`) — destination tool only, not a source. Tools: `generate_diagram`, `get_design_context`, `get_screenshot`, `get_metadata`, `create_design_system_rules`, `get_variable_defs`.

## Ingestion infrastructure

Fetcher scripts (`21st-fetch.ps1`, `codrops-fetch.ps1`, `unicorn-fetch.ps1`) and the aggregated Workshop Bench gallery live in the `idea_init` plugin. Each capture produces:
- `metadata.json` — normalized index
- Raw artifacts (registry.json, srcdoc.html, scene.json + extracted GLSL shaders)
- Standalone `index.html` viewer
- `preview.png`

See `.prism/shared/docs/idea_init-plugin-pairing.md` for the full plugin relationship and handoff protocol when idea_init is installed alongside prism.
