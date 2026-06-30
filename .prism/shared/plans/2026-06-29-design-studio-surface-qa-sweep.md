# Plan — Prism Design Studio: Full Surface QA Sweep & Design-System Consistency

**Date:** 2026-06-29
**Status:** Planned (not started — deferred by request after brown→slate retheme)
**Target repo:** `prism-design-engine` (the forked open-design Next.js app, `apps/web`)
**Companion:** research/findings in `.prism/shared/research/2026-06-29-prism-design-studio-rebrand.md` (§10)
**Goal:** Make every surface of the Design Studio UI render from one coherent token system (Prism theme), eliminate the "disjointed surfaces" feel, and prevent regression.

---

## Problem statement

After the Prism rebrand + accent + neutral retheme, surfaces still feel disjointed in places. Root cause (quantified 2026-06-29): **token adoption is ~95%** (`9,004` `var(--token)` vs `506` raw hex + `258` raw `rgba()/hsl()` + `21` inline-styled components). The design system (`tokens.css`: color, radius "Shape Consistency Lock", motion, type, elevation) already exists — surfaces just **drift off it** with hardcoded values. This is a cleanup + enforcement effort, not a redesign.

## Non-goals

- No new visual language / no redesign of layouts.
- No change to `@open-design/*`, `OD_*`, `od`, `.open-design`, or hosted-service ("Share to Open Design"/AMR) features.
- No change to generated-artifact palettes (`PaletteTweaks` `coral`, design-systems/*, pet colors) — those are product features, not app chrome.

---

## Surfaces inventory (QA targets)

CSS organized under `apps/web/src/styles/`: `home/`, `viewer/`, `workspace/` + roots (`shell.css`, `chat.css`, `primitives.css`, `entrance.css`, `design-system-flow.css`, `social-share.css`). Plus routes: onboarding (`/onboarding`), home (`/`), workspace/chat, the `viewer/*` panels (routines, memory, library, theater, code, tools, templates-plugins, composio, pets, plugin-rail/inputs), settings dialog, new-project modal, marketplace, integrations.

**Drift hotspots (Pareto — fix first):**
| File | raw hex |
|---|---|
| `home/tasks.css` | 67 |
| `home/entry-layout.css` | 48 |
| `workspace/mention-home.css` | 40 |
| `viewer/routines.css` | 33 |
| `viewer/core.css` | 32 |
| `workspace/artifacts.css` | 27 |
| `viewer/composio.css` | 24 |
| `viewer/tools.css` | 23 |
| `home/home-hero.css` | 21 |
| `viewer/memory.css` | 21 |
→ ~8–10 files hold ~60% of all drift.

---

## Phases

### Phase 1 — Triage the raw colors (no visual change yet)
For each of the 506 hex + 258 rgba/hsl occurrences, bucket:
- **(a) maps to an existing token** → replace with `var(--…)`. (Expected majority.)
- **(b) legit but un-tokenized** (same value reused ≥2 places, no token) → add a token to `tokens.css` (both themes), then reference it. Candidates likely: extra surface elevations, scrim/overlay alphas, focus-ring blues.
- **(c) intentional one-off** (gradients, illustrations, brand spectrum, status colors already covered by `--green/--blue/...`) → keep, add `/* intentional: <reason> */`.
Deliverable: a triage table (file → line → bucket → target token).

### Phase 2 — Convert hotspots (biggest visual win)
Apply (a)/(b) to the top ~10 files. Screenshot each surface **before/after, dark + light**, via the chrome-devtools loop. Verify computed colors resolve to tokens (`getComputedStyle`).

### Phase 3 — Inline-style drift (21 components)
Find `style={{ color/background/border }}` in `.tsx`; move to classes or token-driven inline vars. Leave data-driven dynamic colors (e.g., user-chosen palette swatches) — annotate.

### Phase 4 — Enforcement (stop regression)
- Extend the engine's existing **`scripts/style-policy.test.ts`** (run by `pnpm guard`) or add **stylelint** with `declaration-property-value-disallowed-list` to **fail on raw hex/rgb outside `tokens.css`** (allowlist a curated set).
- Add a check flagging new inline color styles in components.
- Wire into CI / pre-push.

### Phase 5 — Beyond color (same system, finish the job)
Audit **radius** (off-scale `7px/9px/10px` literals → `--radius-*`), **spacing**, **motion** (non-`--ease-out` curves, `ease-in` is banned per AGENTS.md), **elevation** (raw box-shadows → `--shadow-*`). The `tokens.css` comments already define these scales; collapse drift to them.

---

## Success criteria

### Automated (runnable)
- [ ] `grep -rE '#[0-9a-fA-F]{3,8}' apps/web/src/styles --include=*.css | grep -v tokens.css | wc -l` → **near 0** (only allowlisted).
- [ ] `pnpm guard` (with extended style-policy) **passes** and **fails** on a deliberately-introduced raw hex (negative test).
- [ ] `pnpm --filter @open-design/web typecheck` and existing web tests pass.
- [ ] No new `style={{...color...}}` introduced (lint check).

### Manual (human QA)
- [ ] Each surface screenshotted dark + light; no warm/cool clash, no off-palette accent, consistent borders/elevation.
- [ ] Onboarding → home → chat → each viewer panel → settings read as one product.
- [ ] Accent + selection states coherent (`--accent` vs `--selected`) on every surface.

---

## Tooling / harness

- **Per-surface QA:** chrome-devtools MCP loop — `new_page`/`navigate` → `take_snapshot` → click into surface → `take_screenshot` + `evaluate_script(getComputedStyle)`. Catches JS-injected/persisted overrides static audits miss (how the `localStorage` coral accent was found).
- **Theme verification:** confirm both `data-theme="dark"` and light render from tokens; check `prefers-color-scheme` path too (3 token blocks in `tokens.css`).
- Run the Studio: `nvm use 24.11.1`; engine via relay (:7457→:7456); web `pnpm run dev` (:3000).

---

## Estimated effort

- Phase 1 (triage): ~1 session (mostly mechanical + categorization).
- Phase 2–3 (convert hotspots + inline): 1–2 sessions.
- Phase 4 (enforcement): ~half session.
- Phase 5 (radius/spacing/motion/elevation): 1 session.
Total ≈ 3–4 focused sessions. Pareto means Phase 2 alone removes ~60% of visible drift.

---

## Source of truth: Griotwave

The target token set is **`prism-design-engine/design-systems/griotwave/DESIGN.md`** (the canonical Griot ecosystem design language). Phase 1 triage maps every surface color onto Griotwave tokens — not ad-hoc values:

- Primary accent **Neural `#3B82F6`** (already applied ✅) · Success **Bio `#10B985`** · Warm **Flare `#F97316`** · Deferred **Violet `#A855F7`** · Danger **Beacon `#FF0033`**
- Substrate (dark-only): **Void `#000`** page · **Graphite `#0E0F11`** cards · **Ash `#111111`** hover · **Voice `#FFF`** text
- Glassmorphic surfaces (`rgba(255,255,255,0.04)`) + ember-bloom motion (`cubic-bezier(0.16,1,0.3,1)` 220–280ms)

**Decision needed before Phase 2:** Griotwave is dark-only — either drop the engine's light theme or treat Griotwave as the dark-theme spec and keep a separate light token set. The interim cool-slate neutrals (applied 2026-06-29) should be darkened to Void/Graphite/Ash to match.
