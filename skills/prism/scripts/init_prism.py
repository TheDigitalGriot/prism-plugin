#!/usr/bin/env python3
"""
Initialize Prism directory structure in a project.

Usage:
    python init_prism.py [path]

If path is not provided, initializes in current directory.
"""

import os
import sys
from pathlib import Path
from datetime import datetime


def init_prism(base_path: str = ".") -> None:
    """Create the .prism directory structure for Prism workflow."""

    base = Path(base_path).resolve()

    # Directory structure
    directories = [
        ".prism/stories",
        ".prism/shared/research",
        ".prism/shared/plans",
        ".prism/shared/validation",
        ".prism/shared/handoffs",
        ".prism/shared/prs",
        ".prism/shared/spectrum",
        ".prism/shared/ref",
        ".prism/shared/docs",
        ".prism/local/ref",
        ".prism/local/docs",
    ]

    print(f"[*] Initializing Prism structure in: {base}")
    print()

    # Create directories
    for dir_path in directories:
        full_path = base / dir_path
        full_path.mkdir(parents=True, exist_ok=True)
        print(f"  [+] Created {dir_path}/")

    # Add .prism/local to .gitignore if not already present
    gitignore_path = base / ".gitignore"
    gitignore_entry = ".prism/local/"

    if gitignore_path.exists():
        content = gitignore_path.read_text()
        if gitignore_entry not in content:
            with open(gitignore_path, "a") as f:
                f.write(f"\n# Prism local artifacts (not committed)\n{gitignore_entry}\n")
            print(f"  [+] Added {gitignore_entry} to .gitignore")
        else:
            print(f"  [-] {gitignore_entry} already in .gitignore")
    else:
        gitignore_path.write_text(f"# Prism local artifacts (not committed)\n{gitignore_entry}\n")
        print(f"  [+] Created .gitignore with {gitignore_entry}")

    # Create README in .prism/shared
    readme_path = base / ".prism/shared/README.md"
    if not readme_path.exists():
        readme_path.write_text("""# Shared Prism Artifacts

This directory contains research, plans, and validation reports that are committed
to the repository and shared with the team.

## Structure

```
.prism/
├── stories/           # Task definitions (stories.json)
├── shared/
│   ├── research/      # Codebase research (YYYY-MM-DD-topic.md)
│   ├── plans/         # Implementation plans (YYYY-MM-DD-feature.md)
│   ├── validation/    # Validation reports (YYYY-MM-DD-report.md)
│   ├── handoffs/      # Session handoff docs
│   ├── prs/           # PR descriptions
│   ├── spectrum/      # Spectrum execution state (progress.md)
│   ├── ref/           # Reference materials
│   └── docs/          # Project documentation
└── local/             # Personal notes (gitignored)
```

## Naming Convention

Use ISO date prefix for chronological ordering:
- `2026-02-10-oauth-integration.md`
- `2026-02-11-api-refactor.md`

## Prism Workflow

1. **Research Phase** -> Save findings to `research/`
2. **Plan Phase** -> Save implementation plan to `plans/`
3. **Implement Phase** -> Reference plan, update progress checkboxes
4. **Validate Phase** -> Save validation report to `validation/`

## Phase Commands

- `/prism-research` - Start research phase
- `/prism-plan` - Start planning phase
- `/prism-implement` - Start implementation phase
- `/prism-validate` - Start validation phase
- `/prism-spectrum` - Autonomous story execution
""")
        print("  [+] Created .prism/shared/README.md")

    # Check for CLAUDE.md and offer to update
    claude_md_path = base / "CLAUDE.md"
    prism_section = """
## Prism Workflow

Use Prism for complex tasks:
- `/prism-research` - Map codebase, understand problem
- `/prism-plan` - Create phased implementation plan
- `/prism-implement` - Execute plan phase by phase
- `/prism-validate` - Verify against success criteria
- `/prism-spectrum` - Autonomous multi-story execution

Prism locations:
- Stories: `.prism/stories/`
- Research: `.prism/shared/research/`
- Plans: `.prism/shared/plans/`
- Validation: `.prism/shared/validation/`
- Spectrum state: `.prism/shared/spectrum/`
- Personal notes: `.prism/local/`
"""

    if claude_md_path.exists():
        content = claude_md_path.read_text()
        if "Prism" not in content:
            with open(claude_md_path, "a") as f:
                f.write(prism_section)
            print("  [+] Added Prism section to CLAUDE.md")
        else:
            print("  [-] Prism section already in CLAUDE.md")
    else:
        # Create minimal CLAUDE.md
        claude_md_path.write_text(f"""# {base.name}

## Overview

[Brief description of the project]

{prism_section}
""")
        print("  [+] Created CLAUDE.md with Prism section")

    print()
    print("[OK] Prism structure initialized!")
    print()
    print("Directory structure:")
    print("   .prism/")
    print("   +-- stories/          # Task definitions (stories.json)")
    print("   +-- shared/")
    print("   |   +-- research/     # Codebase research docs")
    print("   |   +-- plans/        # Implementation plans")
    print("   |   +-- validation/   # Validation reports")
    print("   |   +-- spectrum/     # Execution state (progress.md)")
    print("   |   +-- ref/          # Reference materials")
    print("   |   +-- docs/         # Project documentation")
    print("   +-- local/            # Personal notes (gitignored)")
    print()
    print("Next steps:")
    print("   1. Start with /prism-research for your first task")
    print("   2. Use specialized agents (codebase-locator, codebase-analyzer, etc.)")
    print("   3. Save findings to .prism/shared/research/")


if __name__ == "__main__":
    path = sys.argv[1] if len(sys.argv) > 1 else "."
    init_prism(path)
