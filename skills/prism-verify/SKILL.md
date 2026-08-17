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
| `visual-regression-grader` | Sonnet | Read, Glob, Grep | Judge visual regression diffs — verdict: regression/intentional/inconclusive |

Invoke via: `Task(subagent_type="browser-verifier")` or `Task(subagent_type="visual-regression-grader")`

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

### 5.5. Visual Regression (if baselines exist)

After the browser-verifier agent returns, check for visual regression baselines:

```bash
ls .prism/shared/validation/baselines/{story-id}/*.png 2>/dev/null
```

If baselines exist for the current story/context:

1. For each baseline PNG in `.prism/shared/validation/baselines/{story-id}/`:
   ```bash
   bash scripts/visual-regression.sh {target-url} \
     .prism/shared/validation/baselines/{story-id} {baseline-name} \
     --viewport {viewport-from-filename}
   ```
2. Parse the JSON output from each run
3. If any diff exceeds threshold (`passed: false`), spawn the grader:
   ```
   Task(subagent_type="visual-regression-grader")
   "Diff JSON: {JSON output from visual-regression.sh}
   Diff image: {diff_path}
   Story: {story-id}, modifies: {files list}
   Plan criteria: {manual verification criteria if available}"
   ```
4. Include visual regression results in the verification output (see `verification-template.md` for schema)

If no baselines exist, skip silently — visual regression is optional.

See [references/visual-regression-patterns.md](references/visual-regression-patterns.md) for threshold tuning, multi-viewport strategies, and baseline management.

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
