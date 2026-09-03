#!/usr/bin/env python3
"""prism-inject-stats.py - inject live codebase-memory-mcp graph stats into CLAUDE.md.

Reads live node/edge counts for the current project out of `codebase-memory-mcp`
(the Go MCP server that already indexes this repo) and performs a marker-aware
upsert of a small stats block into the project `CLAUDE.md`, delimited by:

    <!-- prism:start -->
    ...
    <!-- prism:end -->

WHY THE CLI, NOT AN MCP CALL
----------------------------
A standalone script cannot call MCP tools (those are only reachable from an agent).
codebase-memory-mcp ships a synchronous CLI that runs a single tool and prints JSON:

    codebase-memory-mcp cli <tool> '<json-args>'

That is the supported scriptable path. This script uses:
  * list_projects  -> map the current repo root to its indexed project name AND
                      read that project's live nodes/edges counts (both are in the
                      list_projects payload).
  * index_status   -> fallback source for counts if a codemem version ever drops
                      nodes/edges from the list_projects payload.

MARKER-AWARE UPSERT
-------------------
Three cases, all preserving content OUTSIDE the markers byte-for-byte:
  1. File does not exist  -> create CLAUDE.md containing just the block.
  2. File exists, no markers -> append the block after a leading blank line.
  3. File exists, markers present -> replace ONLY the bytes between (and including)
     the two markers; everything before the start marker and after the end marker
     is kept verbatim.

The block carries no timestamps or other volatile data, so re-running with unchanged
counts yields a byte-identical CLAUDE.md (idempotent). If codemem is missing or errors,
the script fails cleanly (`error: ...` on stderr, non-zero exit) and writes nothing.

Usage:
    python scripts/prism-inject-stats.py [--project NAME] [--repo-root DIR]
        [--claude-md PATH] [--codemem-bin PATH] [--dry-run] [--verbose]

Requires: Python 3.8+, the `codebase-memory-mcp` binary on PATH (or --codemem-bin),
and the repo already indexed (run index_repository once if not).
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys

# --- Marker constants --------------------------------------------------------

MARKER_START = "<!-- prism:start -->"
MARKER_END = "<!-- prism:end -->"


# --- codemem CLI access ------------------------------------------------------

class CodememError(RuntimeError):
    pass


def run_codemem(binary: str, tool: str, args: dict) -> dict:
    """Invoke `codebase-memory-mcp cli <tool> <json>` and return the parsed tool result.

    The binary logs to stderr and prints the JSON MCP envelope to stdout. We parse the
    last stdout line that looks like a JSON object, unwrap the `content[0].text` payload,
    and return the inner tool JSON.
    """
    try:
        proc = subprocess.run(
            [binary, "cli", tool, json.dumps(args)],
            capture_output=True, text=True, timeout=120,
        )
    except FileNotFoundError as exc:
        raise CodememError(
            f"codemem binary not found: {binary!r}. Install it or pass --codemem-bin."
        ) from exc
    except subprocess.TimeoutExpired as exc:
        raise CodememError(f"codemem call timed out: {tool}") from exc

    stdout = proc.stdout or ""
    envelope = None
    for line in reversed(stdout.splitlines()):
        line = line.strip()
        if line.startswith("{"):
            try:
                envelope = json.loads(line)
                break
            except json.JSONDecodeError:
                continue
    if envelope is None:
        raise CodememError(
            f"{tool}: no JSON on stdout (exit {proc.returncode}). "
            f"stderr: {(proc.stderr or '')[-400:]}"
        )

    try:
        text = envelope["content"][0]["text"]
        result = json.loads(text)
    except (KeyError, IndexError, TypeError, json.JSONDecodeError) as exc:
        raise CodememError(f"{tool}: unexpected envelope shape: {envelope!r}") from exc

    if envelope.get("isError"):
        raise CodememError(f"{tool} returned an error: {result}")
    return result


# --- Project + counts resolution ---------------------------------------------

def _norm(path: str) -> str:
    """Normalize a filesystem path for cross-platform comparison."""
    return os.path.normcase(os.path.abspath(path)).replace("\\", "/").rstrip("/")


def _as_count(value) -> "int | None":
    """Coerce a count-like value to a non-negative int, or None if unusable."""
    if isinstance(value, bool):  # bool is an int subclass; reject it explicitly
        return None
    if isinstance(value, int):
        return value if value >= 0 else None
    if isinstance(value, float) and value.is_integer() and value >= 0:
        return int(value)
    return None


def resolve_project_stats(binary: str, explicit: "str | None", repo_root: str,
                          verbose: bool) -> "tuple[str, int, int]":
    """Return (project_name, nodes, edges) for repo_root (or the explicit override).

    Counts come from the list_projects payload; if that payload lacks usable
    nodes/edges (e.g. a future codemem drops them), fall back to index_status.
    Raises CodememError if the project can't be resolved or counts are unusable.
    """
    res = run_codemem(binary, "list_projects", {})
    projects = res.get("projects", [])
    available = [p.get("name", "") for p in projects]

    match = None
    if explicit:
        for p in projects:
            if p.get("name") == explicit:
                match = p
                break
        if match is None:
            raise CodememError(f"project {explicit!r} not indexed. Available: {available}")
    else:
        want = _norm(repo_root)
        for p in projects:
            if _norm(p.get("root_path", "")) == want:
                match = p
                break
        if match is None:
            raise CodememError(
                f"no indexed project matches repo root {repo_root!r}.\n"
                f"  looking for: {want}\n"
                f"  available:   {[(p.get('name'), p.get('root_path')) for p in projects]}\n"
                f"  run index_repository first, or pass --project."
            )

    name = match.get("name")
    if not name:
        raise CodememError(f"matched project has no name: {match!r}")

    nodes = _as_count(match.get("nodes"))
    edges = _as_count(match.get("edges"))

    if nodes is None or edges is None:
        if verbose:
            print("list_projects lacked usable counts; querying index_status",
                  file=sys.stderr)
        status = run_codemem(binary, "index_status", {"project": name})
        nodes = _as_count(status.get("nodes")) if nodes is None else nodes
        edges = _as_count(status.get("edges")) if edges is None else edges

    if nodes is None or edges is None:
        raise CodememError(
            f"could not read node/edge counts for project {name!r} "
            f"(nodes={match.get('nodes')!r}, edges={match.get('edges')!r}); "
            f"refusing to write garbage counts."
        )

    return name, nodes, edges


# --- Block construction ------------------------------------------------------

def build_block(project: str, nodes: int, edges: int) -> str:
    """Build the marker-delimited stats block (no trailing newline, no timestamps).

    Deterministic: identical inputs -> identical bytes, which is what makes the
    whole upsert idempotent.
    """
    lines = [
        MARKER_START,
        "## Code Intelligence (live graph stats)",
        "",
        f"Project `{project}` is indexed in codebase-memory-mcp: "
        f"**{nodes} nodes**, **{edges} edges**.",
        "",
        "Graph tools preferred over grep for structural queries.",
        MARKER_END,
    ]
    return "\n".join(lines)


# --- Marker-aware upsert -----------------------------------------------------

def upsert_block(path: str, block: str) -> "tuple[str, str]":
    """Compute the new CLAUDE.md content for `block`. Returns (action, new_content).

    Does NOT write; the caller decides whether to persist (see --dry-run). Files are
    read/written with newline='' so existing bytes (incl. CRLF) survive untranslated.
    """
    if not os.path.exists(path):
        return "create", block + "\n"

    with open(path, "r", encoding="utf-8", newline="") as fh:
        existing = fh.read()

    has_start = MARKER_START in existing
    has_end = MARKER_END in existing

    if has_start and has_end:
        start = existing.index(MARKER_START)
        end = existing.index(MARKER_END, start) + len(MARKER_END)
        if end <= start:
            raise CodememError(
                f"{path}: end marker precedes start marker; refusing to edit."
            )
        new_content = existing[:start] + block + existing[end:]
        return "replace", new_content

    if has_start or has_end:
        raise CodememError(
            f"{path}: found only one of the prism markers "
            f"({MARKER_START if has_start else MARKER_END}); "
            f"refusing to guess where the block belongs."
        )

    # No markers: append after a leading blank line, preserving existing bytes.
    if existing == "":
        return "append", block + "\n"
    sep = ("" if existing.endswith("\n") else "\n") + "\n"
    return "append", existing + sep + block + "\n"


# --- Main --------------------------------------------------------------------

def main(argv=None) -> int:
    ap = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    ap.add_argument("--project",
                    help="indexed project name (default: auto-detect from repo root)")
    ap.add_argument("--repo-root", default=os.getcwd(),
                    help="repo root (default: cwd)")
    ap.add_argument("--claude-md", default=None,
                    help="path to CLAUDE.md (default: <repo-root>/CLAUDE.md)")
    ap.add_argument("--codemem-bin",
                    default=os.environ.get("PRISM_CODEMEM_BIN", "codebase-memory-mcp"),
                    help="codebase-memory-mcp binary (default: on PATH)")
    ap.add_argument("--dry-run", action="store_true",
                    help="compute and print the resulting file, but do not write it")
    ap.add_argument("--verbose", action="store_true", help="progress to stderr")
    args = ap.parse_args(argv)

    claude_md = args.claude_md or os.path.join(args.repo_root, "CLAUDE.md")
    binary = args.codemem_bin

    try:
        project, nodes, edges = resolve_project_stats(
            binary, args.project, args.repo_root, args.verbose
        )
        if args.verbose:
            print(f"project: {project} ({nodes} nodes, {edges} edges)", file=sys.stderr)

        block = build_block(project, nodes, edges)
        action, new_content = upsert_block(claude_md, block)

        if args.dry_run:
            if args.verbose:
                print(f"[dry-run] would {action} {claude_md}", file=sys.stderr)
            sys.stdout.write(new_content)
            return 0

        with open(claude_md, "w", encoding="utf-8", newline="") as fh:
            fh.write(new_content)
    except CodememError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1
    except Exception as exc:  # last-resort net: never crash with a raw traceback
        print(f"error: {exc}", file=sys.stderr)
        return 1

    verb = {"create": "created", "append": "appended", "replace": "replaced"}[action]
    print(f"{verb} stats block in {claude_md}: "
          f"{nodes} nodes, {edges} edges (project {project})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
