# Fidelity Engine

When the visual companion is running, every screen Claude renders has a **fidelity level** that signals how polished the mockup should look. The companion's frame template defines three levels via a `data-fidelity` attribute on the body (or any fragment root).

## Levels

| Level | Vocabulary | What it looks like | When |
|---|---|---|---|
| `lo` | sketch | dashed borders, desaturated, no glass blur, no bloom — wireframe energy | early questions, throwaway exploration |
| `mid` | structured | solid borders, light blur, no bloom — functional but unpolished | once direction is forming |
| `hi` | polished | full griotwave glass — backdrop blur, ember bloom, neural-blue accents | confirmed picks, ceremonial final render |

### Canonical values (authoritative — sourced from idea_init `view_translate.jsx`)

These are the hand-tuned numbers behind each level. Use them when implementing the CSS variable cascade or when generating inline styles that need to match the fidelity system precisely:

| Level | `blur` (px) | `saturate` (%) | `bloom` (opacity) | `rim` (border opacity) | `radius` (px) | Border style |
|-------|------------|---------------|------------------|----------------------|--------------|-------------|
| `lo`  | `0`        | `100`         | `0`              | `.07`                | `6`          | `dashed`    |
| `mid` | `8`        | `118`         | `.26`            | `.09`                | `14`         | `solid`     |
| `hi`  | `40`       | `140`         | `.55`            | `.13`                | `20`         | `solid`     |

**Level notes (verbatim from source):**
- `lo` — "structure only — dashed rims, no glass, embers desaturate to white"
- `mid` — "color + light blur return · embers tint · depth begins"
- `hi` — "full frost · three-layer bloom on the primary affordance · ceremonial"

**CSS variable mapping:**

```css
/* lo */
--fidelity-blur: 0px;       --fidelity-saturate: 100%;
--fidelity-bloom: 0;        --fidelity-rim: .07;
--fidelity-radius: 6px;     --fidelity-border: dashed;

/* mid */
--fidelity-blur: 8px;       --fidelity-saturate: 118%;
--fidelity-bloom: .26;      --fidelity-rim: .09;
--fidelity-radius: 14px;    --fidelity-border: solid;

/* hi */
--fidelity-blur: 40px;      --fidelity-saturate: 140%;
--fidelity-bloom: .55;      --fidelity-rim: .13;
--fidelity-radius: 20px;    --fidelity-border: solid;
```

The bloom value drives the radial-gradient intensity on the primary affordance: `radial-gradient(120% 90% at 100% 0%, {ember}{bloom×26 as hex}, transparent 55%)` and the box-shadow glow: `0 0 {bloom×60}px 0 {ember}{bloom×60 as hex}`.

CSS variables `--fidelity-blur`, `--fidelity-shadow`, `--fidelity-bloom`, `--fidelity-border-style`, `--fidelity-saturate`, `--fidelity-rim`, `--fidelity-radius` are reshaped by `[data-fidelity="lo|mid|hi"]` selectors in `frame-template.html`. New components reference these instead of hard-coding effects.

## Classifier

Every user message is one of:

- **decide** → user committed to a pick. Advance to the next question. Render the next screen at the carry-forward fidelity (or `lo` if no carry-forward yet). **Append the pick to `decisions[]` in `state/decisions.json`** (see `drawer-state.md`).
- **clarify** → user wants more detail or comparison on the *current* question. Re-render the current screen one fidelity level higher (`lo` → `mid` → `hi` → stays `hi`).
- **park** → user (or you, when a side concern surfaces mid-flow) wants to defer this question without answering it. **Append to `parked[]` in `state/decisions.json`** with a back-pointer to the question it branched from. Carry on with the original question. Parked items are NOT unanswered — they are deferred on purpose, and the final design doc carries them as "Deferred Concerns".

The user signals **park** with phrases like *"park this"*, *"defer that"*, *"come back to it later"*, or any explicit call-out. You may also park on your own when a clarifying side-thread is clearly out-of-scope for the current question — but say so explicitly so the user can override.

## Slash-command override

The user can jump fidelity at any point with an explicit command. These take precedence over the classifier for the next render only:

- `/lo` — render the next screen at `lo`
- `/mid` — render the next screen at `mid`
- `/hi` — render the next screen at `hi`

After the override fires, carry-forward resumes from the override level.

## Carry-forward rule

Fidelity persists across questions. If you escalated Q2 to `mid`, Q3 starts at `mid` automatically. Downshifting is explicit (slash command or a fresh `decide` after a long lull).

## Final-hi ceremonial rule

The **last** decision-confirm screen before the design document is **always** rendered at `hi`, regardless of the carry-forward state. This is the ceremonial render — the finished prototype the user signs off on. Do not skip it.

## How to set fidelity in HTML

Set `data-fidelity` on the root element of the fragment Claude writes to `$SCREEN_DIR`:

```html
<div data-fidelity="lo" class="options">
  <div class="option" data-choice="A">...</div>
  <div class="option" data-choice="B">...</div>
</div>
```

For full documents, set it on `<body data-fidelity="hi">`. The CSS cascade does the rest — components automatically pick up the level via the `--fidelity-*` variables.
