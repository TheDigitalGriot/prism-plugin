# Plan Template

Save to: `thoughts/shared/plans/YYYY-MM-DD-feature.md`

---

```markdown
---
date: YYYY-MM-DD
author: Claude
repository: [repo-name]
branch: [feature-branch-name]
ticket: [TICKET-123 or N/A]
status: [draft | approved | in-progress | complete]
research: thoughts/shared/research/YYYY-MM-DD-topic.md
---

# Plan: [Feature/Fix Name]

## Overview

**Goal**: [One sentence — what this accomplishes]

**Research**: [Link to research document]

**Complexity**: [Low | Medium | High]

**Estimated Phases**: [N]

## Success Criteria

### Automated (CI/Scripts)
- [ ] `npm test` — All tests pass
- [ ] `npm run lint` — No lint errors
- [ ] `npm run typecheck` — No type errors
- [ ] `npm run build` — Build succeeds

### Manual Verification
- [ ] User can [specific action]
- [ ] [Specific behavior] works as expected
- [ ] No regressions in [related area]

## Phases

### Phase 1: [Name]

**Goal**: [What this phase accomplishes]

**Files to modify**:
| File | Change |
|------|--------|
| `src/auth/jwt.ts` | Add refresh token method |
| `src/types/auth.ts` | Add RefreshToken interface |

**Files to create**:
| File | Purpose |
|------|---------|
| `src/auth/refresh.ts` | Refresh token logic |
| `src/__tests__/refresh.test.ts` | Unit tests |

**Steps**:
1. [ ] Create `RefreshToken` interface in `src/types/auth.ts`
2. [ ] Implement `refreshToken()` in `src/auth/jwt.ts:68`
3. [ ] Add validation in `src/auth/refresh.ts`
4. [ ] Write tests in `src/__tests__/refresh.test.ts`

**Verification**:
```bash
npm run typecheck
npm test -- --grep "refresh"
```

**Checkpoint**: ⬜ Phase 1 complete

---

### Phase 2: [Name]

**Goal**: [What this phase accomplishes]

**Files to modify**:
| File | Change |
|------|--------|
| `src/api/routes.ts` | Add refresh endpoint |

**Steps**:
1. [ ] Add POST `/auth/refresh` route
2. [ ] Wire up to refresh service
3. [ ] Add rate limiting

**Verification**:
```bash
npm test -- --grep "auth"
curl -X POST localhost:3000/auth/refresh -d '{"token": "..."}'
```

**Checkpoint**: ⬜ Phase 2 complete

---

### Phase 3: [Name]

[Continue pattern...]

**Checkpoint**: ⬜ Phase 3 complete

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Token race condition | Medium | High | Add mutex lock |
| Breaking existing auth | Low | Critical | Full test coverage first |

## Edge Cases

| Case | Handling |
|------|----------|
| Expired refresh token | Return 401, clear cookies |
| Concurrent refresh requests | Queue and dedupe |
| Invalid token format | Return 400 with message |

## Out of Scope

Explicitly excluded:
- [ ] OAuth provider integration
- [ ] Multi-device session management
- [ ] Admin token revocation UI

## Rollback Plan

If critical issues arise:
```bash
git revert HEAD~N..HEAD
npm run deploy:rollback
```

Steps:
1. Revert commits from this feature
2. Deploy previous version
3. Clear any new database migrations (if applicable)

## Dependencies

**Must complete first**:
- [ ] [Other task/PR if any]

**Can parallelize with**:
- [ ] [Related work]

## Progress Log

| Phase | Status | Started | Completed | Notes |
|-------|--------|---------|-----------|-------|
| Phase 1 | ⬜ Not started | | | |
| Phase 2 | ⬜ Not started | | | |
| Phase 3 | ⬜ Not started | | | |

---

## Session Notes

[Space for implementation notes, discoveries, blockers]

### Session 1 - [Date]
- Started Phase 1
- Found: [discovery]
- Blocked: [if any]

### Session 2 - [Date]
- Completed Phase 1
- Started Phase 2
```

---

## Planning Rules

1. **Interactive planning** — Present understanding, get feedback, iterate
2. **No open questions** — Resolve all unknowns before finalizing
3. **Testable criteria** — Every success criterion must be verifiable
4. **Specific file paths** — Know exactly what changes before coding
5. **Phase checkpoints** — Explicit approval gates between phases
6. **Separate auto/manual** — Different verification approaches
