#!/bin/bash
set -euo pipefail

# Prepares all bundled resources needed by the Prism Setup installer.
# Run from anywhere — paths are resolved relative to this script.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SETUP_DIR="$(dirname "$SCRIPT_DIR")"
RESOURCES_DIR="$SETUP_DIR/resources"
REPO_ROOT="$(git rev-parse --show-toplevel)"

echo "=== Prism Setup Resource Preparation ==="
echo "Setup dir:     $SETUP_DIR"
echo "Resources dir: $RESOURCES_DIR"
echo "Repo root:     $REPO_ROOT"
echo ""

# --- 1. Build prism-cli binaries ---
echo "=== [1/3] Building prism-cli binaries ==="
mkdir -p "$RESOURCES_DIR/binaries"

if [ -f "$REPO_ROOT/cmd/prism-cli/Makefile" ]; then
  cd "$REPO_ROOT/cmd/prism-cli"
  make build-all
  cp bin/prism-cli-* "$RESOURCES_DIR/binaries/" 2>/dev/null || {
    echo "WARNING: No prism-cli binaries found in bin/. Run 'make build-all' manually."
  }
else
  echo "WARNING: cmd/prism-cli/Makefile not found. Skipping binary build."
  echo "         Place binaries manually in $RESOURCES_DIR/binaries/"
fi

echo "Binaries:"
ls -la "$RESOURCES_DIR/binaries/" 2>/dev/null || echo "  (empty)"
echo ""

# --- 2. Build and copy VSIX ---
echo "=== [2/3] Building VSCode extension ==="
mkdir -p "$RESOURCES_DIR/extensions"

if [ -f "$REPO_ROOT/cmd/prism-vscode/package.json" ]; then
  cd "$REPO_ROOT/cmd/prism-vscode"

  # Install deps if needed
  if [ ! -d "node_modules" ]; then
    echo "Installing vscode extension dependencies..."
    npm ci
  fi

  # Build if package script exists
  if npm run --silent 2>/dev/null | grep -q "package"; then
    npm run package
  fi

  # Package VSIX
  if command -v npx &>/dev/null; then
    npx @vscode/vsce package --out "$RESOURCES_DIR/extensions/prism.vsix" 2>/dev/null || {
      echo "WARNING: VSIX packaging failed. Install @vscode/vsce or place prism.vsix manually."
    }
  fi
else
  echo "WARNING: cmd/prism-vscode/package.json not found. Skipping VSIX build."
  echo "         Place prism.vsix manually in $RESOURCES_DIR/extensions/"
fi

echo "Extensions:"
ls -la "$RESOURCES_DIR/extensions/" 2>/dev/null || echo "  (empty)"
echo ""

# --- 3. Copy Claude plugin files ---
echo "=== [3/3] Copying Claude plugin files ==="
mkdir -p "$RESOURCES_DIR/plugin"

for dir in .claude-plugin commands agents skills; do
  src="$REPO_ROOT/$dir"
  if [ -d "$src" ]; then
    cp -r "$src" "$RESOURCES_DIR/plugin/"
    echo "  Copied $dir/"
  else
    echo "  WARNING: $src not found, skipping"
  fi
done

echo ""
echo "=== Resources prepared ==="
echo ""
echo "Binaries:"
ls -la "$RESOURCES_DIR/binaries/" 2>/dev/null || echo "  (empty)"
echo ""
echo "Extensions:"
ls -la "$RESOURCES_DIR/extensions/" 2>/dev/null || echo "  (empty)"
echo ""
echo "Plugin:"
ls -la "$RESOURCES_DIR/plugin/" 2>/dev/null || echo "  (empty)"
