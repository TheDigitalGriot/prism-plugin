#!/usr/bin/env python3
"""
Build a Cowork-uploadable sideload zip of the Prism plugin.

WHY: Cowork's "install from connected GitHub" path caches plugin content
server-side and frequently fails to pick up new commits / version bumps /
description changes (see ../references/cowork-sync-bug.md). Uploading a zip via
Cowork -> Customize -> Browse plugins -> Upload plugin bypasses that path.

WHAT: archives ONLY the tracked plugin components at a git ref
(.claude-plugin, skills, agents, commands, hooks, scripts) into a lean zip,
automatically excluding apps/, packages/, prism-docs/, prism-eval/, installer/,
node_modules/, and any nested *.zip. Then verifies the result.

Usage:
  python build-sideload.py [--output DIR] [--ref HEAD]
"""
import argparse
import json
import subprocess
import sys
import zipfile
from pathlib import Path

PLUGIN_PATHS = [".claude-plugin", "skills", "agents", "commands", "hooks", "scripts"]


def git(*args: str) -> str:
    return subprocess.run(
        ["git", *args], check=True, text=True, capture_output=True
    ).stdout


def main() -> int:
    ap = argparse.ArgumentParser(description="Build a Cowork sideload zip of the Prism plugin")
    ap.add_argument("--output", default=None, help="Output directory (default: .prism/local/sideload)")
    ap.add_argument("--ref", default="HEAD", help="Git ref to archive (default: HEAD)")
    args = ap.parse_args()

    root = Path(git("rev-parse", "--show-toplevel").strip())
    version = (root / "VERSION").read_text(encoding="utf-8").strip()
    out_dir = Path(args.output) if args.output else root / ".prism" / "local" / "sideload"
    out_dir.mkdir(parents=True, exist_ok=True)
    out = out_dir / f"prism-sideload-{version}.zip"

    # git archive packages the COMMITTED ref — warn if plugin files have uncommitted edits.
    dirty = git("-C", str(root), "status", "--porcelain", "--", *PLUGIN_PATHS).strip()
    if dirty and args.ref == "HEAD":
        print("WARNING: uncommitted changes in plugin components. The zip packages the", file=sys.stderr)
        print("         COMMITTED state at HEAD, so these edits will NOT be included:", file=sys.stderr)
        for line in dirty.splitlines():
            print("           " + line, file=sys.stderr)
        print("         Commit them first, then re-run.\n", file=sys.stderr)

    if out.exists():
        out.unlink()
    subprocess.run(
        ["git", "-C", str(root), "archive", "--format=zip", "-o", str(out), args.ref, *PLUGIN_PATHS],
        check=True,
    )

    # Verify the artifact.
    problems = []
    with zipfile.ZipFile(out) as z:
        names = z.namelist()
        nested = [n for n in names if n.lower().endswith(".zip")]
        if nested:
            problems.append(f"nested zip(s) present (blocks Cowork install): {nested}")
        if ".claude-plugin/plugin.json" not in names:
            problems.append("missing .claude-plugin/plugin.json")
        else:
            pj = json.loads(z.read(".claude-plugin/plugin.json"))
            if pj.get("version") != version:
                problems.append(f"plugin.json version {pj.get('version')!r} != VERSION {version!r}")

    if problems:
        print("SIDELOAD BUILD FAILED VERIFICATION:", file=sys.stderr)
        for p in problems:
            print("  - " + p, file=sys.stderr)
        return 1

    size_kb = out.stat().st_size // 1024
    print(f"OK  prism {version}  ->  {out}")
    print(f"    {size_kb} KB, {len(names)} entries, 0 nested zips")
    print()
    print("Upload it in Claude Desktop:")
    print("  Cowork -> Customize -> Browse plugins -> Upload plugin  ->  select the zip above")
    print()
    print("(Bypasses Cowork's GitHub-sync cache. Re-run after committing new plugin changes.)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
