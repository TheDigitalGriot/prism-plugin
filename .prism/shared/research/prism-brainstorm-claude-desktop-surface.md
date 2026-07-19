# Claude Desktop surface adapter — brainstorm visual companion

Status: exploration note, ready to fold into `prism-brainstorm`
Origin: discovered live in a Cowork (Claude Desktop, cloud) session while brainstorming Meridian
Destination (proposed): `GriotApps/prism-plugin/skills/prism-brainstorm/references/claude-desktop-surface.md`
Companion edits: `visual-companion.md` (add surface resolver), `SKILL.md` (version-requirements table row)

---

## 1 · Why this exists

The native visual companion assumes **Claude Code and the browser share one machine**: `start-server.sh`
spins a localhost Node server, writes screens to `$SCREEN_DIR`, serves them to `127.0.0.1:<port>` in
Chrome, and clicks fire back through the `brainstorm-channel` MCP to wake Claude.

That whole loop breaks in two common Cowork situations:

- **Cloud session** — Claude runs in an Anthropic sandbox. Its `localhost` is not the user's `localhost`,
  and the sandbox shell cannot reach the user's machine's `localhost` either. The server would start on
  the wrong side of the boundary; the user's Chrome can never reach it.
- **Desktop-native preference** — even when reachable, the user may want the companion *inside* Claude
  Desktop (inline in chat, or in the artifact sidebar) rather than in a separate Chrome tab.

Claude Desktop exposes its own adaptable surfaces that can host the companion. One of them reproduces the
exact click-to-wake hook. This adapter maps the companion onto them.

---

## 2 · Surface options

| Surface | In Claude Desktop | Griotwave fidelity | Click → wakes Claude | Persists | Live drawer |
|---|---|---|---|---|---|
| localhost + Chrome (native) | Chrome only | full | yes — `brainstorm-channel` | ephemeral | yes — WebSocket |
| `show_widget` (inline) | inline in chat | most of it | **yes — `sendPrompt()`** | no | per render |
| Cowork artifact (sidebar) | sidebar | full | no back-to-chat hook | yes — gallery | per update |

**Rule of thumb:** run the interactive loop in `show_widget` (only Claude Desktop surface with a wake
hook); promote the final hi-fi screen to a Cowork artifact so it persists and `prism-design` can consume it.

---

## 3 · Component mapping (native → Claude Desktop)

| Native companion piece | Claude Desktop equivalent |
|---|---|
| `start-server.sh` / `server.cjs` localhost server | none — no server; each screen is rendered directly |
| Screen HTML written to `$SCREEN_DIR`, served to Chrome | HTML passed to `show_widget` (inline) or `create_artifact` (sidebar) |
| `frame-template.html` wrapper + `griotwave.md` tokens | inlined into the rendered HTML (self-contained, no external serve) |
| `brainstorm-channel` active wake (click → Claude wakes) | `sendPrompt(text)` — global in `show_widget`; click handler calls it |
| `$STATE_DIR/events` file fallback for clicks | n/a — a click *is* a fresh user turn via `sendPrompt` |
| `decisions.json` + WebSocket live drawer re-render | drawer rail rendered into each screen from in-turn state (no watcher) |
| `data-fidelity="lo|mid|hi"` CSS cascade | preserved verbatim — it is pure CSS, works in both surfaces |
| Session dir `.prism/local/brainstorm/<id>/` | still written for the ledger; screens live in chat/gallery, not a served dir |

The key insight: the companion's *content contract* (griotwave HTML fragments + `data-choice` cards +
`data-fidelity`) is surface-independent. Only the **transport** (serve-to-Chrome + WebSocket) and the
**wake** (channel) need swapping. `sendPrompt` is a drop-in for the wake; direct render replaces transport.

---

## 4 · Implementation

### 4.1 Option card wired to the wake

Native cards use `data-choice` and rely on the browser+channel to report the click. In the Claude Desktop
surface, wire the same card's `onclick` straight to `sendPrompt` with a fully-formed instruction so the
woken turn has everything it needs:

```html
<div role="button" tabindex="0" aria-label="Choose B, the Mirror"
     onclick="sendPrompt('Meridian Q1 — I choose B, the Mirror: no plan I must honor; it observes what I actually do and reflects patterns back. Go deep on this stance.')"
     style="... griotwave card styles ...">
  <span class="badge">B</span> the mirror
  <p>no plan to fail. it watches what you actually do.</p>
</div>
```

Write the `sendPrompt` string as a complete decision statement, not just `"B"` — the click starts a new
user turn with no other context, so the phrasing carries the intent (chosen option + "go deep on X").

### 4.2 Ledger rail (drawer without a watcher)

The native right-drawer live-renders from `decisions.json` over WebSocket. With no persistent server,
render the drawer rail **into each screen** from the current in-turn ledger state:

```
[ ledger ]
Q<n> · <name>        open | locked
● N locked
○ M parked           (health warning when M >= 5)
ember: <color> (provisional)
```

State still round-trips through the canonical `decisions.json` in the session dir on every `decide`/`park`
(unchanged write protocol) — it just isn't *pushed* to a live browser; it's *pulled* into the next render.

### 4.3 Fidelity + tokens

`data-fidelity` is pure CSS cascade — copy it across untouched. Inline the griotwave tokens
(`griotwave.md`) and the needed `frame-template.html` classes into each screen since there's no server to
inject them. Load `Inter` + `JetBrains Mono` via `fonts.googleapis.com` (`<link>`), which is on the
Cowork CDN allowlist.

### 4.4 show_widget deviations to expect

`show_widget`'s default design system is flat/theme-aware (no dark bg, no glow, transparent outer
container). Griotwave is intentionally dark-glass with ember bloom, so this surface **deliberately
departs** from that default — it renders the project's own language inside its own dark panel. Two known
costs: heavy `backdrop-filter: blur()` flashes during token-by-token streaming (prefer `mid` fidelity for
interactive screens, reserve full `hi` glass for the final ceremonial render), and very large bloom radii
get visually clamped inline.

---

## 5 · Surface resolver (proposed skill logic)

Add to `visual-companion.md` — decide the surface before "Starting a Session" instead of always calling
`start-server.sh`:

```
resolve companion surface:
  if running in Cowork / Claude Desktop:
      interactive screens        -> show_widget          (wake via sendPrompt)
      final hi-fi / keepsake      -> create_artifact      (persist in gallery)
      SKIP start-server.sh
  else if Claude Code + local Chrome reachable:
      -> localhost + Chrome (native companion, unchanged)
```

Detection signal: presence of the `show_widget` / `create_artifact` tools (Cowork) vs a runnable
`start-server.sh` with a co-located browser (Claude Code CLI). When ambiguous, offer the choice.

---

## 6 · Exit ceremony adaptation

`visual-companion.md` → "Session Exit" records a served localhost path as the final hi-fi screen. On the
Claude Desktop surface there is no served path — instead:

1. Render the final `hi` screen once via `show_widget` (ceremonial), then
2. `create_artifact` the same HTML so it persists in the gallery, and
3. In ledger §3, record the **artifact id** (and the workspace HTML path) in place of the
   `.prism/local/brainstorm/<id>/content/<file>.html` localhost reference.

`prism-design` then consumes the artifact HTML as the visual-layout reference exactly as it would the
served file.

---

## 7 · Limitations / what's lost vs native

- **No cross-turn live drawer.** State is pulled into each render, not pushed over WebSocket. In practice
  fine — each screen shows current ledger state; there is no second live viewer to keep in sync.
- **No passive events file.** Clicks are `sendPrompt` user turns; there is no `$STATE_DIR/events` batch to
  replay. A click and a typed reply are the same kind of event here.
- **Persistence only via artifact.** `show_widget` renders are not saved; anything worth keeping must be
  promoted with `create_artifact`.
- **Artifacts have no wake.** If you render an interactive screen *as an artifact*, clicks cannot wake
  Claude — the user must report the choice. Keep interactivity in `show_widget`; use artifacts for
  keep/share/read-again screens.

---

## 8 · Drop-in checklist for Prism source

- [ ] Add this file at `skills/prism-brainstorm/references/claude-desktop-surface.md`
- [ ] `visual-companion.md`: add the §5 surface resolver above "Starting a Session"; add a
      "Claude Desktop surface" subsection pointing here
- [ ] `SKILL.md` version-requirements table: new row —
      `Active wake (Claude Desktop) | Cowork show_widget + sendPrompt (no brainstorm-channel needed)`
- [ ] `SKILL.md` step 9 exit ceremony: note the artifact-persistence path for the Claude Desktop surface
- [ ] Keep `start-server.sh` / `server.cjs` unchanged — this is an *additional* surface, not a replacement
