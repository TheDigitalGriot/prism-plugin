# Browser Verification Protocol

If the story modified UI files (`.tsx`, `.jsx`, `.vue`, `.svelte`, `.html`, `.css`):

1. Check if `playwright-cli` is available:
   ```bash
   which playwright-cli 2>/dev/null || npx @playwright/cli --version 2>/dev/null
   ```
2. If not available, skip with note in progress.md: "Browser verification skipped: playwright-cli not installed"
3. Detect dev server command from `package.json` scripts (`dev` > `start` > `serve`)
4. Start dev server in background, poll until responding (max 30s)
5. Run browser verification:
   ```bash
   playwright-cli screenshot --session story-{id} http://localhost:PORT --name verify-{id}
   playwright-cli console --session story-{id} http://localhost:PORT
   ```
6. Evaluate results:
   - No console errors → PASS
   - Screenshot captured → store in `.prism/local/verifications/`
   - On failure → treat as quality gate failure (same debug flow)
7. Close session: `playwright-cli session-close story-{id}`
8. Kill dev server process
