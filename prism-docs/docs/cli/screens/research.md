---
title: Research Screen
description: File browser for .prism/shared/research/ markdown documents with list and viewer modes.
outline: [2, 3]
---

# Research Screen

A file browser for `.prism/shared/research/` markdown documents. Two sub-modes: **list mode** and **viewer mode**.

## UI Layout — List Mode

```
 PRISM  > Research                                                    ← Breadcrumb
────────────────────────────────────────────────────────────────────────
> 2026-02-12  tech-stack-evaluation                                    ← CurrentStyle
    Evaluated React vs Svelte vs Solid for frontend framework.         ← DimStyle (preview)
    Recommendation: React with Next.js for SSR support.                ← DimStyle (preview)
  2026-02-08  auth-patterns                                            ← PendingStyle
  2026-02-04  database-schema-design                                   ← PendingStyle

  j/k navigate   enter view   esc home
```

## UI Layout — Viewer Mode

```
 PRISM  > Research                                                    ← Breadcrumb
────────────────────────────────────────────────────────────────────────
# Tech Stack Evaluation                                                │
                                                                       │
## Summary                                                             │ viewport.Model
Evaluated React vs Svelte vs Solid for frontend framework...           │ (scrollable)
                                                                       │
## Findings                                                            │
...                                                                    │
────────────────────────────────────────────────────────────────────────
  esc back   j/k scroll
```

## UI Layout — Empty State

When no research documents exist in `.prism/shared/research/`:

```
 PRISM  > Research                                                    ← Breadcrumb
────────────────────────────────────────────────────────────────────────

  No research files found.
  Add .md files to .prism/shared/research/

  j/k navigate   enter view   esc home
```

## Key Bindings — List Mode

| Key | Action |
|-----|--------|
| `j` / `↓` | Next file (clamped, no wrap) |
| `k` / `↑` | Previous file (clamped, no wrap) |
| `Enter` | Open file in scrollable viewport |
| `Esc` / `Backspace` | Return to Home |

## Key Bindings — Viewer Mode

| Key | Action |
|-----|--------|
| `Esc` / `Backspace` | Close viewer, return to list |
| `j` / `k` / `↑` / `↓` | Scroll viewport |
| `PgUp` / `PgDn` | Page scroll |
