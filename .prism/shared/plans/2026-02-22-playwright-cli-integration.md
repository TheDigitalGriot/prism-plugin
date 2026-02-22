---
date: 2026-02-22
author: Claude
repository: prism-plugin
branch: main
ticket: N/A
status: draft
research: .prism/shared/research/2026-02-22-playwright-cli-integration-analysis.md
---

# Plan: Playwright-CLI Deep Integration

## Overview

**Goal**: Integrate Microsoft's `playwright-cli` as a first-class capability in the Prism plugin ecosystem — giving AI agents the ability to visually verify what they build (Track A: skills/commands/agents) and giving humans visibility into verification results (Track B: prism-cli TUI dashboard).

**Research**: [2026-02-22-playwright-cli-integration-analysis.md](../research/2026-02-22-playwright-cli-integration-analysis.md)

**Complexity**: High

**Estimated Phases**: 4

## Resolved Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Browser gates schema | Separate `browserGates` array in stories.json | Easier to skip when playwright-cli not installed |
| Dev server detection | package.json parsing (scripts.dev/start/serve) | Zero config for most projects |
| Verification artifacts | Gitignored in `.prism/local/verifications/` | Large binary files don't belong in git |
| Phase position | Own phase 3.5 (`prism-verify` skill) | Clean separation from validate |
| Target dependency | `@playwright/cli` (npm CLI) | Matches reference copy, Bash-based, token-efficient |
| TUI screenshot preview | Metadata only (path, dimensions, status) | Works in all terminals, ship faster |

## Success Criteria

### Automated (CI/Scripts)
- [ ] `cd cmd/prism-cli && make build` — CLI builds with new Browser plugin
- [ ] `cd cmd/prism-cli && make test` — All Go tests pass
- [ ] `cd cmd/prism-cli && make lint` — No lint errors
- [ ] All new `.md` files have valid YAML frontmatter (skills, commands, agents)
- [ ] `playwright-cli --version` graceful fallback — skill/commands work when binary absent (warn and skip)

### Manual Verification
- [ ] `/prism-screenshot http://localhost:3000` captures a PNG and reports the path
- [ ] `/prism-verify` starts dev server, runs browser checks, generates verification-result.json
- [ ] `/prism-browse` opens an interactive headed browser session
- [ ] Spectrum stories with UI files trigger browser verification as an optional gate
- [ ] Browser plugin tab appears in prism-cli TUI showing session list and verification history
- [ ] Monitor plugin shows browser quality gates with distinct category styling
- [ ] Claude runner log shows "Capturing: screenshot" when playwright-cli runs during Spectrum

## Phases

### Phase 1: Agent & Command Foundation (Claude Plugin Layer)

**Goal**: Create the atomic building blocks — one agent and three commands — that give Claude the ability to run playwright-cli operations within the Prism workflow.

**Files to create**:
| File | Purpose |
|------|---------|
| `agents/browser-verifier.md` | Haiku agent that executes playwright-cli commands and returns structured verification results |
| `commands/prism-screenshot.md` | Quick screenshot capture command (Haiku) |
| `commands/prism-browse.md` | Interactive headed browser session command (Sonnet) |
| `commands/prism-verify.md` | Full verification workflow command (Sonnet) |

**Steps**:

1. [ ] Create `agents/browser-verifier.md` with YAML frontmatter:
   - `name: browser-verifier`
   - `model: haiku`
   - `tools: Bash`
   - `description`: "Verify web application UI using playwright-cli. Use Task tool with subagent_type="browser-verifier" for browser screenshots, console error checks, snapshot assertions, and structured verification results."
   - Body: Role statement, dependency check instruction (`which playwright-cli || npx @playwright/cli --version`), core capabilities (screenshot, snapshot, console, network), output format (JSON verification result schema), rules (headless by default, always close session, capture artifacts to provided output path), "REMEMBER" closing
   - Follow pattern from `agents/codebase-locator.md` and `agents/web-search-researcher.md`

2. [ ] Create `commands/prism-screenshot.md`:
   - Frontmatter: `description: Capture browser screenshot of a URL with optional element assertions`, `model: haiku`
   - Body sections: `# Screenshot Capture`, role statement, `## Process:` (check playwright-cli installed, open URL with `--session screenshot-{timestamp}`, capture screenshot, optionally run snapshot for element assertions, close session, report path and metadata), `## Important:` (always headless, always close session, store in `.prism/local/verifications/`), `## Remember:`

3. [ ] Create `commands/prism-browse.md`:
   - Frontmatter: `description: Open interactive headed browser session for exploration and debugging`, `model: sonnet`
   - Body sections: `# Browser Session`, role statement, `## Initial Response` (with/without URL conditional), `## Process Steps` (`### Step 1: Setup` — check dependency, detect dev server from package.json if no URL given, `### Step 2: Open Browser` — `playwright-cli open --headed --session browse-{timestamp} URL`, `### Step 3: Interactive Loop` — user directs navigation/interaction/screenshots, `### Step 4: Cleanup` — close session), `## Important Notes:` (headed mode, session naming, cleanup), `## Quick Reference` (common playwright-cli commands)

4. [ ] Create `commands/prism-verify.md`:
   - Frontmatter: `description: Verify web application UI by starting dev server, running browser checks, and generating structured verification results`, `model: sonnet`
   - Body sections: `# Verify UI`, role statement, `## Initial Setup` (check playwright-cli, detect dev server command from package.json `scripts.dev || scripts.start || scripts.serve`, determine target URL), `## Verification Process` (`### Step 1: Start Dev Server` — run in background, poll port until ready with 30s timeout; `### Step 2: Run Verification Checks` — spawn `browser-verifier` agent with structured checks; `### Step 3: Generate Report` — write `verification-result.json` to `.prism/local/verifications/{context}/`; `### Step 4: Cleanup` — kill dev server process, close browser session), `## Important Guidelines` (always cleanup, graceful degradation, headless), `## Relationship to Other Commands` (`/prism-implement` → `/prism-verify` → `/prism-validate`)

**Verification**:
- All four `.md` files exist with valid YAML frontmatter
- Frontmatter `model` and `description` fields match conventions
- Agent `tools` field lists only `Bash`
- No syntax errors in markdown

**Checkpoint**: ⬜ Phase 1 complete

---

### Phase 2: Skill & Spectrum Integration

**Goal**: Create the `prism-verify` skill (Phase 3.5 orchestrator) and wire browser verification into the Spectrum autonomous execution loop as an optional quality gate.

**Files to create**:
| File | Purpose |
|------|---------|
| `skills/prism-verify/SKILL.md` | Phase 3.5 skill — browser verification orchestrator |
| `skills/prism-verify/references/verification-template.md` | Output template for verification reports |
| `skills/prism-verify/references/verification-patterns.md` | Common verification recipes |

**Files to modify**:
| File | Change |
|------|--------|
| `skills/prism-spectrum/SKILL.md` | Add Section 6b: browser verification gate after existing quality gates |
| `commands/decompose_plan.md` | Add `browserGates` extraction from plans (after line ~103) |
| `skills/prism/SKILL.md` | Add `prism-verify` to the hub skill's phase navigation |

**Steps**:

1. [ ] Create `skills/prism-verify/SKILL.md`:
   - Frontmatter: `name: prism-verify`, `description: Browser verification phase for visual validation. Use after implementation to verify UI renders correctly. Triggers on "verify the UI", "check the browser", "visual verification", "browser check".`, `model: sonnet`
   - `## Philosophy`: "Agents that can see what they built" — visual verification closes the loop between code generation and user experience
   - `## Prerequisites`: Implementation complete, project has a web UI, dev server available
   - `## Available Agents`: `browser-verifier` (Haiku, Bash)
   - `## Workflow`:
     1. Check dependency (`playwright-cli` installed)
     2. Detect dev server command from `package.json`
     3. Start dev server in background
     4. Wait for server readiness (port poll, 30s timeout)
     5. Spawn `browser-verifier` agent with check instructions
     6. Collect results → write to `.prism/local/verifications/{date}-{context}/`
     7. Present summary to user
     8. Cleanup (kill server, close session)
   - `## Output`: Link to `references/verification-template.md`
   - `## Rules`: Headless by default, always cleanup, graceful skip if no playwright-cli, store artifacts in `.prism/local/`, session naming `verify-{story-id}` or `verify-{timestamp}`

2. [ ] Create `skills/prism-verify/references/verification-template.md`:
   - Template for `verification-result.json` schema
   - Template for human-readable verification summary markdown
   - Examples: pass scenario, fail scenario (console errors), partial scenario (screenshot pass, console fail)

3. [ ] Create `skills/prism-verify/references/verification-patterns.md`:
   - Common recipes: single-page screenshot, multi-page navigation flow, form submission verification, console error check, network failure detection
   - Dev server detection patterns for common frameworks (Next.js, Vite, CRA, SvelteKit)
   - Session management patterns (create, use, cleanup)
   - Playwright-cli command cheatsheet (subset relevant to verification)

4. [ ] Modify `skills/prism-spectrum/SKILL.md` — add Section 6b after the existing Section 6 (Quality Gates, around line 128):
   ```markdown
   ### 6b. Browser Verification (if applicable)

   If the story modified UI files (.tsx, .jsx, .vue, .svelte, .html, .css):

   1. Check if `playwright-cli` is available: `which playwright-cli || npx @playwright/cli --version`
   2. If not available, skip with note in progress.md: "Browser verification skipped: playwright-cli not installed"
   3. Detect dev server command from `package.json` scripts (dev > start > serve)
   4. Start dev server in background, poll until responding (max 30s)
   5. Run browser verification:
      ```bash
      playwright-cli screenshot --session story-{id} http://localhost:PORT --name verify-{id}
      playwright-cli console --session story-{id} http://localhost:PORT
      ```
   6. Evaluate results:
      - No console errors → PASS
      - Screenshot captured → store in .prism/local/verifications/
      - On failure → treat as quality gate failure (same debug flow as Section 6)
   7. Close session: `playwright-cli session-close story-{id}`
   8. Kill dev server process
   ```

5. [ ] Modify `commands/decompose_plan.md` — add `browserGates` extraction after the `qualityGates` section (after line ~103):
   ```markdown
   ### 6b. Extract Browser Gates (if applicable)

   If the plan includes UI verification, visual testing, or browser-based success criteria, create a `browserGates` array:

   ```json
   "browserGates": [
     {
       "name": "Homepage renders correctly",
       "url": "http://localhost:3000",
       "checks": ["screenshot", "no-console-errors"]
     }
   ]
   ```

   Only include browserGates if the plan explicitly mentions UI verification. Do not add them for backend-only plans.
   ```

6. [ ] Modify `skills/prism/SKILL.md` — add `prism-verify` to the workflow navigation, inserting between implement and validate references

**Verification**:
- `skills/prism-verify/SKILL.md` has valid frontmatter with `model: sonnet`
- `skills/prism-verify/references/` contains both template and patterns files
- `prism-spectrum/SKILL.md` Section 6b exists and references playwright-cli
- `decompose_plan.md` includes `browserGates` extraction step

**Checkpoint**: ⬜ Phase 2 complete

---

### Phase 3: Prism CLI Browser Plugin (TUI Dashboard)

**Goal**: Create a Browser plugin tab in the prism-cli Go TUI dashboard showing active playwright sessions, verification history, and artifact metadata.

**Files to create**:
| File | Purpose |
|------|---------|
| `cmd/prism-cli/app/plugin_browser.go` | Browser plugin implementing the Plugin interface |

**Files to modify**:
| File | Change |
|------|--------|
| `cmd/prism-cli/plugin/events.go:175` | Add `BrowserVerificationEvent` and `BrowserSessionEvent` types (after line 175) |
| `cmd/prism-cli/app/model.go:231` | Add `browserPlugin := NewBrowserPlugin()` and register it (after monitorPlugin, before workspacesPlugin) |

**Steps**:

1. [ ] Add new event types to `cmd/prism-cli/plugin/events.go` after line 175:
   ```go
   // BrowserVerificationEvent is published when a browser verification check completes.
   // Browser and Monitor plugins subscribe to update their displays.
   type BrowserVerificationEvent struct {
       StoryID      string
       CheckType    string // "screenshot", "console", "snapshot", "network"
       Status       string // "pass", "fail"
       ArtifactPath string
       Details      string
   }

   func (e BrowserVerificationEvent) Type() string { return "browser.verification" }

   // BrowserSessionEvent is published when a playwright browser session changes state.
   type BrowserSessionEvent struct {
       SessionID string
       Action    string // "created", "closed", "error"
   }

   func (e BrowserSessionEvent) Type() string { return "browser.session" }
   ```

2. [ ] Create `cmd/prism-cli/app/plugin_browser.go`:
   - Follow pattern from existing plugins (`plugin_monitor.go`, `plugin_research.go`)
   - Implement all 10 `Plugin` interface methods
   - Plugin ID: `"browser"`, Name: `"Browser"`, Icon: `"🌐"`
   - State struct: `BrowserPlugin` with fields for sessions list, verification history, selected row, focused panel, context
   - `Init()`: Store context, subscribe to `BrowserVerificationEvent` and `BrowserSessionEvent` on EventBus
   - `Start()`: Return command to scan `.prism/local/verifications/` for existing results
   - `Update()`: Handle `TickMsg` (refresh session list periodically), `PluginResizeMsg`, `BrowserVerificationEvent`, key messages
   - `View()`: Three-panel layout:
     - Top: Active Sessions panel (session ID, status, URL, browser type)
     - Middle: Verification History panel (story ID, check results with pass/fail icons, timestamp)
     - Bottom: Selected Artifact Metadata panel (file path, dimensions, capture time)
   - Key bindings: `Enter` (view details), `d` (delete session), `k` (kill all sessions), `r` (refresh), `s` (take screenshot)
   - `KeyHints()`: Return key hint array matching the bindings

3. [ ] Register browser plugin in `cmd/prism-cli/app/model.go`:
   - After line 230 (`workspacesPlugin := NewWorkspacesPlugin()`), add: `browserPlugin := NewBrowserPlugin()`
   - After line 240 (`registry.Register(monitorPlugin)`), add: `registry.Register(browserPlugin)` (before workspacesPlugin to place it after Monitor in tab order)

**Verification**:
```bash
cd cmd/prism-cli && make build
cd cmd/prism-cli && make test
cd cmd/prism-cli && make lint
```

**Checkpoint**: ⬜ Phase 3 complete

---

### Phase 4: Claude Runner & Monitor Extensions

**Goal**: Extend the Claude runner to recognize playwright-cli activity in Spectrum logs, add browser verification phase detection, and extend the Monitor plugin to categorize browser quality gates.

**Files to modify**:
| File | Change |
|------|--------|
| `cmd/prism-cli/claude/events.go:127-135` | Add playwright-cli command detection inside the `case "Bash":` block of `formatToolUse()` |
| `cmd/prism-cli/claude/parser.go:164-171` | Add browser verification phase detection in `detectPhase()` |
| `cmd/prism-cli/app/plugin_monitor.go:29` | Add `Category` field to `QualityGate` struct |

**Steps**:

1. [ ] Extend `formatToolUse()` in `cmd/prism-cli/claude/events.go` — inside the `case "Bash":` block (line 127), add playwright-cli detection before the generic `cmd := truncate(...)` fallback:
   ```go
   case "Bash":
       if input.Command != "" {
           // Playwright-CLI activity detection
           if strings.Contains(input.Command, "playwright-cli") {
               switch {
               case strings.Contains(input.Command, "screenshot"):
                   return "Capturing: screenshot"
               case strings.Contains(input.Command, "snapshot"):
                   return "Verifying: page structure"
               case strings.Contains(input.Command, "console"):
                   return "Checking: console errors"
               case strings.Contains(input.Command, "network"):
                   return "Checking: network requests"
               case strings.Contains(input.Command, "open"):
                   return "Opening: browser"
               case strings.Contains(input.Command, "session-close"):
                   return "Closing: browser session"
               case strings.Contains(input.Command, "tracing"):
                   return "Recording: browser trace"
               default:
                   return "Browser: " + truncate(input.Command, 40)
               }
           }
           cmd := truncate(input.Command, 50)
           return "Running: " + cmd
       }
   ```

2. [ ] Extend `detectPhase()` in `cmd/prism-cli/claude/parser.go` — add browser verification phase detection before the "Quality Gates" block (before line 164):
   ```go
   // Browser verification phase indicators
   if strings.Contains(line, "playwright") ||
       strings.Contains(line, "browser verification") ||
       strings.Contains(line, "screenshot") ||
       strings.Contains(line, "capturing") ||
       strings.Contains(line, "console errors") {
       return "Browser Verification"
   }
   ```

3. [ ] Extend `QualityGate` struct in `cmd/prism-cli/app/plugin_monitor.go` at line 29 — add `Category` field:
   ```go
   type QualityGate struct {
       Name     string
       Command  string
       Status   string // "pass", "fail", "pending", "running", "unknown"
       LastRun  time.Time
       Output   string // Full command output
       Category string // "build", "test", "lint", "browser"
   }
   ```

4. [ ] Update Monitor plugin rendering to style browser gates distinctly — in the gate list rendering section, apply different accent color when `Category == "browser"` (use teal from the spectral gradient)

5. [ ] Subscribe Monitor plugin to `BrowserVerificationEvent` on EventBus in its `Init()` method — convert incoming events to `QualityGate` entries with `Category: "browser"`

**Verification**:
```bash
cd cmd/prism-cli && make build
cd cmd/prism-cli && make test
cd cmd/prism-cli && make lint
```

**Checkpoint**: ⬜ Phase 4 complete

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| playwright-cli not installed | High | Medium | Graceful skip with warning in every entry point (agent, commands, skill, spectrum gate) |
| Dev server fails to start | Medium | High | 30s timeout with clear error message; allow manual URL override |
| Orphaned browser sessions | Medium | Medium | Always `session-close` in cleanup; `kill-all` safety net in spectrum.sh |
| Port conflict (dev server) | Low | Medium | Detect port from package.json or use common ports (3000, 5173, 8080) |
| Large verification artifacts | Medium | Low | Gitignored in `.prism/local/`; periodic cleanup guidance |
| Browser plugin adds compile time | Low | Low | Single file addition, minimal new dependencies (no new Go modules) |

## Edge Cases

| Case | Handling |
|------|----------|
| No package.json in project | Skip dev server auto-detection; require explicit URL in command args |
| Dev server on non-standard port | Parse package.json scripts for `--port` flags; fall back to common ports |
| Headless not supported (CI container) | playwright-cli handles this internally; document Xvfb for Linux CI |
| Story has no UI files | Skip browser verification entirely in Spectrum (check file extensions) |
| Multiple dev servers in monorepo | Use the first matching script; allow override via `browserGates[].url` |
| playwright-cli version mismatch | Document minimum version; check `playwright-cli --version` output |

## Out of Scope

Explicitly excluded from this plan:
- [ ] Visual regression testing (screenshot diff between runs) — future Slice 6
- [ ] Video recording integration — future Slice 6
- [ ] Tracing for failed verifications — future Slice 6
- [ ] Network request monitoring/mocking — future Slice 6
- [ ] PDF report generation from verification artifacts — future Slice 6
- [ ] Terminal graphics (Sixel/Kitty) for screenshot preview in TUI — future enhancement
- [ ] MCP-native `@playwright/mcp` integration — different architecture, separate effort
- [ ] Electron app (`cmd/prism-electron/`) browser integration
- [ ] Test generation from browser interactions

## Rollback Plan

If critical issues arise:
```bash
git revert HEAD~N..HEAD
cd cmd/prism-cli && make build
```

Steps:
1. Revert commits from this feature branch
2. Rebuild prism-cli to remove Browser plugin
3. Plugin layer files (agents/, commands/, skills/) are additive — safe to remove individually

The integration is purely additive (new files + small modifications to existing files). No existing functionality is altered in a breaking way. The worst case is reverting the modifications to `prism-spectrum/SKILL.md`, `decompose_plan.md`, `events.go`, `parser.go`, `model.go`, and `plugin_monitor.go`.

## Dependencies

**Must complete first**:
- [ ] Phase 1 before Phase 2 (skill references agent and commands)
- [ ] Phase 2 before Phase 3 (TUI displays artifacts from the plugin layer)

**Can parallelize**:
- [ ] Phase 3 and Phase 4 (TUI plugin and runner extensions are independent)

**External dependency**:
- `@playwright/cli` (npm) — users install separately: `npm install -g @playwright/cli@latest`

## Progress Log

| Phase | Status | Started | Completed | Notes |
|-------|--------|---------|-----------|-------|
| Phase 1: Agent & Command Foundation | ⬜ Not started | | | |
| Phase 2: Skill & Spectrum Integration | ⬜ Not started | | | |
| Phase 3: Prism CLI Browser Plugin | ⬜ Not started | | | |
| Phase 4: Claude Runner & Monitor Extensions | ⬜ Not started | | | |

---

## Session Notes

[Space for implementation notes, discoveries, blockers]
