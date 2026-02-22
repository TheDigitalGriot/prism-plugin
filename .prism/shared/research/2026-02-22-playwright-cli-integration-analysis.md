---
date: 2026-02-22T00:00:00Z
researcher: Claude
repository: prism-plugin
branch: main
topic: "Playwright-CLI Deep Integration Analysis"
tags: [research, playwright, integration, verification, browser-testing, spectrum, prism-cli]
status: complete
last_updated: 2026-02-22
last_updated_by: Claude
---

# Playwright-CLI Deep Integration Analysis

## Research Question

How should Microsoft's `playwright-cli` be integrated into both the Prism Claude Plugin (skills/commands/agents) and the prism-cli Go TUI dashboard, and what is the recommended implementation approach?

---

## 1. Executive Summary

After analyzing the [Prism plugin architecture](../research/2026-02-22-prism-plugin-architecture.md), the [playwright-cli integration spec](../docs/playwrigth-cli.md), and the [playwright-cli reference copy](.prism/shared/ref/playwright-cli/), I recommend a **two-track integration** strategy:

**Track A — Claude Plugin Layer** (skills, commands, agents): Add a visual verification phase that slots into the existing Research → Plan → Implement → **Verify** → Validate pipeline. This gives Claude agents the ability to *see what they built*.

**Track B — Prism CLI TUI Layer** (Go dashboard): Add a Browser plugin tab alongside the existing 10 tabs, displaying live verification status, screenshot galleries, and session management. This gives *humans* visibility into what agents verified.

The two tracks share a common data model through `.prism/shared/spectrum/verifications/` artifacts.

### Key Findings

1. **The `deep-integrate` skill is available** as an installed Claude Code skill in the session environment — it should be invoked to drive the integration methodology
2. **The playwright-cli reference copy is comprehensive** — 50+ commands, 7 reference guides, session management, tracing, video
3. **Natural insertion point exists** between Implement (Phase 3) and Validate (Phase 4) — browser verification becomes a quality gate
4. **The Monitor plugin already models `QualityGate` structs** with status tracking — playwright results can extend this
5. **The `webapp-testing` skill exists in the user's environment** but is NOT part of the prism-plugin repo — it's a separate installed skill

---

## 2. Source Analysis: Playwright-CLI

### 2.1 Command Surface (50+ commands, 8 categories)

```
┌────────────────────── PLAYWRIGHT-CLI COMMAND SURFACE ──────────────────────┐
│                                                                             │
│  CORE (14)           NAVIGATION (3)      KEYBOARD (3)      MOUSE (5)       │
│  ──────────          ──────────────       ──────────        ─────────       │
│  open                go-back              type              click            │
│  goto                go-forward           press             hover            │
│  click               reload               selectAll         drag             │
│  fill                                                       mouseDown        │
│  drag                                                       mouseUp          │
│  hover               SAVE-AS (2)         TABS (5)                           │
│  select              ──────────           ──────────                         │
│  upload              screenshot           tab-new                            │
│  check               pdf                  tab-list                           │
│  uncheck                                  tab-select                         │
│  snapshot            STORAGE (8+)         tab-close                          │
│  eval                ──────────           tab-close-all                      │
│  dialog              state-save/load                                         │
│  resize              cookies-*            DEVTOOLS (5+)                      │
│                      localStorage-*       ──────────────                     │
│                      sessionStorage-*     console                            │
│                                           network                            │
│  SESSIONS (5)                             run-code                           │
│  ──────────                               tracing-start/stop                 │
│  -s / --session                           video-start/stop                   │
│  session-list                                                                │
│  session-close                                                               │
│  session-close-all                                                           │
│  kill-all                                                                    │
│                                                                             │
│  DEPENDENCY: @playwright/cli@latest (npm)                                   │
│  ENTRY: playwright-cli.js → require('playwright/lib/cli/client/program')    │
│  ALLOWED-TOOLS: Bash(playwright-cli:*)                                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Session Architecture

Playwright-cli uses named sessions (`-s flag` / `PLAYWRIGHT_CLI_SESSION` env var) for browser isolation:

- Each session = independent browser context (cookies, storage, auth state separate)
- Sessions persist across commands until explicitly closed
- Session commands: `session-list`, `session-close`, `session-close-all`, `kill-all`
- Sessions support persistent profiles (`--persistent --profile <dir>`)

### 2.3 Verification Primitives

| Primitive | Purpose | Prism Use Case |
|-----------|---------|----------------|
| `snapshot` | Accessibility tree + element refs | Assert element existence, structure verification |
| `screenshot` | Visual PNG capture | Visual regression, human review, artifact storage |
| `console` | Browser console messages | Runtime error detection post-implementation |
| `network` | Network request log | API call verification, broken resource detection |
| `tracing-start/stop` | Full execution trace | Debug failed verifications (DOM, screenshots, network, timing) |
| `video-start/stop` | Screen recording | Evidence capture for complex flow verification |
| `eval` | Execute JS in page | Custom assertions, state inspection |
| `run-code` | Execute Playwright code | Complex multi-step verification scenarios |

### 2.4 Plugin Structure Comparison

```
┌──────────── PLUGIN MANIFEST COMPARISON ────────────────────────┐
│                                                                  │
│  PLAYWRIGHT-CLI                    PRISM PLUGIN                  │
│  ──────────────                    ────────────                   │
│  .claude-plugin/                   .claude-plugin/               │
│    plugin.json                       plugin.json                 │
│    marketplace.json                  marketplace.json            │
│                                                                  │
│  Plugin JSON Fields:               Plugin JSON Fields:           │
│  {                                 {                              │
│    name: "playwright-cli"           name: "prism"                │
│    description: "..."               description: "..."           │
│    version: "0.0.1"                 version: "2.1.8"             │
│    author: { name: "MS" }           author: { name: "..." }     │
│  }                                 }                              │
│                                                                  │
│  DIFFERENCE: Playwright uses        Prism has no dependency      │
│  allowed-tools: Bash(playwright-*)  on external CLIs today       │
│                                                                  │
│  SKILL STRUCTURE:                                                │
│  Playwright: 1 skill + 7 refs      Prism: 10 skills + refs      │
│  Playwright: Flat command list      Prism: YAML frontmatter     │
│  Playwright: No model assignment    Prism: model: opus/sonnet   │
└──────────────────────────────────────────────────────────────────┘
```

---

## 3. Target Analysis: Integration Points in Prism

### 3.1 Workflow Insertion Point

The natural insertion point is between Phase 3 (Implement) and Phase 4 (Validate):

```
Current:   Research → Plan → Implement → Validate
                                  │
Proposed:  Research → Plan → Implement → VERIFY → Validate
                                           │
                              ┌─────────────┴──────────────┐
                              │  Browser Verification      │
                              │  • Dev server spin-up      │
                              │  • Screenshot capture      │
                              │  • Console error check     │
                              │  • Snapshot assertions     │
                              │  • Network verification    │
                              └────────────────────────────┘
```

However, verification can ALSO run as a quality gate within Spectrum:

```
┌─── Spectrum Story Execution ─────────────────────────────────────┐
│                                                                    │
│  1. Load story                                                     │
│  2. Implement code changes                                         │
│  3. Run existing quality gates (typecheck, lint, test)             │
│  4. NEW: Run browser verification gates (if story has UI files)   │
│  5. Commit if all gates pass                                       │
│  6. Update stories.json + progress.md                              │
│                                                                    │
│  On browser gate failure:                                          │
│  → Capture screenshot of failure state                             │
│  → Capture console errors                                          │
│  → Record in progress.md with visual evidence                      │
│  → <spectrum-retry reason="BROWSER_VERIFICATION_FAILED">          │
│  → Next session gets failure context + screenshot path             │
└────────────────────────────────────────────────────────────────────┘
```

### 3.2 Existing Quality Gate Infrastructure

The Monitor plugin ([plugin_monitor.go](cmd/prism-cli/app/plugin_monitor.go)) already defines:

```go
type QualityGate struct {
    Name    string
    Command string
    Status  string // "pass", "fail", "pending", "running", "unknown"
    LastRun time.Time
    Output  string
}
```

Browser verification results map directly to this structure:
- `Name`: "Browser: Homepage renders" / "Browser: No console errors"
- `Command`: `playwright-cli screenshot --session story-001 http://localhost:3000`
- `Status`: "pass" / "fail"
- `Output`: Screenshot path or error details

### 3.3 stories.json Extension

The `qualityGates` array in `plan` can be extended to include browser gates:

```json
{
  "plan": {
    "qualityGates": [
      "npm run typecheck",
      "npm run lint",
      "npm test",
      "playwright-cli screenshot http://localhost:3000 --name verify-homepage",
      "playwright-cli console http://localhost:3000 --no-errors"
    ]
  }
}
```

Or a separate `browserGates` array for UI-specific verification:

```json
{
  "plan": {
    "qualityGates": ["npm run typecheck", "npm run lint", "npm test"],
    "browserGates": [
      {
        "name": "Homepage renders correctly",
        "url": "http://localhost:3000",
        "checks": ["screenshot", "no-console-errors", "snapshot-has:[data-testid=app]"]
      }
    ]
  }
}
```

### 3.4 Event Bus Integration

The existing `plugin/events.go` defines `QualityGateResultEvent`. Browser verification results would publish through this same channel:

```
Spectrum Plugin → runs browser gate → publishes QualityGateResultEvent
Monitor Plugin → receives event → updates gate status display
Browser Plugin → receives event → updates screenshot gallery
```

---

## 4. Concept Mapping: Playwright → Prism

```
┌──────────────────── CONCEPT MAPPING ──────────────────────────────┐
│                                                                     │
│  PLAYWRIGHT-CLI              PRISM EQUIVALENT          RATIONALE   │
│  ──────────────              ────────────────           ──────────  │
│                                                                     │
│  Session (-s flag)     →     Story execution context               │
│                              PLAYWRIGHT_CLI_SESSION=story-{id}     │
│                              One session per story, cleanup on done │
│                                                                     │
│  Snapshot (a11y tree)  →     Verification checkpoint               │
│                              Assert structure after code generation │
│                              Store in verifications/ directory      │
│                                                                     │
│  Screenshot (PNG)      →     Visual artifact                       │
│                              Before/after comparison               │
│                              Feed back into agent context          │
│                              Store in verifications/{story-id}/    │
│                                                                     │
│  Console messages      →     Runtime diagnostics                   │
│                              Detect JS errors post-implementation  │
│                              Part of browser quality gate          │
│                                                                     │
│  Network log           →     API verification                      │
│                              Verify API calls succeed              │
│                              Detect 404s, 500s after code changes  │
│                                                                     │
│  --headed mode         →     Debug mode / human review             │
│                              When verification fails, show browser │
│                              For manual verification step          │
│                                                                     │
│  Tab management        →     Multi-page verification               │
│                              Test navigation flows across pages    │
│                              Verify routing after changes          │
│                                                                     │
│  Tracing               →     Execution recording                   │
│                              Debug failed verifications            │
│                              Store trace alongside screenshot      │
│                                                                     │
│  Video recording       →     Flow verification evidence            │
│                              Record multi-step user flows          │
│                              Attach to validation reports          │
│                                                                     │
│  Persistent profile    →     Project-level browser state           │
│                              Reuse auth across stories             │
│                              .prism/local/browser-profiles/        │
│                                                                     │
│  Storage state         →     Auth fixture                          │
│                              Save/restore login state              │
│                              Share across Spectrum iterations      │
│                                                                     │
│  run-code              →     Complex verification scenarios        │
│                              Multi-step flows, conditional checks  │
│                              Agent-authored verification scripts   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 5. Integration Recommendations

### 5.1 Track A: Claude Plugin Layer (Skills, Commands, Agents)

#### New Skill: `prism-verify` (Phase 3.5)

```
skills/prism-verify/
├── SKILL.md                          # Browser verification orchestrator
└── references/
    ├── verification-patterns.md      # Common verification recipes
    └── verification-template.md      # Output template for reports
```

**SKILL.md core behavior**:
- **Model**: Sonnet (balanced speed/capability for verification)
- **Triggers**: "verify the UI", "check the browser", "visual verification"
- **When invoked**: After implementation, before validate
- **Core loop**:
  1. Detect if project has a dev server command (from plan or package.json)
  2. Start dev server in background
  3. Wait for server ready (poll health endpoint or port)
  4. Open browser via `playwright-cli open --session story-{id} http://localhost:PORT`
  5. Run verification checks (screenshot, console, snapshot)
  6. Store artifacts in `.prism/shared/spectrum/verifications/{story-id}/`
  7. Generate verification summary
  8. Kill session on completion

#### New Commands (3)

| Command | Model | Purpose |
|---------|-------|---------|
| `/prism-verify` | Sonnet | Full verification workflow (dev server → browser → checks → report) |
| `/prism-screenshot` | Haiku | Quick screenshot capture of a URL with optional assertions |
| `/prism-browse` | Sonnet | Interactive browser session for exploration/debugging |

#### New Agent: `browser-verifier`

```
agents/browser-verifier.md
```

- **Model**: Haiku (fast, focused verification)
- **Tools**: Bash (playwright-cli commands)
- **Role**: Execute browser verification checks and return structured results
- **Spawned by**: prism-verify skill, prism-spectrum (on UI stories), prism-validate
- **Output format**: Structured JSON verification result

```json
{
  "storyId": "STORY-003",
  "url": "http://localhost:3000/login",
  "timestamp": "2026-02-22T14:30:00Z",
  "checks": [
    { "type": "screenshot", "status": "pass", "path": "verifications/STORY-003/screenshot-login.png" },
    { "type": "console", "status": "fail", "errors": ["Uncaught TypeError: Cannot read property 'user' of null"] },
    { "type": "snapshot", "status": "pass", "elementCount": 42 }
  ],
  "overallStatus": "fail",
  "failureReason": "Console errors detected"
}
```

#### Spectrum Integration

Add browser verification as an optional quality gate in the spectrum skill. Modify [prism-spectrum/SKILL.md](skills/prism-spectrum/SKILL.md) Section 6 (Quality Gates):

```markdown
### 6b. Browser Verification (if applicable)

If the story modified UI files (.tsx, .jsx, .vue, .svelte, .html, .css):

1. Check if a dev server command exists in plan.qualityGates or package.json
2. Start dev server: `npm run dev &` (or detected command)
3. Wait for server: poll until responding
4. Run browser verification:
   ```bash
   playwright-cli screenshot --session story-{id} http://localhost:PORT --name verify
   playwright-cli console --session story-{id} http://localhost:PORT
   ```
5. Check results:
   - No console errors → PASS
   - Screenshot captured → store as artifact
   - Elements present (if assertions defined) → PASS/FAIL
6. Kill dev server and browser session
7. On failure: treat as quality gate failure (same debug flow)
```

### 5.2 Track B: Prism CLI TUI Layer (Go Dashboard)

#### New Plugin: Browser (Tab 11)

```
cmd/prism-cli/app/plugin_browser.go    (~600-800 lines estimated)
```

**Plugin ID**: `browser`
**Tab position**: After Monitor (tab 9), before Workspaces (tab 10)

```
┌──────── BROWSER PLUGIN LAYOUT ─────────────────────────────────┐
│                                                                  │
│  ┌── Active Sessions ───────────────────────────────────────┐   │
│  │ story-001  ● active   http://localhost:3000   chromium    │   │
│  │ story-002  ○ idle     http://localhost:3000/login         │   │
│  │                                                           │   │
│  │ [Enter] Open  [d] Delete  [k] Kill All  [r] Refresh      │   │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌── Verification History ──────────────────────────────────┐   │
│  │ STORY-003  ✓ screenshot  ✓ console  ✗ snapshot   14:23   │   │
│  │ STORY-002  ✓ screenshot  ✓ console  ✓ snapshot   14:01   │   │
│  │ STORY-001  ✓ screenshot  ✗ console  ✓ snapshot   13:45   │   │
│  │                                                           │   │
│  │ [Enter] View Details  [s] Screenshot  [t] Trace           │   │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌── Screenshot Preview (if terminal supports) ─────────────┐  │
│  │                                                           │   │
│  │  [Selected screenshot metadata and path]                  │   │
│  │  Path: .prism/shared/spectrum/verifications/STORY-003/    │   │
│  │  Size: 1920x1080  Captured: 2026-02-22T14:23:05Z         │   │
│  │                                                           │   │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                  │
│  Footer: [s]creenshot [c]onsole [n]etwork [t]race [v]ideo       │
└──────────────────────────────────────────────────────────────────┘
```

**Key behaviors**:
- Subscribes to `QualityGateResultEvent` on EventBus for live updates
- Watches `.prism/shared/spectrum/verifications/` via fsnotify for new artifacts
- Can trigger manual screenshots via key binding
- Shows session list from `playwright-cli session-list` output
- Integrates with Spectrum plugin via shared event types

#### New Event Types

Add to [plugin/events.go](cmd/prism-cli/plugin/events.go):

```go
// BrowserVerificationEvent fired when a browser check completes
type BrowserVerificationEvent struct {
    StoryID    string
    CheckType  string // "screenshot", "console", "snapshot", "network"
    Status     string // "pass", "fail"
    ArtifactPath string
    Details    string
}

func (e BrowserVerificationEvent) Type() string { return "browser.verification" }

// BrowserSessionEvent fired when browser sessions change
type BrowserSessionEvent struct {
    SessionID string
    Action    string // "created", "closed", "error"
}

func (e BrowserSessionEvent) Type() string { return "browser.session" }
```

#### Claude Runner Extension

Extend [claude/events.go](cmd/prism-cli/claude/events.go) `ExtractToolActivity()` to recognize playwright-cli commands:

```go
case "Bash":
    cmd := toolInput["command"].(string)
    if strings.Contains(cmd, "playwright-cli") {
        if strings.Contains(cmd, "screenshot") {
            return "Capturing: screenshot"
        } else if strings.Contains(cmd, "snapshot") {
            return "Verifying: page structure"
        } else if strings.Contains(cmd, "console") {
            return "Checking: console errors"
        }
        return "Browser: " + truncate(cmd, 40)
    }
```

#### Monitor Plugin Extension

Extend the existing `QualityGate` tracking in [plugin_monitor.go](cmd/prism-cli/app/plugin_monitor.go) to categorize browser gates separately:

```go
type QualityGate struct {
    Name     string
    Command  string
    Status   string
    LastRun  time.Time
    Output   string
    Category string // NEW: "build", "test", "lint", "browser"
}
```

---

## 6. Artifact Storage Schema

```
.prism/shared/spectrum/verifications/
├── STORY-001/
│   ├── screenshot-homepage.png
│   ├── screenshot-login.png
│   ├── snapshot-homepage.json        # Accessibility tree
│   ├── console-log.json              # Console messages
│   ├── network-log.json              # Network requests
│   ├── trace.zip                     # Playwright trace (on failure)
│   └── verification-result.json      # Structured result summary
├── STORY-002/
│   └── ...
└── summary.json                      # Aggregated verification status
```

**verification-result.json schema**:
```json
{
  "storyId": "STORY-001",
  "timestamp": "2026-02-22T14:30:00Z",
  "url": "http://localhost:3000",
  "session": "story-001",
  "checks": [
    {
      "type": "screenshot",
      "status": "pass",
      "artifact": "screenshot-homepage.png",
      "metadata": { "width": 1920, "height": 1080 }
    },
    {
      "type": "console",
      "status": "fail",
      "errors": [
        { "level": "error", "message": "...", "source": "...", "line": 42 }
      ]
    }
  ],
  "overallStatus": "fail",
  "duration": "3.2s"
}
```

---

## 7. Implementation Priority & Dependencies

```
┌──────────── IMPLEMENTATION ORDER ──────────────────────────────────┐
│                                                                      │
│  SLICE 1: Foundation (Priority 1-10)                                 │
│  ───────────────────────────────────                                 │
│  ☐ Create browser-verifier agent definition (agents/browser-verifier.md)
│  ☐ Create /prism-screenshot command (commands/prism-screenshot.md)   │
│  ☐ Create /prism-browse command (commands/prism-browse.md)           │
│  ☐ Create /prism-verify command (commands/prism-verify.md)           │
│  ☐ Create prism-verify skill (skills/prism-verify/SKILL.md)         │
│  ☐ Create verification-template.md reference                        │
│  ☐ Create verification-patterns.md reference                        │
│  ☐ Dependency check: @playwright/cli install detection              │
│                                                                      │
│  SLICE 2: Spectrum Integration (Priority 11-20)                      │
│  ──────────────────────────────────────────────                      │
│  ☐ Extend prism-spectrum SKILL.md with browser gate section         │
│  ☐ Define browserGates schema for stories.json                       │
│  ☐ Update decompose_plan to extract browser gates from plans         │
│  ☐ Add verification artifact storage logic                           │
│  ☐ Update progress.md format to include screenshot paths             │
│                                                                      │
│  SLICE 3: Prism-CLI Browser Plugin (Priority 21-30)                  │
│  ──────────────────────────────────────────────                      │
│  ☐ Create plugin_browser.go with Plugin interface                    │
│  ☐ Add BrowserVerificationEvent to events.go                         │
│  ☐ Register browser plugin in model.go NewModel()                    │
│  ☐ Implement session list view                                       │
│  ☐ Implement verification history view                               │
│  ☐ Add fsnotify watcher for verifications/ directory                 │
│                                                                      │
│  SLICE 4: Claude Runner Extensions (Priority 31-35)                  │
│  ─────────────────────────────────────────────                       │
│  ☐ Extend ExtractToolActivity() for playwright-cli commands          │
│  ☐ Extend OutputParser for browser verification phase detection      │
│  ☐ Add "Browser Verification" phase to phase detection heuristic     │
│                                                                      │
│  SLICE 5: Monitor Integration (Priority 36-40)                       │
│  ─────────────────────────────────────────                           │
│  ☐ Add Category field to QualityGate struct                          │
│  ☐ Render browser gates with distinct styling                        │
│  ☐ Subscribe to BrowserVerificationEvent on EventBus                 │
│                                                                      │
│  SLICE 6: Advanced (Priority 41-50)                                  │
│  ─────────────────────────                                           │
│  ☐ Tracing integration for failed verifications                      │
│  ☐ Network request monitoring                                        │
│  ☐ Video recording for flow verification                             │
│  ☐ Visual regression (screenshot diff between runs)                  │
│  ☐ PDF report generation from verification artifacts                 │
│                                                                      │
│  DEPENDENCY CHAIN:                                                   │
│  Slice 1 → Slice 2 → Slice 3 (parallel with Slice 4)               │
│                    → Slice 4 → Slice 5                               │
│                              → Slice 6                               │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 8. Risks & Considerations

### 8.1 Dependency Management

Playwright-cli requires `@playwright/cli` (npm) and downloads browser binaries (~400MB). This is a **heavy dependency** compared to Prism's current zero-dependency model.

**Mitigation**: Make browser verification opt-in:
- Check for `playwright-cli` binary before running browser gates
- Skip gracefully with a warning if not installed
- Add `/prism-verify-install` command for setup
- Document the install in README

### 8.2 Dev Server Lifecycle

Browser verification requires a running dev server. This creates complexity around:
- Detecting the correct dev server command
- Waiting for server readiness
- Cleaning up server processes after verification

**Mitigation**:
- Read `package.json` scripts for `dev`, `start`, or `serve` commands
- Use port polling with timeout (max 30s)
- Always cleanup in a `finally` block / defer
- Allow manual URL override in stories.json

### 8.3 Headless vs Headed

Spectrum runs headless (no user present). Headed mode only makes sense for manual `/prism-browse` usage.

**Mitigation**: Default to headless for all automated verification. Only use `--headed` when explicitly requested via `/prism-browse`.

### 8.4 Session Cleanup

Orphaned browser sessions consume memory. Spectrum iterations create one session per story.

**Mitigation**:
- Always `session-close` at end of verification
- Add `kill-all` as a safety net in spectrum.sh before starting
- Browser plugin shows active sessions with kill button

### 8.5 The `deep-integrate` Skill

The spec references a `deep-integrate` skill. This skill **exists as an installed Claude Code skill** available in the current session environment (not as a file in the prism-plugin repo). It provides the 3-phase methodology (Discovery → Decomposition → Layered Implementation) and 6-layer approach that the playwright-cli integration spec was written to follow. The integration implementation should invoke `/deep-integrate` to leverage this methodology directly.

---

## 9. Recommended Next Steps

1. **Invoke `/deep-integrate`** to follow the Discovery → Decomposition → Layered Implementation methodology for the playwright-cli integration
2. **Create a plan** using `/prism-plan` based on this research, focusing on Slices 1-2 first (Claude plugin layer)
3. **Start with the agent** (`browser-verifier.md`) — it's the atomic unit that everything else composes
4. **Validate with a real project** — test the verification loop on a project with a dev server before building the TUI plugin
5. **Defer Slice 6** (advanced features) until the core loop proves valuable

---

## 10. Open Questions for Planning Phase

1. Should `browserGates` be a separate array in stories.json or merged into `qualityGates`?
2. What dev server detection strategy: package.json parsing, plan metadata, or user-specified?
3. Should the Browser plugin (TUI) support inline screenshot preview via terminal graphics (Sixel/Kitty protocol)?
4. Should verification artifacts be gitignored or committed? (They're large binary files)
5. Is `@playwright/cli` the right dependency, or should we consider `@playwright/mcp` for MCP-native integration?
6. Should the `prism-verify` skill be a separate phase (Phase 3.5) or folded into `prism-validate` (Phase 4)?

---

## Code References

- Playwright-CLI reference: [.prism/shared/ref/playwright-cli/](.prism/shared/ref/playwright-cli/)
- Integration spec: [.prism/shared/docs/playwrigth-cli.md](../docs/playwrigth-cli.md)
- Plugin interface: [cmd/prism-cli/plugin/plugin.go](../../cmd/prism-cli/plugin/plugin.go)
- Event bus: [cmd/prism-cli/plugin/events.go](../../cmd/prism-cli/plugin/events.go)
- Monitor plugin (QualityGate model): [cmd/prism-cli/app/plugin_monitor.go](../../cmd/prism-cli/app/plugin_monitor.go)
- Spectrum skill: [skills/prism-spectrum/SKILL.md](../../skills/prism-spectrum/SKILL.md)
- Validate skill: [skills/prism-validate/SKILL.md](../../skills/prism-validate/SKILL.md)
- Claude runner: [cmd/prism-cli/claude/runner.go](../../cmd/prism-cli/claude/runner.go)
- Stream events: [cmd/prism-cli/claude/events.go](../../cmd/prism-cli/claude/events.go)
