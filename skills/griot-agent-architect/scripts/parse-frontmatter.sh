#!/bin/bash
# Frontmatter Parser Utility
# Extracts YAML frontmatter from .local.md files

set -euo pipefail

# Usage
show_usage() {
  echo "Usage: $0 <settings-file.md> [field-name]"
  echo ""
  echo "Examples:"
  echo "  # Show all frontmatter"
  echo "  $0 .claude/my-plugin.local.md"
  echo ""
  echo "  # Extract specific field"
  echo "  $0 .claude/my-plugin.local.md enabled"
  echo ""
  echo "  # Extract and use in script"
  echo "  ENABLED=\$($0 .claude/my-plugin.local.md enabled)"
  exit 0
}

if [ $# -eq 0 ] || [ "$1" = "-h" ] || [ "$1" = "--help" ]; then
  show_usage
fi

FILE="$1"
FIELD="${2:-}"

# Validate file
if [ ! -f "$FILE" ]; then
  echo "Error: File not found: $FILE" >&2
  exit 1
fi

# --- Portable UTF-8 BOM tolerance --------------------------------------------
# Windows editors (Notepad, PowerShell `>` redirection, some Git clients) prepend
# a 3-byte UTF-8 BOM (EF BB BF). It makes the first line literally `<BOM>---`, so
# every `^---$` match fails and frontmatter parsing reports "none" on a valid file.
#
# `sed '1s/^\xEF\xBB\xBF//'` fixes this on GNU sed ONLY. BSD/macOS sed has no \xNN
# escape and reads the pattern as the literal text `xEFxBBxBF`, so the strip is a
# silent no-op there. Build the BOM from POSIX printf octal escapes instead and
# drop it with `tail -c +4` — no regex dialect involved, portable everywhere.
BOM=$(printf '\357\273\277')

# strip_bom <file> — emit the file with a leading UTF-8 BOM removed.
strip_bom() {
  if [ "$(head -c 3 "$1" 2>/dev/null || true)" = "$BOM" ]; then
    tail -c +4 "$1"
  else
    cat "$1"
  fi
}

# Extract frontmatter
FRONTMATTER=$(strip_bom "$FILE" | sed -n '/^---$/,/^---$/{ /^---$/d; p; }')

if [ -z "$FRONTMATTER" ]; then
  echo "Error: No frontmatter found in $FILE" >&2
  exit 1
fi

# If no field specified, output all frontmatter
if [ -z "$FIELD" ]; then
  echo "$FRONTMATTER"
  exit 0
fi

# Extract specific field
VALUE=$(echo "$FRONTMATTER" | grep "^${FIELD}:" | sed "s/${FIELD}: *//" | sed 's/^"\(.*\)"$/\1/' | sed "s/^'\\(.*\\)'$/\\1/")

if [ -z "$VALUE" ]; then
  echo "Error: Field '$FIELD' not found in frontmatter" >&2
  exit 1
fi

echo "$VALUE"
exit 0
