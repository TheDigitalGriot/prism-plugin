# Translation Canvas

Load during Step 4 (Translate) — one canvas per active reference.

## What it shows

Two panes side by side:
- **Left — source as captured**: the reference exactly as the user showed it. No Griotwave treatment. No `data-fidelity`.
- **Right — Griotwave translation**: the source reinterpreted in the Griotwave aesthetic at the current fidelity level.

## HTML fragment template

```html
<div class="split" style="gap:20px;align-items:stretch;">

  <!-- LEFT: source as captured — no fidelity treatment -->
  <div>
    <div class="mono" style="font-size:9px;letter-spacing:.16em;text-transform:uppercase;
         color:var(--footstep);margin-bottom:10px;display:flex;align-items:center;gap:8px;">
      source · as captured
    </div>
    <div style="border-radius:14px;border:1px solid var(--rim-08);background:#08080b;
         padding:16px;min-height:240px;display:flex;flex-direction:column;gap:12px;">
      <div class="mono" style="font-size:10px;color:var(--footstep);line-height:1.7;">
        // {source name} · {reference identifier or URL}
      </div>
      <!-- source content: description, component name, excerpt, screenshot callout -->
      <div style="color:var(--whisper);font-size:13px;line-height:1.6;">
        {what this reference shows — be specific: "Animated border card with beam effect
        scanning top-edge, glassmorphic container, Inter 500 label"}
      </div>
      <!-- extracted patterns as tags -->
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:auto;">
        {r.patterns.map(p =>
          `<span style="font-family:var(--font-code);font-size:8.5px;color:var(--whisper);
           background:rgba(0,0,0,.4);border:1px solid var(--rim-10);border-radius:999px;
           padding:2px 7px;">{p}</span>`
        )}
      </div>
    </div>
  </div>

  <!-- RIGHT: Griotwave translation — fidelity applied here only -->
  <div data-fidelity="{lo|mid|hi}">
    <div class="mono" style="font-size:9px;letter-spacing:.16em;text-transform:uppercase;
         color:var(--neural);margin-bottom:10px;display:flex;align-items:center;gap:8px;">
      griotwave translation · {fidelity}
    </div>
    <div class="glass" style="border-radius:14px;padding:16px;min-height:240px;
         display:flex;flex-direction:column;gap:14px;">
      <!-- Reinterpret the source in Griotwave register:
           - lo:  dashed rim, desaturated, no blur — structure only
           - mid: solid rim, light blur, embers begin to tint
           - hi:  full frost, ember bloom on primary affordance
           Show the same structural intent as the source, in Griotwave tokens. -->
      {Griotwave interpretation of the source reference}
    </div>
  </div>

</div>
```

## Fidelity rules for the translation pane

Always start at `lo` — structure first. The source pane never gets `data-fidelity`.

| Escalate to `mid` when | Escalate to `hi` when |
|---|---|
| User says "more polished" or types `/mid` | User confirms the direction or types `/hi` |
| 2+ clarify cycles on the same reference | Moving to the final reference in the session |

Follow fidelity-engine carry-forward: once escalated for one reference, the next reference starts at the same level.

## After each canvas

Ask:
> "Does this translation feel right for the direction, or should I adjust the interpretation?"

- If they adjust: re-render the right pane only. Keep the source pane identical.
- If they confirm: write a `decide` entry to `decisions.json`, mark the reference `decided` in the capture ledger, advance to the next active reference.
- If they want to park: write a `park` entry, mark the reference `parked`, advance.

## When NOT to render a translation canvas

- Purely structural references (flow diagrams, wireframes, information architecture)
- UX pattern references from Mobbin — these inform architecture, not aesthetics. Note them in the capture ledger's "structural context" section instead.
