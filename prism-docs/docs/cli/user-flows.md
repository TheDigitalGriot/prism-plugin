---
title: User Flow Diagrams
description: Complete navigation map, back navigation logic, and screen transition flows for the Prism CLI.
outline: [2, 3]
---

# User Flow Diagrams

## Complete Navigation Map

```
┌─────────────────────────────────────────────────────────────────────┐
│                         APPLICATION START                           │
│                                                                     │
│   Always ─────────────────────────────────────▶ Splash (5s/key)    │
│                                                    │                │
│                                    ┌───────────────┴──────────┐    │
│                                    │                          │    │
│                             NeedsOnboarding?            No     │    │
│                                    │                          │    │
│                                    ▼                          ▼    │
│                              Onboarding              Home          │
│                                    │                                │
│                              [complete]                             │
│                                    │                                │
│                                    ▼                                │
│                                  Home                               │
└─────────────────────────────────────────────────────────────────────┘

                         ┌──────────────────┐
                         │                  │
              ┌──────────│      HOME        │──────────────────┐
              │          │  [1] [2] [3]     │                  │
              │          │  j/k  enter      │                  │
              │          └──────┬─┬─────────┘                  │
              │                 │ │                             │
         [1] │           [2]  │ │   [3]                       │
              │                │ │                             │
              ▼                ▼ ▼                             ▼
   ┌──────────────┐ ┌──────────────┐ ┌──────────────────────────────┐
   │  RESEARCH    │ │    PLANS     │ │         SPECTRUM              │
   │  (List)      │ │  (List)      │ │  (Idle → Running → Complete) │
   └──────┬───────┘ └──────┬───────┘ └──────────────────────────────┘
          │                │
     [enter]          [enter]
          │                │
          ▼                ▼
   ┌──────────────┐ ┌──────────────┐
   │  RESEARCH    │ │    PLANS     │
   │  (Viewer)    │ │  (Viewer)    │
   └──────────────┘ └──────────────┘

Tab / Number keys switch between all 9 tabs:
  [1]Home [2]Research [3]Plans [4]Spectrum [5]Files [6]Git [7]Agent [8]Monitor [9]Workspaces

Additional full-screen overlays (not in tab order):
  [Ctrl+P] or [:] → Command Palette
  [?] → Help Modal
  [c] in Git → Commit Modal
```

## Back Navigation Logic

```
Current View          esc / backspace Action
─────────────────     ───────────────────────────────────────
Splash                (any key skips to next view)
Onboarding            (no back — must complete or key through)
Home                  (no effect)
Research (list)       → Home
Research (viewer)     → Research (list)
Plans (list)          → Home
Plans (viewer)        → Plans (list)
Spectrum (idle)       → Home
Spectrum (running)    → (blocked — cannot leave while running)
Spectrum (paused)     → (blocked — cannot leave while paused)
Spectrum (complete)   → Home (via quit)
Files (tree)          → Home
Files (preview)       → Files (tree)
Git (sidebar)         → Home
Git (diff)            → Git (sidebar)
Agent                 → Home
Monitor               → Home
Workspaces (projects) → Home
Workspaces (epics)    → Workspaces (projects)
Workspaces (preview)  → Workspaces (sidebar)
```
