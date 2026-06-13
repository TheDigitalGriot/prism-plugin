# Prism Design Engine Integration — Session Summary

**Date:** 2026-06-12
**Session context:** idea_init handoff → open-design integration → prism-design-engine as first-class prism plugin
**Status:** Structural scaffolding complete. Pending: VSCode extension host wiring, design engine sidecar launch/stop handlers.

---

## What Was Done This Session

### 1. Forked open-design as prism-design-engine

- **Fork:** `TheDigitalGriot/prism-design-engine` (forked from `nexu-io/open-design`)
- **Cloned to:** `~/Developer/prism-design-engine`
- **Why:** Local-first, open-source Claude Design alternative. Has a REST daemon at `localhost:7456`, MCP server, SKILL.md protocol (same as prism), images/video/local model support, 142+ design systems, HTML/PDF/PPTX/MP4 export.

### 2. Created `apps/prism-design-studio/` in prism-plugin

New workspace added to `package.json`. This is the prism-native wrapper for the engine.

**Files created:**
- `apps/prism-design-studio/package.json` — `@prism/design-studio` package, `"prism"` metadata block declaring engine type, port 7456, design_system griotwave
- `apps/prism-design-studio/src/server.js` — relay server at port 7457 that:
  - Spawns `~/Developer/prism-design-engine/apps/daemon` as a child process
  - Exposes `GET /status`, `POST /launch`, `POST /stop` for the VSCode extension
  - Watches for engine startup/shutdown

### 3. Added `DesignView.tsx` to the VSCode panel

- **File:** `apps/prism-vscode/webview-panel/src/views/DesignView.tsx`
- **Types:** `apps/prism-vscode/webview-panel/src/types/design.ts`
- Shows: engine status card (stopped/starting/running/error), `design_prompt.yaml` from idea_init (collapsible, with "Send →" button when engine is running), design artifacts list from `.prism/shared/designs/`, ledger link

### 4. Updated ViewToggle and PrismPanel

- `ViewToggle.tsx` — added `'design'` as third view option with `✦` icon
- `PrismPanel.tsx` — imported `DesignView`, updated `leftView` type to include `'design'`, wired render branch

### 5. Updated `skills/prism-design/SKILL.md`

- **Old:** Pencil.dev MCP (primary), Claude Design (secondary)
- **New:** Prism Design Engine localhost:7456 (primary/default), Claude Design (fallback B), Markdown-only (C)
- Added Step 7A: check relay `/status` → POST `/api/chat` → artifact bundle in `.prism/shared/designs/<date>-<topic>/`
- `design_prompt.yaml` from idea_init is now an optional enrichment input

### 6. Updated idea_init integration

*(in `~/Developer/idea_init`)*

- `idea_init app/app/view_ledger_prompt.jsx` — "Export to Aura" → `openInOpenDesign()` → POST to `localhost:7456/api/chat`, fallback to `claude.ai/design`
- `idea_init app/companion/assistant.jsx` — updated export response + suggestion chip
- `prompts/idea_init-frontend-design-prompt.yaml` — `primary_consumer` updated: Open Design = default, Claude Design = fallback, prism-design = architectural layer

---

## What Still Needs to Be Done

### HIGH: VSCode Extension Host Wiring (`apps/prism-vscode/src/`)

The `DesignView` sends these messages via `vscode.postMessage()`:
- `{ type: 'requestDesignEngineState' }` → extension should query relay at `localhost:7457/status` and scan `.prism/shared/designs/` for artifacts, then reply with `{ type: 'designEngineState', state: DesignEngineState }`
- `{ type: 'launchDesignEngine' }` → `POST localhost:7457/launch`
- `{ type: 'stopDesignEngine' }` → `POST localhost:7457/stop`
- `{ type: 'sendDesignPrompt', yaml: string }` → `POST localhost:7456/api/chat` with the YAML
- `{ type: 'openDesignArtifact', path: string }` → open the file in VSCode or browser
- `{ type: 'openFile', path: string }` → open file in VSCode editor

**Where to add this:** `apps/prism-vscode/src/hosts/` — probably a new `DesignEngineHost.ts` that handles these message types, similar to how other hosts work. Register it in `extension.ts`.

### MEDIUM: Artifact Scanner

The relay/extension needs to scan `.prism/shared/designs/` and build the `DesignArtifact[]` array for the panel. Files to look for:
- `*.md` (design sidecars)
- `*.pen` (legacy Pencil files)
- `**/index.html` (HTML prototypes from the engine)
- `*.pdf`, `*.pptx`, `*.mp4`, `*.zip`

Parse the date and topic from the filename pattern `YYYY-MM-DD-<topic>-design.*`.

### MEDIUM: prism-electron Design Panel

The `apps/prism-electron/` app doesn't have a Design view yet. Mirror the approach from prism-vscode: add a "Design Studio" route to the Electron UI that embeds the engine UI (`http://localhost:7456`) in a BrowserView or iframe.

### LOW: Griotwave Design System in the Engine

The engine needs to know about the Griotwave design system. Register it at:
```
~/Developer/prism-design-engine/design-systems/griotwave/DESIGN.md
```

Pull the tokens from `prompts/idea_init-frontend-design-prompt.yaml`:
- Palette: void #000, neural #3B82F6, bio #10B985, violet #A855F7
- Surface: glassmorphic (blur 40px, saturate 140%)
- Typography: Inter (display), JetBrains Mono (eyebrow/code)
- Motion: ember-bloom, easing spring 50/22

### LOW: Keep fork in sync with upstream

The fork (`TheDigitalGriot/prism-design-engine`) was last pushed 2026-06-08. The upstream (`nexu-io/open-design`) is actively maintained (last push: 2026-06-13). Set up a periodic sync:
```bash
git remote add upstream https://github.com/nexu-io/open-design.git
git fetch upstream
git merge upstream/main --no-edit
```

---

## Architecture Diagram

```
idea_init (~/Developer/idea_init)
    ↓ emits design_prompt.yaml
    ↓ "Open in Open Design" button POSTs to localhost:7456/api/chat
                                    ↑
prism-design SKILL                  │
    ↓ reads brainstorm ledger        │
    ↓ optionally reads design_prompt.yaml
    ↓ POST brief to localhost:7456/api/chat
                                    │
Prism Design Engine (localhost:7456)│← forked TheDigitalGriot/prism-design-engine
    ↓ renders prototype             │   spawned by prism-design-studio relay (localhost:7457)
    ↓ artifacts → .prism/shared/designs/<date>-<topic>/
                                    │
prism-vscode panel (✦ Design tab)   │
    ↓ shows engine status, artifacts, design_prompt.yaml
    ↓ "Send →" button sends YAML to running engine
                                    │
prism-plan → prism-implement        │
    reads markdown sidecar (-design.md)
```

---

## File Manifest (All Changed Files This Session)

### In `~/Developer/prism-plugin/` (this repo)

| File | Change |
|---|---|
| `package.json` | Added `"apps/prism-design-studio"` to workspaces |
| `apps/prism-design-studio/package.json` | NEW — `@prism/design-studio` package with prism engine metadata |
| `apps/prism-design-studio/src/server.js` | NEW — relay server (port 7457) that manages engine process |
| `apps/prism-vscode/webview-panel/src/types/design.ts` | NEW — TypeScript types for DesignEngineState, DesignArtifact |
| `apps/prism-vscode/webview-panel/src/views/DesignView.tsx` | NEW — Design Studio panel view |
| `apps/prism-vscode/webview-panel/src/components/ViewToggle.tsx` | Added 'design' option (✦ icon) |
| `apps/prism-vscode/webview-panel/src/PrismPanel.tsx` | Imported DesignView, updated leftView type and render branch |
| `skills/prism-design/SKILL.md` | Rewritten — Prism Design Engine as default path (replaces Pencil MCP) |

### In `~/Developer/idea_init/`

| File | Change |
|---|---|
| `idea_init app/app/view_ledger_prompt.jsx` | `openInOpenDesign()` — POST to localhost:7456, fallback to claude.ai/design |
| `idea_init app/companion/assistant.jsx` | Updated export response + suggestion chip |
| `prompts/idea_init-frontend-design-prompt.yaml` | `primary_consumer` updated with 3-path architecture |
| `.prism/shared/research/2026-06-08-claude-design-handoff-provenance.md` | §10 added — open-design as default |

### Standalone

| Repo | Action |
|---|---|
| `TheDigitalGriot/prism-design-engine` | Fork of nexu-io/open-design — cloned to ~/Developer/prism-design-engine |
