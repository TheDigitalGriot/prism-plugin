#!/usr/bin/env bash
# test_porter_check.sh — Invariant test for B1c (porter drift fix).
#
# Verifies that port-griotwave.cjs --check exits 0 against the current
# frame-template.html. This ensures the CSS variable block stays in sync
# with the griotwave token source whenever the griotwave library is available.
#
# Exit behaviour:
#   0 — pass: frame-template.html is in sync (or griotwave tokens unavailable — skipped)
#   1 — fail: frame-template.html is OUT OF SYNC with griotwave tokens
#
# Usage:
#   bash scripts/tests/test_porter_check.sh
#   bash scripts/tests/test_porter_check.sh --griotwave-path /path/to/griotwave.tokens.json
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORTER="$SCRIPT_DIR/../../skills/prism-brainstorm/scripts/port-griotwave.cjs"

# Pass any extra flags (e.g. --griotwave-path) straight through to the porter
EXTRA_ARGS=("$@")

if [[ ! -f "$PORTER" ]]; then
  echo "[FAIL] porter not found at: $PORTER" >&2
  exit 1
fi

# Run porter in --check mode. porter exits 0 (pass or skip) / 1 (drift detected).
node "$PORTER" --check "${EXTRA_ARGS[@]+"${EXTRA_ARGS[@]}"}"
STATUS=$?

if [[ $STATUS -eq 0 ]]; then
  echo "[PASS] porter --check: frame-template.html is in sync (or tokens unavailable — skipped)"
  exit 0
else
  echo "[FAIL] porter --check: frame-template.html is OUT OF SYNC with griotwave tokens" >&2
  echo "       Re-run: node $PORTER" >&2
  exit 1
fi
