---
title: Domain Models
description: stories.json schema, story lifecycle, dependency resolution, and .prism/ directory conventions.
outline: [2, 3]
---

# Domain Models

## stories.json Schema

```json
{
  "plan": {
    "name": "Feature Implementation",
    "source": ".prism/shared/plans/2026-02-12-feature.md",
    "createdAt": "2026-02-12T14:00:00Z",
    "qualityGates": ["npm run typecheck", "npm run lint", "npm test"]
  },
  "stories": [
    {
      "id": "STORY-001",
      "title": "Setup database schema",
      "description": "Create initial migration files for PostgreSQL",
      "priority": 1,
      "status": "complete",
      "blockedBy": null,
      "files": [
        { "path": "db/migrations/001_initial.sql", "action": "create" },
        { "path": "db/schema.go", "action": "modify" }
      ],
      "steps": [
        { "description": "Design schema", "done": true },
        { "description": "Write migration", "done": true }
      ],
      "completedAt": "2026-02-12T14:30:00Z",
      "commitHash": "abc123"
    }
  ]
}
```

## Story Status Lifecycle

```
                ┌─────────┐
                │ pending  │
                └────┬────┘
                     │
            GetNextStory()
           (priority-sorted,
            unblocked only)
                     │
                     ▼
              ┌────────────┐
              │ in_progress │
              └──────┬─────┘
                     │
          MarkStoryComplete()
            (sets status,
             records commit,
             marks all steps done)
                     │
                     ▼
              ┌────────────┐
              │  complete   │
              └────────────┘
```

## Dependency Resolution

```go
func GetNextStory():
    candidates = stories.filter(s =>
        s.Status != "complete" &&
        !s.IsBlocked(stories)     // blockedBy story must be complete
    )
    sort(candidates, by: Priority ascending)  // lower number = higher priority
    return candidates[0]  // or nil if empty
```

## .prism/ Directory Convention

```
.prism/
├── stories/                              # Story files
│   ├── stories.json                      # Legacy flat layout
│   ├── epic-a/
│   │   └── stories.json                  # Epic-scoped
│   └── epic-b/
│       └── stories.json
├── shared/                               # Committed to repo
│   ├── research/
│   │   └── YYYY-MM-DD-topic.md
│   ├── plans/
│   │   └── YYYY-MM-DD-feature.md
│   ├── spectrum/
│   │   ├── progress.md                   # Legacy flat
│   │   ├── epic-a/
│   │   │   └── progress.md               # Epic-scoped
│   │   └── epic-b/
│   │       └── progress.md
│   ├── validation/
│   ├── docs/
│   ├── handoffs/
│   ├── prs/
│   └── ref/
└── local/                                # Gitignored
```

**Progress file path derivation**:

| stories.json Location | progress.md Location |
|------------------------|---------------------|
| `.prism/stories/stories.json` | `.prism/shared/spectrum/progress.md` |
| `.prism/stories/<epic>/stories.json` | `.prism/shared/spectrum/<epic>/progress.md` |
