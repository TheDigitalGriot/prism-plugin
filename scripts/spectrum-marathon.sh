#!/usr/bin/env bash
# ============================================================================
# spectrum-marathon.sh -- the ICM long-form runner (Spectrum, re-founded on ICM)
# ----------------------------------------------------------------------------
# Replaces the retired Ralph-loop spectrum.sh. It carries NONE of its machinery
# -- no MAX_ITERATIONS, no lockfile-signal, no state-verification, no story
# queue. In ICM the filesystem IS the state machine (invariant 9): a stage is
# done when its output exists, and a file cannot lie -- so the old script's
# compensating complexity is simply unnecessary here.
#
# WHAT IT DOES
#   Walks an ICM workspace: numbered stage folders (01_*, 02_*, ...), each with
#   a CONTEXT.md contract (authored by spectrum-architect) and an output/ dir.
#   For each stage in order it runs ONE fresh agent that reads only that stage's
#   contract + the inputs the contract names (invariant 7: 2-8k tokens/step),
#   writes into the stage's output/, and advances the moment that output exists.
#
# LONG FORM
#   Unattended by default: it walks every stage in one long run (overnight) --
#   the ICM-native replacement for the loop's one real job, autonomous runs.
#   Each stage is a fresh, bounded agent; nothing is ever "reloaded".
#
# Usage:  spectrum-marathon [workspace-dir]
#   workspace-dir  a dir of numbered stage folders (default: current dir).
#
# Env:
#   SPECTRUM_SUPERVISED=1   pause at each stage's edit surface (invariant 6) for
#                           the human to read/edit the output before advancing.
#                           Unset (default) = long-form, walk unattended.
#   SPECTRUM_MODEL          model for each stage agent (default: claude's default)
#   SPECTRUM_CLAUDE         path to the claude binary (default: `claude` on PATH)
#
# Requires: bash (Git Bash / WSL / macOS / Linux) and the claude CLI.
# ============================================================================

# MARATHON STATES (emitted to the log; how adjacent sessions read this run):
#   MARATHON-START . MARATHON-CONTINUE . STAGE-OK . STAGE-STALL . MARATHON-PAUSED . MARATHON-COMPLETE
#   MARATHON-WAITING . MARATHON-WAIT-EXPIRED are added by the wait gate (spectrum-marathon-wait).
#
set -euo pipefail

WORKSPACE="${1:-$(pwd)}"
[ -d "$WORKSPACE" ] || { echo "spectrum-marathon: no such workspace: $WORKSPACE" >&2; exit 1; }
WORKSPACE="$(cd "$WORKSPACE" && pwd)"

CLAUDE="${SPECTRUM_CLAUDE:-claude}"
SUPERVISED="${SPECTRUM_SUPERVISED:-}"
LOG="$WORKSPACE/.spectrum-marathon.log"
here="$(cd "$(dirname "$0")" && pwd)"

log(){ printf '%s  %s\n' "$(date -Is 2>/dev/null || date)" "$*" | tee -a "$LOG" >&2; }

# A stage is DONE when its output/ exists and is non-empty. The filesystem is
# the state machine -- this is the ONLY advance condition. No signal, no status.
stage_done(){ [ -d "$1/output" ] && [ -n "$(ls -A "$1/output" 2>/dev/null || true)" ]; }

# Discover numbered stage folders (NN_*) in lexical order -- numbering encodes
# order (invariant 3). Renaming folders reorders the walk; that is the point.
stages=()
while IFS= read -r d; do stages+=("$d"); done < <(find "$WORKSPACE" -maxdepth 1 -type d -name '[0-9][0-9]_*' | sort)
[ "${#stages[@]}" -gt 0 ] || { echo "spectrum-marathon: no numbered stage folders (NN_*) in $WORKSPACE" >&2; exit 1; }

# Acyclic guard (ICM Pattern 3, lifted cross-workspace): refuse an obvious
# mutual wait, where this stage awaits a peer stage's output while that peer
# awaits ours. Deeper cycles are caught by SPECTRUM_WAIT_DEADLINE and ultimately
# by the global Workgraph's generated index, which sees every project at once.
inbound_line(){ grep -iE '^[[:space:]]*Inbound[[:space:]]*\(awaits\)[[:space:]]*:' "$1" 2>/dev/null | head -1 || true; }
for _stage in "${stages[@]}"; do
  _il="$(inbound_line "$_stage/CONTEXT.md")"; [ -n "$_il" ] || continue
  _rest="${_il#*:}"; _oldifs="$IFS"; IFS=','
  for _raw in $_rest; do
    IFS="$_oldifs"
    _tok="$(printf '%s' "$_raw" | sed 's/^[[:space:]]*//; s/[[:space:]]*$//; s#/output/*$##')"
    if [ -n "$_tok" ]; then
      case "$_tok" in /*|[A-Za-z]:*) _peer="$_tok";; *) _peer="$_stage/$_tok";; esac
      if [ -d "$_peer" ]; then
        _pil="$(inbound_line "$_peer/CONTEXT.md")"
        if [ -n "$_pil" ] && printf '%s' "$_pil" | grep -qF "$(basename "$_stage")/output"; then
          echo "spectrum-marathon: CYCLE -- $(basename "$_stage") and $(basename "$_peer") await each other. Refusing to start (ICM one-way references)." >&2
          exit 4
        fi
      fi
    fi
    IFS=','
  done
  IFS="$_oldifs"
done

mode=$([ -n "$SUPERVISED" ] && echo "supervised" || echo "long-form")

# START vs CONTINUE are distinct states (The Marathon Continues -- ode to Nipsey
# Hussle). Derived from the filesystem: any stage already carrying an output means
# this is a continuation, not a first run. SPECTRUM_CONTINUE (set by
# spectrum-marathon-continue) forces the CONTINUE state.
done_count=0
for _s in "${stages[@]}"; do stage_done "$_s" && done_count=$((done_count+1)); done
if [ -n "${SPECTRUM_CONTINUE:-}" ] || [ "$done_count" -gt 0 ]; then
  log "MARATHON-CONTINUE ${done_count}/${#stages[@]} stages already done | mode=$mode | workspace=$WORKSPACE"
else
  log "MARATHON-START ${#stages[@]} stages | mode=$mode | workspace=$WORKSPACE"
fi

for stage in "${stages[@]}"; do
  # Pause control: spectrum-marathon-pause writes the .spectrum-marathon.pause sentinel;
  # between stages the marathon enters the MARATHON-PAUSED state and stops cleanly. Finished
  # stages keep their outputs, so spectrum-marathon-continue re-runs nothing. (Companion runner:
  # spectrum-marathon-stories drives a stories.json queue as a marathon.)
  if [ -e "$WORKSPACE/.spectrum-marathon.pause" ]; then
    log "MARATHON-PAUSED (pause requested). Resume: spectrum-marathon-continue $WORKSPACE"
    exit 0
  fi

  name="$(basename "$stage")"
  contract="$stage/CONTEXT.md"

  if [ ! -f "$contract" ]; then log "SKIP $name (no CONTEXT.md contract)"; continue; fi
  if stage_done "$stage"; then log "DONE-ALREADY $name (output present -- resuming past it)"; continue; fi

  # MARATHON-WAITING gate: hold until this stage's inbound worklane sources exist.
  SPECTRUM_WORKSPACE="$WORKSPACE" "$here/spectrum-marathon-wait.sh" "$stage" || {
    rc=$?
    if [ "$rc" -eq 3 ]; then log "STAGE-STALL $name -- inbound wait expired. A human resolves the peer and re-runs."; exit 3; fi
    if [ -e "$WORKSPACE/.spectrum-marathon.pause" ]; then log "MARATHON-PAUSED (during wait on $name)"; exit 0; fi
  }

  log "STAGE-START $name"
  mkdir -p "$stage/output.partial"

  # Thin router prompt. The agent loads ONLY this stage's contract and the
  # inputs it names -- never the whole workspace, never other stages.
  prompt=$(cat <<EOF
You are executing ONE ICM stage, headless, with no user to answer questions.
Read and follow the stage contract at:
  $contract
It names your inputs (working + reference) and the outputs you must write.
Load ONLY what the contract names -- do NOT read other stage folders or the
whole workspace. Ground claims through Prism's discovery agents where available;
query, never photocopy whole files. Write your output artifact(s) into:
  $stage/output.partial/
exactly as the contract's Outputs / Success criteria specify. Append the
contract's heartbeat tokens as you go. Do not ask questions. When the output
exists on disk, stop.
EOF
)

  model_flag=()
  [ -n "${SPECTRUM_MODEL:-}" ] && model_flag=(--model "$SPECTRUM_MODEL")
  agent_flag=(); [ -n "${SPECTRUM_AGENT:-}" ] && agent_flag=(--agent "$SPECTRUM_AGENT")

  # One fresh, bounded agent for this stage. Fresh session each stage is the ICM
  # posture -- never load it in the first place, rather than discard-and-retry.
  ( cd "$WORKSPACE" && "$CLAUDE" --dangerously-skip-permissions "${agent_flag[@]}" "${model_flag[@]}" -p "$prompt" ) >>"$LOG" 2>&1 \
    || log "STAGE-AGENT-EXIT nonzero for $name (verifying output regardless -- exit code is not the truth, the file is)"

  # Atomic publish (ICM: a file cannot lie). Rename the completed partial into
  # place so a peer waiter never sees a half-written output, then generate a
  # content-hash manifest: a generated index, never a .done signal.
  if [ -d "$stage/output.partial" ] && [ -n "$(ls -A "$stage/output.partial" 2>/dev/null || true)" ]; then
    rm -rf "$stage/output" 2>/dev/null || true
    mv "$stage/output.partial" "$stage/output"
    ( cd "$stage/output" && command -v sha256sum >/dev/null 2>&1 && find . -type f ! -name '.manifest' -print0 2>/dev/null | xargs -0 sha256sum > .manifest 2>/dev/null ) || true
  fi

  # Advance ONLY on output existence. If the stage produced nothing, stop the
  # walk cleanly -- a human reads the stage and re-runs. No blind retry.
  if stage_done "$stage"; then
    log "STAGE-OK $name (output present)"
  else
    log "STAGE-STALL $name -- no output produced. Stopping. A human reads $stage/ and re-runs spectrum-marathon to resume here."
    exit 2
  fi

  # Every output is an edit surface (invariant 6). In supervised mode, hold here
  # so a person can open and edit the output before the next stage reads it.
  if [ -n "$SUPERVISED" ]; then
    if [ -t 0 ] || [ -e /dev/tty ]; then
      log "EDIT-SURFACE $name -- output in $stage/output/. Edit in place, then press Enter to advance."
      read -r _ </dev/tty 2>/dev/null || true
    else
      log "EDIT-SURFACE $name -- supervised but no TTY; advancing (attach a terminal to gate)."
    fi
  fi
done

log "MARATHON-COMPLETE all ${#stages[@]} stages have outputs -- the workspace is the record."
