#!/usr/bin/env bash
# ============================================================================
# spectrum-marathon-wait -- the MARATHON-WAITING state (a workgraph inbound edge)
# ----------------------------------------------------------------------------
# A cross-marathon wait is not a new signal. It is a worklane INBOUND record,
# declared IN the stage contract (ICM Pattern 1 + Pattern 5: one canonical
# record, no side-file that could drift):
#
#     Inbound (awaits): <path>[, <path> ...]
#
# Read from the producer's end, the same line is its OUTBOUND obligation: one
# record, two views. A stage is READY when every awaited path exists and is
# non-empty. Producers publish atomically (output.partial/ -> output/), so a
# path existing means it is COMPLETE: the file wins, there is no signal to lie
# (ICM invariant 9, the filesystem is the state machine).
#
# Usage:
#   spectrum-marathon-wait <stage-dir>              wait on the stage's contract
#   spectrum-marathon-wait --source P [--source Q]  wait on explicit path(s)
#
# Env:
#   SPECTRUM_WAIT_POLL      seconds between checks (default 15)
#   SPECTRUM_WAIT_DEADLINE  max seconds before MARATHON-WAIT-EXPIRED (default: none)
#   SPECTRUM_WAIT_MODE      poll (default: block until ready) | stop (log and exit)
#   SPECTRUM_WORKSPACE      if set, its .spectrum-marathon.pause halts the wait
#
# Exit: 0 ready (or stopped/paused cleanly), 3 wait expired.
# ============================================================================
set -euo pipefail

POLL="${SPECTRUM_WAIT_POLL:-15}"
MODE="${SPECTRUM_WAIT_MODE:-poll}"
DEADLINE="${SPECTRUM_WAIT_DEADLINE:-}"

log(){ printf '%s  %s\n' "$(date -Is 2>/dev/null || date)" "$*" >&2; }

# READY = exists and non-empty: a dir with entries, or a file with bytes.
# Nothing half-written passes, because producers rename into place atomically.
path_ready(){
  local p="$1"
  if [ -d "$p" ]; then [ -n "$(ls -A "$p" 2>/dev/null || true)" ]; return; fi
  [ -s "$p" ]
}

# Extract the inbound sources declared in a stage contract's
# "Inbound (awaits):" line, resolved against the stage dir. One record, in the
# contract, never a separate file.
inbound_sources(){
  local contract="$1" base="$2" line rest tok oldifs
  [ -f "$contract" ] || return 0
  line="$(grep -iE '^[[:space:]]*Inbound[[:space:]]*\(awaits\)[[:space:]]*:' "$contract" | head -1 || true)"
  [ -n "$line" ] || return 0
  rest="${line#*:}"
  oldifs="$IFS"; IFS=','
  for tok in $rest; do
    IFS="$oldifs"
    tok="${tok#"${tok%%[![:space:]]*}"}"; tok="${tok%"${tok##*[![:space:]]}"}"
    if [ -n "$tok" ]; then
      case "$tok" in /*|[A-Za-z]:*) printf '%s\n' "$tok";; *) printf '%s\n' "$base/$tok";; esac
    fi
    IFS=','
  done
  IFS="$oldifs"
}

sources=()
name="explicit"
if [ "${1:-}" = "--source" ]; then
  while [ "${1:-}" = "--source" ]; do shift; [ -n "${1:-}" ] && sources+=("$1"); shift || true; done
else
  stage="${1:-$(pwd)}"
  [ -d "$stage" ] || { echo "spectrum-marathon-wait: no such stage: $stage" >&2; exit 1; }
  stage="$(cd "$stage" && pwd)"; name="$(basename "$stage")"
  while IFS= read -r s; do [ -n "$s" ] && sources+=("$s"); done < <(inbound_sources "$stage/CONTEXT.md" "$stage")
fi

if [ "${#sources[@]}" -eq 0 ]; then
  log "STAGE-READY $name (no inbound awaits declared)"
  exit 0
fi

start="$(date +%s 2>/dev/null || echo 0)"
waited=0
while :; do
  if [ -n "${SPECTRUM_WORKSPACE:-}" ] && [ -e "$SPECTRUM_WORKSPACE/.spectrum-marathon.pause" ]; then
    log "MARATHON-PAUSED (pause requested while waiting on $name)"
    exit 0
  fi
  missing=()
  for s in "${sources[@]}"; do path_ready "$s" || missing+=("$s"); done
  [ "${#missing[@]}" -eq 0 ] && break
  if [ "$waited" -eq 0 ]; then log "MARATHON-WAITING $name -- awaiting ${#missing[@]}: ${missing[*]}"; waited=1; fi
  if [ "$MODE" = "stop" ]; then
    log "MARATHON-WAITING $name -- stop mode, exiting for the peer. Resume: spectrum-marathon-continue"
    exit 0
  fi
  if [ -n "$DEADLINE" ]; then
    now="$(date +%s 2>/dev/null || echo 0)"
    if [ "$((now - start))" -ge "$DEADLINE" ]; then
      log "MARATHON-WAIT-EXPIRED $name after ${DEADLINE}s -- ${#missing[@]} source(s) still absent. Stopping for a human."
      exit 3
    fi
  fi
  sleep "$POLL"
done

[ "$waited" -eq 1 ] && log "STAGE-READY $name -- all inbound sources present"
exit 0
