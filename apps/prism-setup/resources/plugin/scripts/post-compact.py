#!/usr/bin/env python3
"""PostCompact hook: Re-inject workflow state after context compaction.

Reads .prism/local/compact-snapshot.json and outputs a structured
recovery message for the compacted context.
"""

import json
import sys
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
    root = find_project_root()
    snapshot_path = root / ".prism" / "local" / "compact-snapshot.json"

    if not snapshot_path.is_file():
        # No snapshot — output minimal recovery guidance
        print(json.dumps({
            "hookSpecificOutput": {
                "additionalContext": (
                    "[Compaction Recovery] No snapshot found. "
                    "Read .prism/shared/plans/ and stories.json to recover context."
                )
            }
        }))
        return

    try:
        snapshot = json.loads(snapshot_path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        print(json.dumps({
            "hookSpecificOutput": {
                "additionalContext": (
                    "[Compaction Recovery] Snapshot unreadable. "
                    "Read .prism/shared/plans/ and stories.json to recover context."
                )
            }
        }))
        return

    phase = snapshot.get("phase", "unknown")
    story = snapshot.get("active_story", "none")
    files = snapshot.get("recent_files", [])
    observations = snapshot.get("recent_observations", [])

    parts = [f"[Compaction Recovery] You were in the {phase.upper()} phase"]
    if story:
        parts[0] += f", working on {story}"
    parts[0] += "."

    if files:
        parts.append(f"Files recently modified: {', '.join(files[:10])}.")

    if observations:
        parts.append(f"Recent actions: {'; '.join(observations[-5:])}.")

    parts.append(
        "Read .prism/shared/plans/ and stories.json to recover full context. "
        "Do NOT ask the user what you were doing."
    )

    recovery_msg = " ".join(parts)

    print(json.dumps({
        "hookSpecificOutput": {
            "additionalContext": recovery_msg
        }
    }))


if __name__ == "__main__":
    main()
