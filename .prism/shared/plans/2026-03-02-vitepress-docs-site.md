---
title: VitePress Documentation Site
date: 2026-03-02
status: draft
research: .prism/shared/research/2026-03-02-vitepress-docs-site.md
spec: .prism/shared/docs/prism-docs-site-prompt.md
source: .prism/shared/docs/PRISM-DOCUMENTATION-2.3.5.md
---

# Plan: VitePress Documentation Site for Prism

## Goal

Split the 5,726-line `PRISM-DOCUMENTATION-2.3.5.md` into ~60 individual VitePress pages with a spectral-themed documentation site in `prism-docs/`.

## Success Criteria

#### Automated Verification
- [x] `cd prism-docs && npm run docs:build` completes without errors
- [x] All sidebar links resolve (no 404s during dev server)
- [x] Code blocks have syntax highlighting

#### Manual Verification
- [ ] Spectral theme renders in dark mode (dark bg, gradient bar, brand colors)
- [ ] Light mode is clean with same brand blue accent
- [ ] Local search (MiniSearch) works across all pages
- [ ] Hero landing page shows gradient name, tagline, 3 action buttons, features
- [ ] Content is complete — no sections lost from source doc
- [ ] Internal cross-references point to correct new page paths

## What We're NOT Doing

- No Algolia search setup
- No GitHub Pages deployment configuration (base stays `/`)
- No custom Vue components beyond theme CSS overrides
- No automated link-rewriting script — manual split with correct links
- Not adding `prism-docs` to root npm workspaces

---

## Phase 1: Scaffold & Config

**Goal**: Working VitePress shell with spectral theme, before any content.

### Steps

1. Create `prism-docs/package.json`:
   ```json
   {
     "name": "prism-docs",
     "private": true,
     "scripts": {
       "docs:dev": "vitepress dev docs",
       "docs:build": "vitepress build docs",
       "docs:preview": "vitepress preview docs"
     }
   }
   ```

2. Install: `cd prism-docs && npm add -D vitepress@next vue`

3. Create `prism-docs/docs/.vitepress/config.ts`:
   - `defineConfig()` with full sidebar (5 collapsible groups)
   - Top nav: Prism logo + Guide, CLI, VS Code, Electron, Monorepo links + GitHub
   - `base: '/'`, `cleanUrls: true`, `lastUpdated: true`
   - `markdown: { lineNumbers: true }`
   - `search: { provider: 'local' }`
   - `outline: { level: [2, 3] }`
   - `head` with meta description + favicon placeholder

4. Create `prism-docs/docs/.vitepress/theme/index.ts`:
   - Extend DefaultTheme
   - Import `./custom.css`

5. Create `prism-docs/docs/.vitepress/theme/custom.css`:
   - `:root` overrides: brand colors (#6366f1)
   - `.dark` overrides: bg #0a0a0f, surface #12121a, elevated #1a1a25, code-block #0f0f18
   - Hero gradient name background
   - Top 3px spectral gradient bar (`body::before`)
   - Light mode: clean with same brand blue

6. Create placeholder `prism-docs/docs/index.md` (hero page)

### Verification
- `cd prism-docs && npm run docs:dev` starts dev server
- Landing page shows with spectral theme

---

## Phase 2: Content Split — Landing + Overview + Part I (Plugin)

**Goal**: Hero page, overview table, and all 13 Plugin pages.

### Source lines → Target files

| Source Section (line start) | Target File |
|---|---|
| Hero (new) | `docs/index.md` |
| Overview table (line 110) | `docs/overview.md` |
| Plugin Overview + What Makes It Different (128–143) | `docs/plugin/index.md` |
| Plugin Manifest & Distribution (144–181) | `docs/plugin/manifest.md` |
| Three-Layer Architecture (182–228) | `docs/plugin/architecture.md` |
| Commands Reference (229–297) | `docs/plugin/commands.md` |
| Agents Reference (298–348) | `docs/plugin/agents.md` |
| Skills Reference (349–447) | `docs/plugin/skills.md` |
| Scripts & Automation (448–511) | `docs/plugin/scripts.md` |
| Model Assignment Convention (512–581) | `docs/plugin/model-assignment.md` |
| Component Invocation Graph (582–686) | `docs/plugin/invocation-graph.md` |
| Data Flow Through .prism/ (687–764) | `docs/plugin/data-flow.md` |
| Behavioral Principles (765–820) | `docs/plugin/behavioral-principles.md` |
| Plugin Directory Structure (821–917) | `docs/plugin/directory-structure.md` |
| Plugin Statistics (918–993) | `docs/plugin/statistics.md` |

### Steps

1. Create `docs/index.md` with full hero frontmatter (name, tagline, actions, features)
2. Create `docs/overview.md` with overview table and intro from lines 110–123
3. Create all 13 `docs/plugin/*.md` files with:
   - Frontmatter: `title`, `description`, `outline: [2, 3]`
   - Full content extracted from source lines
   - All code blocks, tables, diagrams preserved intact

### Verification
- All 15 files created and accessible in sidebar
- No content lost from Part I sections

---

## Phase 3: Content Split — Part II (CLI Dashboard)

**Goal**: All CLI pages including 11 screen sub-pages.

### Source lines → Target files

| Source Section (line start) | Target File |
|---|---|
| CLI Overview (994–1052) | `docs/cli/index.md` |
| Architecture (1053–1262) | `docs/cli/architecture.md` |
| Getting Started (1263–1338) | `docs/cli/getting-started.md` |
| Plugin System (1339–1439) | `docs/cli/plugin-system.md` |
| **Screen Reference — 11 screens** (1440–2243) | `docs/cli/screens/*.md` |
| App Shell (2244–2347) | `docs/cli/app-shell.md` |
| Modal & Dialog Systems (2348–2402) | `docs/cli/modals.md` |
| User Flow Diagrams (2403–2486) | `docs/cli/user-flows.md` |
| Execution State Machine (2487–2624) | `docs/cli/state-machine.md` |
| Animation System (2625–2677) | `docs/cli/animation.md` |
| 3D Prism Rendering (2678–2777) | `docs/cli/3d-rendering.md` |
| Splash Screen Rendering (2778–2820) | `docs/cli/splash-rendering.md` |
| Domain Models (2821–2932) | `docs/cli/domain-models.md` |
| Claude CLI Integration (2933–3039) | `docs/cli/claude-integration.md` |
| Terminal Detection (3040–3086) | `docs/cli/terminal-detection.md` |
| Diff System (3087–3112) | `docs/cli/diff-system.md` |
| Keyboard Reference (3230–3396) | `docs/cli/keyboard.md` |
| Styling Reference (3397–3495) | `docs/cli/styling.md` |
| Vertical Layout & Height Budget (3496–3629) | `docs/cli/layout.md` |
| Configuration (3630–3736) | `docs/cli/configuration.md` |

**Note**: Lines 3113–3229 cover File Watcher, Persisted UI State, Global Workspace Registry — these map into the `configuration.md` page or as part of adjacent CLI pages.

### Screen Reference sub-pages (from within lines 1440–2243)

Each screen section within the Screen Reference gets its own file under `docs/cli/screens/`:
- `splash.md`, `onboarding.md`, `home.md`, `research.md`, `plans.md`, `spectrum.md`, `files.md`, `git.md`, `agent.md`, `monitor.md`, `workspaces.md`

### Steps

1. Create `docs/cli/index.md` — overview section
2. Create 11 screen pages in `docs/cli/screens/`
3. Create remaining 16 CLI pages
4. Preserve ALL code blocks (Go, bash), ASCII diagrams, tables

### Verification
- All ~27 CLI files created
- Sidebar "Screens" sub-group renders correctly

---

## Phase 4: Content Split — Part III (VS Code Extension)

**Goal**: All 15 VS Code Extension pages.

### Source lines → Target files

| Source Section (line start) | Target File |
|---|---|
| VS Code Extension Overview (3739–3769) | `docs/vscode/index.md` |
| Extension Architecture (3770–3842) | `docs/vscode/architecture.md` |
| Extension Source Structure (3843–3987) | `docs/vscode/source-structure.md` |
| Core Orchestrator — PrismController (3988–4031) | `docs/vscode/controller.md` |
| IPC Architecture (4032–4069) | `docs/vscode/ipc.md` |
| Sidebar Webview (4070–4101) | `docs/vscode/sidebar.md` |
| Bottom Panel Webview (4102–4136) | `docs/vscode/bottom-panel.md` |
| Native Tree Views & Status Bar (4137–4168) | `docs/vscode/tree-views.md` |
| Commands & Keybindings (4169–4249) | `docs/vscode/commands.md` |
| Extension Settings (4250–4263) | `docs/vscode/settings.md` |
| Workflow State Machine (4264–4290) | `docs/vscode/state-machine.md` |
| Spectrum Execution (4291–4326) | `docs/vscode/spectrum.md` |
| Plugin Skill Integration (4327–4376) | `docs/vscode/plugin-skills.md` |
| Office Visualization (4377–4409) | `docs/vscode/office.md` |
| Extension Technology Stack (4410–4468) | `docs/vscode/tech-stack.md` |

### Steps
1. Create all 15 `docs/vscode/*.md` files with frontmatter
2. Preserve code blocks (TypeScript, JSON), architecture diagrams, tables

### Verification
- All 15 files created and accessible in sidebar

---

## Phase 5: Content Split — Part IV (Electron Desktop App)

**Goal**: All 13 Electron pages.

### Source lines → Target files

| Source Section (line start) | Target File |
|---|---|
| Electron App Overview (4473–4528) | `docs/electron/index.md` |
| Electron Architecture (4529–4617) | `docs/electron/architecture.md` |
| Electron Source Structure (4618–4741) | `docs/electron/source-structure.md` |
| Main Process & Window Management (4742–4817) | `docs/electron/main-process.md` |
| Preload & Context Bridge (4818–4863) | `docs/electron/preload.md` |
| IPC Bridge — Electron Transport (4864–4963) | `docs/electron/ipc-bridge.md` |
| ElectronPrismController (4964–5072) | `docs/electron/controller.md` |
| Platform Modules (5073–5164) | `docs/electron/platform-modules.md` |
| Webview UI — React SPA (5165–5256) | `docs/electron/webview-ui.md` |
| State Management (5257–5347) | `docs/electron/state-management.md` |
| Build & Packaging (5348–5429) | `docs/electron/build.md` |
| Security Hardening (5430–5461) | `docs/electron/security.md` |
| Three-Platform Feature Parity (5462–5512) | `docs/electron/feature-parity.md` |

### Steps
1. Create all 13 `docs/electron/*.md` files with frontmatter
2. Preserve code blocks (TypeScript, JSON, bash), tables, diagrams

### Verification
- All 13 files created and accessible in sidebar

---

## Phase 6: Content Split — Part V (Monorepo Architecture)

**Goal**: All 7 Monorepo pages.

### Source lines → Target files

| Source Section (line start) | Target File |
|---|---|
| Repository Structure (5519–5533) | `docs/monorepo/index.md` |
| npm Workspaces (5534–5556) | `docs/monorepo/workspaces.md` |
| packages/prism-core (5557–5607) | `docs/monorepo/prism-core.md` |
| packages/prism-ui (5608–5678) | `docs/monorepo/prism-ui.md` |
| Platform Shell Responsibilities (5679–5691) | `docs/monorepo/platform-shells.md` |
| Development Workflow (5692–5711) | `docs/monorepo/dev-workflow.md` |
| Production Hardening (5712–5726) | `docs/monorepo/production-hardening.md` |

### Steps
1. Create all 7 `docs/monorepo/*.md` files with frontmatter
2. Preserve code blocks, tables

### Verification
- All 7 files created and accessible in sidebar

---

## Phase 7: Verify & Fix

**Goal**: Ensure everything builds, links resolve, and content is complete.

### Steps
1. Run `cd prism-docs && npm run docs:build` — must complete without errors
2. Run `npm run docs:dev` and verify:
   - All sidebar links work (no 404s)
   - Code blocks have syntax highlighting with line numbers
   - Spectral theme active in dark mode
   - Top gradient bar visible
   - Hero page renders correctly
   - Local search indexes and returns results
3. Spot-check content completeness:
   - Compare line counts: sum of all output pages vs source doc
   - Verify first and last section of each Part

### Verification
- Build succeeds
- Dev server shows full site with all navigation working

---

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| VitePress v2 alpha API may differ from v1 docs | Research confirmed latest API shape; use `defineConfig` pattern |
| Screen Reference sub-sections may be hard to split | Each screen starts with "### N. Screen Name" pattern — use line numbers from grep |
| Internal anchor links broken after split | Add frontmatter + use relative page links instead of anchors |
| Large content in some CLI sections | Pages like Architecture (200+ lines) are fine for VitePress |
