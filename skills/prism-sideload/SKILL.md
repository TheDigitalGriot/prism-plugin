---
name: prism-sideload
description: Build a Cowork-uploadable sideload zip of the Prism plugin to bypass Cowork's broken GitHub-sync / stale-cache. Use in Claude Code when Cowork or Claude Desktop keeps serving an old Prism version despite pushed commits, version bumps, or description changes — or when the user says "sideload", "upload plugin to Cowork", "Cowork won't update the plugin", or invokes /prism-sideload.
---

# Prism Sideload

Package the Prism plugin into a lean zip you upload directly in Cowork, sidestepping Cowork's GitHub-sync path — which caches plugin content server-side and routinely ignores new commits, version bumps, and description edits. Background + open-issue links: [references/cowork-sync-bug.md](references/cowork-sync-bug.md).

**Runs in Claude Code** (needs Bash + git). The zip it produces is uploaded by hand in Claude Desktop's Cowork UI — Cowork itself has no Bash tool, so it can't build the zip.

## Steps

1. Build the zip:

   ```bash
   python "${CLAUDE_PLUGIN_ROOT}/skills/prism-sideload/scripts/build-sideload.py"
   ```

   It reads `VERSION`, archives only the **tracked** plugin components at `HEAD`
   (`.claude-plugin`, `skills`, `agents`, `commands`, `hooks`, `scripts`) — excluding
   `apps/`, `packages/`, `prism-docs/`, `prism-eval/`, `installer/`, `node_modules/`,
   and any nested `.zip` — and writes
   `.prism/local/sideload/prism-sideload-<version>.zip` (gitignored, so it can never
   re-enter the synced tree and recreate the nested-zip problem).

2. The script **verifies automatically**: `plugin.json` is present and matches `VERSION`,
   and there are **zero nested zips** (a nested zip blocks Cowork installs). If plugin
   files have uncommitted changes it warns you — commit first, since it packages the
   committed `HEAD`.

3. Upload in Claude Desktop:
   **Cowork → Customize → Browse plugins → Upload plugin** → pick the zip.

## When to use vs. not

- **Use** when Cowork serves a stale version and the marketplace **Update** button is
  greyed out or ineffective (a known Cowork bug — see the references file).
- **Skip** for the Claude Code CLI — there, `/plugin marketplace update prism-marketplace`
  followed by reinstall works normally; sideloading is only needed for Cowork/Desktop.
