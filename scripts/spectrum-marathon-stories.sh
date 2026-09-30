#!/usr/bin/env bash
# ============================================================================
# spectrum-marathon-stories.sh -- run a stories.json queue AS a marathon (Q1)
# ----------------------------------------------------------------------------
# stories.json stays the queue; the marathon drives it. This REPLACES the
# retired Ralph loop (scripts/spectrum.sh) with the ICM posture:
#   - walk the READY FRONTIER of the story DAG (pending + unblocked, lowest
#     priority) -- the same selection the old loop made, but
#   - carry NONE of the loop machinery: no MAX_ITERATIONS, no lying-signal
#     verification. A story's "status" in stories.json IS the state (a file
#     cannot lie, ICM invariant 9). A fresh bounded worker runs each story via
#     the `spectrum` skill and sets its status to complete; the walker re-reads
#     and advances. A story not complete after its worker STOPS the walk cleanly
#     (STALL) for a human -- never a blind retry.
#
# Each story executes AS a walk: the queue is the top-level marathon; each
# story's own worker walks its requirements (the story-manifest depends_on).
# One shape, two scales -- the workgraph, recursive.
#
# Usage:  spectrum-marathon-stories [stories.json | project-dir]
#   default: ./.prism/stories/stories.json
#
# Env:
#   SPECTRUM_SUPERVISED=1  hold at each story's edit surface before advancing
#   SPECTRUM_MODEL         model for each story worker
#   SPECTRUM_CLAUDE        claude binary (default: claude)
#   SPECTRUM_SKILL         skill the worker follows (default: spectrum)
#
# States: MARATHON-START . MARATHON-CONTINUE . STORY-OK . STORY-STALL .
#         MARATHON-PAUSED . MARATHON-COMPLETE
# ============================================================================
set -euo pipefail

command -v jq >/dev/null 2>&1 || { echo "spectrum-marathon-stories: jq is required" >&2; exit 1; }

ARG="${1:-$(pwd)}"
if [ -d "$ARG" ]; then STORIES_FILE="$ARG/.prism/stories/stories.json"; else STORIES_FILE="$ARG"; fi
[ -f "$STORIES_FILE" ] || { echo "spectrum-marathon-stories: no stories file: $STORIES_FILE" >&2; exit 1; }
STORIES_FILE="$(cd "$(dirname "$STORIES_FILE")" && pwd)/$(basename "$STORIES_FILE")"
WORKSPACE="${STORIES_FILE%%/.prism/*}"
[ -d "$WORKSPACE/.prism" ] || WORKSPACE="$(pwd)"

CLAUDE="${SPECTRUM_CLAUDE:-claude}"
SKILL="${SPECTRUM_SKILL:-spectrum}"
SUPERVISED="${SPECTRUM_SUPERVISED:-}"
LOG="$(dirname "$STORIES_FILE")/.spectrum-marathon-stories.log"
PAUSE="$WORKSPACE/.spectrum-marathon.pause"

log(){ printf '%s  %s\n' "$(date -Is 2>/dev/null || date)" "$*" | tee -a "$LOG" >&2; }

jq empty "$STORIES_FILE" 2>/dev/null || { echo "spectrum-marathon-stories: invalid JSON: $STORIES_FILE" >&2; exit 1; }
bad="$(jq -r '.stories | to_entries[] | select((.value.id==null) or (.value.status==null) or (.value.priority==null) or (.value|has("blockedBy")|not)) | "index \(.key)"' "$STORIES_FILE" 2>/dev/null || true)"
[ -z "$bad" ] || { echo "spectrum-marathon-stories: story missing id/status/priority/blockedBy: $bad" >&2; exit 1; }

count_remaining(){ jq '[.stories[] | select(.status != "complete")] | length' "$STORIES_FILE"; }
count_total(){ jq '.stories | length' "$STORIES_FILE"; }

# READY FRONTIER: pending, unblocked (no blockedBy, or blockedBy is complete),
# lowest priority first -- the same selection the retired loop used.
select_next_story(){
  jq -r '
    ([.stories[] | select(.status=="complete") | .id]) as $done |
    [ .stories[] | select(.status!="complete") |
      select((.blockedBy==null) or (.blockedBy=="") or (.blockedBy as $b | $done | any(.==$b))) ]
    | sort_by(.priority) | first | .id // empty' "$STORIES_FILE"
}

total="$(count_total)"; remaining="$(count_remaining)"; done_count="$((total - remaining))"
if [ "$done_count" -gt 0 ]; then
  log "MARATHON-CONTINUE stories | ${done_count}/${total} complete | $STORIES_FILE"
else
  log "MARATHON-START stories | ${total} stories | $STORIES_FILE"
fi

while :; do
  if [ -e "$PAUSE" ]; then log "MARATHON-PAUSED (pause requested). Resume: re-run spectrum-marathon-stories (finished stories are skipped)."; exit 0; fi

  remaining="$(count_remaining)"
  if [ "$remaining" -eq 0 ]; then log "MARATHON-COMPLETE all ${total} stories complete -- stories.json is the record."; exit 0; fi

  sid="$(select_next_story)"
  if [ -z "$sid" ]; then
    log "STORY-STALL frontier blocked -- ${remaining} story(ies) remain but none are unblocked. A human resolves blockedBy and re-runs."
    exit 2
  fi

  log "STORY-START $sid"
  prompt=$(cat <<PROMPT
You are executing ONE Spectrum story, headless, with no user to answer questions.
Follow the $SKILL skill (skills/$SKILL/SKILL.md) for the full workflow: implement the
story to its quality gates, run the gates, and do the two-stage review the skill defines.

Your story: id "$sid" in the manifest:
  $STORIES_FILE
Read that story (and its story-manifest if present). Load ONLY what the story needs; query
the code graph, do not photocopy whole files. When the story's gates pass, set its "status"
to "complete" for id "$sid" in $STORIES_FILE (the filesystem is the state; do not emit a
signal instead). Do not ask questions. When status is complete, stop.
PROMPT
)
  model_flag=(); [ -n "${SPECTRUM_MODEL:-}" ] && model_flag=(--model "$SPECTRUM_MODEL")
  agent_flag=(); [ -n "${SPECTRUM_AGENT:-}" ] && agent_flag=(--agent "$SPECTRUM_AGENT")
  ( cd "$WORKSPACE" && "$CLAUDE" --dangerously-skip-permissions "${agent_flag[@]}" "${model_flag[@]}" -p "$prompt" ) >>"$LOG" 2>&1 \
    || log "STORY-WORKER-EXIT nonzero for $sid (verifying status regardless -- the file is the truth, not the exit code)"

  st="$(jq -r --arg id "$sid" '.stories[] | select(.id==$id) | .status' "$STORIES_FILE" 2>/dev/null || echo "")"
  if [ "$st" = "complete" ]; then
    log "STORY-OK $sid (status=complete)"
  else
    log "STORY-STALL $sid -- worker did not complete it (status=$st). Stopping. A human reads the story and re-runs. No blind retry."
    exit 2
  fi

  if [ -n "$SUPERVISED" ]; then
    if [ -t 0 ] || [ -e /dev/tty ]; then
      log "EDIT-SURFACE $sid -- review before the next story. Press Enter to advance."
      read -r _ </dev/tty 2>/dev/null || true
    else
      log "EDIT-SURFACE $sid -- supervised but no TTY; advancing."
    fi
  fi
done
