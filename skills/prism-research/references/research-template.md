# Research Template

Save to: `thoughts/shared/research/YYYY-MM-DD-topic.md`

---

```markdown
---
date: YYYY-MM-DD
researcher: Claude
git_commit: [from git rev-parse HEAD]
branch: [from git branch --show-current]
repository: [repo-name]
topic: "[Research Topic]"
tags: [research, component-names]
status: complete
---

# Research: [Topic]

## Research Question

[Original user query]

## Summary

[2-3 sentence high-level answer. What exists, where it lives, how it works.]

## Files Discovered

| File | Purpose |
|------|---------|
| `src/auth/jwt.ts` | Token generation and validation |
| `src/api/middleware.ts` | Auth middleware for routes |
| `src/types/auth.ts` | TypeScript interfaces |

## Component Analysis

### [Component 1 Name]

**Location**: `src/auth/`

**How it works**:
- Entry point: `jwt.ts:45` - `createToken()` function
- Validation: `jwt.ts:78` - `validateToken()` function
- Calls: `crypto.ts:12` for signature generation

**Data flow**:
```
Request → middleware.ts:23 → jwt.ts:78 → Response
```

### [Component 2 Name]

**Location**: `src/api/`

**How it works**:
- [Description with file:line references]

**Connections**:
- Imports from: `../auth/jwt.ts`
- Used by: `routes.ts:34`, `handlers.ts:89`

## Patterns Found

### [Pattern Name]

**Example at**: `src/components/Button.tsx:15-45`

```typescript
// Key pattern snippet
const pattern = {
  // ...
};
```

**Also used in**:
- `src/components/Input.tsx:20`
- `src/components/Select.tsx:18`

## Historical Context

From `thoughts/` directory:

- `thoughts/shared/research/2024-01-10-auth.md` - Previous auth research
- `thoughts/shared/plans/2024-01-15-refactor.md` - Related refactoring

## Architecture Notes

[Current patterns, conventions, design decisions found in codebase]

- **Pattern**: Repository pattern used for data access
- **Convention**: All API routes in `src/api/routes/`
- **Decision**: JWT over sessions (per `thoughts/shared/decisions/auth.md`)

## Open Questions

For TodoWrite tracking:

- [ ] How does X interact with Y?
- [ ] What happens when Z fails?
- [ ] Is there documentation for the ABC pattern?

## Code References

Quick navigation:

| Reference | Description |
|-----------|-------------|
| `src/auth/jwt.ts:45` | Token creation |
| `src/auth/jwt.ts:78` | Token validation |
| `src/api/middleware.ts:23` | Auth middleware |
| `src/types/auth.ts:5-20` | Auth interfaces |
```

---

## Template Rules

1. **Always include file:line references** - Concrete navigation points
2. **Document connections** - How components interact
3. **Cite thoughts/ sources** - Link to historical context
4. **Track open questions** - Use TodoWrite for follow-ups
5. **No recommendations** - Document what IS, not what SHOULD BE
