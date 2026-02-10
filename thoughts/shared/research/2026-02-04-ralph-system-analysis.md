# Ralph: Autonomous AI Agent Loop System

## Executive Summary

**Ralph** is an autonomous AI agent loop system that transforms Product Requirements Documents (PRDs) into fully implemented features through iterative, self-contained AI coding sessions. Named humorously after Ralph Wiggum, it implements a pattern where fresh AI instances are spawned for each iteration, with memory persisting through git history, progress logs, and PRD state tracking.

---

## Core Concept

Ralph's fundamental insight is simple but powerful:

> **Each iteration is fresh, but memory persists through files.**

Instead of trying to maintain one long AI session (which degrades over time), Ralph spawns a completely fresh AI instance for each iteration. Knowledge persists through:

1. **Git history** - All previous commits
2. **progress.txt** - Append-only learnings log
3. **prd.json** - Task list with completion status
4. **CLAUDE.md/AGENTS.md** - Discovered codebase patterns

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        RALPH SYSTEM                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐    ┌─────────────────────────────────────────┐ │
│  │   ralph.sh  │───▶│           Fresh AI Instance             │ │
│  │ (Bash Loop) │    │  (Amp or Claude Code - no memory)       │ │
│  └──────┬──────┘    └─────────────────────────────────────────┘ │
│         │                           │                            │
│         │                           ▼                            │
│         │           ┌─────────────────────────────────────────┐ │
│         │           │         PERSISTENT STATE                 │ │
│         │           │  ┌──────────┐ ┌──────────┐ ┌──────────┐ │ │
│         │           │  │ prd.json │ │progress. │ │ CLAUDE.  │ │ │
│         │           │  │(tasks)   │ │txt(learn)│ │md(agents)│ │ │
│         │           │  └──────────┘ └──────────┘ └──────────┘ │ │
│         │           └─────────────────────────────────────────┘ │
│         │                           │                            │
│         │    ┌──────────────────────┴──────────────────────┐    │
│         │    │                GIT REPOSITORY                │    │
│         │    │  (Commits = Permanent Memory of All Work)   │    │
│         │    └─────────────────────────────────────────────┘    │
│         │                                                        │
│         ▼                                                        │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Completion Check: <promise>COMPLETE</promise> signal?   │    │
│  │     YES → Exit     NO → Spawn next iteration            │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## The Bash Script: ralph.sh

The core loop is elegantly simple:

```bash
#!/bin/bash

MAX_ITERATIONS=${1:-10}
TOOL=${2:-amp}  # amp or claude

for i in $(seq 1 $MAX_ITERATIONS); do
  echo "=== Iteration $i of $MAX_ITERATIONS ==="

  # Spawn fresh AI instance with prompt
  if [[ "$TOOL" == "amp" ]]; then
    OUTPUT=$(cat "$SCRIPT_DIR/prompt.md" | amp --dangerously-allow-all 2>&1)
  else
    OUTPUT=$(claude --dangerously-skip-permissions --print < "$SCRIPT_DIR/CLAUDE.md" 2>&1)
  fi

  # Check for completion signal
  if echo "$OUTPUT" | grep -q "<promise>COMPLETE</promise>"; then
    echo "✅ All stories complete!"
    exit 0
  fi

  sleep 2  # Brief pause between iterations
done

echo "⚠️ Max iterations reached"
```

### Key Mechanics

| Mechanism | Purpose |
|-----------|---------|
| Fresh Instance | Each iteration has clean context, no degradation |
| Completion Signal | `<promise>COMPLETE</promise>` terminates the loop |
| Max Iterations | Safety limit (default: 10) |
| Sleep Between | Prevents rate limiting, allows state to settle |

---

## State Files

### prd.json - The Task List

```json
{
  "project": "MyApp",
  "branchName": "ralph/feature-name",
  "description": "Feature description",
  "userStories": [
    {
      "id": "US-001",
      "title": "Add user authentication schema",
      "description": "As a developer, I want database tables for users...",
      "acceptanceCriteria": [
        "Users table with email, password_hash columns",
        "Migrations run successfully",
        "Typecheck passes"
      ],
      "priority": 1,
      "passes": false,
      "notes": ""
    },
    {
      "id": "US-002",
      "title": "Add login API endpoint",
      "priority": 2,
      "passes": false
      // ... more fields
    }
  ]
}
```

**Key Fields:**
- `priority` - Lower = higher priority (done first)
- `passes` - `false` → needs work, `true` → complete
- `acceptanceCriteria` - Verifiable checklist

### progress.txt - The Learning Log

```
## Codebase Patterns (Consolidated)
- Database migrations in /db/migrations/ using Drizzle
- API routes follow /api/v1/[resource] pattern
- React components use shadcn/ui
---

## 2026-02-04 10:30 - US-001
- Implemented users table with Drizzle schema
- Files changed: db/schema.ts, db/migrations/0001_users.sql
- **Learnings:**
  - Must run `pnpm db:generate` before `db:migrate`
  - Foreign keys need explicit ON DELETE CASCADE
---

## 2026-02-04 10:45 - US-002
- Added login endpoint
- Files changed: app/api/auth/login/route.ts
- **Learnings:**
  - Auth tokens stored in httpOnly cookies (see authConfig.ts)
  - Rate limiting handled by middleware in /lib/rateLimit.ts
---
```

**Key Principles:**
- **Append-only** - Never delete, only add
- **Patterns bubble up** - Consolidate repeated learnings to top
- **Specific file paths** - Future iterations can navigate precisely

### CLAUDE.md / AGENTS.md - Agent Instructions

Contains:
- Step-by-step workflow instructions
- Quality requirements (typecheck, lint, tests)
- Progress report format
- Completion criteria
- Browser testing instructions (for UI)

---

## The Iteration Workflow

Each fresh AI instance follows this exact sequence:

```
┌─────────────────────────────────────────────────────────────────┐
│                     SINGLE ITERATION                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. READ STATE                                                   │
│     ├─ prd.json (what needs doing)                              │
│     ├─ progress.txt (what was learned)                          │
│     └─ CLAUDE.md (codebase patterns)                            │
│                                                                  │
│  2. SELECT WORK                                                  │
│     └─ Find highest priority story where passes: false          │
│                                                                  │
│  3. IMPLEMENT                                                    │
│     ├─ Checkout correct branch                                  │
│     └─ Implement the single story                               │
│                                                                  │
│  4. QUALITY CHECKS                                               │
│     ├─ Typecheck (required)                                     │
│     ├─ Lint                                                     │
│     └─ Tests                                                    │
│                                                                  │
│  5. COMMIT (if passing)                                          │
│     └─ "feat: [US-001] - Add user authentication schema"        │
│                                                                  │
│  6. UPDATE PATTERNS                                              │
│     └─ If discovered new patterns, add to CLAUDE.md             │
│                                                                  │
│  7. UPDATE STATE                                                 │
│     ├─ Set passes: true in prd.json                             │
│     └─ Append progress report to progress.txt                   │
│                                                                  │
│  8. CHECK COMPLETION                                             │
│     ├─ All passes: true? → Output <promise>COMPLETE</promise>   │
│     └─ More work? → End normally (next iteration starts)        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Story Sizing Guidelines

Ralph only works if stories are small enough to complete in one iteration (one context window).

### Right-Sized Stories ✅
- Add a database column and migration
- Add a UI component to an existing page
- Update a server action with new logic
- Add a filter dropdown to a list
- Display indicator or badge on cards

### Too Big - Must Split ❌
- "Build the entire dashboard" → Split: schema, queries, components, filters
- "Add authentication" → Split: schema, middleware, login UI, session handling
- "Refactor the API" → One story per endpoint or pattern

### Splitting Rule
> If you can't describe the implementation in 2-3 sentences, it's too big.

---

## PRD Generation Skills

Ralph includes two skills for Claude Code marketplace:

### /prd - PRD Generation
1. Ask 3-5 clarifying questions with lettered options
2. Generate comprehensive PRD with:
   - Overview, Goals, User Stories
   - Functional Requirements
   - Non-Goals, Design Considerations
   - Technical Considerations
   - Success Metrics, Open Questions
3. Save to `tasks/prd-[feature-name].md`

### /ralph - PRD to JSON Conversion
1. Parse markdown PRD
2. Split complex features into small stories
3. Order by dependencies (schema → backend → UI)
4. Generate prd.json format

---

## Why Fresh Iterations Matter

### Problem with Long Sessions
| Session Length | Symptoms |
|----------------|----------|
| Short (fresh) | Clear thinking, follows instructions |
| Medium | Starts forgetting earlier context |
| Long | Hallucinations, repeated mistakes, confusion |

### Ralph's Solution
- **Fresh context every time** - No accumulated confusion
- **Memory through files** - Learnings persist across iterations
- **Git as truth** - Commits can't be hallucinated
- **Quality gates** - Broken code doesn't advance

---

## Quality Feedback Loops

Ralph critically depends on feedback:

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Typecheck  │────▶│    Lint     │────▶│    Tests    │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       ▼                   ▼                   ▼
   Pass? ✅            Pass? ✅            Pass? ✅
       │                   │                   │
       ▼                   ▼                   ▼
   Commit ────────────────────────────────▶ Done
```

If any check fails:
- Story stays `passes: false`
- Next iteration tries again
- progress.txt contains learnings about why it failed

---

## Archive System

When starting a new feature (branch name changes):

```
archive/
└── 2026-02-03-user-auth/
    ├── prd.json
    ├── progress.txt
    └── CLAUDE.md (with patterns discovered)
```

This preserves the complete history of each feature's development.

---

## Key Insights

### 1. Files Are Memory
Without any database or special system, plain text files become the AI's long-term memory.

### 2. Git Is Truth
Commits provide verifiable proof of progress. The AI can't hallucinate a commit that exists.

### 3. Small Stories = Success
Large tasks fail. Small, focused stories succeed consistently.

### 4. Quality Gates Are Essential
Without typecheck/lint/test gates, errors compound across iterations.

### 5. Patterns Consolidate
Repeated learnings in progress.txt get consolidated into "Codebase Patterns" section, teaching future iterations.

---

## File Organization

```
ralph/
├── ralph.sh                  # Main orchestrator
├── CLAUDE.md                # Prompt for Claude Code
├── prompt.md               # Prompt for Amp
├── prd.json.example        # Example format
├── prd.json               # Current tasks (runtime)
├── progress.txt           # Learnings (runtime)
├── .last-branch           # Archive tracking
├── skills/
│   ├── prd/SKILL.md       # PRD generation
│   └── ralph/SKILL.md     # PRD converter
├── .claude-plugin/
│   ├── plugin.json        # Plugin manifest
│   └── marketplace.json   # Marketplace config
├── flowchart/             # React Flow visualization
└── archive/               # Previous runs
```

---

## Summary

Ralph transforms AI-assisted development by:

1. **Spawning fresh AI instances** instead of maintaining degrading sessions
2. **Persisting memory through files** (prd.json, progress.txt, git)
3. **Breaking work into tiny stories** that fit in one context window
4. **Enforcing quality gates** (typecheck, lint, tests) before advancing
5. **Consolidating learnings** so future iterations get smarter

The result is autonomous, iterative feature development that can complete complex multi-day features without human intervention between iterations.
