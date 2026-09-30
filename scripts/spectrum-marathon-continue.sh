#!/usr/bin/env bash
# ============================================================================
# spectrum-marathon-continue -- THE MARATHON CONTINUES
# ----------------------------------------------------------------------------
# Named as an ode to Nipsey Hussle -- The Marathon Continues (TMC). Deliberately
# DISTINCT from a fresh start: it clears the pause and re-enters the marathon in
# the MARATHON-CONTINUE state (never MARATHON-START), so an observer can always
# tell a continuation from a first run. Finished stages already have outputs, so
# it picks up at the first unfinished stage -- no stage re-runs.
#
# Usage:  spectrum-marathon-continue [workspace-dir]
# ============================================================================
set -euo pipefail
WORKSPACE="${1:-$(pwd)}"
[ -d "$WORKSPACE" ] || { echo "spectrum-marathon-continue: no such workspace: $WORKSPACE" >&2; exit 1; }
WORKSPACE="$(cd "$WORKSPACE" && pwd)"
rm -f "$WORKSPACE/.spectrum-marathon.pause"
here="$(cd "$(dirname "$0")" && pwd)"
echo "spectrum-marathon: THE MARATHON CONTINUES -- resuming $WORKSPACE (finished stages skipped)."
SPECTRUM_CONTINUE=1 exec "$here/spectrum-marathon.sh" "$WORKSPACE"
