---
title: User Flow Diagrams
description: Complete navigation map, back navigation logic, and within-screen workflow diagrams for the Prism CLI.
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

Additional screens (not in number-key shortcuts):
  Browser — accessible via Command Palette (: → "Browser Focus")

Full-screen overlays (not in tab order):
  [Ctrl+P] or [:] → Command Palette
  [Ctrl+D] → File Finder
  [Ctrl+S] → Content Search
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

## Within-Screen Workflows

Multi-step user workflows showing how screens, modals, and state transitions connect.

### Git Commit Workflow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────────────────┐
│ Git Sidebar   │     │ Git Sidebar   │     │ Commit Modal             │
│              │     │              │     │                          │
│ (files       │ [s] │ (files       │ [c] │ Textarea: commit msg     │
│  listed)     │────▶│  staged)     │────▶│ [Commit] [Cancel]        │
│              │     │              │     │                          │
└──────────────┘     └──────────────┘     └────────┬─────────────────┘
                                                    │
                                              [Commit]
                                                    │
                                                    ▼
                                          ┌──────────────────┐
                                          │ git commit -m... │
                                          │ (executes async) │
                                          └────────┬─────────┘
                                                    │
                                                    ▼
                                          ┌──────────────────┐
                                          │ Modal closes     │
                                          │ Status refreshes │
                                          └──────────────────┘
```

If no files are staged when `c` is pressed, the commit modal still opens (user can type message but commit will fail).

### Git Push/Pull Workflow

```
┌──────────────┐  [P]  ┌────────────────────────────────────────┐
│ Git Sidebar   │──────▶│ Push Modal                             │
│              │       │ Branch: main (2 ahead)                 │
└──────────────┘       │ [Push] [Force Push] [Set Upstream]     │
                        └──────────┬─────────────────────────────┘
                                   │ [Push]
                                   ▼
                        ┌────────────────────┐
                        │ git push origin... │──▶ Modal closes ──▶ Status refreshes
                        └────────────────────┘

┌──────────────┐  [L]  ┌────────────────────────────────────────┐
│ Git Sidebar   │──────▶│ Pull / Fetch Modal                     │
│              │       │ Branch: main (1 behind)                │
└──────────────┘       │ [Fetch] [Pull] [Pull (rebase)]         │
                        └──────────┬─────────────────────────────┘
                                   │ [Pull]
                                   ▼
                        ┌────────────────────┐
                        │ git pull origin... │──▶ Modal closes ──▶ Status refreshes
                        └────────────────────┘
```

### Git Stash Workflow

```
┌──────────────┐  [S]  ┌────────────────────────────────┐
│ Git Sidebar   │──────▶│ Stash Menu                     │
│              │       │ [Stash] [+untracked] [View] [X]│
└──────────────┘       └───┬──────┬──────┬──────────────┘
                           │      │      │
                    [Stash]│      │      │[View Stashes]
                           │      │      │
                           ▼      │      ▼
                 ┌──────────┐     │   ┌────────────────────────────────┐
                 │ git stash│     │   │ Stash List Modal               │
                 │ push     │     │   │ > stash@{0}: WIP on auth...   │
                 │ ──▶ done │     │   │   stash@{1}: save before...   │
                 └──────────┘     │   │ [Apply] [Pop] [Drop] [Cancel] │
                                  │   └───┬──────┬──────┬─────────────┘
                           [+untracked]   │      │      │
                                  │  [Apply]  [Pop]  [Drop]
                                  ▼       │      │      │
                        ┌──────────┐      ▼      ▼      ▼
                        │ stash    │   applied  popped  ┌───────────────────┐
                        │ push -u  │                    │ Drop Confirm      │
                        │ ──▶ done │                    │ [red border]      │
                        └──────────┘                    │ [Drop] [Cancel]   │
                                                        └─────┬─────────────┘
                                                              │ [Drop]
                                                              ▼
                                                        git stash drop
```

### Workspaces Worktree Lifecycle

```
┌─────────────────┐  [n]  ┌──────────────────────────┐
│ Worktrees View   │──────▶│ Create Worktree Modal    │
│ (sidebar list)   │       │ Branch: feature/...      │
└─────────────────┘       │ [Create] [Cancel]        │
       │                   └────────┬─────────────────┘
       │                            │ [Create]
       │                            ▼
       │                   ┌──────────────────┐
       │                   │ git worktree add │──▶ List refreshes
       │                   └──────────────────┘
       │
       │  [d]  ┌──────────────────────────┐
       │──────▶│ Delete Confirm Dialog    │
       │       │ [red border]             │
       │       │ [Delete] [Cancel]        │
       │       └────────┬─────────────────┘
       │                │ [Delete]
       │                ▼
       │       ┌───────────────────┐
       │       │ git worktree      │──▶ List refreshes
       │       │ remove <path>     │
       │       └───────────────────┘
       │
       │  [Enter]
       └──────────▶ cd to worktree directory
```

### Spectrum Execution Lifecycle (User Perspective)

```
┌──────────┐  [Enter]  ┌──────────────┐         ┌─────────────────────┐
│   IDLE    │─────────▶│   RUNNING    │────────▶│ Permission Dialog?  │
│ "Press    │          │   ⣾ Working  │  (tool) │ [Allow] [Session]   │
│  Enter"   │          │              │◀────────│ [Deny]              │
└──────────┘          └──────┬───┬───┘ (allow)  └─────────────────────┘
                              │   │
                        (story│   │[p]
                        done) │   │
                              │   ▼
                              │ ┌──────────┐  [p]  ┌──────────────┐
                              │ │ PAUSED   │──────▶│   RUNNING    │
                              │ │ ⏸ Paused │       │   (resume)   │
                              │ └──────────┘       └──────────────┘
                              │
                              ▼
                     ┌────────────────────┐    (all stories done)
                     │ Story pop animation│──────────────────────▶ ┌──────────┐
                     │ Next story starts  │                        │ COMPLETE │
                     │ ─▶ back to RUNNING │                        │ ✓ Done   │
                     └────────────────────┘                        │ [Enter]  │
                                                                   │ ──▶ quit │
                              (3 errors)                            └──────────┘
                     ┌──────────────┐        (50 iterations)  ┌────────────────┐
                     │    ERROR     │                          │ MAX ITERATIONS │
                     │ ✗ Error msg  │                          │ ⏸ Limit hit    │
                     │ [Enter] quit │                          │ [Enter] quit   │
                     └──────────────┘                          └────────────────┘
```

### Files Edit Workflow

```
┌──────────────┐ [Enter] ┌────────────────┐  [Tab]  ┌────────────────┐
│ Files Tree    │────────▶│ File opens in  │────────▶│ Preview pane   │
│ (select file) │         │ preview tab    │         │ (focused)      │
└──────────────┘         └────────────────┘         └───────┬────────┘
                                                            │ [e]
                                                            ▼
                                                   ┌────────────────┐
                                                   │ EDIT MODE      │
                                                   │ Textarea with  │
                                                   │ file content   │
                                                   │ (cursor active)│
                                                   └───┬────────┬───┘
                                                       │        │
                                                [Ctrl+S]    [Esc]
                                                       │        │
                                                       ▼        ▼
                                              ┌───────────┐ ┌───────────┐
                                              │ File saved│ │ Changes   │
                                              │ ──▶ back  │ │ discarded │
                                              │ to preview│ │ ──▶ back  │
                                              └───────────┘ │ to preview│
                                                            └───────────┘
```

### Files Search-to-Navigate Workflows

```
┌───────────────┐  [Ctrl+D]  ┌───────────────────────────────────────┐
│ Any Screen     │───────────▶│ File Finder Overlay                   │
│               │            │ [Filter: mod                         ]│
└───────────────┘            │ > cmd/prism-cli/app/model.go          │
                              │   go.mod                              │
                              └──────────────┬────────────────────────┘
                                             │ [Enter] select file
                                             ▼
                              ┌───────────────────────────────────────┐
                              │ Navigate to Files screen              │
                              │ Selected file opens in preview tab    │
                              └───────────────────────────────────────┘

┌───────────────┐  [Ctrl+S]  ┌───────────────────────────────────────┐
│ Any Screen     │───────────▶│ Content Search Overlay                │
│               │            │ [Search: handleSubmit                ]│
└───────────────┘            │ > Form.tsx:42  const handleSubmit... │
                              │   useForm.ts:28  return { handle...  │
                              └──────────────┬────────────────────────┘
                                             │ [Enter] select result
                                             ▼
                              ┌───────────────────────────────────────┐
                              │ Navigate to Files screen              │
                              │ File opens at matching line           │
                              └───────────────────────────────────────┘
```
