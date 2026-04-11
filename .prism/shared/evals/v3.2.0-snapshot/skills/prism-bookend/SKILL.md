---
name: prism-bookend
description: Context-aware version bump and release workflow. Analyzes commits since last version, suggests semantic version increment, updates documentation snapshot, syncs VitePress site, and triggers release. Use when ready to finalize and ship a new version.
model: sonnet
---

# Prism Bookend

Finalize a release cycle with context-aware version bumping, documentation sync, and GitHub release.

**Workflow**: Analyze commits → Suggest version bump → Create docs snapshot → Update VERSION → Sync docs site → Create GitHub release.

## Prerequisites

- All implementation complete and committed
- VERSION file exists at project root
- PRISM-DOCUMENTATION-[current-version].md exists in `.prism/shared/docs/`
- `/prism-docs-update` and `/prism-release` skills available

## Step 1: Analyze Changes

Detect what changed since last version to suggest semantic bump:

```bash
# Get current version
CURRENT_VERSION=$(cat VERSION)

# Find last version tag (fallback to v prefix if needed)
LAST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "")

# If no tag, analyze commits since first commit or since a reasonable window
if [ -z "$LAST_TAG" ]; then
  COMMITS=$(git log --oneline | wc -l)
else
  COMMITS=$(git rev-list --count $LAST_TAG..HEAD)
fi

# Get commit types since version
git log --oneline --since="30 days ago" | grep -E "^.*feat|^.*fix|^.*BREAKING"
```

## Step 2: Suggest Version Bump

Based on commit analysis, suggest semantic version:

```markdown
## Version Bump Suggestion

**Current Version**: 3.0.3
**Last Version**: (from git tags or VERSION file)

### Changes Detected:
- **Features** (feat): 5 commits → suggests **minor bump**
  - new: brainstorm MCP channel (wake-on-click notifications)
  - new: griotwave theming + fidelity engine
  - new: two-pane drawer with live state updates
  - fix: skill graph (brainstorm → design)
  - fix: init infrastructure + encoding

**Suggested New Version**: 3.1.0

**Rationale**: 
- 3 new capabilities (channel, fidelity, drawer)
- 2 fixes (skill graph, encoding)
- No breaking changes
- Backward compatible

**Override?** (Type "3.2.0" to override, or "confirm" to proceed with 3.1.0)
```

Accept user input:
- If user confirms: use 3.1.0
- If user provides version: validate semver format (X.Y.Z), use that version
- Default to suggested version if ambiguous

## Step 3: Create Documentation Snapshot

Before version bump, archive current docs as [old-version]:

```bash
# Copy current PRISM-DOCUMENTATION file (e.g., 3.0.3) for safekeeping
cp .prism/shared/docs/PRISM-DOCUMENTATION-3.0.3.md .prism/shared/docs/PRISM-DOCUMENTATION-3.0.3.md.backup

# Confirm snapshot created
ls -lh .prism/shared/docs/PRISM-DOCUMENTATION-*.md
```

## Step 4: Update VERSION File

Bump the version:

```bash
echo "3.1.0" > VERSION
cat VERSION
```

## Step 5: Sync Documentation Site

Invoke `/prism-docs-update` to sync VitePress site from the docs file.

The skill will:
1. Detect the newest PRISM-DOCUMENTATION-[version].md file
2. Compare against current VitePress pages in `prism-docs/docs/`
3. Apply section changes to appropriate pages
4. Create new pages if sections don't map to existing files
5. Update VitePress config if needed

Present the plan to user before proceeding.

## Step 6: Create Release

Invoke `/prism-release` with the new version:

```bash
/prism-release --version=3.1.0 --notes="Brainstorm visual companion (channel, fidelity, drawer), skill graph correction, init infrastructure updates"
```

The skill will:
1. Create a git tag for the release
2. Build and package artifacts
3. Create GitHub release with auto-generated changelog
4. Upload VSIX and artifacts
5. Update marketplace listings if applicable

## Output

**Final State**:
- ✓ VERSION file updated
- ✓ PRISM-DOCUMENTATION snapshot preserved
- ✓ VitePress site synced with current docs
- ✓ GitHub release created with tags and artifacts
- ✓ Ready for distribution

## Rules

1. **Always suggest before bumping** — Show user the commit analysis and version bump suggestion first
2. **Preserve old docs** — Create snapshots of previous version documentation
3. **Context-aware** — If no version provided, analyze commits and suggest increment
4. **Validate semver** — Ensure new version follows semantic versioning (X.Y.Z)
5. **Chain workflows** — Explicitly invoke `/prism-docs-update` then `/prism-release` as sub-steps
6. **Stop at gates** — Get user approval before each major phase (version bump, docs sync, release)

## Semantic Version Guide

- **MAJOR** (X.0.0) — Breaking changes, incompatible API changes
- **MINOR** (3.Y.0) — New features, backward compatible
- **PATCH** (3.0.Z) — Bug fixes, backward compatible

Analyze commit types to decide:
- `feat:` → Minor bump candidate
- `fix:` → Patch bump candidate
- `BREAKING CHANGE:` → Major bump
- Multiple features (3+) without breaking changes → Minor bump
- Mixed fixes + features → Minor bump (features take priority)

## Notes

- If user provides explicit version via `--version=X.Y.Z` argument, skip analysis and use that version
- Documentation snapshots are kept for historical reference and rollback capability
- VitePress config updates (new pages, sidebar changes) require user approval
