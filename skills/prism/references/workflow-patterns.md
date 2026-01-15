# Workflow Patterns

Patterns extracted from real-world development workflows that can be adapted to any project.

## Ticket Lifecycle Workflow

A structured progression ensures alignment before code is written:

```
Triage → Spec Needed → Research Needed → Research in Progress →
Ready for Plan → Plan in Progress → Plan in Review →
Ready for Dev → In Dev → Code Review → Done
```

### Key Principle

**Review and alignment happen at the plan stage (not PR stage)** to move faster and avoid rework.

### State Transitions

| From | To | Trigger |
|------|-----|---------|
| Triage | Spec Needed | Ticket needs more detail |
| Spec Needed | Research Needed | Problem/solution outlined, needs investigation |
| Research Needed | Research in Progress | Starting active research |
| Research in Progress | Ready for Plan | Research complete |
| Ready for Plan | Plan in Progress | Starting to write plan |
| Plan in Progress | Plan in Review | Plan written |
| Plan in Review | Ready for Dev | Plan approved |
| Ready for Dev | In Dev | Implementation started |
| In Dev | Code Review | PR submitted |
| Code Review | Done | PR merged |

## Auto-Pick from Backlog Pattern

Automation for processing tickets from a backlog:

### Pattern

1. Fetch top N items by priority from a specific status
2. Filter by size (prefer SMALL/XS for automation)
3. Select the highest priority matching item
4. Process only ONE item per invocation
5. Update status as work progresses

### Implementation

```markdown
## Auto-Research

1. Fetch top 10 priority items in "research needed" status
2. Select highest priority SMALL/XS issue
3. Move to "research in progress"
4. Conduct research
5. Save findings to thoughts/shared/research/
6. Move to "ready for plan"

## Auto-Plan

1. Fetch top 10 priority items in "ready for plan" status
2. Select highest priority SMALL/XS issue
3. Move to "plan in progress"
4. Create implementation plan
5. Save plan to thoughts/shared/plans/
6. Move to "plan in review"

## Auto-Implement

1. Fetch top 10 priority items in "ready for dev" status
2. Select highest priority SMALL/XS issue
3. Move to "in dev"
4. Create worktree for isolated development
5. Implement according to plan
6. Commit, create PR
7. Move to "code review"
```

### Why Size Filtering?

- SMALL/XS tickets are well-scoped
- Reduces risk of automation getting stuck
- Faster feedback loops
- Larger tickets need human judgment on approach

## Document-Driven Development

All artifacts are persisted to `thoughts/` directory:

```
thoughts/
├── shared/               # Committed to repo
│   ├── research/        # YYYY-MM-DD-topic.md
│   ├── plans/           # YYYY-MM-DD-feature.md
│   ├── validation/      # YYYY-MM-DD-report.md
│   └── handoffs/        # Session handoff docs
└── local/               # Gitignored, per-developer
```

### Benefits

- Persists context across sessions
- Enables handoffs between developers/agents
- Creates audit trail of decisions
- Research can be reused across tickets

## Worktree-Based Isolation

Use git worktrees for parallel work:

```bash
# Create worktree for feature
git worktree add -b feature/ENG-123 ~/worktrees/project/ENG-123 main

# Work in isolation
cd ~/worktrees/project/ENG-123
# ... implement ...

# Clean up when done
git worktree remove ~/worktrees/project/ENG-123
```

### Benefits

- Main branch stays clean
- Multiple features in parallel
- Easy to abandon failed experiments
- Tests can run in one worktree while developing in another

## Ticket Quality Guidelines

### Required Elements

Every ticket should include:

1. **Problem to solve** - User perspective, not implementation
2. **Proposed solution** - High-level approach
3. **Acceptance criteria** - How to verify it's done

### Comment Quality

Focus on:
- Key insights over summaries
- Decisions and tradeoffs
- Blockers resolved
- State changes and what they mean

Avoid:
- Mechanical lists without context
- Restating what's obvious from diffs
- Generic summaries

## Integration Points

### With Issue Trackers

- Use MCP tools or CLI for programmatic access
- Keep ticket status synchronized with actual work state
- Attach documents (research, plans) to tickets

### With Git

- Branch names should reference ticket IDs
- Commit messages should reference tickets
- PR descriptions should link to plans

### With CI/CD

- Automated verification runs on PR
- Manual verification documented in plan
- Status updates based on CI results
