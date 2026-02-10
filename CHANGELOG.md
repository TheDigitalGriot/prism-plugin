# Changelog

All notable changes to Prism Plugin will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/).

## [2.0.0] - 2026-02-10

### Changed
- **BREAKING**: Renamed `ralph` namespace to `spectrum` across all skills, commands, agents, and scripts
- **BREAKING**: Migrated directory structure from `thoughts/` to `.prism/` with separated concerns
- **BREAKING**: Separated `stories.json` into `.prism/stories/` (task definitions) from execution state in `.prism/shared/spectrum/` (progress.md)
- Renamed `cmd/ralph-tui/` to `cmd/prism-tui/`
- Renamed `scripts/ralph.sh` to `scripts/spectrum.sh`
- Renamed `init_thoughts.py` to `init_prism.py`
- Renamed `thoughts-analyzer` agent to `prism-analyzer`
- Renamed `thoughts-locator` agent to `prism-locator`
- Updated all skill YAML frontmatter and cross-references
- Updated README with Spectrum branding and new directory structure
- Updated `.gitignore` for new build paths and prism-tui artifacts
- Updated GitHub workflow for prism-tui release builds

### Added
- `/prism-dir-update` command for migrating existing projects from `thoughts/` to `.prism/`
- Prism TUI with multi-screen dashboard, 3D prism rendering (FauxGL), spring physics animation (harmonica), 7 render views, story pagination, and demo mode
- `.prism/shared/ref/` and `.prism/shared/docs/` directories for reference materials and documentation
- `.prism/local/ref/` and `.prism/local/docs/` directories for personal (gitignored) artifacts

### Removed
- Legacy `thoughts/` directory structure
- All `ralph` naming from active codebase
