---
description: Create git worktree for parallel development on a separate branch
model: haiku
---

# Git Worktree Setup

Create a git worktree to work on a branch in a separate directory. Useful for:
- Working on multiple features simultaneously
- Keeping main branch clean while experimenting
- Running tests on one branch while developing on another

## Process

### 1. Determine Worktree Details

Gather the required information:
- **Branch name**: The branch to work on (will be created if doesn't exist)
- **Worktree path**: Where to create the worktree (e.g., `~/worktrees/project/feature-name`)
- **Base branch**: Branch to base off (default: `main`)

### 2. Create the Worktree

**For a new branch:**
```bash
git worktree add -b [BRANCH_NAME] [WORKTREE_PATH] [BASE_BRANCH]
```

**For an existing branch:**
```bash
git worktree add [WORKTREE_PATH] [BRANCH_NAME]
```

### 3. Configure the Worktree

After creating:
```bash
cd [WORKTREE_PATH]

# Copy any local settings if needed
cp ../main-repo/.env .env  # if applicable

# Install dependencies
npm install  # or equivalent for your project
```

### 4. Sync Shared Directories

If you use a `thoughts/` directory for documentation:
- The `thoughts/` directory should be symlinked or shared between worktrees
- Consider using `git worktree add` from the repo root so paths are consistent

## Example

```bash
# Create worktree for feature work
git worktree add -b feature/auth-improvements ~/worktrees/myproject/auth main

# Navigate and set up
cd ~/worktrees/myproject/auth
npm install

# Work on the feature...
# When done, remove the worktree
git worktree remove ~/worktrees/myproject/auth
```

## Managing Worktrees

**List all worktrees:**
```bash
git worktree list
```

**Remove a worktree:**
```bash
git worktree remove [PATH]
```

**Prune stale worktrees:**
```bash
git worktree prune
```

## Tips

- Keep worktree paths organized (e.g., `~/worktrees/[project]/[feature]`)
- Remember to remove worktrees when done to avoid confusion
- Each worktree has its own working directory but shares the git history
- You can't have the same branch checked out in multiple worktrees
