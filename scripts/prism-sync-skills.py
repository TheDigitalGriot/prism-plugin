#!/usr/bin/env python3
"""prism-sync-skills.py - generate community SKILL.md files from the codebase-memory-mcp graph.

Reads the real code graph out of `codebase-memory-mcp` (the Go MCP server that already
indexes this repo), detects communities of related symbols, and writes one
`skills/generated/<kebab-cluster>/SKILL.md` per community with >= N symbols.

WHY THE CLI, NOT AN MCP CALL
----------------------------
A standalone script cannot call MCP tools (those are only reachable from an agent).
codebase-memory-mcp ships a synchronous CLI that runs a single tool and prints JSON:

    codebase-memory-mcp cli <tool> '<json-args>'

That is the supported scriptable path. This script uses:
  * list_projects  -> map the current repo root to its indexed project name
  * query_graph    -> pull symbol nodes (per label) and relationship edges (per type)

codebase-memory-mcp does NOT expose its internal community detection (cbm_louvain) through
any CLI/query/DB surface, and stores no community id on nodes. So communities are DERIVED
here, from the real nodes+edges, with deterministic label propagation seeded by module
locality — the same "enumerate communities via query_graph" approach the plan calls for.

The output is 100% regenerable: re-running against an unchanged index produces byte-identical
files (no timestamps, everything sorted), so it is safe to run on every reindex.

Usage:
    python scripts/prism-sync-skills.py [--project NAME] [--repo-root DIR]
        [--output-dir DIR] [--min-symbols N] [--codemem-bin PATH]
        [--seed-by dir|id] [--dry-run] [--verbose]

Requires: Python 3.8+, the `codebase-memory-mcp` binary on PATH (or --codemem-bin),
and the repo already indexed (run index_repository once if not).
"""
from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
from collections import Counter, defaultdict

# --- Graph model constants ---------------------------------------------------

# Node labels that represent a "symbol" worth documenting.
SYMBOL_LABELS = ["Function", "Method", "Class", "Interface", "Type", "Enum"]

# Edge types (among symbols) that signal a real relationship, with cohesion weights.
# Only edges whose *both* endpoints are symbols are used.
EDGE_WEIGHTS = {
    "DEFINES_METHOD": 3,       # a class and its methods belong together
    "CALLS": 3,                # direct call coupling
    "USAGE": 2,                # references / uses
    "SIMILAR_TO": 2,           # structural similarity
    "SEMANTICALLY_RELATED": 2, # semantic similarity
    "TESTS": 1,                # test <-> subject
}

# Directed edge types used to score "entry point" prominence (most-referenced first).
IN_DEGREE_EDGES = {"CALLS", "USAGE"}

# File-path fragments that mark vendored / build / minified code we never document.
VENDOR_MARKERS = (
    "/build/", "/dist/", "/out/", "/.next/", "/.nuxt/", "/coverage/",
    "node_modules/", "/vendor/", "/webview-ui/build", "/target/", "/bin/",
    ".min.", ".bundle.", ".generated.",
    "/.prism/",          # Prism's own working data (research, plans, eval snapshots)
    "-snapshot/",        # versioned eval snapshots duplicate real code
)

MAX_ITERATIONS = 30          # label-propagation cap (converges well before this)
MAX_KEY_FILES = 15           # cap "Key Files" list length
MAX_ENTRY_POINTS = 8         # cap "Entry Points" list length
NAME_MAX_LEN = 55            # cap for the kebab skill/dir name

# Marker written into every generated file so we know it is ours (safe to wipe).
GENERATED_MARKER = "<!-- prism:generated-skill do-not-edit source=codebase-memory-mcp -->"


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
            capture_output=True, text=True, timeout=300,
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
            f"{tool}: no JSON on stdout (exit {proc.returncode}). stderr: {proc.stderr[-400:]}"
        )

    try:
        text = envelope["content"][0]["text"]
        result = json.loads(text)
    except (KeyError, IndexError, TypeError, json.JSONDecodeError) as exc:
        raise CodememError(f"{tool}: unexpected envelope shape: {envelope!r}") from exc

    if envelope.get("isError"):
        raise CodememError(f"{tool} returned an error: {result}")
    return result


def query_rows(binary: str, project: str, cypher: str) -> list:
    """Run a query_graph Cypher statement, returning its rows (list of lists)."""
    res = run_codemem(binary, "query_graph", {"project": project, "query": cypher})
    return res.get("rows", [])


# --- Project resolution ------------------------------------------------------

def resolve_project(binary: str, explicit: str | None, repo_root: str) -> str:
    """Return the indexed project name for repo_root, or the explicit override."""
    res = run_codemem(binary, "list_projects", {})
    projects = res.get("projects", [])
    available = [p.get("name", "") for p in projects]

    if explicit:
        if explicit in available:
            return explicit
        raise CodememError(
            f"project {explicit!r} not indexed. Available: {available}"
        )

    want = os.path.normcase(os.path.abspath(repo_root)).replace("\\", "/").rstrip("/")
    for p in projects:
        root = p.get("root_path", "")
        got = os.path.normcase(os.path.abspath(root)).replace("\\", "/").rstrip("/")
        if got == want:
            return p["name"]

    raise CodememError(
        f"no indexed project matches repo root {repo_root!r}.\n"
        f"  looking for: {want}\n"
        f"  available:   {[(p.get('name'), p.get('root_path')) for p in projects]}\n"
        f"  run index_repository first, or pass --project."
    )


# --- Graph loading -----------------------------------------------------------

def is_vendor(file_path: str) -> bool:
    fp = "/" + file_path.replace("\\", "/").lstrip("/")
    return any(marker in fp for marker in VENDOR_MARKERS)


_GOOD_NAME = re.compile(r"[A-Za-z_][A-Za-z0-9_]*")


def is_real_symbol_name(name: str) -> bool:
    """Reject minified / anonymous names like `$1`, `o1`, `w1`, ``."""
    if not name or len(name) < 3:
        return False
    m = _GOOD_NAME.fullmatch(name)
    return m is not None


def load_symbols(binary: str, project: str, verbose: bool) -> dict:
    """Return {qualified_name: {name, file_path, label}} for real, non-vendor symbols."""
    symbols: dict[str, dict] = {}
    for label in SYMBOL_LABELS:
        rows = query_rows(
            binary, project,
            f"MATCH (n:{label}) RETURN n.qualified_name, n.name, n.file_path",
        )
        kept = 0
        skipped = 0
        for row in rows:
            # Guard against an unexpected column count from query_graph so a shape
            # change surfaces as a clean skip, not a raw ValueError past main()'s handler.
            if not isinstance(row, (list, tuple)) or len(row) != 3:
                skipped += 1
                continue
            qn, name, fp = row
            if not qn or not fp or is_vendor(fp) or not is_real_symbol_name(name or ""):
                continue
            # First writer wins; qualified_name is unique per symbol.
            if qn not in symbols:
                symbols[qn] = {"name": name, "file_path": fp.replace("\\", "/"),
                               "label": label}
                kept += 1
        if verbose:
            note = f" ({skipped} malformed)" if skipped else ""
            print(f"  {label}: {len(rows)} rows -> {kept} kept{note}", file=sys.stderr)
    return symbols


def load_edges(binary: str, project: str, symbols: dict, verbose: bool):
    """Build undirected weighted adjacency + directed in-degree over symbol nodes.

    Returns (adjacency, in_degree):
      adjacency: {qn: {neighbor_qn: weight}}
      in_degree: Counter of incoming CALLS/USAGE references per qn
    """
    adjacency: dict[str, dict[str, int]] = defaultdict(dict)
    in_degree: Counter = Counter()
    for etype, weight in EDGE_WEIGHTS.items():
        rows = query_rows(
            binary, project,
            f"MATCH (a)-[r:{etype}]->(b) RETURN a.qualified_name, b.qualified_name",
        )
        used = 0
        for row in rows:
            # Same shape guard as load_symbols: tolerate an unexpected column count.
            if not isinstance(row, (list, tuple)) or len(row) != 2:
                continue
            a, b = row
            if a in symbols and b in symbols and a != b:
                adjacency[a][b] = adjacency[a].get(b, 0) + weight
                adjacency[b][a] = adjacency[b].get(a, 0) + weight
                if etype in IN_DEGREE_EDGES:
                    in_degree[b] += 1
                used += 1
        if verbose:
            print(f"  {etype}: {len(rows)} rows -> {used} intra-symbol edges",
                  file=sys.stderr)
    return adjacency, in_degree


# --- Community detection (deterministic label propagation) -------------------

def top_dir(file_path: str) -> str:
    """The directory containing a file, used as a locality seed."""
    d = os.path.dirname(file_path.replace("\\", "/"))
    return d or "."


def rollup_dir_seeds(symbols: dict, nodes: list, min_seed_mass: int) -> dict:
    """Seed each node by its directory, then merge small leaf dirs into their parent.

    A leaf directory with fewer than min_seed_mass symbols is rolled up to its parent
    directory, repeatedly, until every seed group is either large enough or has hit the
    repo root. This yields subsystem-level seeds instead of one-per-leaf-folder, so the
    resulting communities are coarser, fewer, and more navigable. Fully deterministic.
    """
    seed = {qn: top_dir(symbols[qn]["file_path"]) for qn in nodes}
    for _ in range(64):  # bounded; path depth is far below this
        counts = Counter(seed.values())
        changed = False
        for qn, d in seed.items():
            if counts[d] < min_seed_mass and "/" in d:
                seed[qn] = d.rsplit("/", 1)[0]
                changed = True
        if not changed:
            break
    return {qn: "dir:" + seed[qn] for qn in nodes}


def detect_communities(symbols: dict, adjacency: dict, seed_by: str,
                       min_seed_mass: int, verbose: bool) -> dict:
    """Deterministic label propagation. Returns {label: [qualified_name, ...]}.

    Determinism (=> idempotent output):
      * nodes are processed in sorted order every sweep,
      * a node adopts the neighbor label with the greatest summed edge weight,
        ties broken by the lexicographically smallest label,
      * iteration stops when a full sweep makes no change (or MAX_ITERATIONS).
    Seeding by directory ('dir') biases toward module-cohesive communities that only
    merge when call/usage coupling across directories dominates; 'id' is pure structure.
    """
    nodes = sorted(symbols.keys())
    if seed_by == "dir":
        label = rollup_dir_seeds(symbols, nodes, min_seed_mass)
    else:
        label = {qn: qn for qn in nodes}

    for sweep in range(MAX_ITERATIONS):
        changed = 0
        for qn in nodes:
            neigh = adjacency.get(qn)
            if not neigh:
                continue
            scores: dict[str, int] = defaultdict(int)
            for nb, w in neigh.items():
                scores[label[nb]] += w
            # pick max score, tie-break by smallest label string
            best = min(scores.items(), key=lambda kv: (-kv[1], kv[0]))[0]
            if best != label[qn]:
                label[qn] = best
                changed += 1
        if verbose:
            print(f"  LPA sweep {sweep + 1}: {changed} changes", file=sys.stderr)
        if changed == 0:
            break

    communities: dict[str, list] = defaultdict(list)
    for qn in nodes:
        communities[label[qn]].append(qn)
    return communities


# --- Naming & rendering ------------------------------------------------------

def kebab(text: str) -> str:
    """Lower-kebab a path/identifier, valid for a skill name: ^[a-z][a-z0-9]*(-[a-z0-9]+)*$."""
    # split camelCase and non-alphanumerics
    text = re.sub(r"([a-z0-9])([A-Z])", r"\1-\2", text)
    parts = re.split(r"[^A-Za-z0-9]+", text)
    slug = "-".join(p for p in parts if p).lower()
    slug = re.sub(r"-+", "-", slug).strip("-")
    if not slug:
        slug = "cluster"
    if not slug[0].isalpha():
        slug = "c-" + slug
    return slug[:NAME_MAX_LEN].rstrip("-")


def common_dir(paths: list) -> str:
    """Longest common directory prefix of a set of file paths."""
    dirs = [top_dir(p).split("/") for p in paths]
    if not dirs:
        return ""
    common = dirs[0]
    for d in dirs[1:]:
        i = 0
        while i < len(common) and i < len(d) and common[i] == d[i]:
            i += 1
        common = common[:i]
        if not common:
            break
    return "/".join(common)


# Path segments too generic to name a community on their own.
_GENERIC_SEGMENTS = {"", ".", "apps", "packages", "src", "lib", "pkg", "internal"}


def cluster_area(members: list, symbols: dict) -> str:
    """The directory that best identifies a community (for both naming and headings).

    Prefers the longest common directory, but if that collapses to something generic
    (spanning multiple apps -> "apps"), falls back to the community's modal directory,
    which is specific and descriptive.
    """
    paths = [symbols[qn]["file_path"] for qn in members]
    base = common_dir(paths)
    segments = [s for s in base.split("/") if s and s != "."]
    if not segments or all(s in _GENERIC_SEGMENTS for s in segments):
        base = Counter(top_dir(p) for p in paths).most_common(1)[0][0]
    return base


def cluster_name(members: list, symbols: dict) -> str:
    """Human-facing kebab name derived from where the community's code lives."""
    base = cluster_area(members, symbols)
    segments = [s for s in base.split("/") if s and s != "."]
    # keep the last few, most-specific, non-generic segments for readability
    specific = [s for s in segments if s not in _GENERIC_SEGMENTS] or segments
    tail = specific[-3:] if len(specific) > 3 else specific
    return kebab("-".join(tail) or base)


def describe(name: str, members: list, symbols: dict, area: str) -> str:
    """A 50-200 char description mentioning the area and what lives there."""
    kinds = Counter(symbols[qn]["label"].lower() for qn in members)
    kind_str = ", ".join(f"{c} {k}{'es' if k in ('class',) else 's' if c != 1 else ''}"
                         for k, c in kinds.most_common(3))
    desc = (f"Code community for the {area} area ({len(members)} symbols: {kind_str}). "
            f"Use when working on this subsystem's functions, types, or call paths.")
    if len(desc) < 50:
        desc = desc + " Auto-generated from the codebase-memory-mcp graph."
    return desc[:300]


def yaml_dq(value: str) -> str:
    """Emit `value` as a YAML double-quoted scalar (stdlib-only, no pyyaml).

    A plain (unquoted) scalar containing ``": "`` is parsed by YAML as a nested
    mapping, so descriptions like ``57 symbols: 27 functions`` break `safe_load`.
    Double-quoting fixes that: inside a double-quoted scalar a ``: `` is literal.
    Only ``\\`` and ``"`` need escaping for a single-line value.
    """
    escaped = value.replace("\\", "\\\\").replace('"', '\\"')
    return '"' + escaped + '"'


def render_skill(name: str, area: str, members: list, symbols: dict,
                 in_degree: Counter, adjacency: dict) -> str:
    """Render a full SKILL.md string (deterministic; no timestamps)."""
    members_sorted = sorted(members)
    files = sorted({symbols[qn]["file_path"] for qn in members_sorted})

    # Entry points: most-referenced symbols first (incoming CALLS/USAGE), with total
    # connectivity as a tie-breaker so type/interface-only clusters still rank sensibly;
    # final tie-break by qualified name for determinism.
    def degree(qn):
        return sum(adjacency.get(qn, {}).values())
    ranked = sorted(members_sorted, key=lambda qn: (-in_degree.get(qn, 0), -degree(qn), qn))
    entry = ranked[:MAX_ENTRY_POINTS]

    desc = describe(name, members, symbols, area)

    lines = []
    lines.append("---")
    lines.append(f"name: {yaml_dq(name)}")
    lines.append(f"description: {yaml_dq(desc)}")
    lines.append("---")
    lines.append("")
    lines.append(GENERATED_MARKER)
    lines.append("")
    lines.append(f"# {area}")
    lines.append("")
    lines.append(
        "Generated by `scripts/prism-sync-skills.py` from the codebase-memory-mcp graph. "
        "This documents a community of related symbols; regenerated on every reindex."
    )
    lines.append("")

    lines.append("## When to Use")
    lines.append("")
    lines.append(
        f"Use this skill when reading, modifying, or tracing the **{area}** subsystem "
        f"({len(members_sorted)} symbols across {len(files)} file"
        f"{'s' if len(files) != 1 else ''}). Before changing any symbol here, trace its "
        f"call path — the members are structurally coupled."
    )
    lines.append("")

    lines.append("## Key Files")
    lines.append("")
    for fp in files[:MAX_KEY_FILES]:
        count = sum(1 for qn in members_sorted if symbols[qn]["file_path"] == fp)
        lines.append(f"- `{fp}` — {count} symbol{'s' if count != 1 else ''}")
    if len(files) > MAX_KEY_FILES:
        lines.append(f"- …and {len(files) - MAX_KEY_FILES} more file(s)")
    lines.append("")

    lines.append("## Entry Points")
    lines.append("")
    lines.append("Most-referenced symbols in this community (likely public surface):")
    lines.append("")
    for qn in entry:
        s = symbols[qn]
        refs = in_degree.get(qn, 0)
        lines.append(f"- `{s['name']}` ({s['label']}) — `{s['file_path']}` "
                     f"[{refs} ref{'s' if refs != 1 else ''}]")
    lines.append("")

    return "\n".join(lines) + "\n"


# --- Output management -------------------------------------------------------

def is_generated_dir(path: str) -> bool:
    """True if every SKILL.md under path carries our generated marker (safe to wipe)."""
    if not os.path.isdir(path):
        return True  # nothing there yet
    for root, _dirs, files in os.walk(path):
        for f in files:
            if f == "SKILL.md":
                try:
                    with open(os.path.join(root, f), encoding="utf-8") as fh:
                        if GENERATED_MARKER not in fh.read():
                            return False
                except OSError:
                    return False
    return True


def write_outputs(output_dir: str, skills: dict, dry_run: bool) -> None:
    """Wipe the (generated-only) output dir and rewrite it. skills: {name: content}."""
    if os.path.isdir(output_dir) and not is_generated_dir(output_dir):
        raise CodememError(
            f"refusing to wipe {output_dir!r}: it contains non-generated SKILL.md files. "
            f"This directory is managed exclusively by prism-sync-skills.py."
        )
    if dry_run:
        return
    if os.path.isdir(output_dir):
        shutil.rmtree(output_dir)
    for name, content in skills.items():
        d = os.path.join(output_dir, name)
        os.makedirs(d, exist_ok=True)
        with open(os.path.join(d, "SKILL.md"), "w", encoding="utf-8", newline="\n") as fh:
            fh.write(content)


# --- Main --------------------------------------------------------------------

def build_skills(symbols, adjacency, in_degree, communities, min_symbols):
    """Turn communities into {kebab_name: skill_content}, resolving name collisions."""
    # Filter and order communities deterministically (largest first, then by name).
    qualifying = [(lbl, m) for lbl, m in communities.items() if len(m) >= min_symbols]
    qualifying.sort(key=lambda km: (-len(km[1]), sorted(km[1])[0]))

    used_names: dict[str, int] = {}
    skills: dict[str, str] = {}
    for _lbl, members in qualifying:
        base = cluster_name(members, symbols)
        area = cluster_area(members, symbols) or base
        name = base
        if name in used_names:
            used_names[name] += 1
            name = f"{base}-{used_names[base]}"[:NAME_MAX_LEN].rstrip("-")
        else:
            used_names[base] = 1
        skills[name] = render_skill(name, area, members, symbols, in_degree, adjacency)
    return skills


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--project", help="indexed project name (default: auto-detect from repo root)")
    ap.add_argument("--repo-root", default=os.getcwd(), help="repo root (default: cwd)")
    ap.add_argument("--output-dir", default=None,
                    help="output dir (default: <repo-root>/skills/generated)")
    ap.add_argument("--min-symbols", type=int, default=3,
                    help="minimum symbols per community (default: 3)")
    ap.add_argument("--codemem-bin",
                    default=os.environ.get("PRISM_CODEMEM_BIN", "codebase-memory-mcp"),
                    help="codebase-memory-mcp binary (default: on PATH)")
    ap.add_argument("--seed-by", choices=["dir", "id"], default="dir",
                    help="label-propagation seed: dir=module-cohesive (default), id=pure structure")
    ap.add_argument("--min-seed-mass", type=int, default=12,
                    help="roll small leaf dirs into parents until a seed has this many "
                         "symbols (dir seeding only; default: 12)")
    ap.add_argument("--dry-run", action="store_true", help="compute but do not write files")
    ap.add_argument("--verbose", action="store_true", help="progress to stderr")
    args = ap.parse_args(argv)

    output_dir = args.output_dir or os.path.join(args.repo_root, "skills", "generated")
    binary = args.codemem_bin

    try:
        project = resolve_project(binary, args.project, args.repo_root)
        if args.verbose:
            print(f"project: {project}", file=sys.stderr)

        symbols = load_symbols(binary, project, args.verbose)
        if not symbols:
            print("no real symbols found in index; nothing to generate.", file=sys.stderr)
            return 0
        adjacency, in_degree = load_edges(binary, project, symbols, args.verbose)
        communities = detect_communities(symbols, adjacency, args.seed_by,
                                          args.min_seed_mass, args.verbose)
        skills = build_skills(symbols, adjacency, in_degree, communities, args.min_symbols)

        if not skills:
            print(f"no community had >= {args.min_symbols} symbols; nothing generated.",
                  file=sys.stderr)
            return 0

        write_outputs(output_dir, skills, args.dry_run)
    except CodememError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1
    except Exception as exc:  # last-resort net: never crash with a raw traceback
        print(f"error: {exc}", file=sys.stderr)
        return 1

    verb = "would generate" if args.dry_run else "generated"
    rel = os.path.relpath(output_dir, args.repo_root)
    print(f"{verb} {len(skills)} skill(s) from {len(symbols)} symbols "
          f"into {rel}/ (project {project})")
    if args.verbose:
        for name in sorted(skills):
            print(f"  {name}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
