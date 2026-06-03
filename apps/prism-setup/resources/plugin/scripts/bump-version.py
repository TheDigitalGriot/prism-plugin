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
from typing import Optional


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


def update_json(path: Path, old: str, new: str, also_replace: Optional[list] = None) -> bool:
    """Update 'version' field in a JSON file.
    also_replace: additional old version strings to replace (for files stuck at older versions).
    """
    if not path.exists():
        return False
    text = path.read_text(encoding="utf-8")
    updated = text.replace(f'"version": "{old}"', f'"version": "{new}"')
    if also_replace:
        for extra_old in also_replace:
            updated = updated.replace(f'"version": "{extra_old}"', f'"version": "{new}"')
    if updated == text:
        return False
    path.write_text(updated, encoding="utf-8")
    return True


def update_text(path: Path, old: str, new: str, also_replace: Optional[list] = None) -> bool:
    """Replace all occurrences of old version with new in a text file.
    also_replace: additional old strings to replace (for files stuck at older versions).
    """
    if not path.exists():
        return False
    text = path.read_text(encoding="utf-8")
    updated = text.replace(old, new)
    if also_replace:
        for extra_old in also_replace:
            updated = updated.replace(extra_old, new)
    if updated == text:
        return False
    path.write_text(updated, encoding="utf-8")
    return True


def discover_stale_versions(root: Path, new_version: str,
                            old_versions: Optional[list] = None) -> list:
    """Search the repo for SPECIFIC old version strings that should have been bumped.

    Rather than scanning for any semver string != new_version (which produces thousands
    of false positives from npm dependencies, Rust crate versions, etc.), this function
    looks only for the exact old version strings provided. This finds files that were
    accidentally skipped by a bump run without drowning in noise.

    Args:
        root: repository root
        new_version: the version we just bumped to
        old_versions: specific old version strings to search for (e.g. ["3.3.1", "3.3.0"])
                      defaults to None; if empty, sweep is skipped.

    Returns list of (relative_path, line_number, matched_version) tuples.

    Excludes:
      - .git/, node_modules/
      - .prism/ (all documentation time capsules — plans, research, evals, brainstorms)
      - Build artifact directories (target/, dist/, build/, out/)
      - CHANGELOG.md (intentional historical version entries)
    """
    if not old_versions:
        return []

    EXTENSIONS = {".md", ".json", ".go", ".ts", ".tsx", ".toml"}

    EXCLUDE_BASENAMES = {
        "package-lock.json", "yarn.lock", "pnpm-lock.yaml",
        "go.sum", "go.mod", "CHANGELOG.md", "CHANGELOG",
    }

    EXCLUDE_PATH_SEGMENTS = [
        ".git", "node_modules", ".prism/",
        "target/",           # Rust/Tauri build artifacts
        "dist/", "build/", "out/",   # JS build artifacts
        "apps/prism-setup/", # Deprecated NSIS installer — no longer version-tracked
    ]

    stale = []
    for path in root.rglob("*"):
        if not path.is_file() or path.suffix not in EXTENSIONS:
            continue
        if path.name in EXCLUDE_BASENAMES:
            continue
        rel = str(path.relative_to(root)).replace("\\", "/")
        if any(seg in rel for seg in EXCLUDE_PATH_SEGMENTS):
            continue
        try:
            text = path.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            continue
        for lineno, line in enumerate(text.splitlines(), 1):
            for old_v in old_versions:
                if old_v in line:
                    stale.append((rel, lineno, old_v))
                    break  # one entry per line is enough
    return stale


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
    parser.add_argument(
        "--strict",
        action="store_true",
        help="Fail (exit 1) if any out-of-sync version strings are found after bump",
    )
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

    # ── Known straggler files (belt-and-suspenders) ──────────────────────────
    # These files use plain version strings requiring find-and-replace.
    # They are listed explicitly as a belt-and-suspenders layer alongside the
    # post-bump discovery sweep.
    #
    # Straggler history:
    #   - main.go, footer.go, PrismState.ts, PrismStateContext.tsx were stuck at
    #     3.0.3 across multiple releases (caught during v3.3.0 release QA).
    #   - All four were at 3.3.0 when v3.3.1 shipped (partial bump run).
    #   - v3.4.0 introduces the discovery sweep to prevent recurrence.
    #
    # also_replace: used one-time to fix files stuck at a version OLDER than
    # old_version (the VERSION file). Remove this list once all files are
    # confirmed at the current version post-bump.
    straggler_also_replace = ["3.3.0"]

    straggler_files = [
        root / "apps" / "prism-cli" / "main.go",
        root / "apps" / "prism-cli" / "app" / "footer.go",
        root / "packages" / "prism-core" / "src" / "shared" / "PrismState.ts",
        root / "packages" / "prism-ui" / "src" / "context" / "PrismStateContext.tsx",
        # Tauri Cargo.toml — uses 'version = "X.Y.Z"' format (plain text replace)
        root / "apps" / "prism-installer" / "src-tauri" / "Cargo.toml",
        # tauri.conf.json uses non-standard spacing ("version":  "X") — handle via text replace
        root / "apps" / "prism-installer" / "src-tauri" / "tauri.conf.json",
        # Deprecated: cmd/prism-setup — kept for rollback but no longer bumped
        # root / "apps" / "prism-setup" / "src" / "main.ts",
        # root / "apps" / "prism-setup" / "src" / "screens" / "WelcomeScreen.tsx",
        # root / "apps" / "prism-setup" / "src" / "installer" / "download.ts",
        # root / "apps" / "prism-setup" / "src" / "installer" / "version.ts",
    ]

    updated = []
    skipped = []

    for path in json_files:
        if update_json(path, old_version, new_version, also_replace=straggler_also_replace):
            updated.append(str(path.relative_to(root)))
        else:
            skipped.append(str(path.relative_to(root)))

    for path in straggler_files:
        if update_text(path, old_version, new_version, also_replace=straggler_also_replace):
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

    # ── Post-bump discovery sweep ────────────────────────────────────────────
    # Search for stuck/old versions (not new_version — that would flag every correctly-bumped file).
    # Idempotency: when re-running --set X.Y.Z on a repo already at X.Y.Z, old_version == new_version,
    # so we skip it from the search and only check for known straggler versions.
    search_for = set(straggler_also_replace)
    if old_version != new_version:
        search_for.add(old_version)
    old_versions_to_find = list(search_for)
    print(f"\nScanning repo for stale version strings: {old_versions_to_find}")
    stale = discover_stale_versions(root, new_version, old_versions=old_versions_to_find)
    if stale:
        print(f"\nWARNING: found {len(stale)} out-of-sync version string(s):")
        for (rel, lineno, found) in stale:
            print(f"  {rel}:{lineno}  found: {found}  (expected: {new_version})")
        if args.strict:
            print(f"\nERROR: --strict mode: out-of-sync version strings found. Fix and re-run.")
            sys.exit(1)
    else:
        print("Discovery sweep: all version strings consistent.")

    print(f"\nVersion is now {new_version}")


if __name__ == "__main__":
    main()
