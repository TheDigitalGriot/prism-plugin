# Design Sources

Load when the visual companion is accepted AND the work is visual or brand-driven. Ask about design sources before rendering the first companion screen.

## The source question

> "What design sources are you drawing from? This tells me which visual vocabulary to translate into the Griotwave register."

| Source | Kind | Tech stack | What it excels at |
|---|---|---|---|
| **21st.dev** | Component library | React, Tailwind, Radix, shadcn | AI inputs, command palettes, glowing buttons, hero animations |
| **Aceternity** | Motion components | React, Tailwind, Framer Motion | Animated borders, beam effects, motion-heavy layouts |
| **Codrops** | Gallery / experiments | GSAP, WebGL, GLSL | Foundational WebGL + motion reference |
| **Unicorn Studio** | WebGL scenes | WebGL, shaders, scene.json | Rich motion + shader compositions |
| **React Bits** | Animated components | React, CSS, JS | CSS-only + JS-driven animation effects |
| **Pinterest** | Personal curation | taste-curated | Pre-filtered through your eye — highest confidence |
| **Mobbin** | UX pattern catalog | flows, UX patterns | Production UX: onboarding, empty states, flows |
| **Dribbble** | Designer shots | shots, animations | Designer portfolios, animated gifs |

## What the answer unlocks

**In companion renders** — when rendering a Translation Canvas screen, the source pane shows the reference as-captured; the Griotwave pane translates it. The tech stack tells Claude what's structurally translatable vs aesthetically reference-only.

**In the design_prompt.yaml** — source selections populate the vocabulary context for Claude Design.

**In prism-capture ledgers** — if `.prism/shared/captures/` has a ledger for this project, the sources are already documented there. Skip this question; use the ledger's source vocabulary instead.

## Translatability by category

- **Component libraries** (21st, Aceternity, React Bits) — code + visual. What the component *does* carries over; what it looks like is reinterpreted in Griotwave tokens.
- **WebGL / motion** (Codrops, Unicorn) — aesthetic and technique reference only. The feeling carries; the GLSL doesn't.
- **Curated collections** (Pinterest, Dribbble) — mood, palette direction, compositional reference.
- **UX patterns** (Mobbin) — structural and interaction patterns. Informs architecture, not aesthetics.
