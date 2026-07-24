---
name: prism-finish
description: Complete development work by presenting structured options for merge, PR, cleanup, or discard. Use after implementation and validation are complete. Triggers on "finish this branch", "ready to merge", "create PR", "clean up branch", or after prism-validate completes.
model: sonnet
---

# Prism Finish

Complete development work on a branch with structured options.

## Prerequisites

Before presenting options, verify:

1. **Tests pass** — Run the project's test suite
2. **No uncommitted changes** — `git status` shows clean working tree
3. **Validation complete** — `.prism/shared/validation/` has a recent report (optional)

If tests fail, STOP. Do not present options until tests pass. Fix failing tests first.

## Determine Base Branch

```bash
# Find the merge base
BASE_BRANCH=$(git log --oneline --decorate --all | grep -oP 'origin/\K(main|master|develop)' | head -1 || echo "main")
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
COMMIT_COUNT=$(git rev-list --count "$BASE_BRANCH..HEAD")
```

Present: "Branch `$CURRENT_BRANCH` has $COMMIT_COUNT commits ahead of `$BASE_BRANCH`."

## Present Options

Present exactly these 4 options:

### Option 1: Merge Locally

Merge this branch into the base branch locally.

```bash
git checkout $BASE_BRANCH
git merge $CURRENT_BRANCH
# If in a worktree, clean it up after merge
```

### Option 2: Push and Create PR

Push the branch and create a pull request via GitHub CLI.

```bash
git push -u origin $CURRENT_BRANCH
# Then invoke /describe_pr to generate and apply PR description
```

After pushing, invoke the `/describe_pr` command to generate a comprehensive PR description.

### Option 3: Keep As-Is

Leave the branch for later. No action taken. Report the branch name and how to resume:

```
Branch: $CURRENT_BRANCH
Resume: git checkout $CURRENT_BRANCH
```

### Option 4: Discard Branch

**Requires explicit confirmation.** Ask the user to type "discard" before proceeding.

```bash
git checkout $BASE_BRANCH
git branch -D $CURRENT_BRANCH
# If in a worktree:
git worktree remove <path> --force
```

## Worktree Cleanup

For Options 1, 2, and 4: if currently in a worktree, clean it up after the action.

**Preferred (Claude Code ≥ v2.1.154):** use the native `ExitWorktree` tool. It handles cleanup atomically — no stale lockfiles, no manual path resolution:
```
ExitWorktree
```

**Fallback (older versions or manual control):**
```bash
# Navigate out of worktree first
cd $(git worktree list --porcelain | head -1 | sed 's/worktree //')
git worktree remove <worktree-path>
git worktree prune
```

For Option 3: keep the worktree intact.

## Rules

1. **Always verify tests first** — No options without passing tests
2. **Never force-push to main/master** — Warn if the user requests this
3. **Confirm before discard** — Require typed "discard" for Option 4
4. **Clean up worktrees** — Remove worktree after merge, PR, or discard
5. **One option at a time** — Execute the chosen option completely before offering another

## Integration

- **Follows:** `/prism-validate` (after implementation is verified)
- **Follows:** `/prism-spectrum` (after all stories are complete)
- **Pairs with:** `/describe_pr` (for Option 2)
- **Pairs with:** `/worktree` (cleanup)
