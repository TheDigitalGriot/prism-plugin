#!/usr/bin/env python3
"""
SubagentStart/SubagentStop hook: log agent dispatches to .prism/local/agent-log.jsonl.
Cross-platform (Windows, macOS, Linux).

Receives hook event JSON on stdin. Appends one JSON line per event.
"""
import json
import sys
import os
from datetime import datetime, timezone
from pathlib import Path


def find_project_root():
    """Walk up from cwd to find .prism/ directory."""
    current = Path.cwd()
    while current != current.parent:
        if (current / ".prism").is_dir():
            return current
        current = current.parent
    return Path.cwd()


def main():
    # Read event from stdin
    try:
        event = json.load(sys.stdin)
    except (json.JSONDecodeError, EOFError):
        sys.exit(0)

    # Determine event type from hook context
    # SubagentStart provides: agent_name, agent_type, model
    # SubagentStop provides: agent_name, agent_type, model, duration_ms, token_usage
    agent_name = event.get("agent_name", event.get("subagent_type", "unknown"))
    agent_type = event.get("agent_type", "unknown")
    model = event.get("model", "unknown")

    # Determine if this is start or stop based on presence of duration
    is_stop = "duration_ms" in event or "status" in event

    # Build log entry
    entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "event": "stop" if is_stop else "start",
        "agent": agent_name,
        "type": agent_type,
        "model": model,
    }

    if is_stop:
        entry["duration_ms"] = event.get("duration_ms", 0)
        entry["status"] = event.get("status", "unknown")
        # Include token usage if available
        token_usage = event.get("token_usage", {})
        if token_usage:
            entry["tokens"] = token_usage

    # Write to .prism/local/agent-log.jsonl
    project_root = find_project_root()
    log_dir = project_root / ".prism" / "local"
    log_dir.mkdir(parents=True, exist_ok=True)
    log_path = log_dir / "agent-log.jsonl"

    with open(log_path, "a", encoding="utf-8") as f:
        f.write(json.dumps(entry) + "\n")


if __name__ == "__main__":
    main()
