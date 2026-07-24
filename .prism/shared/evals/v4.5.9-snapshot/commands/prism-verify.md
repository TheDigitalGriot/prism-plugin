---
description: Verify web application UI by starting dev server, running browser checks, and generating structured verification results
model: sonnet
---

# Verify UI

You are a UI verification orchestrator. Start the dev server, run browser checks via the `browser-verifier` agent, generate a structured report, and clean up.

## Initial Setup

### 1. Check playwright-cli

```bash
which playwright-cli 2>/dev/null || npx @playwright/cli --version 2>/dev/null
```

If not available:
> playwright-cli is not installed. Skipping browser verification.
> Install with: `npm install -g @playwright/cli@latest`
>
> To proceed without browser verification, use `/prism-validate` instead.

Exit gracefully — do not error.

### 2. Detect Dev Server Command

Read `package.json` to find the dev server:

```bash
cat package.json 2>/dev/null
```

Check scripts in priority order:
1. `scripts.dev` → `npm run dev`
2. `scripts.start` → `npm start`
3. `scripts.serve` → `npm run serve`

If no `package.json` exists or none of the above are present, ask the user:
> Which URL should I verify? (e.g. http://localhost:3000)

### 3. Determine Target URL

Default: `http://localhost:3000`

Override if:
- The dev command includes `--port N` → use port N
- Common framework defaults: Vite → 5173, SvelteKit → 5173, Next.js → 3000, CRA → 3000

## Verification Process

### Step 1: Start Dev Server

Run the dev server in the background:
```bash
{dev-command} &
DEV_SERVER_PID=$!
```

Poll until the server responds (max 30 seconds):
```bash
for i in $(seq 1 30); do
  curl -sf {url} > /dev/null 2>&1 && break
  sleep 1
done
```

If it doesn't respond in 30 seconds, kill the process and report:
> Dev server did not respond within 30 seconds. Verify it starts correctly with `{dev-command}`.

### Step 2: Run Verification Checks

Create the output directory:
```bash
mkdir -p .prism/local/verifications/{date}-{context}/
```

Spawn the `browser-verifier` agent with instructions:
- Session ID: `verify-{context}-{timestamp}`
- URL: `{target-url}`
- Checks to run: screenshot, console errors
- Output path: `.prism/local/verifications/{date}-{context}/`

Collect the JSON result from the agent.

### Step 2.5: Visual Regression (if baselines exist)

After the browser-verifier agent returns, check for visual regression baselines:

```bash
ls .prism/shared/validation/baselines/{story-id}/*.png 2>/dev/null
```

If baselines exist:
1. Run `scripts/visual-regression.sh` for each baseline against the live URL
2. If any diff exceeds threshold, spawn `visual-regression-grader` agent with the diff JSON and story context
3. Add visual regression results to the checks array in the verification report

If no baselines exist or `playwright-cli` is not installed, skip gracefully.

### Step 3: Generate Report

Write `verification-result.json` to `.prism/local/verifications/{date}-{context}/`:

```json
{
  "timestamp": "{ISO-8601}",
  "url": "{target-url}",
  "devCommand": "{dev-command}",
  "status": "pass" | "fail" | "partial",
  "checks": [...],
  "artifactDir": ".prism/local/verifications/{date}-{context}/"
}
```

Present a summary to the user:
```
## Verification Results

URL: http://localhost:3000
Status: ✓ PASS

Checks:
  ✓ screenshot → .prism/local/verifications/2026-02-22-home/screenshot.png
  ✓ console errors → No errors found

Report: .prism/local/verifications/2026-02-22-home/verification-result.json
```

### Step 4: Cleanup

Always cleanup, even on failure:

```bash
# Close browser session
playwright-cli session-close verify-{context}-{timestamp}

# Kill dev server
kill $DEV_SERVER_PID 2>/dev/null
```

## Important Guidelines

- **Always cleanup** — browser sessions and dev servers must be closed even if checks fail
- **Graceful degradation** — if playwright-cli is not installed, warn and skip (do not error)
- **Headless by default** — never use `--headed` in automated verification
- **Store artifacts** in `.prism/local/verifications/` (gitignored, never committed)

## Relationship to Other Commands

```
/prism-implement → /prism-verify → /prism-validate
```

- `/prism-implement` builds the feature
- `/prism-verify` confirms the UI renders correctly in a browser (this command)
- `/prism-validate` verifies the full implementation against the plan's success criteria
