#!/bin/sh
# Worktree setup hook - runs after WorktreeCreate
# Receives hook event JSON on stdin
# POSIX sh ONLY — cloud sandboxes may run hooks under dash/busybox.
set -eu
if (set -o pipefail) 2>/dev/null; then set -o pipefail; fi

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
