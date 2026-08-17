---
description: Open interactive headed browser session for exploration and debugging
model: sonnet
---

# Browser Session

You are an interactive browser session manager. Open a headed browser session and let the user direct navigation, interaction, and screenshot capture.

## Initial Response

**If a URL was provided**: Immediately open that URL in a headed browser session.

**If no URL was provided**:
1. Check `package.json` for a dev server command:
   ```bash
   cat package.json 2>/dev/null | grep -E '"(dev|start|serve)"'
   ```
2. If found, offer to start the dev server and open `http://localhost:3000` (or the configured port)
3. If not found, ask the user which URL to open

## Process Steps

### Step 1: Setup

Check playwright-cli is available:
```bash
which playwright-cli 2>/dev/null || npx @playwright/cli --version 2>/dev/null
```

If not available, tell the user:
> playwright-cli is not installed. Install it with: `npm install -g @playwright/cli@latest`

Generate a session name: `browse-{unix-timestamp}`

### Step 2: Open Browser

```bash
playwright-cli open --headed --session browse-{timestamp} {url}
```

Tell the user the session has opened and what they can do.

### Step 3: Interactive Loop

Wait for the user to direct you. Common actions:

- **Navigate**: `playwright-cli navigate --session {session} {url}`
- **Screenshot**: `playwright-cli screenshot --session {session} {url} --name {name}`
  - Save to `.prism/local/verifications/browse-sessions/`
- **Snapshot**: `playwright-cli snapshot --session {session} {url}`
- **Console log**: `playwright-cli console --session {session} {url}`
- **Click**: Use the browser's built-in UI (headed mode)

Report results after each action.

### Step 4: Cleanup

When the user is done (or says "close", "done", "exit"):
```bash
playwright-cli session-close browse-{timestamp}
```

Confirm the session is closed.

## Important Notes

- **Headed mode** — this command always uses `--headed` for interactive exploration
- **Session naming** — use `browse-{timestamp}` to avoid conflicts
- **Cleanup** — always close the session when done
- **Screenshots** — store in `.prism/local/verifications/browse-sessions/`

## Quick Reference

| Action | Command |
|--------|---------|
| Open URL | `playwright-cli open --headed --session {s} {url}` |
| Navigate | `playwright-cli navigate --session {s} {url}` |
| Screenshot | `playwright-cli screenshot --session {s} {url} --name {name}` |
| Snapshot | `playwright-cli snapshot --session {s} {url}` |
| Console | `playwright-cli console --session {s} {url}` |
| Close | `playwright-cli session-close {s}` |
