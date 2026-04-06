---
title: Plugin Directory Structure
description: The complete plugin directory tree — all commands, agents, skills, and scripts.
outline: [2, 3]
---

# Plugin Directory Structure

The complete plugin tree:

```
prism-plugin/                              # Repository root
├── .claude-plugin/
│   ├── plugin.json                        # Plugin manifest (8 lines)
│   └── marketplace.json                   # Distribution config (20 lines)
│
├── commands/                              # 25 slash commands (4,051 lines total)
│   ├── create_plan.md                     # 442 lines — opus
│   ├── research_codebase.md               # 179 lines — opus
│   ├── implement_plan.md                  #  85 lines — sonnet
│   ├── validate_plan.md                   # 167 lines — sonnet
│   ├── iterate_plan.md                    # 249 lines — opus
│   ├── decompose_plan.md                  # 334 lines — opus
│   ├── create_handoff.md                  #  78 lines — sonnet
│   ├── resume_handoff.md                  # 219 lines — sonnet
│   ├── commit.md                          #  44 lines — haiku
│   ├── describe_pr.md                     #  91 lines — sonnet
│   ├── retroactive.md                     #  80 lines — sonnet
│   ├── generate_prd.md                    # 196 lines — opus
│   ├── generate_pricing.md                # 228 lines — opus
│   ├── generate_tech_spec.md              # 252 lines — opus
│   ├── generate_user_flows.md             # 230 lines — opus
│   ├── prism-debug.md                     # 184 lines — sonnet
│   ├── prism-verify.md                    # 142 lines — sonnet
│   ├── prism-screenshot.md                #  54 lines — haiku
│   ├── prism-browse.md                    #  82 lines — sonnet
│   ├── prism_dir_update.md                # 145 lines — sonnet
│   ├── prism_cli.md                       #  93 lines — (none)
│   ├── cli-install.md                     # 132 lines — sonnet
│   ├── cli-uninstall.md                   # 150 lines — sonnet
│   ├── worktree.md                        #  90 lines — haiku
│   └── review-setup.md                    #  91 lines — haiku
│
├── agents/                                # 14 subagents (~1,750 lines total)
│   ├── codebase-locator.md                # 122 lines — haiku
│   ├── codebase-analyzer.md               # 143 lines — opus
│   ├── codebase-pattern-finder.md         # 227 lines — sonnet
│   ├── prism-locator.md                   # 134 lines — haiku
│   ├── prism-analyzer.md                  # 175 lines — opus
│   ├── web-search-researcher.md           # 108 lines — sonnet
│   ├── log-investigator.md                # 106 lines — haiku
│   ├── state-investigator.md              # 121 lines — haiku
│   ├── git-investigator.md                # 140 lines — haiku
│   ├── browser-verifier.md               #  92 lines — haiku
│   ├── graph-navigator.md                #  95 lines — haiku (knowledge graph queries)
│   ├── visual-regression-grader.md       # ~100 lines — sonnet
│   ├── spec-reviewer.md                  #  ~70 lines — sonnet (v3.0.1)
│   └── quality-reviewer.md              #  ~75 lines — sonnet (v3.0.1)
│
├── skills/                                # 14 auto-discovered skills (2,344 lines total)
│   ├── prism/
│   │   ├── SKILL.md                       # 276 lines — sonnet (master orchestrator)
│   │   ├── references/workflow-patterns.md
│   │   └── scripts/init_prism.py          # 178 lines
│   ├── prism-research/
│   │   ├── SKILL.md                       # 121 lines — sonnet
│   │   └── references/{exploration-patterns,research-template}.md
│   ├── prism-plan/
│   │   ├── SKILL.md                       # 126 lines — opus
│   │   └── references/plan-template.md
│   ├── prism-implement/SKILL.md           # 122 lines — sonnet
│   ├── prism-validate/
│   │   ├── SKILL.md                       # 108 lines — sonnet
│   │   └── references/validation-template.md
│   ├── prism-iterate/SKILL.md             # 103 lines — opus
│   ├── prism-spectrum/
│   │   ├── SKILL.md                       # 406 lines — sonnet (manifest-aware)
│   │   └── references/
│   │       ├── story-manifest-schema.md   # Per-requirement tracking schema
│   │       └── contracts-convention.md    # Cross-domain contract convention
│   ├── prism-debug/SKILL.md               # 221 lines — sonnet
│   ├── prism-verify/
│   │   ├── SKILL.md                       # 125 lines — sonnet
│   │   └── references/{verification-template,verification-patterns}.md
│   ├── prism-prd/SKILL.md                 # 122 lines — opus
│   ├── prism-visual-docs/SKILL.md         # 146 lines — opus
│   ├── prism-release/SKILL.md             # 245 lines — full release pipeline
│   ├── prism-eval/
│   │   ├── SKILL.md                       # 237 lines — sonnet (eval runner)
│   │   └── references/eval-schemas.md
│   ├── prism-docs-update/
│   │   ├── SKILL.md                       # 138 lines — VitePress docs syncer
│   │   └── references/section-mapping.md
│   ├── prism-brainstorm/
│   │   └── SKILL.md                       # ~120 lines — sonnet (ideation & exploration)
│   ├── prism-design/
│   │   └── SKILL.md                       # ~130 lines — opus (architecture & design)
│   └── prism-finish/
│       └── SKILL.md                       # ~110 lines — sonnet (cleanup & wrap-up)
│
├── scripts/                               # Automation scripts (979 lines total)
│   ├── spectrum.sh                        # 518 lines — autonomous execution loop
│   ├── prism-cli-install.sh               # 280 lines — cross-platform installer
│   └── prism-cli-install.ps1              # 181 lines — PowerShell installer
│
├── CLAUDE.md                              # 115 lines — architectural guidance
│
├── cmd/                                   # Platform implementations (Parts I–IV)
│   ├── prism-cli/                         # Go TUI dashboard
│   ├── prism-vscode/                      # VS Code extension
│   └── prism-electron/                    # Electron desktop app
│
├── packages/                              # Shared packages (Part IV)
│   ├── prism-core/                        # Platform-agnostic business logic
│   └── prism-ui/                          # Shared React components
│
└── .prism/                                # Workflow artifacts directory
    ├── stories/                           # stories.json + per-story manifests
    ├── shared/                            # Committed: research, plans, validation
    │   └── contracts/                     # Cross-domain interface contracts
    └── local/                             # Gitignored: per-developer artifacts
```
