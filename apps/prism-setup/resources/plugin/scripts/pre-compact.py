#!/usr/bin/env python3
"""PreCompact hook: Snapshot current workflow state before context compaction.

Writes .prism/local/compact-snapshot.json with phase, active story,
recent files, pending errors, and observation trail.
"""

import json
import os
import subprocess
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


def get_active_story(root):
    """Find the in_progress story from stories.json."""
    stories_paths = list(root.glob(".prism/stories/**/stories.json"))
    for sp in stories_paths:
        try:
            data = json.loads(sp.read_text(encoding="utf-8"))
            for story in data.get("stories", []):
                if story.get("status") == "in_progress":
                    return story.get("id", "unknown")
        except (json.JSONDecodeError, OSError):
            continue
    return None


def detect_phase(root):
    """Infer current workflow phase from recent .prism/shared/ file timestamps."""
    phase_dirs = {
        "research": root / ".prism" / "shared" / "research",
        "plan": root / ".prism" / "shared" / "plans",
        "validate": root / ".prism" / "shared" / "validation",
    }
    latest_phase = "implement"  # default if no research/plan/validate artifacts
    latest_time = 0

    for phase, d in phase_dirs.items():
        if d.is_dir():
            for f in d.iterdir():
                if f.is_file():
                    mtime = f.stat().st_mtime
                    if mtime > latest_time:
                        latest_time = mtime
                        latest_phase = phase

    return latest_phase


def get_recent_files():
    """Get recently modified files from git diff."""
    try:
        result = subprocess.run(
            ["git", "diff", "--name-only"],
            capture_output=True, text=True, timeout=5
        )
        files = [f.strip() for f in result.stdout.strip().split("\n") if f.strip()]
        return files[:20]  # cap at 20
    except (subprocess.TimeoutExpired, FileNotFoundError):
        return []


def get_observation_tail(root):
    """Get last 20 lines from observation log."""
    log_path = root / ".prism" / "local" / "observations.log"
    if not log_path.is_file():
        return []
    try:
        lines = log_path.read_text(encoding="utf-8").strip().split("\n")
        return lines[-20:]
    except OSError:
        return []


def main():
    root = find_project_root()
    local_dir = root / ".prism" / "local"
    local_dir.mkdir(parents=True, exist_ok=True)

    snapshot = {
        "phase": detect_phase(root),
        "active_story": get_active_story(root),
        "recent_files": get_recent_files(),
        "recent_observations": get_observation_tail(root),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    snapshot_path = local_dir / "compact-snapshot.json"
    snapshot_path.write_text(json.dumps(snapshot, indent=2), encoding="utf-8")

    # Output for hook result (JSON to stdout)
    print(json.dumps(snapshot))


if __name__ == "__main__":
    main()
