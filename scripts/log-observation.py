#!/usr/bin/env python3
"""PostToolUse hook: Log mutation tool usage for observational context.

Appends one-line entries to .prism/local/observations.log for
Write, Edit, and Bash tool uses. Provides a lightweight trail
of recent actions that survives compaction via pre-compact snapshot.
"""

import json
import os
import sys
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
    # Read hook input from stdin
    try:
        hook_input = json.loads(sys.stdin.read())
    except (json.JSONDecodeError, EOFError):
        return

    tool_name = hook_input.get("tool_name", "unknown")
    tool_input = hook_input.get("tool_input", {})

    # Extract primary argument based on tool type
    if tool_name == "Write":
        primary = tool_input.get("file_path", "")
    elif tool_name == "Edit":
        primary = tool_input.get("file_path", "")
    elif tool_name == "Bash":
        cmd = tool_input.get("command", "")
        # Truncate long commands
        primary = cmd[:80] + ("..." if len(cmd) > 80 else "")
    else:
        primary = str(tool_input)[:80]

    root = find_project_root()
    local_dir = root / ".prism" / "local"
    local_dir.mkdir(parents=True, exist_ok=True)

    log_path = local_dir / "observations.log"
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S")
    entry = f"{timestamp} {tool_name} {primary}\n"

    with open(log_path, "a", encoding="utf-8") as f:
        f.write(entry)


if __name__ == "__main__":
    main()
