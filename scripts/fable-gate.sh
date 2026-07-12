#!/usr/bin/env bash
# fable-gate.sh — PreToolUse gate for Fable 5 (claude-fable-5) Task dispatches.
#
# Called by the PreToolUse hook (matcher "Task") before each Task tool call.
# Fable 5 costs ~2.6x Opus per call, so it must never run silently. This gate
# reuses the same flag semantics as the app (.prism/local/fable.flag):
#   - The requested model comes from tool_input.model (an explicit Task override).
#   - Only "fable" / "claude-fable-5" are gated; every other model passes through.
#   - Flag ON  (file parses to JSON with enabled === true) -> ask (human confirm).
#   - Flag OFF (missing / malformed / enabled !== true)     -> deny.
#
# Reads the PreToolUse payload ({tool_name, tool_input, ...}) as JSON on stdin.
# JSON is parsed with node (no jq dependency; robust on Windows Git Bash), matching
# the repo's node/python hook convention. Emits a PreToolUse permission decision on
# stdout per the hook output protocol (see cl-plugin-structure/references/hook-events.md).
set -euo pipefail

# Read the hook payload from stdin (skip when attached to a terminal, e.g. debug).
PAYLOAD=""
if [ ! -t 0 ]; then
  PAYLOAD=$(cat)
fi

# Extract the requested Task model override (tool_input.model). Empty if absent.
# Primary path: precise JSON parse via node (accurate). Only run node when it is
# actually on PATH so a missing/broken node is distinguishable from a genuinely
# empty/non-Fable model below.
MODEL=""
if [ -n "$PAYLOAD" ] && command -v node >/dev/null 2>&1; then
  MODEL=$(printf '%s' "$PAYLOAD" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const j=JSON.parse(s);const ti=j.tool_input||{};process.stdout.write(String(ti.model||""))}catch{process.stdout.write("")}})' 2>/dev/null || echo "")
fi

# Determine whether this is a Fable dispatch.
IS_FABLE=0
case "$MODEL" in
  fable|claude-fable-5) IS_FABLE=1 ;;
esac

# Fail-closed safety net: if node was unavailable OR its precise parse missed on a
# genuinely-Fable payload, grep the raw payload for an explicit Fable model token.
# This keeps non-Fable Task calls working without node, while ensuring a Fable
# dispatch always enters the gate (the flag check below fails closed -> deny when
# node is also unavailable to read the flag). grep's no-match exit (1) must not
# abort under `set -e`, so it is confined to this `if` condition.
if [ "$IS_FABLE" -eq 0 ] && [ -n "$PAYLOAD" ] \
   && printf '%s' "$PAYLOAD" | grep -Eq '"model"[[:space:]]*:[[:space:]]*"(fable|claude-fable-5)"'; then
  IS_FABLE=1
fi

# Only Fable dispatches are gated. Everything else passes through untouched.
if [ "$IS_FABLE" -eq 0 ]; then
  exit 0
fi

# Resolve the project dir: CLAUDE_PROJECT_DIR when set, else the hook's CWD.
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
FLAG_FILE="$PROJECT_DIR/.prism/local/fable.flag"

# Flag ON iff the file exists and parses to JSON with enabled === true.
# Anything else (missing file, read error, malformed JSON, enabled !== true) = OFF.
FLAG_STATE="off"
if [ -f "$FLAG_FILE" ]; then
  if node -e 'const fs=require("fs");try{const j=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));process.exit(j&&typeof j==="object"&&j.enabled===true?0:1)}catch{process.exit(1)}' "$FLAG_FILE" 2>/dev/null; then
    FLAG_STATE="on"
  fi
fi

if [ "$FLAG_STATE" = "on" ]; then
  # Flag ON -> ask: defer to the permission prompt so a human confirms the cost.
  printf '%s\n' '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"ask","permissionDecisionReason":"Fable 5 requested (~2.6x Opus cost). Confirm?"}}'
  exit 0
fi

# Flag OFF -> deny the dispatch.
printf '%s\n' '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"Fable 5 is disabled. Enable via .prism/local/fable.flag ({\"enabled\":true})."}}'
exit 0
