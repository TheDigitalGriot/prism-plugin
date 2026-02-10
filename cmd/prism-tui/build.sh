#!/bin/bash
# Build prism-tui for the current platform

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "Building prism-tui..."
go build -o prism-tui .

# Make executable on Unix
if [[ "$OSTYPE" != "msys" && "$OSTYPE" != "win32" ]]; then
    chmod +x prism-tui
fi

echo "Build complete: $SCRIPT_DIR/prism-tui"
echo ""
echo "To install globally: go install ."
