# Capture Sources

Load during Step 1 (Genesis) to surface the source vocabulary and guide the selection question.

## The source question

> "Which design sources are you drawing from? Pick any that apply — or describe your own."

## Primary sources

| Source | URL | Kind | Tech stack | Excels at |
|---|---|---|---|---|
| **21st.dev** | https://21st.dev | Component library | React, Tailwind, Radix, shadcn | AI inputs, command palettes, glowing buttons, hero animations, sign-in flows |
| **Aceternity** | https://ui.aceternity.com | Motion components | React, Tailwind, Framer Motion | Animated borders, beam effects, motion-heavy components |
| **Codrops** | https://tympanus.net/codrops | Gallery / experiments | GSAP, WebGL, GLSL | Foundational WebGL + motion reference, tutorials |
| **Unicorn Studio** | https://unicorn.studio | WebGL scenes | WebGL, shaders, scene.json | Rich motion + shader compositions |
| **React Bits** | https://reactbits.dev | Animated components | React, CSS, JS | CSS-only + JS-driven animation effects |
| **Pinterest** | https://ca.pinterest.com/DigitalGriotStudio | Personal curation | taste-curated | Pre-filtered through your eye — highest confidence source |
| **Mobbin** | https://mobbin.com | UX pattern catalog | flows, UX patterns | Mobile/web UX from production apps, onboarding, empty states |
| **Dribbble** | https://dribbble.com | Designer shots | shots, animations | Designer portfolios, animated gifs |

## Additional sources

Users may describe sources outside this list — personal Figma files, physical references, competitor analysis, custom captures. Document these in the capture ledger with `source_type` noted:

```
- custom: "{description}" · kind: {figma | physical | competitor | screenshot}
```

## What's translatable by source type

**Component libraries** (21st, Aceternity, React Bits):
Highest extraction signal — code + visual. Component *structure* carries over; visual treatment is reinterpreted in Griotwave tokens. A shadcn card becomes a glass card; the grid structure stays.

**WebGL / motion galleries** (Codrops, Unicorn):
Aesthetic and technique reference only. The *feeling* and *motion character* carry over; the GLSL shaders don't. Informs motion language assignment in the brand system.

**Personal / curated collections** (Pinterest, Dribbble):
Mood, palette direction, compositional reference. The user's own taste filter makes these the highest-confidence signal for overall direction.

**UX patterns** (Mobbin):
Structural and interaction reference. Informs architecture (flows, empty states, onboarding) not aesthetics. Goes to prism-plan context, not visual companion renders.

## Ingestion infrastructure note

For large reference collections (25+ captures), the fetcher scripts and Workshop Bench gallery live in the `idea_init` plugin. See `.prism/shared/docs/idea_init-plugin-pairing.md` for the plugin relationship. When idea_init is running, its capture ledgers land in `.prism/shared/captures/` and prism-capture reads them directly — skipping the Genesis step.
