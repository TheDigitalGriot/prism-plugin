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
