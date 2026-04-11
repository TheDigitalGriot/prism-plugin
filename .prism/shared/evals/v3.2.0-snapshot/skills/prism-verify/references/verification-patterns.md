# Verification Patterns

Common recipes for browser verification using playwright-cli.

## Common Recipes

### Single-Page Screenshot

The simplest check — capture the page and report:

```bash
SESSION="verify-$(date +%s)"
OUTPUT_DIR=".prism/local/verifications/$(date +%Y-%m-%d)-home/"
mkdir -p "$OUTPUT_DIR"

playwright-cli screenshot --session "$SESSION" http://localhost:3000 --name screenshot
playwright-cli session-close "$SESSION"
```

### Multi-Page Navigation Flow

Verify multiple pages in sequence:

```bash
SESSION="verify-$(date +%s)"
OUTPUT_DIR=".prism/local/verifications/$(date +%Y-%m-%d)-flow/"
mkdir -p "$OUTPUT_DIR"

playwright-cli screenshot --session "$SESSION" http://localhost:3000 --name home
playwright-cli screenshot --session "$SESSION" http://localhost:3000/about --name about
playwright-cli screenshot --session "$SESSION" http://localhost:3000/dashboard --name dashboard
playwright-cli session-close "$SESSION"
```

### Console Error Check

Check for JavaScript errors without a screenshot:

```bash
SESSION="verify-$(date +%s)"
playwright-cli console --session "$SESSION" http://localhost:3000
playwright-cli session-close "$SESSION"
```

Look for lines containing `error`, `Error`, `TypeError`, `ReferenceError` in the output.

### Form Submission Verification

Verify a form renders and can be submitted (read-only check):

```bash
SESSION="verify-$(date +%s)"
playwright-cli screenshot --session "$SESSION" http://localhost:3000/contact --name contact-form
playwright-cli snapshot --session "$SESSION" http://localhost:3000/contact
playwright-cli session-close "$SESSION"
```

The snapshot captures the DOM structure — compare across runs to detect regressions.

### Visual Regression Check

Compare a live page against a stored pixel baseline using `visual-regression.sh`:

```bash
# Run visual regression for a single page
bash scripts/visual-regression.sh http://localhost:5173 \
  .prism/shared/validation/baselines/STORY-001 homepage

# Multi-viewport regression check
bash scripts/visual-regression.sh http://localhost:5173 \
  .prism/shared/validation/baselines/STORY-001 homepage-desktop
bash scripts/visual-regression.sh http://localhost:5173 \
  .prism/shared/validation/baselines/STORY-001 homepage-mobile --viewport 375x812
```

The script outputs JSON to stdout:
```json
{
  "name": "homepage",
  "change_pct": 0.003,
  "threshold": 0.01,
  "passed": true,
  "new_baseline": false
}
```

**When to spawn the grader**: Only when `change_pct > threshold` (the script exits 1). Spawn the `visual-regression-grader` agent with the diff JSON, diff image path, and story context:

```
Task(subagent_type="visual-regression-grader")
"Diff JSON: {paste JSON output}
Diff image: {diff_path from JSON}
Story: {story ID}, modifies: {list of files}
Plan criteria: {manual verification criteria}"
```

**Updating baselines**: Delete the old baseline PNG, re-run the script. It creates a new baseline and exits 0 with `"new_baseline": true`.

See [visual-regression-patterns.md](visual-regression-patterns.md) for threshold tuning and multi-viewport strategies.

### Network Failure Detection

Check for failed API calls or missing resources:

```bash
SESSION="verify-$(date +%s)"
playwright-cli network --session "$SESSION" http://localhost:3000
playwright-cli session-close "$SESSION"
```

Look for 4xx/5xx responses or failed requests in the output.

## Dev Server Detection Patterns

### Next.js (default port 3000)

```json
{ "scripts": { "dev": "next dev" } }
```
→ Start: `npm run dev`, URL: `http://localhost:3000`

### Vite (default port 5173)

```json
{ "scripts": { "dev": "vite" } }
```
→ Start: `npm run dev`, URL: `http://localhost:5173`

### Create React App (default port 3000)

```json
{ "scripts": { "start": "react-scripts start" } }
```
→ Start: `npm start`, URL: `http://localhost:3000`

### SvelteKit (default port 5173)

```json
{ "scripts": { "dev": "vite dev" } }
```
→ Start: `npm run dev`, URL: `http://localhost:5173`

### Custom Port Detection

Extract port from script command:
```bash
cat package.json | grep -oE '"dev".*--port [0-9]+' | grep -oE '[0-9]+$'
```

If no port found, fall back to framework defaults above.

## Session Management Patterns

### Create and Use Session

```bash
SESSION="verify-$(date +%s)"
playwright-cli screenshot --session "$SESSION" {url} --name {name}
# ... more commands using same session ...
playwright-cli session-close "$SESSION"
```

### Always Cleanup (trap)

```bash
SESSION="verify-$(date +%s)"
cleanup() { playwright-cli session-close "$SESSION" 2>/dev/null; }
trap cleanup EXIT

# ... verification commands ...
```

### Kill All Sessions (emergency)

```bash
playwright-cli session-list
playwright-cli session-close {session-id}
```

## Playwright-CLI Command Cheatsheet

| Command | Purpose |
|---------|---------|
| `playwright-cli screenshot --session {s} {url} --name {n}` | Capture screenshot |
| `playwright-cli snapshot --session {s} {url}` | Capture DOM snapshot |
| `playwright-cli console --session {s} {url}` | Check console output |
| `playwright-cli network --session {s} {url}` | Check network requests |
| `playwright-cli open --headed --session {s} {url}` | Open headed browser |
| `playwright-cli navigate --session {s} {url}` | Navigate existing session |
| `playwright-cli session-close {s}` | Close browser session |
| `playwright-cli session-list` | List all active sessions |
| `playwright-cli --version` | Check version |

## Artifact Storage

All artifacts go in `.prism/local/verifications/` (gitignored):

```
.prism/local/verifications/
├── 2026-02-22-home/
│   ├── screenshot.png
│   └── verification-result.json
├── 2026-02-22-dashboard/
│   ├── screenshot.png
│   ├── console-output.txt
│   └── verification-result.json
└── browse-sessions/
    └── explore-1708620000.png
```

Convention: `{YYYY-MM-DD}-{context}/` where context is the story ID, feature name, or page name.
