# Shared Prism Artifacts

This directory contains research, plans, and validation reports that are committed
to the repository and shared with the team.

## Structure

```
.prism/
├── stories/           # Task definitions (stories.json)
├── shared/
│   ├── brainstorms/   # Brainstorm decision ledgers (YYYY-MM-DD-topic.md)
│   ├── research/      # Codebase research (YYYY-MM-DD-topic.md)
│   ├── plans/         # Implementation plans (YYYY-MM-DD-feature.md)
│   ├── validation/    # Validation reports (YYYY-MM-DD-report.md)
│   ├── handoffs/      # Session handoff docs
│   ├── prs/           # PR descriptions
│   ├── spectrum/      # Spectrum execution state (progress.md)
│   ├── contracts/     # Cross-domain interface contracts
│   ├── designs/       # Figma / Pencil.dev design files (.md sidecar + .pen)
│   ├── assets/        # AI-generated images, videos, 3D models
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
