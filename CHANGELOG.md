# Changelog

All notable changes to Prism Plugin will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/).

## [3.3.1] - 2026-06-03
### Fixed
- prism-spectrum: reverted from `opus[1m]` back to `sonnet[1m]` with rationale comment — spectrum is the outer-loop orchestrator, the agents it dispatches carry the deep reasoning load (Karpathy two-tier delegation pattern). Avoids paying opus premium on shepherding work.
- hook-validator schema: updated `validate-hook-schema.sh` to accept both flat (`{ "EventName": [...] }`) and nested (`{ "hooks": { "EventName": [...] } }`) root formats, matching Claude Code's actual behaviour. Also fixes empty-matcher false-positive (empty string `""` is valid — means "match all"), adds missing valid event types (`PostCompact`, `WorktreeCreate`, `WorktreeRemove`, `SubagentStart`), and guards `((counter++))` with `|| true` to prevent premature `set -e` exit on first-error.

## [3.3.0] - 2026-06-03

### Added
- `skills/cl-plugin-structure/` — cl-plugin-structure v0.7.2 bundled as a skill. Includes `references/model-config.md` (current Claude model line, effort levels, ultrathink, 1M context), `references/folder-architecture-routing.md` (Cliefnotes routing-table pattern), `references/token-optimization-research.md` (~51 KB: autoresearch, Attention Residuals, observational memory), `examples/` (3 plugin scaffolds), and `scripts/` (6 validator scripts).
- Routing table added to `CLAUDE.md` — maps 5 core task types to per-task file loads (addresses the "guess-what-to-read" context leak).
- `## Requirements` section added to `README.md` — documents Claude Code v2.1.154+ and Max/Team/Enterprise plan requirements.
- `ultrathink` keyword woven into `prism-brainstorm` (Step 4), `prism-iterate` (Step 2), and `prism-validate` (Iron Law) prompt bodies.
- 9 existing skills cross-linked to cl-plugin-structure references (folder-architecture-routing, component-patterns, hook-events, validators, token-optimization-research, examples, cowork-compatibility, model-config).

### Changed
- Opus pin updated: `claude-opus-4-6` → `claude-opus-4-8` in `apps/prism-vscode/src/core/api/claude-sdk.ts` and `skills/prism-eval/references/eval-schemas.md`.
- `effort: xhigh` added to 6 heavy-reasoning skills: `prism-brainstorm`, `prism-iterate`, `prism-plan`, `prism-prd`, `prism-design`, `prism-subagent`.
- `prism-spectrum` model changed `sonnet` → `opus[1m]` for autonomous multi-story execution with full 1M context window.
- Plugin version bumped 3.2.1 → 3.3.0 in `plugin.json` and `marketplace.json`.

### Notes
- After merging: run `/prism-release` to build VSIX, CLI binaries, and create the GitHub release tag v3.3.0.
- Do NOT run `/prism-bookend` — it re-analyzes and re-suggests a version bump, conflicting with the bump applied here.

## [2.4.1] - 2026-03-05

### Added
- Chat agent working
- Version display in VSCode panel StatusBar and Electron BottomStatusBar
- `prism-release` skill for automated version bumping across all version files

### Fixed
- Stale hardcoded version in CLI TUI footer (was v1.9.8)
- Stale version defaults in prism-core/prism-ui state (was 2.1.8)

## [2.0.0] - 2026-02-10

### Changed
- **BREAKING**: Renamed `ralph` namespace to `spectrum` across all skills, commands, agents, and scripts
- **BREAKING**: Migrated directory structure from `thoughts/` to `.prism/` with separated concerns
- **BREAKING**: Separated `stories.json` into `.prism/stories/` (task definitions) from execution state in `.prism/shared/spectrum/` (progress.md)
- Renamed `cmd/ralph-tui/` to `cmd/prism-cli/`
- Renamed `scripts/ralph.sh` to `scripts/spectrum.sh`
- Renamed `init_thoughts.py` to `init_prism.py`
- Renamed `thoughts-analyzer` agent to `prism-analyzer`
- Renamed `thoughts-locator` agent to `prism-locator`
- Updated all skill YAML frontmatter and cross-references
- Updated README with Spectrum branding and new directory structure
- Updated `.gitignore` for new build paths and prism-cli artifacts
- Updated GitHub workflow for prism-cli release builds

### Added
- `/prism-dir-update` command for migrating existing projects from `thoughts/` to `.prism/`
- Prism CLI with multi-screen dashboard, 3D prism rendering (FauxGL), spring physics animation (harmonica), 7 render views, story pagination, and demo mode
- `.prism/shared/ref/` and `.prism/shared/docs/` directories for reference materials and documentation
- `.prism/local/ref/` and `.prism/local/docs/` directories for personal (gitignored) artifacts

### Removed
- Legacy `thoughts/` directory structure
- All `ralph` naming from active codebase
