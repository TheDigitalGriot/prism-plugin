# Cowork GitHub-sync stale-cache bug (why prism-sideload exists)

## The mechanism

Cowork's "Customize → Browse plugins → Add marketplace from GitHub" pulls plugins through
a **server-side, read-only mount** of your connected GitHub repo — **not** the Claude Code
CLI's local `git clone` into `~/.claude/plugins/`. There is no local `.git/` to inspect or
`git pull`. Its cache appears keyed on an internal plugin/marketplace ID plus a timestamp —
**not** the `version` field in `plugin.json` / `marketplace.json`, and **not** simply the
latest commit SHA on the branch.

## The consequence

Pushing new commits, bumping `version`, editing the description, or removing files often
does **not** propagate to Cowork. The documented refresh (the marketplace **Update** button)
is frequently greyed out or silently ineffective on the Personal tab. Version bumps and
manifest edits — the usual "cache-bust" moves — do not help, because they are not the cache
key.

## Known open issues (github.com/anthropics/claude-code), all matching these symptoms

- **#69020** — Cowork installs a stale cached plugin version; ignores all repo updates.
  Reporter tried marketplace **rename**, **private→public**, and **remove + re-add** — the
  stale version persisted through all of them.
- **#38185** — Personal tab can't update third-party plugins. Explicitly notes the Claude
  Code CLI `/plugin marketplace update` works — i.e. the bug is Cowork-desktop-specific, not
  the repo or the manifest.
- **#45810** — Marketplace **Update** button disabled even when the installed version is
  outdated.
- **#36700** — No path to force-update a stale marketplace cache.
- **#39400** — Marketplace-sourced plugins fail to load skills in Cowork; a **zip upload of
  the same plugin works fine**.

At time of research no Anthropic staff responses were visible on these threads, and no
official root-cause or ETA existed.

## The workaround this skill automates

Bypass GitHub sync entirely: upload a zip via **Cowork → Customize → Browse plugins →
Upload plugin**. Reported to reflect current content when marketplace sync will not
(#38185, #39400).

**Nested-zip caveat:** a `.zip` file *inside* the uploaded package blocks the Cowork
install. Prism previously shipped `.prism/shared/docs/update/prism-v2-update.zip` tracked in
git, which broke installs; it was untracked and gitignored. The build script asserts there
are **zero** nested zips in the artifact so this can't regress.

## Escalation

If Anthropic later fixes Personal-tab GitHub sync, sideloading becomes optional and
`/plugin marketplace update` (CLI) or the **Update** button (Cowork) should suffice. Until
then, re-run `/prism-sideload` after each set of committed plugin changes and re-upload.
