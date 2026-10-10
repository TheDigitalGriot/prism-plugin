---
description: Migrate existing projects from legacy thoughts/ directory to new .prism/ structure
model: sonnet
---

# Prism Directory Migration

Migrate a project from the legacy `thoughts/` directory structure to the new `.prism/` structure with separated stories and execution state.

## Process

### 1. Detect Legacy Structure

Check if the project has the old `thoughts/` directory:

```bash
ls thoughts/
ls thoughts/shared/ralph/
```

**If `thoughts/` does NOT exist**: Inform the user there's nothing to migrate and suggest running `init_prism.py` instead:
```
No legacy thoughts/ directory found. To initialize a fresh Prism structure, run:
  python skills/prism/scripts/init_prism.py
```
Stop here.

**If `thoughts/` exists**: Continue to step 2.

### 2. Preview Migration

Show the user what will be migrated before making any changes:

```
Legacy structure detected. Here's what will be migrated:

  thoughts/shared/ralph/stories.json  →  .prism/stories/stories.json
  thoughts/shared/ralph/progress.md   →  .prism/shared/spectrum/progress.md
  thoughts/shared/research/*          →  .prism/shared/research/
  thoughts/shared/plans/*             →  .prism/shared/plans/
  thoughts/shared/validation/*        →  .prism/shared/validation/
  thoughts/shared/handoffs/*          →  .prism/shared/handoffs/
  thoughts/shared/prs/*               →  .prism/shared/prs/
  thoughts/local/*                    →  .prism/local/
```

Only list entries that actually exist. Ask the user to confirm before proceeding.

### 3. Create New Structure

Run `init_prism.py` to create the full `.prism/` directory tree:

```bash
python skills/prism/scripts/init_prism.py
```

This creates:
```
.prism/
├── stories/
├── shared/
│   ├── research/
│   ├── plans/
│   ├── validation/
│   ├── handoffs/
│   ├── prs/
│   ├── spectrum/
│   ├── contracts/         # + seeds stories-contract.md (canonical stories.json schema + mapping rules)
│   ├── ref/
│   └── docs/
└── local/
    ├── ref/
    └── docs/
```

### 4. Copy Files

Copy files from old locations to new, preserving content:

**Stories (key separation)**:
- `thoughts/shared/ralph/stories.json` → `.prism/stories/stories.json`

**Execution state**:
- `thoughts/shared/ralph/progress.md` → `.prism/shared/spectrum/progress.md`

**Shared artifacts** (copy contents of each if the directory exists):
- `thoughts/shared/research/*` → `.prism/shared/research/`
- `thoughts/shared/plans/*` → `.prism/shared/plans/`
- `thoughts/shared/validation/*` → `.prism/shared/validation/`
- `thoughts/shared/handoffs/*` → `.prism/shared/handoffs/`
- `thoughts/shared/prs/*` → `.prism/shared/prs/`

**Local artifacts**:
- `thoughts/local/*` → `.prism/local/`

Skip any `.example` or `.template` files — they are obsolete.

### 5. Verify Migration

List the new `.prism/` structure and confirm files were copied:

```bash
find .prism/ -type f
```

Verify key files exist:
- `.prism/stories/stories.json` (if stories existed before)
- `.prism/shared/spectrum/progress.md` (if progress existed before)

### 6. Clean Up

Ask the user if they want to remove the old `thoughts/` directory:

```
Migration complete! Would you like to remove the old thoughts/ directory?
(It's safe to remove — all files have been copied to .prism/)
```

If confirmed:
```bash
rm -rf thoughts/
```

### 7. Summary

Report what was done:

```
Migration complete!

  Old: thoughts/shared/ralph/ (combined stories + progress)
  New: .prism/stories/          (task definitions — what to do)
       .prism/shared/spectrum/  (execution state — what happened)

Key change: stories.json is now separated from progress.md
for cleaner ownership and version control.

Next: Run your workflow commands as usual — they now use .prism/ paths.
```

## Guidelines

- **Always preview before migrating** — never move files without user confirmation
- **Skip missing directories** — only migrate what exists
- **Preserve file contents** — copy, don't transform file content
- **The key separation**: stories.json goes to `.prism/stories/`, NOT `.prism/shared/spectrum/`
