---
date: 2026-07-22
author: Claude
repository: prism
branch: feat/ceremony-review-audit-gate
ticket: N/A
status: draft
research: none (workflow derived from the 4.5.7 release we just ran by hand)
epic: ceremony-review-audit-gate
---

> On finalize, this plan emits `.prism/stories/stories.json` (the executable work-definition every
> executor reads) via the `decompose_plan` engine. See `.prism/shared/contracts/stories-contract.md`.

# Plan: Route review + audit into prism-closing-ceremony (self-hardening release)

## Overview

**Goal**: Add a fail-fast **Review & Audit gate** as the first step of `prism-closing-ceremony`, so every
release runs the same independent review + best-practices audit we applied by hand to 4.5.7 — before
bookend, docs, or release. The ceremony hardens its own output.

**Research**: The 4.5.7 release cycle (two-stage review + cl-plugin-structure audit + `prism-validate`),
which was done manually. This plan encodes it.

**Complexity**: Low–Medium

**Estimated Phases**: 2 (+ bookend to cut 4.5.8)

## Success Criteria

### Automated
- [ ] `node scripts/verify-ceremony-gate.mjs` (new) passes: asserts `prism-closing-ceremony/SKILL.md`
      declares Step 0 Review & Audit before Bookend, and that it invokes the two-stage reviewers +
      `claude plugin validate` + bundled `verify-*.mjs` discovery.
- [ ] `claude plugin validate .` passes clean.
- [ ] `node scripts/verify-story-unification.mjs --all` still 16/16 (no regression to 4.5.7 work).

### Manual
- [ ] Running the ceremony on a dirty change set surfaces review findings and halts on a High before bookend.
- [ ] On a clean change set, the gate passes and the ceremony proceeds to bookend → docs → release.

## Phases

### Phase 1: Add the Review & Audit gate to the ceremony

**Goal**: `prism-closing-ceremony` runs review + audit first, fail-fast, before the existing sequence.

**Files to modify**:
| File | Change |
|------|--------|
| `skills/prism-closing-ceremony/SKILL.md` | Insert "Step 0 — Review & Audit gate" ahead of Bookend: (a) compute `git diff <last-tag>..HEAD`; (b) two-stage review — dispatch `spec-reviewer` then `quality-reviewer` on the diff + the plan(s)/stories that drove it; (c) best-practices audit — `claude plugin validate .` + structural checks per `cl-plugin-structure` + discover and run any bundled `scripts/verify-*.mjs`; (d) surface findings ranked, fix loop, **halt on unresolved High before Bookend**. Update the "Sequence" + "Rules" sections to include the gate and keep fail-fast semantics. |

**Files to create**:
| File | Purpose |
|------|---------|
| `skills/prism-closing-ceremony/references/review-audit-gate.md` | The gate's detailed procedure (diff scoping, reviewer prompts, audit checklist, gate criteria) — progressive disclosure so SKILL.md stays lean |

**Steps**:
1. [ ] Write `references/review-audit-gate.md` (procedure + reviewer prompts + audit checklist + gate rule).
2. [ ] Edit `SKILL.md`: add Step 0, update the Sequence table and Rules to make the gate fail-fast and first.

**Verification**:
```bash
node scripts/verify-ceremony-gate.mjs
claude plugin validate .
```

**Checkpoint**: ⬜ Phase 1 complete

---

### Phase 2: The audit helper script

**Goal**: A single command the gate runs for the deterministic half of the audit.

**Files to create**:
| File | Purpose |
|------|---------|
| `scripts/verify-ceremony-gate.mjs` | Static guard: asserts the ceremony SKILL.md declares the gate ahead of bookend and references the reviewers + validate + verify-script discovery |
| `scripts/pre-release-audit.mjs` | Runs the deterministic audit: `claude plugin validate` (spawns), plus discovery+run of every `scripts/verify-*.mjs`, plus SKILL.md size + portable-path structural checks; exits non-zero on failure |

**Steps**:
1. [ ] Write `scripts/pre-release-audit.mjs` (deterministic audit runner).
2. [ ] Write `scripts/verify-ceremony-gate.mjs` (gate-wiring guard).
3. [ ] Reference `pre-release-audit.mjs` from `references/review-audit-gate.md` as the audit half.

**Verification**:
```bash
node scripts/pre-release-audit.mjs
node scripts/verify-ceremony-gate.mjs
```

**Checkpoint**: ⬜ Phase 2 complete

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Gate too slow / noisy on every release | Medium | Medium | Deterministic audit is a fast script; two-stage review runs only on the diff since last tag, not the whole repo |
| Gate blocks a legitimate release on a false-positive High | Low | Medium | Findings are surfaced for human confirmation; the gate halts but the user can override with an explicit, logged acknowledgement |
| Reviewers can't reach files (remote/headless) | Low | Low | Gate passes the diff + plan inline to the reviewers (same pattern proven in 4.5.7) |

## Edge Cases

| Case | Handling |
|------|----------|
| No prior version tag | Diff against the first commit or a bounded window; note it in the gate output |
| No bundled `verify-*.mjs` scripts | Audit runs plugin-validate + structural checks only; not a failure |
| Clean change set, zero findings | Gate passes silently, ceremony proceeds |

## Out of Scope
- [ ] Rewriting bookend / docs-update / release sub-skills (the gate precedes them, unchanged).
- [ ] The native build / push / GitHub-release mechanics (still `prism-release`'s job, still HITL-gated).
- [ ] Auto-fixing review findings without surfacing them (the gate proposes; the human confirms).

## Rollback Plan
```bash
git revert HEAD~N..HEAD   # gate is additive; reverting restores the prior ceremony sequence
claude plugin validate .
```

## Dependencies
**Must complete first**: none (builds on 4.5.7, already on the branch history).
**Blocks**: cutting 4.5.8 (the first release to run through its own gate).

## Progress Log
| Phase | Status | Started | Completed | Notes |
|-------|--------|---------|-----------|-------|
| Phase 1 — Ceremony gate | ⬜ Not started | | | |
| Phase 2 — Audit helper | ⬜ Not started | | | |
