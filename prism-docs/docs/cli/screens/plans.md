---
title: Plans Screen
description: File browser for .prism/shared/plans/ with list and viewer modes, plus a decompose command to generate stories.json.
outline: [2, 3]
---

# Plans Screen

Identical to the [Research screen](/cli/screens/research) but browses `.prism/shared/plans/` and adds a **decompose** command.

## UI Layout — List Mode

```
 PRISM  > Plans                                                       ← Breadcrumb
────────────────────────────────────────────────────────────────────────
> 2026-02-28  feature-implementation                                    ← CurrentStyle
    Phase 1: Set up database schema and migrations                     ← DimStyle (preview)
    Phase 2: Implement API endpoints for CRUD operations               ← DimStyle (preview)
  2026-02-20  auth-system-redesign                                      ← PendingStyle
  2026-02-15  performance-optimization                                  ← PendingStyle

  j/k navigate   enter view   d decompose to epic   esc home
```

## UI Layout — Viewer Mode

```
 PRISM  > Plans                                                       ← Breadcrumb
────────────────────────────────────────────────────────────────────────
# Feature Implementation Plan                                          │
                                                                       │
## Phase 1: Database Schema                                            │ viewport.Model
- Create initial migration files                                       │ (scrollable)
- Set up connection pooling                                            │
                                                                       │
## Phase 2: API Endpoints                                              │
...                                                                    │
────────────────────────────────────────────────────────────────────────
  esc back   j/k scroll
```

## Additional Key Binding

| Key | Action |
|-----|--------|
| `d` | Decompose selected plan into an epic (creates `.prism/stories/<name>/stories.json`) |

All other key bindings are identical to the Research screen (list and viewer modes).
