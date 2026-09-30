#!/usr/bin/env bash
# ============================================================================
# spectrum-marathon-pause -- move a running marathon to the PAUSED state
# ----------------------------------------------------------------------------
# Writes a pause sentinel. Between stages the marathon reads it, enters the
# MARATHON-PAUSED state, and stops cleanly. Finished stages keep their outputs
# (the filesystem is the state machine), so a later continue resumes at the
# first unfinished stage and re-runs nothing.
#
# Usage:  spectrum-marathon-pause [workspace-dir]
# ============================================================================
set -euo pipefail
WORKSPACE="${1:-$(pwd)}"
[ -d "$WORKSPACE" ] || { echo "spectrum-marathon-pause: no such workspace: $WORKSPACE" >&2; exit 1; }
WORKSPACE="$(cd "$WORKSPACE" && pwd)"
touch "$WORKSPACE/.spectrum-marathon.pause"
echo "spectrum-marathon: PAUSED state signalled for $WORKSPACE"
echo "  the marathon holds at the next stage boundary."
echo "  resume with:  spectrum-marathon-continue $WORKSPACE"
