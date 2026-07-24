---
name: prism-docs-update
description: Update the VitePress documentation site (prism-docs/) from a versioned PRISM-DOCUMENTATION-[version].md file. Use when the user says "update prism docs", "sync docs site", "update documentation site", or references a new PRISM-DOCUMENTATION-*.md file that needs to be applied to the prism-docs/ VitePress pages. Triggers when a documentation .md file with the naming convention PRISM-DOCUMENTATION-[version-num].md is referenced for updating the prism-docs/ site.
model: sonnet
---

# Prism Docs Update

Update the VitePress documentation site at `prism-docs/` from a monolithic documentation file.

## Context

The Prism project maintains documentation in two forms:
1. **Per-release notes**: `.prism/shared/docs/PRISM-DOCUMENTATION-[version].md` — a SHORT summary of one
   release's changes (headline + what-changed), **not** a full monolithic doc.
2. **VitePress site**: `prism-docs/docs/` — ~97 markdown pages organized by product surface (`plugin/`,
   `cli/`, `vscode/`, `electron/`, `daemon/`, `monorepo/`, `eval/`).

**The sync is driven by the DELTA, not by the release-notes file alone.** A short release-notes summary
rarely maps 1:1 onto the pages, so syncing means: take the release-notes headline for *intent*, then
reconcile the actual **code/changelog delta since the site's last-synced version** against the pages that
document those surfaces — new skills → `plugin/skills.md`, new scripts → `plugin/scripts.md`, new
commands/agents → their reference pages, count changes → `plugin/statistics.md`, and so on.

> **Why the site drifts (read this).** Historically this step assumed a *monolithic* input that doesn't
> exist, so it was skipped at release time — leaving the site frozen at 4.3.0 while `config.ts` still
> declared 4.0.0 and the product shipped 4.5.9. Do **not** let that recur: run this at **every** release,
> reconcile from the delta, add/create pages as needed (Step 5), and **bump the site version (Step 6.5)**.

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

### Step 6.5: Bump the site version (required — the site drifts silently otherwise)

The VitePress site declares its **own** version in `prism-docs/docs/.vitepress/config.ts` (plus any
version constant, hero, or footer). This is NOT synced automatically and is exactly why the site once
declared `4.0.0` while the product shipped `4.5.9`. Update it to match root `VERSION`:

```bash
grep -rn "[0-9]\+\.[0-9]\+\.[0-9]\+" prism-docs/docs/.vitepress/config.ts   # find the current site version
```

Set every occurrence to `$(cat VERSION)`. If the version appears in a user-facing surface (homepage hero,
footer, a `themeConfig` field), update those too.

### Step 7: Update the root CHANGELOG (required — most-missed surface)

The VitePress site is **not** the only changelog surface. The root `CHANGELOG.md` (Keep a Changelog format) must also carry an entry for the version — it is not synced automatically and is the surface most often forgotten, so it is a required step here.

1. Read `CHANGELOG.md`. Check whether the top entry already matches the version from the source doc (`PRISM-DOCUMENTATION-[version].md` / `VERSION`).
2. If missing, **prepend** a new `## [version] - YYYY-MM-DD` section (below the header/intro, above the previous top entry) with `### Added` / `### Changed` / `### Fixed` subsections summarizing the cycle's user-facing changes. Mine them from `git log <last-tag>..HEAD --oneline` and the source doc's highlights.
3. Keep entries concise and user-facing; match the tone of existing entries and link the full account to `.prism/shared/docs/PRISM-DOCUMENTATION-[version].md`.
4. **Prepend only** — never rewrite or reflow prior entries.

### Step 8: Staleness self-check (catch silent drift)

Confirm the site is actually current, not just touched:

```bash
SITE_VER=$(grep -oE "[0-9]+\.[0-9]+\.[0-9]+" prism-docs/docs/.vitepress/config.ts | head -1)
echo "site declares $SITE_VER, releasing $(cat VERSION)"
# what plugin-surface changed since the site's last-synced version (most-drift-prone):
git log --oneline "v${SITE_VER}..HEAD" -- skills/ commands/ agents/ scripts/ 2>/dev/null | head -20
```

If the site lagged by more than the current release (prior releases were skipped), the `plugin/` pages
(`skills.md`, `scripts.md`, `commands.md`, `agents.md`, `statistics.md`) are the most likely stale
surface — reconcile the new/changed skills, scripts, commands, and agents before finishing. **Never let a
stale site pass as "synced"** — if you must defer bulk backlog, log it explicitly (e.g. in the handoff or
`/dgs-plan-update`), don't leave it silent.

## Rules

1. ALWAYS read the section mapping reference before starting
2. ALWAYS present a change summary and get user approval before modifying files
3. NEVER modify VitePress config (`config.ts`) without explicit user approval
4. PRESERVE all VitePress frontmatter in existing pages
5. MATCH the existing page structure — insert new sections at logical positions relative to existing content
6. USE `Edit` for targeted changes, `Write` only for complete rewrites or new files
7. ASCII art code blocks must be preserved exactly — do not reformat or rewrap
8. Track progress with TodoWrite for updates spanning 5+ pages
9. ALWAYS update the root `CHANGELOG.md` with a Keep-a-Changelog entry for the version (Step 7) — it is not synced automatically and is the surface most often forgotten
10. ALWAYS bump the site version in `.vitepress/config.ts` to match root `VERSION` (Step 6.5) — the site drifts silently otherwise (it once declared 4.0.0 at product 4.5.9)
11. DRIVE the sync from the code/changelog DELTA since the site's last-synced version, NOT from the release-notes file alone — a short release-notes summary does not map onto the ~97 pages, and assuming a monolithic input is why the site went stale in the first place
