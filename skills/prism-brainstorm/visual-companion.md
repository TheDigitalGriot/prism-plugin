# Visual Companion Guide

The visual companion is a browser-based tool for showing interactive mockups and design choices during brainstorming. Use it when visual questions are ahead — layout comparisons, UI patterns, information architecture.

## Render visual-first — the whole point of the companion

The companion exists to make ideas **visual**. A screen that is mostly headings, bullet lists, and paragraphs is a **failure** — it is a text document in a browser, and it defeats the purpose for a visual thinker.

**Before your first render, read the full vocabulary — the class table below is only a subset:**
- `scripts/frame-template.html` — the authoritative component library: `.diagram`/`.arc`/`.seq-box` (monospace dataflow boxes), `.tool-card` (ember-tinted grid cards), `.meta`/`.cell` (key/value cells), `.mea`/`.caveats` (callouts), `.tag.blue|green|amber|volt` (status pills), plus every `--token`.
- `references/griotwave.md` — the token values (palette, text ladder, ember-bloom, rim catchlight).

**Lead every screen with a visual form:**
- Decisions & dataflows → a `.diagram`/`.arc` box or color-coded boxes with `▼`/`→` arrows — NOT a bulleted list.
- Comparisons → `.split` or `.cards` side-by-side — NOT stacked paragraphs.
- Options → `.options` cards with `.pick` on the recommendation; one line of copy each.
- Status & labels → `.tag.*` pills and `.meta` cells — NOT sentences.
- Keep prose to a single `.lede` line; push detail into diagram labels, tags, and cells.

**Heuristic:** if more than ~a third of a screen is sentences, redesign it as a diagram / boxes / cards before pushing it.

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

> **This is a working subset — `scripts/frame-template.html` is authoritative.** The visual-first classes (`.diagram`, `.tool-card`, `.meta`, callouts, tags) are what turn a screen from a text list into a picture — reach for them first.

| Class | Purpose |
|-------|---------|
| `.diagram` / `.arc` / `.seq-box` | Monospace box for dataflows & sequences — `<b>` for nodes, `.c` for dim comments |
| `.options` / `.option[data-choice]` | A/B/C choice cards; add `.pick` to the recommended one for an ember glow |
| `.split` | Side-by-side comparison layout (2-col grid) |
| `.cards` / `.card` | Grid of design cards (`.card-image` / `.card-body`) |
| `.tool-card` (in `.tool-grid`) | Ember-tinted feature card; set `--ember-c` for a per-card accent |
| `.meta` / `.cell` (`.k` / `.v`) | Key/value cells for specs & parameters |
| `.mea` | Green success / insight callout |
| `.caveats` | Amber warning callout (`.label` + `<ul>`) |
| `.pros-cons` / `.pros` / `.cons` | Pro/con columns |
| `.tag.blue` / `.green` / `.amber` / `.volt` | Inline status pills |
| `.eyebrow` / `h2.title` / `.lede` / `.sub-label` | Heading system — eyebrow label, 40px title, one-line lede, section labels |
| `.mockup` (`.mockup-header` / `.mockup-body`) | Container with header for a wireframe |
| `.mock-nav` / `.mock-sidebar` / `.mock-button` / `.mock-input` | Wireframe building blocks |
| `.placeholder` | Dashed placeholder block |

## Fidelity Attribute

Every fragment root (or `<body>` for full documents) supports a `data-fidelity` attribute that cascades griotwave fidelity primitives into the subtree. The classifier rules, slash-command overrides, carry-forward, and final-hi ceremonial rules live in `prism-brainstorm/SKILL.md` — this section just documents the attribute itself.

| Value | What it does |
|-------|--------------|
| `data-fidelity="lo"` | Sketch — dashed borders, desaturated, no glass blur, no bloom |
| `data-fidelity="mid"` | Structured — solid borders, light blur, no bloom |
| `data-fidelity="hi"` | Polished — full griotwave glass with backdrop blur, ember bloom |

Example fragment:

```html
<div data-fidelity="lo" class="options">
  <div class="option" data-choice="A">
    <h3>Option A: Sidebar Navigation</h3>
    <p>Wireframe rendering — minimal styling.</p>
  </div>
  <div class="option" data-choice="B">
    <h3>Option B: Top Navigation</h3>
    <p>Wireframe rendering — minimal styling.</p>
  </div>
</div>
```

The CSS cascade reshapes `--fidelity-blur`, `--fidelity-shadow`, `--fidelity-bloom`, `--fidelity-border-style`, `--fidelity-saturation`, and `--fidelity-opacity` based on the active level. Components reference these variables instead of hard-coding effects, so flipping the attribute changes the visual treatment of the entire subtree without rewriting any other CSS.

## Drawer State (`state/decisions.json`)

The frame template's right-side drawer renders from a single state file: `$STATE_DIR/decisions.json`. The full classifier rules and write protocol live in `prism-brainstorm/SKILL.md` — this section just documents the schema and the live-update mechanism.

### Schema

```json
{
  "decisions": [
    { "q": "Q1", "label": "Re-skin fidelity", "choice": "B", "summary": "Hybrid (inlined + regen script)" }
  ],
  "parked": [
    { "fromQ": "Q2", "label": "/hi mid-stream priority", "concern": "Classifier vs command override", "revisit": "during Q2 implementation" }
  ]
}
```

### Live updates

The brainstorm server (`server.cjs`) watches `$STATE_DIR` for `decisions.json` changes (100 ms debounced). On change it parses the file and broadcasts a WebSocket message:

```json
{ "type": "state-update", "payload": { "decisions": [...], "parked": [...] } }
```

`helper.js` receives the message and re-renders the two panes in the drawer. There is also a `GET /state/decisions.json` HTTP route that `helper.js` calls once on initial connect to seed the drawer with whatever state existed at page load.

### Health signal

When `parked.length >= 5`, the parking pane shows a yellow warning *"Long parking lot — session may be over-scoped"*. The skill treats this as a prompt to narrow scope rather than continuing to defer.

## Translation Canvas

When the user has selected design sources (via the source question or a prism-capture ledger), render a **source vs Griotwave translation** side-by-side before asking the decision question. This gives the user a concrete anchor: "here's what you showed me, here's what that looks like in our register."

Use the `.split` layout. Apply `data-fidelity` to the **translation pane only** — the source pane is always shown as-captured:

```html
<div class="split" style="gap:20px;align-items:stretch;">

  <!-- LEFT: source as captured — no fidelity attribute -->
  <div>
    <div class="mono" style="font-size:9px;letter-spacing:.16em;text-transform:uppercase;
         color:var(--footstep);margin-bottom:10px;">source · as captured</div>
    <div style="border-radius:14px;border:1px solid var(--rim-08);background:#08080b;padding:16px;min-height:200px;">
      {source content — component name, excerpt, description}
    </div>
  </div>

  <!-- RIGHT: Griotwave translation at carry-forward fidelity -->
  <div data-fidelity="{lo|mid|hi}">
    <div class="mono" style="font-size:9px;letter-spacing:.16em;text-transform:uppercase;
         color:var(--neural);margin-bottom:10px;">griotwave translation · {fidelity}</div>
    <div class="glass" style="border-radius:14px;padding:16px;min-height:200px;">
      {source reinterpreted in Griotwave tokens at current fidelity}
    </div>
  </div>

</div>
```

See `references/fidelity-engine.md` for exact CSS variable values per level. See `prism-capture/references/translate-canvas.md` for the full template including pattern tags, decision/park protocol, and when NOT to use the canvas (UX pattern references — those go to structural context, not the canvas).

**When to use:** visual/aesthetic decisions where the user has a reference in mind. **When not to use:** purely architectural decisions (navigation structure, data model, feature scope) — use the standard `.options` layout instead.

## File Naming

Use semantic names that describe the content:
- `layout-comparison.html` — not `screen1.html`
- `navigation-options.html` — not `mockup2.html`
- Never reuse filenames within a session

## Session Exit

Execute this sequence after the **final-hi ceremonial render** (see `references/fidelity-engine.md` → Final-hi ceremonial rule). This is the exit protocol referenced by SKILL.md Step 9.

1. **Record the final screen path** — note the exact filename written to `$SCREEN_DIR` for the hi-fi render. This becomes `prism-design`'s visual reference for the `.pen` file or Claude Design prompt.
2. **Populate ledger §3 Reference Artifacts** with exact paths — no placeholders:
   - `Visual companion session:` → `.prism/local/brainstorm/<session-id>/`
   - `Final hi-fi screen:` → `.prism/local/brainstorm/<session-id>/content/<filename>.html`
   - `Decisions state:` → `.prism/local/brainstorm/<session-id>/state/decisions.json`
3. **Stop the server:**
   ```bash
   bash ${CLAUDE_PLUGIN_ROOT}/skills/prism-brainstorm/scripts/stop-server.sh <session-dir>
   ```
4. **Confirm to the user:**
   > "Visual companion session packaged. Decisions are saved in the ledger and the hi-fi mockup path is recorded in §3 for the design phase."

Then return to SKILL.md Workflow — proceed to Step 10 (Transition to design).

## Stopping the Server (manual)

To stop outside the exit sequence:

```bash
bash ${CLAUDE_PLUGIN_ROOT}/skills/prism-brainstorm/scripts/stop-server.sh <session-dir>
```

## Session Storage

- Persistent: `.prism/local/brainstorm/<session-id>/content/` (when `--project-dir` used)
- Ephemeral: `/tmp/prism-brainstorm-<session-id>/content/` (without `--project-dir`)
