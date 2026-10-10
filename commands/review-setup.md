---
description: Set up local environment to review a colleague's branch or PR
model: haiku
---

# Review Setup

Set up a local review environment for a colleague's branch. Creates a worktree so you can review without disrupting your current work.

## Process

### 1. Parse the Input

Accept input in formats like:
- `username:branch-name` - Colleague's fork and branch
- `PR-URL` - GitHub PR URL
- `branch-name` - Branch name (assumes same repo)

### 2. Set Up Remote (if needed)

For a colleague's fork:
```bash
# Check if remote exists
git remote -v | grep [USERNAME]

# If not, add it
git remote add [USERNAME] git@github.com:[USERNAME]/[REPO].git

# Fetch their branches
git fetch [USERNAME]
```

### 3. Create Review Worktree

Extract a short name from the branch (e.g., ticket number or feature name):
```bash
# Create worktree tracking their branch
git worktree add -b review/[SHORT_NAME] ~/worktrees/[REPO]/review-[SHORT_NAME] [USERNAME]/[BRANCH]
```

### 4. Set Up the Environment

```bash
cd ~/worktrees/[REPO]/review-[SHORT_NAME]

# Install dependencies
npm install  # or equivalent

# Copy local config if needed
cp ~/.config/[app]/settings.json .

# Run any setup scripts
make setup  # or equivalent
```

### 5. Begin Review

You're now ready to:
- Run the code locally
- Execute tests
- Explore the changes

## Example

```bash
# Review colleague's PR
/review-setup colleague:feature/new-auth-flow

# This will:
# 1. Add 'colleague' as a remote (if needed)
# 2. Fetch their branches
# 3. Create worktree at ~/worktrees/myrepo/review-new-auth-flow
# 4. Set up the environment
```

## Cleanup

When done reviewing:
```bash
# Remove the worktree
git worktree remove ~/worktrees/[REPO]/review-[SHORT_NAME]

# Optionally remove the remote
git remote remove [USERNAME]
```

## Error Handling

- If worktree already exists, inform user they need to remove it first
- If remote fetch fails, check if username/repo exists
- If setup fails, provide error but worktree is still usable
