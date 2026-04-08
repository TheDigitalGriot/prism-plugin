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
