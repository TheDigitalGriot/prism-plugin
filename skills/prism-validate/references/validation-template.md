# Validation Template

Save to: `thoughts/shared/validation/YYYY-MM-DD-report.md`

---

```markdown
---
date: YYYY-MM-DD
validator: Claude
repository: [repo-name]
branch: [branch-name]
plan: thoughts/shared/plans/YYYY-MM-DD-feature.md
git_range: [start-commit]..[end-commit]
status: [pass | fail | partial]
---

# Validation Report: [Feature Name]

## Summary

| Metric | Result |
|--------|--------|
| Phases Completed | [N/M] |
| Automated Criteria | [N/M] passing |
| Manual Criteria | [N/M] verified |
| Overall Status | ✅ PASS / ❌ FAIL / ⚠️ PARTIAL |

## Git Verification

```bash
# Commits in scope
git log --oneline [start]..[end]
```

Output:
```
abc1234 feat: Add refresh token endpoint
def5678 test: Add refresh token tests
ghi9012 refactor: Extract token validation
```

```bash
# Files changed
git diff [start]..[end] --stat
```

Output:
```
 src/auth/jwt.ts          | 45 ++++++++++++++
 src/auth/refresh.ts      | 82 +++++++++++++++++++++++++
 src/__tests__/refresh.ts | 120 ++++++++++++++++++++++++++++++++++++
 3 files changed, 247 insertions(+)
```

## Phase Verification

### Phase 1: [Name]

**Plan said**:
- Create RefreshToken interface
- Implement refreshToken() method
- Write unit tests

**Actual**:
- ✅ Interface created at `src/types/auth.ts:45-52`
- ✅ Method implemented at `src/auth/jwt.ts:68-95`
- ✅ Tests at `src/__tests__/refresh.test.ts`

**Verification commands**:
```bash
$ npm run typecheck
✓ No errors

$ npm test -- --grep "refresh"
  RefreshToken
    ✓ generates valid refresh token
    ✓ validates token signature
    ✓ rejects expired tokens
  3 passing (45ms)
```

**Phase Status**: ✅ COMPLETE

---

### Phase 2: [Name]

**Plan said**:
- Add POST /auth/refresh route
- Wire up to service
- Add rate limiting

**Actual**:
- ✅ Route added at `src/api/routes.ts:78`
- ✅ Service wired correctly
- ⚠️ Rate limiting deferred (see Deviations)

**Verification commands**:
```bash
$ curl -X POST localhost:3000/auth/refresh -d '{"token":"..."}' 
{"accessToken": "new-token", "expiresIn": 3600}
```

**Phase Status**: ⚠️ PARTIAL (rate limiting pending)

---

### Phase 3: [Name]

[Continue pattern...]

---

## Success Criteria Check

### Automated Criteria

| Criterion | Command | Result |
|-----------|---------|--------|
| Tests pass | `npm test` | ✅ 47 passing |
| Lint clean | `npm run lint` | ✅ No errors |
| Types check | `npm run typecheck` | ✅ No errors |
| Build succeeds | `npm run build` | ✅ Built in 12s |

### Manual Criteria

| Criterion | Verified By | Result |
|-----------|-------------|--------|
| User can refresh token | Manual test | ✅ Works |
| Old token invalidated | Manual test | ✅ Confirmed |
| No auth regressions | Smoke test | ✅ All flows work |

## Deviations from Plan

| Deviation | Reason | Impact | Action Needed |
|-----------|--------|--------|---------------|
| Rate limiting deferred | Requires Redis setup | Low | Follow-up ticket created |
| Extra validation added | Found edge case | None | Plan updated |

## Issues Found

### Issue 1: [Title]

**Severity**: [Critical | High | Medium | Low]

**Description**: [What's wrong]

**Location**: `src/file.ts:42`

**Recommendation**: [Fix or follow-up]

### Issue 2: [Title]

[Continue pattern...]

## Recommendations

1. **Immediate**: [Any blocking issues]
2. **Follow-up**: [Non-blocking improvements]
3. **Future**: [Technical debt to address]

## Final Checklist

- [ ] All automated tests passing
- [ ] All manual criteria verified
- [ ] Deviations documented and accepted
- [ ] No critical issues remaining
- [ ] Plan document updated with actual progress
- [ ] Ready for code review / merge

## Approval

| Role | Name | Status | Date |
|------|------|--------|------|
| Implementer | Claude | ✅ Complete | YYYY-MM-DD |
| Validator | Claude | ✅ Verified | YYYY-MM-DD |
| User | [Name] | ⬜ Pending | |
```

---

## Validation Rules

1. **Verify against plan** — Check what was promised vs delivered
2. **Run all commands** — Don't trust checkboxes, run verification
3. **Document deviations** — Any difference from plan gets recorded
4. **Severity matters** — Critical issues block, low issues can follow-up
5. **Update the plan** — Mark actual completion status
