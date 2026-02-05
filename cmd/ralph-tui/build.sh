#!/bin/bash
# Build ralph-tui for the current platform

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "Building ralph-tui..."
go build -o ralph-tui .

# Make executable on Unix
if [[ "$OSTYPE" != "msys" && "$OSTYPE" != "win32" ]]; then
    chmod +x ralph-tui
fi

echo "Build complete: $SCRIPT_DIR/ralph-tui"
echo ""
echo "To install globally: go install ."
