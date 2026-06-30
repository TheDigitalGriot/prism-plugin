# Prism Design Studio — Branding Inventory & Rebrand Map (forked open-design engine)

**Date:** 2026-06-29
**Author:** session (first-run + rebrand of `apps/prism-design-studio` surface)
**Status:** Implemented (text + logo rebrand + accent + neutral retheme applied to `prism-design-engine`); design-system consistency plan in §10.
**Scope:** Where "Open Design" branding lives in the `prism-design-engine` fork, what is safe to swap vs. what must NOT be touched, and exactly how the swap was performed and verified.

> Documentarian note: this records what exists and what was changed. It is a map for future rebrand/whitelabel passes.

---

## 1. Context

`apps/prism-design-studio` (in `prism-plugin`) is a thin Node HTTP **relay** (port **7457**) that spawns and fronts the **`prism-design-engine`** child process — a fork of **open-design** (`nexu-io/open-design`, forked as `TheDigitalGriot/prism-design-engine`). The engine is what the broker's `design-gen` service brokers.

The visible product is **three processes**:

| Layer | Port | Serves | Branding present? |
|---|---|---|---|
| Relay (`prism-design-studio/src/server.js`) | 7457 | `/status`, `/launch`, `/stop` (JSON only) | none (control plane) |
| Engine daemon (`prism-design-engine/apps/daemon`, `od` CLI) | 7456 | REST API incl. `/api/skills` (readiness) | API only — **no UI**, `GET /` → 404 |
| **Web UI** (`prism-design-engine/apps/web`, Next.js 16) | 3000 | the actual visual app | **all visible branding lives here** |

**Key realization:** the daemon on 7456 has no page. All user-facing branding is in the **Next.js `apps/web`** app. Start it with `pnpm run dev` (Turbopack) → http://localhost:3000; it proxies `/api` to the daemon on 7456 via `next.config.ts`.

---

## 2. Branding inventory — tiered by safety

### Tier 1 — Visible product brand (SWAP — these are "Open Design" the brand)

| # | What | Location | Original | Mechanism |
|---|---|---|---|---|
| 1 | Browser tab title | `apps/web/app/layout.tsx` (`metadata.title`) | `Open Design` | Next metadata (server-rendered) |
| 2 | Header/nav wordmark token | `apps/web/src/i18n/locales/*.ts` key **`app.brand`** (×19 locales) | `Open Design` | i18n flat key |
| 3 | **Home-hero wordmark** ⚠️ | `apps/web/src/components/HomeHero.tsx:784` `<span className="home-hero__brand-name">` | `Open Design` | **HARDCODED string — NOT the token** |
| 4 | Brand subtitle | `apps/web/src/i18n/locales/*.ts` key **`app.brandSubtitle`** (×19) | `by Nexu Labs` (translated per-locale) | i18n flat key |
| 5 | Brand pill/badge | `app.brandPill` (×19) | `Research Preview` | i18n — *status, not brand; left as-is* |
| 6 | Logo / app icon art | `apps/web/public/{logo.svg, logo.png, brand-icon.svg, app-icon.svg, app-icon.png}` | OD arrow-in-circle mark | static assets |

> ⚠️ **The gotcha (#3):** changing only the `app.brand` i18n token is NOT enough. The **home hero** renders a *separately hardcoded* `Open Design` span (`HomeHero.tsx:784`) and pulls the icon from `/app-icon.svg`. After swapping the token, the home screen still read "Open Design" until this hardcoded span was fixed. Any future rebrand must grep for hardcoded brand strings in `.tsx`, not just i18n keys.

### Tier 2 — Secondary display copy (SWAP — demo/marketing prompt text)

| What | Location | Notes |
|---|---|---|
| Sample-prompt / demo copy | `apps/web/src/i18n/content.*.ts` (16 translated files; 36 total occurrences) | e.g. *"Design the **Open Design** marketing landing page…"*, *"Create the **Open Design** pitch deck…"*. **English base (`content.ts`/`content.en.ts`) had ZERO literal "Open Design"** — only the translations hardcoded it. These are display strings shown as example prompts, safe to swap. |

### Tier 3 — DO NOT TOUCH (functional identifiers + hosted-service references)

| What | Why it must stay |
|---|---|
| `@open-design/*` package names (workspace libs: contracts, daemon, sidecar, platform, …) | Workspace module resolution; renaming breaks every import + `pnpm` graph |
| `open-design` workspace/repo name, root `package.json` `name` | Lockfile / workspace identity |
| `OD_*` env vars (`OD_PORT`, `OD_BIND_HOST`, `OD_DEFAULT_DESIGN_SYSTEM`, …) | **The relay sets `OD_PORT=7456`; the broker's `design-gen` readiness contract depends on it.** Renaming breaks the daemon↔relay↔broker chain |
| `od` CLI bin (`apps/daemon/bin/od.mjs`), `.open-design` data dir | CLI + on-disk state contracts |
| `"Share to Open Design"`, `"Open Design PR"`, `"Open Design AMR"` strings (13 in `.tsx`) + `od plugin publish --to open-design` | These call **Open Design's real hosted marketplace / contribution / analytics (AMR) services**. Relabeling them to "Prism" is *misleading*, not cosmetic — the buttons still POST to open-design's servers. Either disable the features or leave labeled honestly. |
| Code comments mentioning "Open Design" | No UI impact; cosmetic only |

**Replacement safety rule:** a **case-sensitive** `"Open Design"` → `"Prism Design Studio"` swap is safe because every functional identifier is lowercase/underscored (`open-design`, `OD_`, `od`). Never blanket-replace case-insensitively.

---

## 3. i18n structure (important for whitelabel)

- **`apps/web/src/i18n/locales/<lang>.ts`** — flat key→string maps (`'app.brand': '…'`). ~19 languages. The brand keys (`app.brand`, `app.brandSubtitle`, `app.brandPill`) repeat in every file; `app.brand` is left untranslated ("Open Design") across all of them.
- **`apps/web/src/i18n/content.*.ts`** — larger translated content (demo prompts, marketing copy, template strings). English base = `content.ts`.
- **`apps/web/src/i18n/types.ts`** — declares the key union (e.g. `'app.brand': string`), useful to enumerate all brand-ish keys.
- Tests reference flattened keys (`'app.brand': 'Open Design'` in `WorkspaceTabsBar.test.tsx`) — a good discovery breadcrumb.

---

## 4. Logo assets (geometry + how they're consumed)

| File | Dims / viewBox | Color model | Consumed by |
|---|---|---|---|
| `brand-icon.svg` | 444×444 | `currentColor` (monochrome, inherits text color) | inline header/nav mark |
| `logo.svg` | 444×444 | full color, dark bg | standalone logo |
| `app-icon.svg` | 533×533 | gradient rounded-square (spectrum gradient already!) | home hero (`HomeHero.tsx:782` `<img src="/app-icon.svg">`), favicon source |
| `app-icon.png` | 512×512 | raster | `layout.tsx` `icons.icon` / `apple` (browser tab favicon) |

**New Prism mark:** prism triangle refracting an incident beam into a spectrum fan (the classic prism motif — and the app-icon already shipped a spectrum gradient, so it fit naturally). PNG was regenerated from the SVG via the engine's installed **sharp** (`sharp('app-icon.svg', {density:384}).resize(512,512).png()`), since no SVG→PNG CLI was guaranteed on the box. Modern browsers also accept an SVG favicon if PNG raster is undesirable.

---

## 5. Exact commands used (reproducible)

```bash
# Tier 1 wordmark token (all locales, exact key match)
sed -i "s/'app.brand': 'Open Design'/'app.brand': 'Prism Design Studio'/" \
  apps/web/src/i18n/locales/*.ts            # 19 files

# Tier 1 subtitle (value swap regardless of translated 'by'/'von'/'بواسطة')
sed -i "s/'app.brandSubtitle': '[^']*'/'app.brandSubtitle': 'by Griot'/" \
  apps/web/src/i18n/locales/*.ts            # 19 files

# Tier 2 secondary copy (case-sensitive — leaves @open-design / OD_ intact)
sed -i "s/Open Design/Prism Design Studio/g" apps/web/src/i18n/content.*.ts   # 36 → 0

# Tier 1 tab title + hardcoded hero wordmark — edited directly:
#   apps/web/app/layout.tsx          title: 'Open Design' → 'Prism Design Studio'
#   apps/web/src/components/HomeHero.tsx:784  <span ...>Open Design</span> → 'Prism Design Studio'

# Logo PNG regen
node -e "require('sharp')('public/app-icon.svg',{density:384}).resize(512,512).png().toFile('public/app-icon.png')"
```

---

## 6. Verification method

- `curl localhost:3000 | grep <title>` → `Prism Design Studio`.
- Asset 200s: `brand-icon.svg`, `logo.svg`, `app-icon.svg`, `app-icon.png`.
- **chrome-devtools MCP**: `new_page` → `take_snapshot` → `click "Skip for now"` (onboarding) → `take_screenshot`. Confirmed the home hero renders the prism icon + "Prism Design Studio" wordmark. Hard reload (`ignoreCache`) required to flush the hardcoded-span fix + favicon cache.

---

## 7. Still showing "Open Design"-era identity (deliberately left / open questions)

| Item | Where | Decision |
|---|---|---|
| Tagline | `homeHero.subtitlePrefix` = "The open-source Claude Design alternative." | Positioning copy, not "Open Design" brand → left; candidate for a Prism line |
| Top-right toolbar | GitHub `Star · 72.9K`, Discord, etc. | Link to Open Design's real repo/community — external/functional, repoint or hide separately |
| Desktop "pet" (`N` badge, bottom-right) | community-pets default | not brand |
| 13 functional refs | "Share to Open Design" / "Open Design PR" / AMR | hosted-service calls — leave honest or disable |

---

## 8. Color theme (current → Prism) — for the retheme pass

**Engine theme system:** CSS custom properties in `apps/web/src/styles/tokens.css` (203 lines) — a `:root` light theme + a dark override block. One `--accent` family drives all primary CTAs.

**Current (warm "Open Design"/Claude-ish):**
- `--accent: #c96442` (coral/terracotta), `--accent-strong/hover: #b45a3b`, `--accent-soft: #f5d8cb`, `--accent-tint: #fbeee5`
- warm neutrals: light `--bg: #faf9f7`, dark `--bg: #1a1917`; `--text: #1a1916` / dark `#e8e4dc`
- `themeColor: '#F4EFE6'` (`layout.tsx` viewport)
- already-cool: `--selected: #2563eb`

**Prism palette (from `apps/prism-cli` Lipgloss usage — authoritative for the Prism brand):**
- **Primary `#3B82F6`** (blue-500, dominant — 22 uses) → maps to `--accent`
- strong/hover `#2563EB` (blue-600)
- spectrum secondaries: violet `#7C3AED`, amber `#F59E0B`, red `#EF4444`, green `#22C55E`, teal `#14B8A6`, emerald `#10B981`
- cool darks: `#1e1f2e`, `#2c2d3a`, `#363748`
- neutrals: Tailwind gray/slate (`#6B7280`, `#4B5563`, `#1F2937`, `#9CA3AF`)

**Retheme plan:** swap the `--accent*` family (coral → Prism blue `#3B82F6` / `#2563EB`), update `themeColor`, and optionally cool the dark-theme background toward `#1e1f2e`. The semantic accent tints (green/blue/purple/red/amber) already approximate the Prism spectrum and can stay or be aligned to Tailwind values. `--selected` is already Prism blue.

### 8.1 ⚠️ The accent has FOUR layers (critical — `tokens.css` alone does NOT work)

Editing `tokens.css` `--accent` had **zero visible effect**. Live `getComputedStyle` showed `--accent: #c96442` with `--accent-hover: color-mix(... #c96442 90%, #f2ede4)` — values absent from `tokens.css`. The accent is **JS-injected as inline styles on `<html>`**, which beat the stylesheet. There are four layers, in override order (last wins):

1. `apps/web/src/styles/tokens.css` — `--accent*` in `:root` + `[data-theme="dark"]` + `@media (prefers-color-scheme: dark)`. **CSS fallback only** (prevents pre-JS flash).
2. `apps/web/src/state/appearance.ts` — `DEFAULT_ACCENT_COLOR = '#c96442'`; `applyAppearanceToDocument()` calls `root.style.setProperty('--accent', …)` and derives `-strong/-soft/-tint/-hover` via `color-mix`. `ACCENT_SWATCHES[0]` references this const, so changing it also fixes the Settings accent picker.
3. `apps/web/app/layout.tsx` — a **pre-hydration inline `<script>`** (`themeInitScript`) that reads `localStorage['open-design:config']` and sets the same vars before paint; has its **own hardcoded `'#c96442'` fallback** that must be kept in sync (the code comments say so).
4. `localStorage['open-design:config'].accentColor` — **persisted runtime value; overrides everything above.** On this box it already held `#c96442` from first load, so all code edits were masked until this was updated.

**Files changed for the Prism-blue retheme (`#3b82f6` primary, `#2563eb`/`#60a5fa` strong):**
- `tokens.css` — `--accent*` in all 3 blocks (light + 2 dark).
- `appearance.ts:11` — `DEFAULT_ACCENT_COLOR` → `#3b82f6` (also flips swatch[0]).
- `layout.tsx` — pre-hydration script fallback `#c96442` → `#3b82f6`; `themeColor` `#F4EFE6` → `#eff5ff`.
- `styles/viewer/composio.css` — hardcoded `#c96442` → `var(--accent)`.
- **Runtime:** set `localStorage['open-design:config'].accentColor = '#3b82f6'` (or clear it) so persisted state doesn't mask the new default.

**Verified:** live `--accent` = `#3b82f6`, Send button `rgb(59,130,246)`, `--selected` `#2563eb` — brand accent + selection blue now unified. `ACCENT_SWATCHES` is already a spectrum (blue/violet/emerald/red/amber/cyan/pink) — fittingly prism-like.

**Left as product features (NOT chrome — do not touch):** the `coral` entry in `PaletteTweaks.tsx` (a user-selectable *design* palette), pet accent colors (`pets.ts`, `config.ts` DEFAULT_PET), and template-thumbnail SVG fills — these style generated output / features, not the app shell.

---

## 9. Runtime/env notes (carried from first-run)

- Engine requires **node ~24** (native `better-sqlite3` ABI); `nvm use 24.11.1` selected it. `pnpm` self-provisions `10.33.2` via the `packageManager` field.
- `node-pty` build script is skipped by pnpm but loads via prebuilt `win32-x64` binary — not a problem.
- Readiness: relay `/status` `running:true` + engine `/api/skills` 200 → broker `design-gen` flips `error`→`ready`.

---

## 9. Neutral retheme — warm brown → cool slate (done)

The warm-brown neutrals clashed with the cool blue accent ("disjointed"). Unlike `--accent`, the **neutral tokens are pure `tokens.css`** (`appearance.ts` injects only the `--accent*` family), so editing them takes effect directly. Swapped at equal lightness to preserve contrast, pulling the dark ramp toward the prism-cli blue-grays (`#1e1f2e` / `#2c2d3a` / `#363748`):

| Token (dark) | Was (warm) | Now (cool) |
|---|---|---|
| `--bg` / `--bg-app` | `#1a1917` | `#15161e` |
| `--bg-panel` | `#222120` | `#1c1e29` |
| `--bg-subtle` | `#252321` | `#212330` |
| `--bg-muted` | `#2e2c29` | `#2a2d3a` |
| `--bg-elevated` / `--border-soft` | `#2a2825` | `#23252f` |
| `--border` | `#333128` | `#2e303d` |
| `--border-strong` | `#46433c` | `#3a3d4d` |
| `--text` | `#e8e4dc` | `#e4e6ef` |
| `--text-strong` | `#f2ede4` | `#f4f5fb` |
| `--text-muted/-soft/-faint` | `#9a9690 / #6e6b65 / #4e4b46` | `#9b9fb2 / #6d7185 / #4b4f60` |
| `--code-header/-body-bg` | `#1e1e20 / #18181b` | `#1b1d27 / #16171f` |

Light theme cooled too (`--bg #faf9f7→#f7f8fb`, `--bg-panel/-elevated→#fdfdff/#ffffff`, `--text #1a1916→#1a1c22`, `--text-muted/-soft → #6b7280/#9ca3af` Tailwind grays). Applied across all 3 blocks (`:root`, `[data-theme="dark"]`, media query). Backup at `%TEMP%/dslogs/tokens.css.bak`.

> Note: `tokens.css` top comments still say "Open Design — neutral product workspace" / "Open Design action color" (CSS comments, no UI impact) — left for now.

---

## 10. Design-system consistency — the real problem & method

**Reframe:** `tokens.css` is already a *complete* design system — it defines not just color but a **radius scale** ("Shape Consistency Lock"), **motion** (`--ease-out`, `--dur-quick/enter/exit`), **type** (`--serif/--sans/--mono`, prose + code sizing), **elevation** (`--shadow-*`), and a `--selected` state intentionally separate from `--accent`. The "disjointed surfaces" are **not a missing system — they are surfaces drifting OFF these tokens** with hardcoded values. The file comments literally say: *"Off-scale values (7px, 9px, 10px literals) are drift; collapse them to the nearest token."*

### Audit (2026-06-29) — token adoption is already ~95%
| Metric (all CSS minus `tokens.css`) | Count |
|---|---|
| `var(--token)` usages | **9,004** |
| raw hex colors (drift) | **506** |
| raw `rgba()/hsl()` literals | 258 |
| CSS files | 41 (organized `home/`, `viewer/`, `workspace/` + root) |
| components with inline `style={{ color/background/border }}` | 21 |

**Drift is concentrated** (Pareto) — top offenders carry most of the 506:
`home/tasks.css` (67) · `home/entry-layout.css` (48) · `workspace/mention-home.css` (40) · `viewer/routines.css` (33) · `viewer/core.css` (32) · `workspace/artifacts.css` (27) · `viewer/composio.css` (24) · `viewer/tools.css` (23). Fixing ~8 files removes ~60% of the drift.

### Method to make all surfaces consistent
- **Phase 0 — Unify global tokens (DONE):** accent → Prism blue, neutrals → cool slate. Foundation set.
- **Phase 1 — Triage the 506 raw hex into 3 buckets:**
  - (a) **maps to existing token** → replace with `var(--…)` (pure drift, the majority).
  - (b) **legit but un-tokenized** (a value reused across files) → add a new token, then reference it.
  - (c) **intentional one-off** (gradients, illustrations, brand spectrum, generated-design palettes like `PaletteTweaks` `coral`) → keep, add `/* intentional: … */` annotation.
- **Phase 2 — Convert top offenders first** (the ~8 files above) for the biggest visual wins.
- **Phase 3 — Enforce (prevent regression):** the engine already runs a **`scripts/style-policy.test.ts`** via its `guard` script (`pnpm guard`). Extend it (or add a stylelint rule `declaration-property-value-disallowed-list` for hex/rgb) to **fail CI on raw color outside `tokens.css`** + flag inline color styles. This is the lever that keeps the system consistent going forward.
- **Phase 4 — Per-surface visual QA:** screenshot each surface (home, onboarding, chat, `viewer/*`, `workspace/*`, settings) in dark + light, diff against the token palette; fix remaining color **and** spacing/radius/elevation drift (the system covers those too).

**Tooling note:** the chrome-devtools MCP loop (navigate → `getComputedStyle` → screenshot) used for the accent debugging is the per-surface QA harness for Phase 4 — it catches JS-injected/persisted overrides that static CSS audits miss (exactly how the coral-in-`localStorage` was found).

---

## 11. ⭐ Griotwave is the canonical design system (source of truth)

`prism-design-engine/design-systems/griotwave/DESIGN.md` ("the canonical design language of the Griot ecosystem — used across idea_init, prism-plugin, and all Digital Griot Studio products") defines the authoritative palette. **The retheme should target these exact tokens, not the prism-cli approximations.**

| Role | Griotwave token | Value | vs. what was applied |
|---|---|---|---|
| **Primary accent** | Neural | `#3B82F6` | ✅ **exact match** (our `--accent`) |
| Success | Bio | `#10B985` | engine `--green` ≈; align |
| Warm/hover bloom | Flare | `#F97316` | engine `--amber` ≈; align |
| Deferred | Violet | `#A855F7` | engine `--purple` ≈; align |
| Danger | Beacon | `#FF0033` | engine `--red` ≈; align |
| Page bg | Void | `#000000` | ⚠️ we used `#15161e` (slate) — Griotwave wants near-black |
| Card / panel | Graphite | `#0E0F11` | ⚠️ we used `#1c1e29` |
| Card hover | Ash | `#111111` | ⚠️ — |
| Text | Voice | `#FFFFFF` | ✅ ≈ |
| Glass surface | — | `rgba(255,255,255,0.04)` | glassmorphic; engine uses solid panels |
| Motion | ember-bloom | `cubic-bezier(0.16,1,0.3,1)` @ 220–280ms | engine `--ease-out` `cubic-bezier(0.23,1,0.32,1)` — align |

**Key deltas to reach true Griotwave:** (1) accent is already correct; (2) darken the dark substrate to Void/Graphite/Ash (near-black, not slate); (3) Griotwave is **dark-only** (no light mode / no white bg) — decide whether to keep the engine's light theme or drop it; (4) adopt glassmorphic surface treatment + the ember-bloom motion curve. This makes §10's "consistent design system" effort concrete: **map every surface onto Griotwave tokens.** The cool-slate neutrals applied 2026-06-29 are a directional improvement over the browns but are an interim step, not the Griotwave target.
