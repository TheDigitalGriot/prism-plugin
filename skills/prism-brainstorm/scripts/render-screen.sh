#!/usr/bin/env bash
# render-screen.sh — write a companion screen AND advance session state as ONE action.
#
# WHY THIS EXISTS
# ---------------
# The "screen ships before the question is spoken" rule was declared as a
# standing decision and then violated three times in the session that declared
# it. An instruction to an agent is not a control. The drift was possible only
# because writing the screen and advancing `current` were two separate steps
# performed in whatever order was convenient.
#
# This makes them one step. There is no order left to get wrong. It costs no
# flexibility -- it removes the opportunity for divergence.
#
# It also ASSERTS the result rather than trusting it: after writing, it verifies
# the screen is genuinely the newest file the server will serve (screens are
# selected by mtime, and a bulk copy can flatten timestamps -- the exact
# mechanical cause of one of the three failures).
#
# usage:
#   render-screen.sh <session-dir> <screen-file> [current-question-id]
#
# exits non-zero if the screen did not end up newest, or state was not updated.

set -euo pipefail

SESSION="${1:?session dir required}"
SCREEN="${2:?screen filename required}"
CURRENT="${3:-}"

CONTENT="$SESSION/content"
STATE="$SESSION/state/decisions.json"

[ -f "$CONTENT/$SCREEN" ] || { echo "render-screen: no such screen: $CONTENT/$SCREEN" >&2; exit 2; }

# 1 -- the screen the server serves is newest-by-mtime. Make it so, explicitly.
touch "$CONTENT/$SCREEN"

# 2 -- advance `current` in the same action, if given.
if [ -n "$CURRENT" ] && [ -f "$STATE" ]; then
  python - "$STATE" "$CURRENT" "$SCREEN" <<'PY'
import json, sys, pathlib
state_path, current, screen = sys.argv[1], sys.argv[2], sys.argv[3]
p = pathlib.Path(state_path)
s = json.loads(p.read_text(encoding="utf-8"))
s["current"] = current
s["currentScreen"] = screen
p.write_text(json.dumps(s, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
PY
fi

# 3 -- ASSERT, do not assume. Verify what we just claimed.
NEWEST="$(ls -t "$CONTENT" | head -1)"
if [ "$NEWEST" != "$SCREEN" ]; then
  echo "render-screen: FAILED -- newest is '$NEWEST', expected '$SCREEN'" >&2
  exit 1
fi

if [ -n "$CURRENT" ] && [ -f "$STATE" ]; then
  GOT="$(python -c "import json,sys;print(json.load(open(sys.argv[1],encoding='utf-8')).get('current',''))" "$STATE")"
  if [ "$GOT" != "$CURRENT" ]; then
    echo "render-screen: FAILED -- state current='$GOT', expected '$CURRENT'" >&2
    exit 1
  fi
fi

echo "render-screen: ok -- serving '$SCREEN'${CURRENT:+ as $CURRENT}"
