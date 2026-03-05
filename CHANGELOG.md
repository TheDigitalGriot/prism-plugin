# Changelog

All notable changes to Prism Plugin will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/).

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
