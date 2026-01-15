#!/usr/bin/env python3
"""
Initialize Prism thoughts directory structure in a project.

Usage:
    python init_thoughts.py [path]

If path is not provided, initializes in current directory.
"""

import os
import sys
from pathlib import Path
from datetime import datetime


def init_thoughts(base_path: str = ".") -> None:
    """Create the thoughts directory structure for Prism workflow."""
    
    base = Path(base_path).resolve()
    
    # Directory structure
    directories = [
        "thoughts/shared/research",
        "thoughts/shared/plans",
        "thoughts/shared/validation",
        "thoughts/local",
    ]
    
    print(f"[*] Initializing Prism structure in: {base}")
    print()

    # Create directories
    for dir_path in directories:
        full_path = base / dir_path
        full_path.mkdir(parents=True, exist_ok=True)
        print(f"  [+] Created {dir_path}/")
    
    # Add thoughts/local to .gitignore if not already present
    gitignore_path = base / ".gitignore"
    gitignore_entry = "thoughts/local/"
    
    if gitignore_path.exists():
        content = gitignore_path.read_text()
        if gitignore_entry not in content:
            with open(gitignore_path, "a") as f:
                f.write(f"\n# Prism local thoughts (not committed)\n{gitignore_entry}\n")
            print(f"  [+] Added {gitignore_entry} to .gitignore")
        else:
            print(f"  [-] {gitignore_entry} already in .gitignore")
    else:
        gitignore_path.write_text(f"# Prism local thoughts (not committed)\n{gitignore_entry}\n")
        print(f"  [+] Created .gitignore with {gitignore_entry}")
    
    # Create README in thoughts/shared
    readme_path = base / "thoughts/shared/README.md"
    if not readme_path.exists():
        readme_path.write_text("""# Shared Thoughts

This directory contains research, plans, and validation reports that are committed 
to the repository and shared with the team.

## Structure

```
thoughts/shared/
├── research/      # Codebase research (YYYY-MM-DD-topic.md)
├── plans/         # Implementation plans (YYYY-MM-DD-feature.md)
└── validation/    # Validation reports (YYYY-MM-DD-report.md)
```

## Naming Convention

Use ISO date prefix for chronological ordering:
- `2025-01-12-oauth-integration.md`
- `2025-01-13-api-refactor.md`

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
""")
        print("  [+] Created thoughts/shared/README.md")
    
    # Check for CLAUDE.md and offer to update
    claude_md_path = base / "CLAUDE.md"
    prism_section = """
## Prism Workflow

Use Prism for complex tasks:
- `/prism-research` - Map codebase, understand problem
- `/prism-plan` - Create phased implementation plan
- `/prism-implement` - Execute plan phase by phase
- `/prism-validate` - Verify against success criteria

Thoughts location:
- Research: `thoughts/shared/research/`
- Plans: `thoughts/shared/plans/`
- Validation: `thoughts/shared/validation/`
- Personal notes: `thoughts/local/`
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
    print("   thoughts/")
    print("   +-- shared/")
    print("   |   +-- research/    # Codebase research docs")
    print("   |   +-- plans/       # Implementation plans")
    print("   |   +-- validation/  # Validation reports")
    print("   +-- local/           # Personal notes (gitignored)")
    print()
    print("Next steps:")
    print("   1. Start with /prism-research for your first task")
    print("   2. Use specialized agents (codebase-locator, codebase-analyzer, etc.)")
    print("   3. Save findings to thoughts/shared/research/")


if __name__ == "__main__":
    path = sys.argv[1] if len(sys.argv) > 1 else "."
    init_thoughts(path)
