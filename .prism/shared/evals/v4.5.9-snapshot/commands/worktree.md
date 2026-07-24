---
description: Create git worktree for parallel development on a separate branch
model: haiku
---

# Git Worktree Setup

## Native Claude Code Support

**Claude Code ≥ v2.1.154** ships native worktree tools that handle setup, `.prism/shared` symlinking, and cleanup automatically. Use the native tools when available; fall back to the git commands below on older versions.

**Preferred (Claude Code ≥ v2.1.154):**

```
EnterWorktree — creates and enters a new worktree (branch + directory + .prism symlink)
ExitWorktree  — cleans up and removes the worktree when done
```

These tools are available via the deferred tool system. Invoke `EnterWorktree` with the branch name; it handles the rest. When finished, `ExitWorktree` cleans up atomically and prevents stale lockfiles.

**Fallback (older versions or manual control):** use the git commands documented below.

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

## Safety Checks (Run Before Creating)

Before creating any worktree, verify these safety conditions:

### 1. Gitignore Verification

If placing the worktree inside the project (e.g., `.worktrees/`), verify it's gitignored:

```bash
git check-ignore -q .worktrees 2>/dev/null
echo $?  # Must be 0 (ignored). If 1, add to .gitignore first.
```

If NOT ignored, add it before proceeding:
```bash
echo '.worktrees/' >> .gitignore
git add .gitignore
git commit -m "chore: add .worktrees/ to gitignore"
```

### 2. Test Baseline

After creation, run the project's test suite to establish a clean baseline:

```bash
cd [WORKTREE_PATH]
# Detect and run appropriate test command
npm test       # Node.js
go test ./...  # Go
cargo test     # Rust
pytest         # Python
```

If tests fail on a clean worktree, the base branch has issues — do not proceed until resolved.

### 3. .prism/ Shared Directory

Symlink the shared directory so research and plans are accessible:

```bash
mkdir -p [WORKTREE_PATH]/.prism
ln -s $(git rev-parse --show-toplevel)/.prism/shared [WORKTREE_PATH]/.prism/shared
```

On Windows, copy instead of symlink:
```bash
cp -r $(git rev-parse --show-toplevel)/.prism/shared [WORKTREE_PATH]/.prism/shared
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

If you use a `.prism/` directory for documentation:
- The `.prism/` directory should be symlinked or shared between worktrees
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
