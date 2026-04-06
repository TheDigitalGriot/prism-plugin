# Plan C: Worktree & Branch Lifecycle — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add gitignore safety checks and lifecycle hooks to worktree management, and create a structured branch completion workflow (`prism-finish`).

**Architecture:** The existing `commands/worktree.md` is enhanced with safety checks (gitignore verification, dependency installation, test baseline). New `WorktreeCreate`/`WorktreeRemove` hooks in `hooks/hooks.json` automate setup and cleanup via bash scripts. A new `prism-finish` skill provides 4 structured options for completing development branches.

**Tech Stack:** Bash scripts, markdown command/skill files, hooks.json configuration.

---

## File Structure

| Action | Path | Responsibility |
|--------|------|---------------|
| Modify | `commands/worktree.md` | Add safety checks and auto-setup |
| Modify | `hooks/hooks.json` | Add WorktreeCreate/WorktreeRemove hooks |
| Create | `scripts/worktree-setup.sh` | Post-creation setup (deps, tests, .prism) |
| Create | `scripts/worktree-cleanup.sh` | Pre-removal safety checks |
| Create | `skills/prism-finish/SKILL.md` | Branch completion workflow |

---

### Task 1: Create the Worktree Setup Script

**Files:**
- Create: `scripts/worktree-setup.sh`

- [ ] **Step 1: Create the worktree-setup.sh script**

```bash
#!/usr/bin/env bash
# Worktree setup hook - runs after WorktreeCreate
# Receives hook event JSON on stdin
set -euo pipefail

# Parse event from stdin (if available)
EVENT=""
if [ ! -t 0 ]; then
  EVENT=$(cat)
fi

# Extract worktree path from event or use current directory
WORKTREE_PATH=""
if [ -n "$EVENT" ]; then
  WORKTREE_PATH=$(echo "$EVENT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('worktree_path',''))" 2>/dev/null || echo "")
fi

if [ -z "$WORKTREE_PATH" ]; then
  echo '{"status":"skipped","reason":"no worktree path in event"}'
  exit 0
fi

echo "Setting up worktree at: $WORKTREE_PATH"

# 1. Verify gitignore for common worktree directories
WORKTREE_DIR=$(dirname "$WORKTREE_PATH")
WORKTREE_DIRNAME=$(basename "$WORKTREE_DIR")
if [ "$WORKTREE_DIRNAME" = ".worktrees" ] || [ "$WORKTREE_DIRNAME" = "worktrees" ]; then
  if ! git check-ignore -q "$WORKTREE_DIR" 2>/dev/null; then
    echo "WARNING: $WORKTREE_DIR is not in .gitignore"
    echo "Add '$WORKTREE_DIRNAME/' to .gitignore to prevent committing worktree directories"
  fi
fi

# 2. Install dependencies if package manager detected
if [ -f "$WORKTREE_PATH/package.json" ]; then
  echo "Detected package.json — installing npm dependencies..."
  (cd "$WORKTREE_PATH" && npm install --silent 2>/dev/null) || echo "npm install failed (non-fatal)"
elif [ -f "$WORKTREE_PATH/Cargo.toml" ]; then
  echo "Detected Cargo.toml — building Rust project..."
  (cd "$WORKTREE_PATH" && cargo build 2>/dev/null) || echo "cargo build failed (non-fatal)"
elif [ -f "$WORKTREE_PATH/go.mod" ]; then
  echo "Detected go.mod — downloading Go dependencies..."
  (cd "$WORKTREE_PATH" && go mod download 2>/dev/null) || echo "go mod download failed (non-fatal)"
elif [ -f "$WORKTREE_PATH/requirements.txt" ]; then
  echo "Detected requirements.txt — installing Python dependencies..."
  (cd "$WORKTREE_PATH" && pip install -r requirements.txt -q 2>/dev/null) || echo "pip install failed (non-fatal)"
fi

# 3. Copy local config files if they exist in main worktree
MAIN_WORKTREE=$(git worktree list --porcelain | head -1 | sed 's/worktree //')
for config_file in .env .env.local .env.development.local; do
  if [ -f "$MAIN_WORKTREE/$config_file" ] && [ ! -f "$WORKTREE_PATH/$config_file" ]; then
    cp "$MAIN_WORKTREE/$config_file" "$WORKTREE_PATH/$config_file"
    echo "Copied $config_file from main worktree"
  fi
done

# 4. Symlink .prism/shared if it exists and isn't already linked
if [ -d "$MAIN_WORKTREE/.prism/shared" ] && [ ! -e "$WORKTREE_PATH/.prism/shared" ]; then
  mkdir -p "$WORKTREE_PATH/.prism"
  ln -s "$MAIN_WORKTREE/.prism/shared" "$WORKTREE_PATH/.prism/shared" 2>/dev/null || \
    echo "Could not symlink .prism/shared (may need manual copy on Windows)"
fi

echo '{"status":"complete","worktree":"'"$WORKTREE_PATH"'"}'
```

- [ ] **Step 2: Make the script executable**

Run: `chmod +x scripts/worktree-setup.sh`

- [ ] **Step 3: Verify syntax**

Run: `bash -n scripts/worktree-setup.sh`
Expected: No syntax errors

- [ ] **Step 4: Commit**

```bash
git add scripts/worktree-setup.sh
git commit -m "feat: add worktree-setup.sh for automated post-creation setup"
```

---

### Task 2: Create the Worktree Cleanup Script

**Files:**
- Create: `scripts/worktree-cleanup.sh`

- [ ] **Step 1: Create the worktree-cleanup.sh script**

```bash
#!/usr/bin/env bash
# Worktree cleanup hook - runs before WorktreeRemove
# Receives hook event JSON on stdin
set -euo pipefail

# Parse event from stdin (if available)
EVENT=""
if [ ! -t 0 ]; then
  EVENT=$(cat)
fi

WORKTREE_PATH=""
if [ -n "$EVENT" ]; then
  WORKTREE_PATH=$(echo "$EVENT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('worktree_path',''))" 2>/dev/null || echo "")
fi

if [ -z "$WORKTREE_PATH" ]; then
  echo '{"status":"skipped","reason":"no worktree path in event"}'
  exit 0
fi

echo "Checking worktree before removal: $WORKTREE_PATH"

# 1. Check for uncommitted changes
if [ -d "$WORKTREE_PATH" ]; then
  UNCOMMITTED=$(cd "$WORKTREE_PATH" && git status --porcelain 2>/dev/null | wc -l)
  if [ "$UNCOMMITTED" -gt 0 ]; then
    echo "WARNING: Worktree has $UNCOMMITTED uncommitted changes"
    echo "Files with uncommitted changes:"
    (cd "$WORKTREE_PATH" && git status --short)
  fi

  # 2. Check for unpushed commits
  BRANCH=$(cd "$WORKTREE_PATH" && git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
  if [ -n "$BRANCH" ]; then
    UNPUSHED=$(cd "$WORKTREE_PATH" && git log --oneline "origin/$BRANCH..HEAD" 2>/dev/null | wc -l || echo "0")
    if [ "$UNPUSHED" -gt 0 ]; then
      echo "WARNING: Branch $BRANCH has $UNPUSHED unpushed commits"
    fi
  fi

  # 3. Remove .prism/shared symlink if it exists (don't delete the target)
  if [ -L "$WORKTREE_PATH/.prism/shared" ]; then
    rm "$WORKTREE_PATH/.prism/shared"
    echo "Removed .prism/shared symlink"
  fi
fi

echo '{"status":"complete","worktree":"'"$WORKTREE_PATH"'"}'
```

- [ ] **Step 2: Make the script executable**

Run: `chmod +x scripts/worktree-cleanup.sh`

- [ ] **Step 3: Verify syntax**

Run: `bash -n scripts/worktree-cleanup.sh`
Expected: No syntax errors

- [ ] **Step 4: Commit**

```bash
git add scripts/worktree-cleanup.sh
git commit -m "feat: add worktree-cleanup.sh for pre-removal safety checks"
```

---

### Task 3: Add Worktree Lifecycle Hooks

**Files:**
- Modify: `hooks/hooks.json`

- [ ] **Step 1: Read the current hooks.json**

Run: `cat hooks/hooks.json`

Current structure has three hook events: `PreCompact`, `PostCompact`, `PostToolUse`.

- [ ] **Step 2: Add WorktreeCreate and WorktreeRemove hooks**

Add two new entries to the hooks object. The existing hooks.json structure is:

```json
{
  "hooks": {
    "PreCompact": [...],
    "PostCompact": [...],
    "PostToolUse": [...]
  }
}
```

Add after the `PostToolUse` entry:

```json
    "WorktreeCreate": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "bash ${CLAUDE_PLUGIN_ROOT}/scripts/worktree-setup.sh"
          }
        ]
      }
    ],
    "WorktreeRemove": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "bash ${CLAUDE_PLUGIN_ROOT}/scripts/worktree-cleanup.sh"
          }
        ]
      }
    ]
```

- [ ] **Step 3: Verify JSON is valid**

Run: `python3 -c "import json; json.load(open('hooks/hooks.json'))"`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add hooks/hooks.json
git commit -m "feat: add WorktreeCreate/WorktreeRemove lifecycle hooks"
```

---

### Task 4: Enhance the Worktree Command with Safety Checks

**Files:**
- Modify: `commands/worktree.md`

- [ ] **Step 1: Read the current worktree command**

Run: `cat commands/worktree.md`

- [ ] **Step 2: Add safety checks section after "Create Worktree" and before "Configure Worktree"**

Insert the following section after the worktree creation commands (after the `git worktree add` examples, around line 31):

```markdown
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
```

- [ ] **Step 3: Commit**

```bash
git add commands/worktree.md
git commit -m "feat: add safety checks to worktree command (gitignore, tests, .prism)"
```

---

### Task 5: Create the Prism Finish Skill

**Files:**
- Create: `skills/prism-finish/SKILL.md`

- [ ] **Step 1: Create the branch completion skill**

```markdown
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

For Options 1, 2, and 4: if currently in a worktree, clean it up after the action:

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
```

- [ ] **Step 2: Verify the skill file**

Run: `head -5 skills/prism-finish/SKILL.md`
Expected: Valid YAML frontmatter with `name: prism-finish`

- [ ] **Step 3: Commit**

```bash
git add skills/prism-finish/SKILL.md
git commit -m "feat: create prism-finish skill for branch completion workflow"
```

---

### Task 6: Integration Verification

**Files:**
- Verify: All created/modified files

- [ ] **Step 1: Verify all files exist**

Run: `ls scripts/worktree-setup.sh scripts/worktree-cleanup.sh skills/prism-finish/SKILL.md`
Expected: All 3 files listed

- [ ] **Step 2: Verify hooks.json is valid JSON with new events**

Run: `python3 -c "import json; h=json.load(open('hooks/hooks.json')); print('WorktreeCreate' in h.get('hooks',{}), 'WorktreeRemove' in h.get('hooks',{}))"` 
Expected: `True True`

- [ ] **Step 3: Verify worktree command has safety checks**

Run: `grep -c "Gitignore Verification\|Test Baseline\|Safety Checks" commands/worktree.md`
Expected: 3

- [ ] **Step 4: Final commit if needed**

```bash
git status
# Commit any remaining changes
```

---

## Success Criteria

### Automated Verification
- [ ] `ls scripts/worktree-setup.sh scripts/worktree-cleanup.sh` — both scripts exist
- [ ] `bash -n scripts/worktree-setup.sh` — no syntax errors
- [ ] `bash -n scripts/worktree-cleanup.sh` — no syntax errors
- [ ] `python3 -c "import json; json.load(open('hooks/hooks.json'))"` — valid JSON
- [ ] `grep "WorktreeCreate" hooks/hooks.json` — hook registered
- [ ] `grep "WorktreeRemove" hooks/hooks.json` — hook registered
- [ ] `grep "Safety Checks" commands/worktree.md` — safety section added
- [ ] `ls skills/prism-finish/SKILL.md` — finish skill exists

### Manual Verification
- [ ] Create a test worktree — verify setup script detects package manager and installs deps
- [ ] Remove a test worktree — verify cleanup script warns about uncommitted changes
- [ ] Read `prism-finish/SKILL.md` — confirms 4 options (merge/PR/keep/discard)
- [ ] Read updated `worktree.md` — confirms gitignore check before creation
- [ ] Verify hooks.json still loads correctly when plugin is enabled
