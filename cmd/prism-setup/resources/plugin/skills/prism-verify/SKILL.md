---
name: prism-verify
description: Browser verification phase for visual validation. Use after implementation to verify UI renders correctly. Triggers on "verify the UI", "check the browser", "visual verification", "browser check".
model: sonnet
---

# Prism Verify

**Phase 3.5: Browser Verification** — confirm what was built actually renders correctly in a browser.

## Philosophy

"Agents that can see what they built."

Visual verification closes the loop between code generation and user experience. An AI that can capture a screenshot of its own output can catch rendering failures, broken layouts, and JavaScript errors that unit tests miss.

## Prerequisites

- Implementation complete (Phase 3)
- Project has a web UI
- Dev server command available in `package.json` (or URL provided directly)

## Available Agents

| Agent | Model | Tools | Purpose |
|-------|-------|-------|---------|
| `browser-verifier` | Haiku | Bash | Execute playwright-cli commands and return structured JSON results |

Invoke via: `Task(subagent_type="browser-verifier")`

## Workflow

### 1. Check Dependency

```bash
which playwright-cli 2>/dev/null || npx @playwright/cli --version 2>/dev/null
```

If not installed:
- Warn: "playwright-cli not installed — skipping browser verification"
- Add note to progress: "Browser verification skipped: playwright-cli not installed"
- Continue to `/prism-validate` without failing

### 2. Detect Dev Server Command

Read `package.json` and check scripts in order:
1. `scripts.dev` → `npm run dev`
2. `scripts.start` → `npm start`
3. `scripts.serve` → `npm run serve`

If no package.json or no matching script:
- Ask user for the URL to verify

### 3. Start Dev Server

```bash
{dev-command} &
DEV_SERVER_PID=$!
```

Poll port until server responds (30 second timeout):
```bash
for i in $(seq 1 30); do curl -sf {url} > /dev/null && break; sleep 1; done
```

### 4. Wait for Readiness

Poll the target URL until it returns 200 or timeout:
- Timeout: 30 seconds
- Interval: 1 second
- On timeout: report failure, kill server, exit gracefully

### 5. Spawn browser-verifier Agent

```
Task(subagent_type="browser-verifier")
"Session: verify-{story-id or timestamp}
URL: {target-url}
Output path: .prism/local/verifications/{YYYY-MM-DD}-{context}/
Checks: screenshot, console-errors"
```

Collect the JSON verification result.

### 6. Write Results

Save to `.prism/local/verifications/{date}-{context}/verification-result.json`.

See [references/verification-template.md](references/verification-template.md) for the output schema.

### 7. Present Summary

Show the user a table of check results with pass/fail status and artifact paths.

### 8. Cleanup

Always run cleanup, even on failure:

```bash
playwright-cli session-close verify-{session}
kill $DEV_SERVER_PID 2>/dev/null
```

## Output

Results are written to `.prism/local/verifications/{date}-{context}/`:

```
verification-result.json    — machine-readable results
screenshot.png              — captured page screenshot
verification-summary.md     — human-readable summary
```

See [references/verification-template.md](references/verification-template.md) for full schema.

See [references/verification-patterns.md](references/verification-patterns.md) for common recipes.

## Rules

1. **Headless by default** — only use `--headed` when debugging interactively
2. **Always cleanup** — close sessions and kill dev server in all exit paths
3. **Graceful skip** — if playwright-cli is not installed, warn and skip (never error)
4. **Store artifacts** in `.prism/local/` — gitignored, never committed
5. **Session naming** — `verify-{story-id}` or `verify-{timestamp}`
6. **Non-blocking failures** — verification failure is a signal, not a blocker (unless explicitly set as a hard gate)
