#!/usr/bin/env python3
"""Extract tasks from a Prism plan markdown into a state.json skeleton.

Used by prism-subagent to avoid burning ~3000 tokens of LLM extraction per run.
Parses the standard Prism plan format:

    ### Task N: Title
    **Files:**
    - Create: path
    - Modify: path
    - [ ] **Step N: description**
        ...code/commands...

Output: a state.json skeleton at .prism/local/subagent/<plan-slug>/state.json
ready for the controller to review and adjust before dispatching the first
implementer.

Usage:
    python scripts/extract-tasks.py <plan-path> [--domain DOMAIN] [--force]

Exits non-zero if the plan format is unfamiliar — controller falls back to
LLM extraction in that case.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

# --- Constants ---------------------------------------------------------------

CONFIG_GLOBS = (".json", ".yaml", ".yml", ".toml", ".ini", ".env")
DOCS_GLOBS = (".md", ".mdx", ".txt", ".adoc", ".rst")
TEST_PATTERNS = (".test.", ".spec.", "/__tests__/", "/tests/")
SANDBOX_DIRS = ("prototypes/", "playground/", "experiments/", "sandbox/", ".prism/local/")
CONTRACT_PATTERNS = (".prism/shared/contracts/", "/api/", "/schemas/", "/contracts/")

R3F_HINTS = ("useFrame", "<Canvas>", "three", "@react-three", "drei", "shader", "GLB")
ELECTRON_HINTS = ("ipcMain", "BrowserWindow", "preload", "contextBridge", "electron", "ipcRenderer")
FULLSTACK_HINTS = ("apps/api", "apps/web", "trpc", "tRPC", "openapi", "graphql", "migration")

# --- Plan parsing ------------------------------------------------------------

TASK_HEADER = re.compile(r"^###\s+Task\s+(\d+|[A-Z]\d*)[\s:.\-—]+(.+?)\s*$")
FILES_HEADER = re.compile(r"^\*\*Files?:\*\*\s*$", re.IGNORECASE)
FILE_LINE = re.compile(r"^[-*]\s*(Create|Modify|Delete|Read)[:\s]+`?([^`\s]+)`?\s*$", re.IGNORECASE)
STEP_LINE = re.compile(r"^[-*]\s*\[[ x]\]\s*\*\*Step\s+\d+[:\s.\-]+(.+?)\*\*\s*$", re.IGNORECASE)
ACCEPTANCE_HEADER = re.compile(r"^\*\*Acceptance(?:\s+Criteria)?:\*\*\s*$", re.IGNORECASE)
SECTION_BREAK = re.compile(r"^(###|---)\s*")


def slugify(name: str) -> str:
    s = re.sub(r"[^\w\s-]", "", name.lower())
    return re.sub(r"[\s_]+", "-", s).strip("-")[:80]


def parse_plan(plan_path: Path) -> tuple[list[dict], list[str]]:
    """Return (tasks, warnings). Tasks is a list of task dicts in plan order."""
    text = plan_path.read_text(encoding="utf-8")
    lines = text.splitlines()
    tasks: list[dict] = []
    warnings: list[str] = []

    current: Optional[dict] = None
    state = "idle"  # idle | task | files | acceptance
    spec_buffer: list[str] = []

    for raw in lines:
        line = raw.rstrip()

        m = TASK_HEADER.match(line)
        if m:
            if current is not None:
                current["spec_text"] = "\n".join(spec_buffer).strip()
                tasks.append(current)
            tid = m.group(1)
            current = {
                "id": f"T{tid}" if tid.isdigit() else tid,
                "title": m.group(2).strip(),
                "spec_text": "",
                "acceptance": [],
                "files": [],
                "steps": [],
            }
            spec_buffer = []
            state = "task"
            continue

        if current is None:
            continue

        spec_buffer.append(raw)

        if FILES_HEADER.match(line):
            state = "files"
            continue
        if ACCEPTANCE_HEADER.match(line):
            state = "acceptance"
            continue

        if state == "files":
            fm = FILE_LINE.match(line)
            if fm:
                action = fm.group(1).lower()
                if action == "read":
                    continue
                current["files"].append({"path": fm.group(2), "action": action})
                continue
            if line and not line.startswith(("-", "*", " ", "\t")):
                state = "task"

        if state == "acceptance":
            if line.lstrip().startswith(("-", "*")) and "[ ]" not in line and "[x]" not in line:
                item = line.lstrip(" -*").strip()
                if item:
                    current["acceptance"].append(item)
                continue
            if line and not line.startswith(("-", "*", " ", "\t")):
                state = "task"

        sm = STEP_LINE.match(line)
        if sm:
            current["steps"].append(sm.group(1).strip())

    if current is not None:
        current["spec_text"] = "\n".join(spec_buffer).strip()
        tasks.append(current)

    if not tasks:
        warnings.append("No tasks found. Plan may not use the standard `### Task N:` header format.")

    return tasks, warnings


# --- Classification ----------------------------------------------------------

def classify_review(files: list[dict], title: str) -> tuple[str, str]:
    """Return (review_class, reason). Mirrors review-decision-matrix.md rules."""
    if not files:
        return "feature", "rule 9: default (no files declared)"

    paths = [f["path"] for f in files]
    title_lc = title.lower()

    if all(any(p.startswith(s) for s in SANDBOX_DIRS) for p in paths):
        return "experiment", "rule 1: all files under sandbox path"
    if all(any(c in p for c in CONTRACT_PATTERNS) for p in paths):
        return "contract", "rule 2: all files under contract paths"
    if all(any(t in p for t in TEST_PATTERNS) for p in paths):
        return "test-only", "rule 3: all files are tests"
    if all(p.endswith(CONFIG_GLOBS) for p in paths):
        return "config", "rule 4: all files are config"
    if all(p.endswith(DOCS_GLOBS) for p in paths):
        return "docs", "rule 5: all files are docs"
    if title_lc.startswith("revert"):
        return "revert", "rule 6: title starts with revert"
    if title_lc.startswith(("refactor", "rename")):
        return "refactor", "rule 7: title indicates refactor"
    if title_lc.startswith("fix") or re.match(r"^[a-z]+-\d+", title_lc):
        return "bugfix", "rule 8: title indicates bugfix"
    return "feature", "rule 9: default"


def detect_domain(plan_text: str, all_files: list[str]) -> str:
    """Auto-detect domain from plan content + file paths."""
    score = {"r3f": 0, "electron": 0, "fullstack": 0, "experiment": 0}
    text_lc = plan_text.lower()

    for hint in R3F_HINTS:
        if hint.lower() in text_lc:
            score["r3f"] += 1
    for hint in ELECTRON_HINTS:
        if hint.lower() in text_lc:
            score["electron"] += 1
    for hint in FULLSTACK_HINTS:
        if hint.lower() in text_lc:
            score["fullstack"] += 1

    for f in all_files:
        if any(f.startswith(s) for s in SANDBOX_DIRS):
            score["experiment"] += 1

    nonzero = [k for k, v in score.items() if v >= 2]
    if len(nonzero) > 1:
        return "mixed"
    if len(nonzero) == 1:
        return nonzero[0]
    return "fullstack"


def model_ladder_for(review_class: str) -> list[str]:
    if review_class in ("feature", "contract"):
        return ["sonnet", "opus", "opus"]
    if review_class == "experiment":
        return ["haiku", "haiku", "sonnet"]
    return ["sonnet", "opus", "opus"]


# --- Output ------------------------------------------------------------------

def build_state(plan_path: Path, tasks: list[dict], domain: str) -> dict:
    starting_sha = ""
    try:
        starting_sha = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            capture_output=True, text=True, timeout=5, check=False,
        ).stdout.strip()
    except (subprocess.SubprocessError, FileNotFoundError):
        pass

    enriched = []
    for t in tasks:
        review_class, reason = classify_review(t["files"], t["title"])
        ladder = model_ladder_for(review_class)
        enriched.append({
            "id": t["id"],
            "title": t["title"],
            "spec_text": t["spec_text"],
            "acceptance": t["acceptance"],
            "files": t["files"],
            "steps": t["steps"],
            "review_class": review_class,
            "review_class_reason": reason,
            "starting_model": ladder[0],
            "model_ladder": ladder,
            "implementer_model": None,
            "status": "pending",
            "retry_count": 0,
            "review_cycles": 0,
            "implementer_status": None,
            "spec_review_skipped": False,
            "quality_review_skipped": False,
            "concerns": [],
            "raised_issues": [],
            "clarifications": [],
            "caller_count": None,
            "commit_sha": None,
            "completed_at": None,
        })

    plan_slug = slugify(plan_path.stem)
    return {
        "version": 1,
        "plan_path": str(plan_path),
        "plan_slug": plan_slug,
        "started_at": datetime.now(timezone.utc).isoformat(),
        "last_updated": datetime.now(timezone.utc).isoformat(),
        "domain": domain,
        "sandbox_paths": list(SANDBOX_DIRS),
        "starting_sha": starting_sha,
        "current_task": enriched[0]["id"] if enriched else None,
        "consecutive_escalations": 0,
        "consecutive_blocks": 0,
        "tasks": enriched,
    }


def find_project_root() -> Path:
    current = Path.cwd()
    while current != current.parent:
        if (current / ".prism").is_dir():
            return current
        current = current.parent
    return Path.cwd()


def main() -> int:
    ap = argparse.ArgumentParser(description="Extract Prism plan tasks into state.json")
    ap.add_argument("plan", type=Path, help="Path to plan markdown file")
    ap.add_argument("--domain", choices=["r3f", "electron", "fullstack", "experiment", "mixed"],
                    help="Override auto-detected domain")
    ap.add_argument("--force", action="store_true", help="Overwrite existing state.json")
    ap.add_argument("--stdout", action="store_true", help="Print state.json to stdout instead of writing")
    args = ap.parse_args()

    plan_path = args.plan.resolve()
    if not plan_path.is_file():
        print(f"error: plan not found: {plan_path}", file=sys.stderr)
        return 2

    tasks, warnings = parse_plan(plan_path)
    if not tasks:
        for w in warnings:
            print(f"warning: {w}", file=sys.stderr)
        print("error: no tasks extracted; controller should fall back to LLM extraction", file=sys.stderr)
        return 3

    plan_text = plan_path.read_text(encoding="utf-8")
    all_files = [f["path"] for t in tasks for f in t["files"]]
    domain = args.domain or detect_domain(plan_text, all_files)

    state = build_state(plan_path, tasks, domain)

    if args.stdout:
        print(json.dumps(state, indent=2))
        return 0

    root = find_project_root()
    out_dir = root / ".prism" / "local" / "subagent" / state["plan_slug"]
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / "state.json"

    if out_path.exists() and not args.force:
        print(f"error: {out_path} already exists. Use --force to overwrite.", file=sys.stderr)
        return 4

    tmp = out_path.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(state, indent=2), encoding="utf-8")
    os.replace(tmp, out_path)

    summary = {
        "state_path": str(out_path.relative_to(root)),
        "plan_slug": state["plan_slug"],
        "domain": domain,
        "task_count": len(tasks),
        "review_classes": {t["id"]: t["review_class"] for t in state["tasks"]},
        "warnings": warnings,
    }
    print(json.dumps(summary, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
