---
name: prism-init
description: Initialize the .prism/ directory structure in the current project. Creates shared folders for brainstorms, research, plans, validation, designs, assets, and more. Use when starting a new project with Prism or when the user says "init prism", "set up prism", "initialize prism", "create .prism folder".
model: haiku
---

# Prism Init

Initialize the `.prism/` directory structure for a new project.

## Steps

1. **Check if .prism/ already exists**

```bash
ls .prism/ 2>/dev/null
```

If `.prism/shared/` already exists, inform the user and ask if they want to re-run (which will fill in any missing directories without overwriting existing files).

2. **Run the init script**

```bash
python "${CLAUDE_PLUGIN_ROOT}/skills/prism/scripts/init_prism.py" .
```

3. **Report results** — Show the user which directories were created and any actions taken (gitignore update, CLAUDE.md update).

## What It Creates

```
.prism/
├── stories/              # Task definitions (stories.json)
├── shared/
│   ├── brainstorms/      # Brainstorm decision ledgers (YYYY-MM-DD-topic.md)
│   ├── research/         # Codebase research (YYYY-MM-DD-topic.md)
│   ├── plans/            # Implementation plans (YYYY-MM-DD-feature.md)
│   ├── validation/       # Validation reports + baselines + diffs
│   ├── handoffs/         # Session handoff documents
│   ├── prs/              # PR descriptions
│   ├── spectrum/         # Spectrum execution state (progress.md)
│   ├── contracts/        # Cross-domain interface contracts
│   ├── designs/          # Figma / Pencil.dev design files (.md sidecar + .pen)
│   ├── assets/           # AI-generated images, videos, 3D models
│   ├── ref/              # Reference materials
│   └── docs/             # Project documentation
└── local/                # Personal notes (gitignored)
```

## Rules

1. **Never overwrite existing files** — The script uses `exist_ok=True` and checks before writing
2. **Always run from the project root** — Pass `.` or the project path
3. **Report what happened** — Tell the user exactly which directories and files were created or skipped
