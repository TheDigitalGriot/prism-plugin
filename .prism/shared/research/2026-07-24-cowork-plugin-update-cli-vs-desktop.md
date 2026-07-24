---
date: 2026-07-24
researcher: Claude (Cowork, Opus 4.8)
topic: "Why Cowork's plugin 'Update' stays greyed after push+release — Claude Code CLI vs Claude Desktop are two distinct marketplace systems"
tags: [research, marketplace, plugins, cowork, claude-code, cinopsis, remote-marketplace, stale-state]
status: resolved (mechanism confirmed; Desktop-side remedy is an open research track)
related:
  - .prism/shared/handoffs/2026-07-24_stdio-hygiene-standard-adoption.md
  - .prism/shared/handoffs/2026-07-17_09-00-00_forge-day-close-4.2.0-to-4.3.1.md
---

# Research: Cowork plugin "Update" is stale — CLI vs Desktop are distinct

## The question
After Cinopsis was fixed, committed, pushed to `main`, and released as **v2.1.3**
(GitHub release = Latest), the Claude **Desktop → Cowork → Customize → Plugins** panel
still showed **Version 2.1.2 · "Last updated 1 month ago"** with the **Update button
greyed out**. A month of prior debugging had landed on "it's just Anthropic's stale
state" but never nailed the mechanism. This confirms it — with the mechanism.

## The headline finding
**Claude Code (CLI) and Claude Desktop (Cowork) use two DISTINCT plugin-marketplace
systems. Do not conflate them.**

| | Claude Code CLI | Claude Desktop / Cowork |
|---|---|---|
| Binary | `C:\Users\digit\.local\bin\claude.exe` (v2.1.206) | bundled `%APPDATA%\Claude\claude-code\2.1.217` |
| Marketplace model | **Local git clones** under `~/.claude/plugins/marketplaces/` | **Remote cloud catalog** (Anthropic-hosted) |
| Version/update source | the local clone's `marketplace.json` | Anthropic's cloud index |
| Refresh mechanism | `claude plugin marketplace update <name>` (re-pulls the clone) | cloud re-crawl / Desktop re-add — **not** local |
| State after our push | updatable once refreshed | still stale (greyed) |

## Evidence
1. **Desktop migrated to a remote marketplace.** `%APPDATA%\Claude\config.json` contains
   `"remote_marketplace_migration_done_v1": true` (and `"remote_uploads_migration_done_v1_…"`).
   The Desktop Plugins panel reads plugin version + update availability from Anthropic's
   cloud catalog, not from the source GitHub repo and not from the local clone.
2. **The Desktop-bundled claude-code has no plugin store of its own.** `%APPDATA%\Claude\claude-code`
   holds only the binary (`2.1.217`); there is no `plugins/` dir there. Plugin *runtime* code
   is still read from `~/.claude/plugins/cache/` (that's why the on-device fix worked and the
   live bridge served 2.1.3-patched code), but the *catalog/version UI* is cloud-driven.
3. **The CLI's local clone was a month stale.** `~/.claude/plugins/known_marketplaces.json`:
   cinopsis marketplace cloned from `TheDigitalGriot/Cinopsis` on **2026-06-13**, never re-pulled
   (= the "1 month ago"). `installed_plugins.json`: `cinopsis@cinopsis` = **2.1.0**, pinned to old
   `gitCommitSha 7661217`.
4. **Empirical proof via a controlled refresh** (`claude plugin marketplace update cinopsis`):

   | | before | after |
   |---|---|---|
   | CLI clone HEAD | `7661217` (v2.1.0) | `461662b` (v2.1.3) |
   | CLI clone marketplace.json version | (none) | **2.1.3** |
   | CLI update available? | no | **yes** (installed 2.1.0 → 2.1.3 offered) |
   | Desktop Update button | greyed | **still greyed** (unchanged) |

   The CLI refresh moved the CLI clone to 2.1.3 and did nothing to the Desktop button →
   the two systems are provably separate.

## Conclusion
- The repo and release were **always correct**; the greyed button is **not** a repo/release problem.
- The **CLI path works**: `claude plugin marketplace update cinopsis` → `claude plugin update cinopsis`.
- The **Desktop path is Anthropic-cloud-side**: the cloud catalog hasn't re-indexed 2.1.3 for a
  user-owned GitHub repo-as-marketplace. No local action (push, CLI refresh, cache patch) can move it.
- This is the **same family** as the 2026-07-17 forge-day close (repo-as-marketplace staleness,
  `failed_content` on large marketplaces, thin-mirror + sideload workaround).

## Candidate Desktop-side remedies (to confirm — see research prompt)
1. **Re-add the marketplace** in Desktop → Customize (remove + re-add `TheDigitalGriot/Cinopsis`)
   to force a cloud re-fetch/re-register.
2. **Restart the Desktop app** (may re-pull the cloud catalog on launch).
3. **Thin marketplace mirror** (as Prism did with `TheDigitalGriot/prism-marketplace`) if
   repo-as-marketplace is transitional/unsupported post-migration.
4. Otherwise **wait for the cloud re-crawl** — if it's purely Anthropic-side, that's the honest answer.

## Open questions (research track)
- What exactly is `remote_marketplace_migration_done_v1`, when did it ship, and what changed?
- Post-migration, how does a new push/release on a user-owned GitHub marketplace propagate to the
  Desktop Update button — cloud crawl, TTL, manual re-submit, or unsupported?
- Is the greyed button a known bug for user GitHub marketplaces after the migration? (issues/threads)

## Provenance
- Device: digitalgriotpc (Windows 11). Investigated via Windows-MCP PowerShell in a Cowork session.
- Cinopsis release: https://github.com/TheDigitalGriot/cinopsis/releases/tag/v2.1.3
- A separate Cowork research prompt (web/GitHub/docs/Medium) is chasing the Desktop-side mechanism.
