# Plan B: Visual Companion & Design Phase — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port Superpowers' browser-based visual companion to Prism for interactive brainstorming, and add a new `prism-design` phase between research and planning.

**Architecture:** A zero-dependency Node.js HTTP/WebSocket server serves interactive HTML mockups to the browser. The agent writes HTML files to a session directory; the server detects new files via `fs.watch` and broadcasts reload events via WebSocket. User clicks are captured as JSONL events. A new `prism-brainstorm` skill orchestrates the brainstorming workflow, and a new `prism-design` skill bridges research and planning.

**Tech Stack:** Node.js (zero npm dependencies), bash scripts, HTML/CSS/JS, markdown skill files.

**Source Material:** `.prism/shared/ref/superpowers/skills/brainstorming/` (server.cjs, frame-template.html, helper.js, start-server.sh, stop-server.sh, visual-companion.md)

---

## File Structure

| Action | Path | Responsibility |
|--------|------|---------------|
| Create | `skills/prism-brainstorm/SKILL.md` | Brainstorming workflow orchestrator |
| Create | `skills/prism-brainstorm/visual-companion.md` | Browser integration guide |
| Create | `skills/prism-brainstorm/scripts/server.cjs` | Zero-dep HTTP/WS server (ported) |
| Create | `skills/prism-brainstorm/scripts/frame-template.html` | Prism-themed HTML template |
| Create | `skills/prism-brainstorm/scripts/helper.js` | Client-side interaction capture |
| Create | `skills/prism-brainstorm/scripts/start-server.sh` | Session launcher |
| Create | `skills/prism-brainstorm/scripts/stop-server.sh` | Graceful shutdown |
| Create | `skills/prism-design/SKILL.md` | Design phase orchestrator |

---

### Task 1: Port the Zero-Dependency Server

**Files:**
- Create: `skills/prism-brainstorm/scripts/server.cjs`

- [ ] **Step 1: Copy and adapt server.cjs from Superpowers**

Port `.prism/shared/ref/superpowers/skills/brainstorming/scripts/server.cjs` to `skills/prism-brainstorm/scripts/server.cjs`. The server is 354 lines of zero-dependency Node.js implementing:

- RFC 6455 WebSocket protocol (frame encode/decode)
- HTTP server serving HTML files from `CONTENT_DIR`
- File watching with 100ms debounce
- Owner PID monitoring (exits if parent dies)
- 30-minute idle timeout
- JSONL event recording for user clicks

Changes from Superpowers version:
1. Update the header comment from "Superpowers" to "Prism"
2. Change the default `SESSION_DIR` prefix from `brainstorm` to `prism-brainstorm`
3. Keep ALL other logic identical — the server is transport-agnostic

The full server source is in `.prism/shared/ref/superpowers/skills/brainstorming/scripts/server.cjs`. Read it and copy, changing only the branding strings.

- [ ] **Step 2: Verify the server file exists and has the WebSocket implementation**

Run: `grep -c "computeAcceptKey\|encodeFrame\|decodeFrame" skills/prism-brainstorm/scripts/server.cjs`
Expected: 3 or more (function definitions + exports)

- [ ] **Step 3: Verify the server runs without errors**

Run: `node -c skills/prism-brainstorm/scripts/server.cjs`
Expected: No syntax errors

- [ ] **Step 4: Commit**

```bash
git add skills/prism-brainstorm/scripts/server.cjs
git commit -m "feat: port zero-dep brainstorm server from Superpowers"
```

---

### Task 2: Create the Prism-Themed Frame Template

**Files:**
- Create: `skills/prism-brainstorm/scripts/frame-template.html`

- [ ] **Step 1: Create the HTML template adapted for Prism**

Port `.prism/shared/ref/superpowers/skills/brainstorming/scripts/frame-template.html` with these changes:

1. Replace "Superpowers Brainstorming" header text with "Prism Design Studio"
2. Replace the green accent color (`#22c55e` / `rgb(34,197,94)`) with Prism's blue accent (`#6366f1` / indigo-500)
3. Update CSS custom property names from `--sp-*` to `--prism-*` (if any exist)
4. Keep all CSS classes identical (`.options`, `.cards`, `.mockup`, `.split`, `.pros-cons`, mock wireframe elements)
5. Keep the `<!-- CONTENT -->` injection point
6. Keep the dark/light theme support via `prefers-color-scheme`

The frame template provides:
- Fixed header with connection status indicator
- Scrollable main content area
- Selection indicator bar at bottom
- CSS classes for options (A/B/C choices), cards, mockups, split views, pros/cons
- Mock UI elements (nav, sidebar, button, input, placeholder)

- [ ] **Step 2: Verify the template has the content injection point**

Run: `grep "CONTENT" skills/prism-brainstorm/scripts/frame-template.html`
Expected: `<!-- CONTENT -->` marker present

- [ ] **Step 3: Commit**

```bash
git add skills/prism-brainstorm/scripts/frame-template.html
git commit -m "feat: create Prism-themed frame template for brainstorm UI"
```

---

### Task 3: Port the Client-Side Helper Script

**Files:**
- Create: `skills/prism-brainstorm/scripts/helper.js`

- [ ] **Step 1: Copy helper.js from Superpowers with no changes**

Port `.prism/shared/ref/superpowers/skills/brainstorming/scripts/helper.js` to `skills/prism-brainstorm/scripts/helper.js`. This file is transport-agnostic — it connects via WebSocket, captures click events on `[data-choice]` elements, manages selection state, and exposes `window.brainstorm.send()` and `window.brainstorm.choice()`. No changes needed.

The 88-line script handles:
- WebSocket connection with auto-reconnect
- Event queue for offline handling
- Click capture on `[data-choice]` elements
- Indicator bar updates with selection count
- Toggle selection with multi-select support (`data-multiselect` attribute)

- [ ] **Step 2: Verify syntax**

Run: `node -c skills/prism-brainstorm/scripts/helper.js`
Expected: No syntax errors

- [ ] **Step 3: Commit**

```bash
git add skills/prism-brainstorm/scripts/helper.js
git commit -m "feat: port client-side brainstorm helper from Superpowers"
```

---

### Task 4: Port the Start and Stop Scripts

**Files:**
- Create: `skills/prism-brainstorm/scripts/start-server.sh`
- Create: `skills/prism-brainstorm/scripts/stop-server.sh`

- [ ] **Step 1: Port start-server.sh with Prism paths**

Port `.prism/shared/ref/superpowers/skills/brainstorming/scripts/start-server.sh` with these changes:

1. Change session directory from `.superpowers/brainstorm/` to `.prism/local/brainstorm/`
2. Change temp directory prefix from `brainstorm-` to `prism-brainstorm-`
3. Update the `SCRIPT_DIR` resolution to use `${CLAUDE_PLUGIN_ROOT}/skills/prism-brainstorm/scripts`
4. Keep all platform detection (Windows/MSYS/Codex), foreground/background modes, PID handling

The script handles:
- `--project-dir`, `--host`, `--url-host`, `--foreground`, `--background` flags
- Auto-detect Windows (MSYS/Cygwin/MinGW) for foreground mode
- Unique session directory creation: `<base>/<pid>-<timestamp>/`
- Background mode with `nohup` + polling for startup
- Foreground mode for Windows `run_in_background: true`
- Owner PID resolution
- JSON output with port, URL, screen_dir, state_dir

- [ ] **Step 2: Port stop-server.sh with Prism paths**

Port `.prism/shared/ref/superpowers/skills/brainstorming/scripts/stop-server.sh` with these changes:

1. Change preservation check from `.superpowers/` to `.prism/` (preserve .prism/ directories, delete /tmp/ sessions)
2. Keep SIGTERM → wait → SIGKILL escalation
3. Keep JSON status output

- [ ] **Step 3: Make both scripts executable**

Run: `chmod +x skills/prism-brainstorm/scripts/start-server.sh skills/prism-brainstorm/scripts/stop-server.sh`

- [ ] **Step 4: Verify start script parses arguments**

Run: `bash skills/prism-brainstorm/scripts/start-server.sh --help 2>&1 || true`
Expected: Usage message or argument parsing (no bash syntax errors)

- [ ] **Step 5: Commit**

```bash
git add skills/prism-brainstorm/scripts/start-server.sh skills/prism-brainstorm/scripts/stop-server.sh
git commit -m "feat: port brainstorm start/stop scripts with Prism paths"
```

---

### Task 5: Create the Visual Companion Guide

**Files:**
- Create: `skills/prism-brainstorm/visual-companion.md`

- [ ] **Step 1: Create the visual companion reference**

Adapt `.prism/shared/ref/superpowers/skills/brainstorming/visual-companion.md` for Prism. Key adaptations:

1. Change all directory references from `.superpowers/brainstorm/` to `.prism/local/brainstorm/`
2. Change script paths to `${CLAUDE_PLUGIN_ROOT}/skills/prism-brainstorm/scripts/`
3. Keep the content loop (check server → write HTML → tell user → read events → iterate)
4. Keep the content fragment vs full document distinction
5. Keep the CSS class reference (`.options`, `.cards`, `.mockup`, etc.)
6. Keep the file naming conventions (semantic names, never reuse)
7. Update "Superpowers Brainstorming" references to "Prism Design Studio"

The guide covers:
- When to offer the visual companion (per-question, not per-session)
- Starting a session: `bash ${CLAUDE_PLUGIN_ROOT}/skills/prism-brainstorm/scripts/start-server.sh --project-dir $PROJECT_DIR`
- The content loop: write HTML → tell user to check browser → read events → iterate
- Writing content fragments (auto-wrapped) vs full documents (served as-is)
- Available CSS classes and mock UI elements
- Cleanup and session management

```markdown
# Visual Companion Guide

The visual companion is a browser-based tool for showing interactive mockups and design choices during brainstorming. Use it when visual questions are ahead — layout comparisons, UI patterns, information architecture.

## When to Offer

Offer the visual companion when the brainstorming session involves visual decisions:
- Layout options (A vs B)
- UI component choices
- Information architecture
- Wireframe walkthrough

The offer MUST be its own message. Do not combine it with clarifying questions.

## Starting a Session

```bash
bash ${CLAUDE_PLUGIN_ROOT}/skills/prism-brainstorm/scripts/start-server.sh --project-dir $(pwd)
```

Returns JSON:
```json
{
  "type": "server-started",
  "port": 52341,
  "url": "http://127.0.0.1:52341",
  "screen_dir": ".prism/local/brainstorm/<session>/content",
  "state_dir": ".prism/local/brainstorm/<session>/state"
}
```

## The Content Loop

1. Check server is alive: read `$STATE_DIR/server-info`
2. Write HTML file to `$SCREEN_DIR` using semantic filenames (e.g., `layout-comparison.html`)
3. Tell user: "Check the browser at {url} for the mockup"
4. End your turn — let the user respond
5. On next turn: read `$STATE_DIR/events` for click selections
6. Merge terminal text + browser events for full picture
7. Iterate or advance

## Content Types

**Fragments** — Raw HTML, auto-wrapped in frame template:
```html
<div class="options">
  <div class="option" data-choice="A">
    <h3>Option A: Sidebar Navigation</h3>
    <p>Traditional sidebar with collapsible sections</p>
  </div>
  <div class="option" data-choice="B">
    <h3>Option B: Top Navigation</h3>
    <p>Horizontal nav bar with dropdown menus</p>
  </div>
</div>
```

**Full documents** — Start with `<!DOCTYPE` or `<html>`, served as-is.

## Available CSS Classes

| Class | Purpose |
|-------|---------|
| `.options` | Container for A/B/C choice cards |
| `.option[data-choice]` | Individual selectable choice |
| `.cards` | Grid layout for design cards |
| `.mockup` | Container with header for wireframe |
| `.split` | Side-by-side comparison layout |
| `.pros-cons` | Pro/con list layout |
| `.mock-nav` | Wireframe navigation bar |
| `.mock-sidebar` | Wireframe sidebar element |
| `.mock-button` | Wireframe button element |
| `.mock-input` | Wireframe input field |
| `.placeholder` | Gray placeholder block |

## File Naming

Use semantic names that describe the content:
- `layout-comparison.html` — not `screen1.html`
- `navigation-options.html` — not `mockup2.html`
- Never reuse filenames within a session

## Stopping the Server

```bash
bash ${CLAUDE_PLUGIN_ROOT}/skills/prism-brainstorm/scripts/stop-server.sh <session-dir>
```

## Session Storage

- Persistent: `.prism/local/brainstorm/<session-id>/content/` (when `--project-dir` used)
- Ephemeral: `/tmp/prism-brainstorm-<session-id>/content/` (without `--project-dir`)
```

- [ ] **Step 2: Commit**

```bash
git add skills/prism-brainstorm/visual-companion.md
git commit -m "feat: create visual companion guide for Prism brainstorming"
```

---

### Task 6: Create the Prism Brainstorm Skill

**Files:**
- Create: `skills/prism-brainstorm/SKILL.md`

- [ ] **Step 1: Create the brainstorm skill definition**

```markdown
---
name: prism-brainstorm
description: Interactive brainstorming with optional browser-based visual companion. Use when starting creative design work before planning. Triggers on "brainstorm this", "design options", "explore approaches", "let's think about", or when the user needs to make design decisions before implementation.
model: opus
---

# Prism Brainstorm

Interactive design exploration with optional browser-based visual companion for mockups and A/B choices.

<HARD-GATE>
Do NOT invoke any implementation skill, write any code, scaffold any project, or take any
implementation action until you have presented a design and the user has approved it.
Brainstorming produces a design document, not code.
</HARD-GATE>

## Workflow

- [ ] 1. **Explore project context** — Read relevant files, check `.prism/shared/research/` for existing research
- [ ] 2. **Offer visual companion** — If visual questions ahead, offer the browser companion (load `visual-companion.md`)
- [ ] 3. **Ask clarifying questions** — One at a time, wait for answers
- [ ] 4. **Propose 2-3 approaches** — With trade-offs for each
- [ ] 5. **Present design in sections** — Get user approval after each section
- [ ] 6. **Write design document** — Save to `.prism/shared/plans/YYYY-MM-DD-<topic>-design.md`
- [ ] 7. **Self-review** — Check for TODOs, contradictions, missing requirements
- [ ] 8. **User reviews spec** — Present the saved file for review
- [ ] 9. **Transition** — Offer `/prism-plan` to create implementation plan from the design

## Visual Companion

When visual decisions are ahead, offer the browser-based companion:

> "This design involves visual choices. I can show interactive mockups in your browser for comparing options. Want me to start the visual companion?"

This offer MUST be its own message. Do not combine it with clarifying questions.

If accepted, load `visual-companion.md` for the full integration guide.

## Design Document Format

Save to `.prism/shared/plans/YYYY-MM-DD-<topic>-design.md`:

```markdown
# {Topic} Design Document

**Date:** {date}
**Status:** Approved | Draft
**Author:** AI + {user}

## Problem Statement
{What we're solving and why}

## Design Decision
{The chosen approach}

## Alternatives Considered
### Option A: {name}
{Description, trade-offs}

### Option B: {name}
{Description, trade-offs}

## Technical Design
{Architecture, data flow, key interfaces}

## Success Criteria
{How we'll know this works}

## Open Questions
{Anything unresolved}
```

## Rules

1. **Design before code** — Never write implementation code during brainstorming
2. **One question at a time** — Don't overwhelm with multiple questions
3. **User approval per section** — Don't write the full design in one shot
4. **Visual companion is optional** — Only offer when visual decisions are involved
5. **Save and commit** — Design documents are committed to `.prism/shared/plans/`

## Integration

- **Follows:** `/prism-research` (optional — brainstorming can start from scratch)
- **Precedes:** `/prism-plan` (design document becomes planning input)
- **Visual companion:** Stored in `.prism/local/brainstorm/` (gitignored)
```

- [ ] **Step 2: Verify the skill file has valid YAML frontmatter**

Run: `head -5 skills/prism-brainstorm/SKILL.md`
Expected: `---`, `name: prism-brainstorm`, `description:`, `model: opus`, `---`

- [ ] **Step 3: Commit**

```bash
git add skills/prism-brainstorm/SKILL.md
git commit -m "feat: create prism-brainstorm skill with visual companion integration"
```

---

### Task 7: Create the Prism Design Phase Skill

**Files:**
- Create: `skills/prism-design/SKILL.md`

- [ ] **Step 1: Create the design phase skill**

```markdown
---
name: prism-design
description: Design phase between research and planning. Creates design documents with architectural decisions, interface definitions, and visual documentation. Triggers on "design this", "create a design", "design the architecture", or after research completes when design decisions are needed.
model: opus
---

# Prism Design Phase

Create design documents that bridge research findings and implementation planning. This phase produces the architectural decisions, interface contracts, and visual documentation that the planning phase turns into actionable tasks.

## When to Use

Use this phase when:
- Research has identified multiple viable approaches that need a decision
- The feature involves user-facing design (layouts, interactions, flows)
- Cross-cutting concerns need architectural decisions before planning
- The user explicitly asks to "design" something

Skip this phase when:
- The implementation approach is obvious from research
- The feature is purely backend with no design decisions
- The user wants to go straight to planning

## Workflow

### 1. Load Context

1. Read the most recent research in `.prism/shared/research/`
2. If a PRD exists, read it from `.prism/shared/plans/`
3. Summarize what the research found and present to user

### 2. Identify Design Decisions

List the decisions that need to be made before planning:
- Architecture approach (which pattern? which library?)
- Data model design (what entities? what relationships?)
- Interface contracts (what APIs? what props?)
- Visual design (what layout? what UX flow?)

### 3. Brainstorm Options

For each decision, use `/prism-brainstorm` to explore options interactively. This may include the visual companion for UI-related decisions.

### 4. Generate Visual Documentation (Optional)

If the design involves user-facing features, invoke `/generate_user_flows` for:
- User personas and journey maps
- Screen inventory with wireframes
- Component library
- Interaction patterns

### 5. Write Design Document

Save to `.prism/shared/plans/YYYY-MM-DD-<topic>-design.md` with:
- Problem statement and goals
- Chosen approach with rationale
- Alternatives considered
- Technical architecture
- Interface contracts
- Visual documentation (if applicable)
- Success criteria

### 6. Transition to Planning

After design approval, offer:
- `/prism-plan` — Create implementation plan from the design document

## Integration

```
prism-research → prism-design → prism-plan → prism-implement → prism-validate
                  ↑ YOU ARE HERE
```

- **Input:** Research document from `.prism/shared/research/`
- **Output:** Design document in `.prism/shared/plans/`
- **Next:** `/prism-plan` uses the design document as primary input

## Rules

1. **Decisions, not implementation** — This phase produces decisions, not code
2. **User approval required** — Every major decision needs explicit user buy-in
3. **Visual when visual** — Use brainstorm visual companion for UI decisions
4. **Document everything** — Design documents are the contract for planning
```

- [ ] **Step 2: Verify the skill file**

Run: `head -5 skills/prism-design/SKILL.md`
Expected: Valid YAML frontmatter with `name: prism-design`

- [ ] **Step 3: Commit**

```bash
git add skills/prism-design/SKILL.md
git commit -m "feat: create prism-design skill for design phase between research and plan"
```

---

### Task 8: Integration Test

**Files:**
- Verify: All created files

- [ ] **Step 1: Verify all files exist**

Run: `ls -la skills/prism-brainstorm/SKILL.md skills/prism-brainstorm/visual-companion.md skills/prism-brainstorm/scripts/server.cjs skills/prism-brainstorm/scripts/frame-template.html skills/prism-brainstorm/scripts/helper.js skills/prism-brainstorm/scripts/start-server.sh skills/prism-brainstorm/scripts/stop-server.sh skills/prism-design/SKILL.md`
Expected: All 8 files listed

- [ ] **Step 2: Verify server starts (quick smoke test)**

Run: `cd skills/prism-brainstorm/scripts && timeout 3 node server.cjs 2>&1 || true`
Expected: Server starts (may timeout after 3 seconds, that's fine — confirms no crash)

- [ ] **Step 3: Verify skill YAML frontmatter parses**

Run: `head -5 skills/prism-brainstorm/SKILL.md && echo "---" && head -5 skills/prism-design/SKILL.md`
Expected: Both have valid `---` delimited YAML with name and model

- [ ] **Step 4: Final commit if any loose changes**

```bash
git status
# If any unstaged changes:
git add skills/prism-brainstorm/ skills/prism-design/
git commit -m "chore: finalize brainstorm and design skill integration"
```

---

## Success Criteria

### Automated Verification
- [ ] `ls skills/prism-brainstorm/scripts/server.cjs` — server exists
- [ ] `node -c skills/prism-brainstorm/scripts/server.cjs` — no syntax errors
- [ ] `node -c skills/prism-brainstorm/scripts/helper.js` — no syntax errors
- [ ] `ls skills/prism-brainstorm/scripts/frame-template.html` — template exists
- [ ] `grep "CONTENT" skills/prism-brainstorm/scripts/frame-template.html` — injection point present
- [ ] `ls skills/prism-brainstorm/scripts/start-server.sh skills/prism-brainstorm/scripts/stop-server.sh` — scripts exist
- [ ] `ls skills/prism-brainstorm/SKILL.md skills/prism-brainstorm/visual-companion.md` — skill files exist
- [ ] `ls skills/prism-design/SKILL.md` — design skill exists
- [ ] All YAML frontmatter has `name` and `model` fields

### Manual Verification
- [ ] Start the server, open browser, confirm "Prism Design Studio" header appears
- [ ] Write an HTML fragment to the content directory, confirm browser auto-reloads
- [ ] Click a `[data-choice]` element, confirm event recorded in `state/events`
- [ ] Read `prism-brainstorm/SKILL.md` — confirms hard gate prevents implementation
- [ ] Read `prism-design/SKILL.md` — confirms workflow: research → design → plan
- [ ] Visual companion guide references correct Prism paths (`.prism/local/brainstorm/`)
