#!/bin/bash
# Build prism-cli for the current platform

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "Building prism-cli..."
go build -o prism-cli .

# Make executable on Unix
if [[ "$OSTYPE" != "msys" && "$OSTYPE" != "win32" ]]; then
    chmod +x prism-cli
fi

echo "Build complete: $SCRIPT_DIR/prism-cli"
echo ""
echo "To install globally: go install ."
