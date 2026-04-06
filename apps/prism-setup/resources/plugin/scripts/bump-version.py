#!/usr/bin/env python3
"""
Bump the Prism version across all files in the repository.

Usage:
  python scripts/bump-version.py <major|minor|patch> [--root .]
  python scripts/bump-version.py --set 2.5.0         [--root .]

Reads the current version from the VERSION file, computes the new version,
then updates every file that contains a hardcoded version string.
"""

import argparse
import json
import re
import sys
from pathlib import Path


def read_version(root: Path) -> str:
    return (root / "VERSION").read_text().strip()


def write_version(root: Path, version: str):
    (root / "VERSION").write_text(version + "\n")


def bump(current: str, part: str) -> str:
    major, minor, patch = (int(x) for x in current.split("."))
    if part == "major":
        return f"{major + 1}.0.0"
    elif part == "minor":
        return f"{major}.{minor + 1}.0"
    elif part == "patch":
        return f"{major}.{minor}.{patch + 1}"
    raise ValueError(f"Unknown bump type: {part}")


def update_json(path: Path, old: str, new: str) -> bool:
    """Update 'version' field in a JSON file."""
    if not path.exists():
        return False
    text = path.read_text(encoding="utf-8")
    updated = text.replace(f'"version": "{old}"', f'"version": "{new}"')
    if updated == text:
        return False
    path.write_text(updated, encoding="utf-8")
    return True


def update_text(path: Path, old: str, new: str) -> bool:
    """Replace all occurrences of old version with new in a text file."""
    if not path.exists():
        return False
    text = path.read_text(encoding="utf-8")
    updated = text.replace(old, new)
    if updated == text:
        return False
    path.write_text(updated, encoding="utf-8")
    return True


def main():
    parser = argparse.ArgumentParser(description="Bump Prism version")
    parser.add_argument(
        "bump_type",
        nargs="?",
        choices=["major", "minor", "patch"],
        help="Semver component to bump",
    )
    parser.add_argument("--set", dest="set_version", help="Set an explicit version")
    parser.add_argument("--root", default=".", help="Repository root directory")
    args = parser.parse_args()

    root = Path(args.root).resolve()
    old_version = read_version(root)

    if args.set_version:
        new_version = args.set_version
    elif args.bump_type:
        new_version = bump(old_version, args.bump_type)
    else:
        parser.error("Provide a bump type (major/minor/patch) or --set VERSION")

    print(f"Bumping version: {old_version} -> {new_version}")

    # ── Files to update ──────────────────────────────────────────────────

    # JSON files: update "version" field
    json_files = [
        root / ".claude-plugin" / "plugin.json",
        root / ".claude-plugin" / "marketplace.json",
        root / "apps" / "prism-vscode" / "package.json",
        root / "apps" / "prism-electron" / "package.json",
        # Tauri installer (new — supersedes prism-setup)
        root / "apps" / "prism-installer" / "package.json",
        root / "apps" / "prism-installer" / "src-tauri" / "tauri.conf.json",
        # Deprecated: cmd/prism-setup — kept for rollback but no longer bumped
        # root / "apps" / "prism-setup" / "package.json",
    ]

    # Text files: straight find-and-replace of old → new
    text_files = [
        root / "apps" / "prism-cli" / "main.go",
        root / "apps" / "prism-cli" / "app" / "footer.go",
        root / "packages" / "prism-core" / "src" / "shared" / "PrismState.ts",
        root / "packages" / "prism-ui" / "src" / "context" / "PrismStateContext.tsx",
        # Deprecated: cmd/prism-setup — kept for rollback but no longer bumped
        # root / "apps" / "prism-setup" / "src" / "main.ts",
        # root / "apps" / "prism-setup" / "src" / "screens" / "WelcomeScreen.tsx",
        # root / "apps" / "prism-setup" / "src" / "installer" / "download.ts",
        # root / "apps" / "prism-setup" / "src" / "installer" / "version.ts",
    ]

    updated = []
    skipped = []

    for path in json_files:
        if update_json(path, old_version, new_version):
            updated.append(str(path.relative_to(root)))
        else:
            skipped.append(str(path.relative_to(root)))

    for path in text_files:
        if update_text(path, old_version, new_version):
            updated.append(str(path.relative_to(root)))
        else:
            skipped.append(str(path.relative_to(root)))

    # ── Write new VERSION file ───────────────────────────────────────────
    write_version(root, new_version)
    updated.append("VERSION")

    # ── Report ───────────────────────────────────────────────────────────
    print(f"\nUpdated ({len(updated)}):")
    for f in updated:
        print(f"  + {f}")

    if skipped:
        print(f"\nSkipped ({len(skipped)}) -- file missing or already at {new_version}:")
        for f in skipped:
            print(f"  - {f}")

    print(f"\nVersion is now {new_version}")


if __name__ == "__main__":
    main()
