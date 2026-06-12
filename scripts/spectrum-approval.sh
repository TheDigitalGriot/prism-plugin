#!/usr/bin/env bash
# spectrum-approval.sh — Spectrum worker PreToolUse approval gate.
#
# Called by the PreToolUse hook before each tool invocation.
# Only applies to spectrum worker sessions (identified by SPECTRUM_WORKER_STORY_ID env var).
# Non-spectrum sessions exit 0 immediately — zero overhead on normal usage.
#
# Supervision modes:
#   Unsupervised (default): SPECTRUM_SUPERVISED is unset → auto-approve immediately,
#     zero polling overhead. This is the happy path for unattended runs.
#   Supervised: set SPECTRUM_SUPERVISED=1 to enable the controller protocol below.
#
# Protocol (supervised mode only):
#   1. Write a .request file to .prism/local/spectrum-approvals/<story-id>/<request-id>.request
#   2. Poll for .approve or .deny file for up to SPECTRUM_APPROVAL_TIMEOUT seconds (default: 3)
#   3. Auto-approve on timeout (control without micromanagement)
#
# To manually approve a pending tool call (during a live spectrum run):
#   touch .prism/local/spectrum-approvals/<story-id>/<request-id>.approve
#
# To deny a pending tool call:
#   touch .prism/local/spectrum-approvals/<story-id>/<request-id>.deny
#
# The controller (spectrum.sh) can also watch for .request files and auto-respond
# based on tool name patterns. Silence auto-approves after SPECTRUM_APPROVAL_TIMEOUT seconds.
#
# Environment variables:
#   SPECTRUM_WORKER_STORY_ID    — set by spectrum.sh's run_iteration() for worker sessions
#   HOOK_TOOL_NAME              — name of the tool being called (set by hook runner)
#   SPECTRUM_SUPERVISED         — set to any non-empty value to enable controller protocol
#   SPECTRUM_APPROVAL_TIMEOUT   — seconds to poll before auto-approving (default: 3)
#
set -euo pipefail

# Fast path: not a spectrum worker session — exit immediately with no overhead.
if [[ -z "${SPECTRUM_WORKER_STORY_ID:-}" ]]; then
    exit 0
fi

# Fast path: unsupervised mode (default). No controller is watching, so auto-approve
# immediately with zero polling overhead. Set SPECTRUM_SUPERVISED=1 to opt into
# the full controller protocol below.
if [[ -z "${SPECTRUM_SUPERVISED:-}" ]]; then
    exit 0
fi

STORY_ID="${SPECTRUM_WORKER_STORY_ID}"
TOOL="${HOOK_TOOL_NAME:-unknown}"
# PRISM_PROJECT_DIR is passed explicitly by spectrum.sh's run_iteration() so approval
# files always land under the project root even if the worker's cwd drifts. The fallback
# to "." exists as a safety net for direct/debug invocations only — never rely on it
# in production (cwd drift silently misroutes .request files and breaks the controller).
PRISM_PROJECT_DIR="${PRISM_PROJECT_DIR:-.}"
APPROVAL_DIR="${PRISM_PROJECT_DIR}/.prism/local/spectrum-approvals"
REQUEST_ID="$(date +%s%N 2>/dev/null || date +%s)$$"

mkdir -p "$APPROVAL_DIR/$STORY_ID"

REQUEST_FILE="$APPROVAL_DIR/$STORY_ID/${REQUEST_ID}.request"
APPROVE_FILE="$APPROVAL_DIR/$STORY_ID/${REQUEST_ID}.approve"
DENY_FILE="$APPROVAL_DIR/$STORY_ID/${REQUEST_ID}.deny"

# Write approval request — controller can watch for these
printf '{"tool":"%s","story":"%s","ts":"%s","request_id":"%s"}\n' \
    "$TOOL" "$STORY_ID" "$(date -Iseconds 2>/dev/null || date)" "$REQUEST_ID" \
    > "$REQUEST_FILE"

# Poll for controller response (configurable auto-approve window, default 3s)
TIMEOUT="${SPECTRUM_APPROVAL_TIMEOUT:-3}"
elapsed=0

while [[ $elapsed -lt $TIMEOUT ]]; do
    if [[ -f "$APPROVE_FILE" ]]; then
        rm -f "$REQUEST_FILE" "$APPROVE_FILE"
        exit 0  # Approved — tool call proceeds
    fi
    if [[ -f "$DENY_FILE" ]]; then
        rm -f "$REQUEST_FILE" "$DENY_FILE"
        # Exit 2 to block the tool call (per hook-events.md: exit 2 = block)
        echo "[spectrum-approval] Tool call denied by controller: $TOOL (story: $STORY_ID)" >&2
        exit 2
    fi
    sleep 1
    elapsed=$((elapsed + 1))
done

# Timeout reached — auto-approve (control without micromanagement)
rm -f "$REQUEST_FILE"
exit 0
