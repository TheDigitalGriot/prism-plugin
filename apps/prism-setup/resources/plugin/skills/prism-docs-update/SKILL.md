---
name: prism-docs-update
description: Update the VitePress documentation site (prism-docs/) from a versioned PRISM-DOCUMENTATION-[version].md file. Use when the user says "update prism docs", "sync docs site", "update documentation site", or references a new PRISM-DOCUMENTATION-*.md file that needs to be applied to the prism-docs/ VitePress pages. Triggers when a documentation .md file with the naming convention PRISM-DOCUMENTATION-[version-num].md is referenced for updating the prism-docs/ site.
---

# Prism Docs Update

Update the VitePress documentation site at `prism-docs/` from a monolithic documentation file.

## Context

The Prism project maintains documentation in two forms:
1. **Monolithic doc**: `.prism/shared/docs/PRISM-DOCUMENTATION-[version].md` — single file with all content
2. **VitePress site**: `prism-docs/docs/` — 69+ markdown pages organized by section

When the monolithic doc is updated, the VitePress pages must be synced. This skill automates that process.

## Prerequisites

- A source documentation file exists at `.prism/shared/docs/PRISM-DOCUMENTATION-[version].md`
- The `prism-docs/` VitePress site exists with its current structure

## Workflow

### Step 0: Identify Source File

If the user provides a specific file path, use it. Otherwise scan `.prism/shared/docs/` for the latest `PRISM-DOCUMENTATION-*.md` file:

```bash
ls -t .prism/shared/docs/PRISM-DOCUMENTATION-*.md | head -1
```

### Step 1: Read Section Mapping

Read `references/section-mapping.md` for the complete mapping of monolithic doc sections to VitePress page files.

### Step 2: Analyze Changes

Spawn parallel agents to compare the source doc sections against the current VitePress pages:

```
Agent(subagent_type="general-purpose", description="Compare doc sections to site pages")
```

For each section in the mapping:
1. Read the section from the source doc (using heading anchors and line ranges)
2. Read the corresponding VitePress page
3. Identify new content, changed content, and removed content

Use `Grep` to find section headings in the source doc:
```
Grep(pattern="^## |^### |^#### ", path="<source-doc>", output_mode="content")
```

### Step 3: Report Changes

Present a summary to the user before making changes:

```
## Documentation Update Summary

**Source**: PRISM-DOCUMENTATION-[version].md
**Target**: prism-docs/docs/

### Changes Detected:
- **New sections**: [list of new sections and target pages]
- **Updated sections**: [list of changed sections and target pages]
- **Removed sections**: [list of removed sections]

### Pages to update:
1. `cli/modals.md` — 3 new modal visuals
2. `cli/screens/spectrum.md` — 5 new state layouts
...

Proceed with updates?
```

Wait for user approval before proceeding.

### Step 4: Apply Updates

For each page that needs updating, use the appropriate tool:
- **New sections**: Use `Edit` to insert after the correct anchor point
- **Changed sections**: Use `Edit` to replace the old content with new
- **Complete rewrites**: Use `Write` only when >80% of the page content changes

Preserve VitePress frontmatter (`---` YAML block) at the top of each file.

Process pages in parallel where possible using agents:

```
Agent(subagent_type="general-purpose", description="Update [section-name] pages")
```

### Step 5: Handle New Pages

If the source doc contains sections that don't map to any existing VitePress page:

1. Create the new `.md` file in the appropriate directory
2. Add VitePress frontmatter (title, description, outline)
3. Update `prism-docs/docs/.vitepress/config.ts` to add the page to the sidebar navigation

### Step 6: Verify

After all updates:

1. Count headings in updated pages to confirm content was applied:
```bash
grep -c "^##\|^###\|^####" prism-docs/docs/cli/modals.md
```

2. Check line counts to verify growth matches expectations:
```bash
wc -l prism-docs/docs/cli/*.md prism-docs/docs/cli/screens/*.md
```

3. Report summary:
```
## Update Complete

**Pages updated**: N
**Lines added**: ~N
**New pages created**: N
**Config changes**: [yes/no]

Version: [extracted from source filename]
```

## Rules

1. ALWAYS read the section mapping reference before starting
2. ALWAYS present a change summary and get user approval before modifying files
3. NEVER modify VitePress config (`config.ts`) without explicit user approval
4. PRESERVE all VitePress frontmatter in existing pages
5. MATCH the existing page structure — insert new sections at logical positions relative to existing content
6. USE `Edit` for targeted changes, `Write` only for complete rewrites or new files
7. ASCII art code blocks must be preserved exactly — do not reformat or rewrap
8. Track progress with TodoWrite for updates spanning 5+ pages
