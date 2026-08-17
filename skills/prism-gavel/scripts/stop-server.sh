#!/usr/bin/env bash
# Stop the prism-gavel cockpit popout server and clean up.
# Copy of prism-brainstorm/scripts/stop-server.sh (gavel session dirs live under
# .prism/local/gavel/ or /tmp/prism-gavel-*).
# Usage: stop-server.sh <session_dir>
#
# Kills the server process. Only deletes the session directory if it's under /tmp
# (ephemeral). Persistent directories (.prism/) are kept.

SESSION_DIR="$1"

if [[ -z "$SESSION_DIR" ]]; then
  echo '{"error": "Usage: stop-server.sh <session_dir>"}'
  exit 1
fi

STATE_DIR="${SESSION_DIR}/state"
PID_FILE="${STATE_DIR}/server.pid"

if [[ -f "$PID_FILE" ]]; then
  pid=$(cat "$PID_FILE")

  kill "$pid" 2>/dev/null || true

  for i in {1..20}; do
    if ! kill -0 "$pid" 2>/dev/null; then
      break
    fi
    sleep 0.1
  done

  if kill -0 "$pid" 2>/dev/null; then
    kill -9 "$pid" 2>/dev/null || true
    sleep 0.1
  fi

  if kill -0 "$pid" 2>/dev/null; then
    echo '{"status": "failed", "error": "process still running"}'
    exit 1
  fi

  rm -f "$PID_FILE" "${STATE_DIR}/server.log" "${STATE_DIR}/open-viewer"

  if [[ "$SESSION_DIR" == /tmp/* ]]; then
    rm -rf "$SESSION_DIR"
  fi

  echo '{"status": "stopped"}'
else
  echo '{"status": "not_running"}'
fi
