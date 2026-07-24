---
date: 2026-07-24
researcher: Claude (Cowork, Opus 4.8)
git_commit: 26180f3 (chore/stdio-hygiene-standard)
branch: chore/stdio-hygiene-standard
topic: "no-orphan stdio hygiene standard — Cinopsis v2.1.3 fix → cl-plugin-structure adoption → Fragment"
tags: [handoff, cl-plugin-structure, fragment-sync, stdio, mcp, cinopsis, standard, marketplace]
status: ready-to-resume
---

# Handoff: no-orphan stdio hygiene standard (2026-07-24)

## TL;DR
A Cowork session fixed the long-standing **Cinopsis MCP hang** (shipped + released as
**v2.1.3**), then codified the fix as a reusable **"no-orphan stdio hygiene"** standard
into `cl-plugin-structure` and carried it into `fragment-sync`. The cl-plugin-structure /
fragment-sync edits are committed to branch **`chore/stdio-hygiene-standard`** (pushed) but
**NOT merged or released** — that is the main pickup here, plus a Fragment gap and a Cowork
marketplace-refresh finding.

## What shipped (Cinopsis — done, released, verified)
Root cause: on Windows, every `subprocess.run` in the server path inherited the MCP server's
**stdin JSON-RPC pipe**, so spawned `yt-dlp`/`ffmpeg` children blocked on it until the 60s
timeout → every tool call hung. (python-sdk #671, CPython #19575.)

- Fix: `stdin=subprocess.DEVNULL` on all 7 `subprocess.run` sites (get_transcript ×3,
  capture_frames ×2, compare_videos ×2).
- Hardening: `get_env()` strips `HTTP/HTTPS/ALL_PROXY`; `find_ytdlp()` prefers the venv's own
  binary first (was running a stale user-site yt-dlp); `mcp_launcher.py` binds the server child
  to a **`KILL_ON_JOB_CLOSE` Job Object** so the host reaps it instead of orphaning it.
- Verified: §8 probe **3.6s** (was 60s), live MCP bridge returns the 114-entry transcript,
  kill-launcher-reaps-server confirmed. Patched repo + cache + **the live per-session rpm copy**
  (the discovery that explained why prior fixes "never stuck": Cowork runs
  `…\local-agent-mode-sessions\<s>\rpm\plugin_…\scripts`, reused on respawn, not the cache).
- **Released:** `main` @ 461662b, tag `v2.1.3`, GitHub release (Latest).

## What's on the branch (Prism — needs your ceremony)
Branch **`chore/stdio-hygiene-standard`** (pushed, commit **26180f3**), based off
`feat/ceremony-review-audit-gate` HEAD. 6 files:

- `skills/cl-plugin-structure/SKILL.md` — **v0.7.2 → 0.7.3**, added a pointer in the MCP Servers section.
- `skills/cl-plugin-structure/references/mcp-patterns.md` — new **"Local stdio server hygiene"**
  section: 5 rules + 2 anti-patterns.
- `skills/fragment-sync/references/conformance-checklist.md` — new item **B10**.
- The `apps/prism-setup/resources/plugin/skills/…` **mirror** of all three (was in sync pre-edit).

## Next actions (do these in Prism Claude Code)
1. **Integrate the branch cleanly.** It descends from `feat/ceremony-review-audit-gate`, so a
   direct PR to `main` would drag that feature's commits in. Prefer: **cherry-pick 26180f3**
   onto a `main`-based branch → PR, OR merge after the ceremony feature lands. Do NOT force it
   into the feature PR.
2. **Run the closing ceremony** for the cl-plugin-structure change (bookend → docs-update →
   release) per your flow. Decide whether it warrants a Prism version bump — it's a skill-content
   change; the skill's OWN version already went to 0.7.3. Update root CHANGELOG (docs-update Step 7).
3. **Fragment gap (fragment-sync B10).** Fragment has **NO MCP-server template** today
   (templates: base/core/electron/mobile/tui/ui/vscode), so the standard has nothing to emit
   against yet. Decide the gated **Layer-B** pass: add an `mcp`/`server` template surface that
   emits the hygiene by default, then flip B10 conformant. (Gates: git/publish — explicit go only.)
4. **Fleet adoption (optional, high-value).** Audit the other local stdio plugins that shell out
   — blender / ableton / github wrappers — for the same 5 rules (stdin=DEVNULL, stdout purity,
   env sanitize, interpreter-first binaries, kill-on-close launcher). Cinopsis v2.1.3 is the
   reference implementation.

## The standard (what got codified — for quick reference)
1. **stdout is sacred** — it IS the JSON-RPC channel; route wrapped-function stdout → stderr.
2. **`stdin=subprocess.DEVNULL`** on every shelled-out child (the Windows hang).
3. **Sanitize child env** — strip proxy vars the host/VM may inject.
4. **Interpreter-first binary resolution** — prefer the venv's own binary over PATH / user-site.
5. **`KILL_ON_JOB_CLOSE` Job Object** in self-bootstrapping launchers (Windows).
Anti-patterns: no second stdin reader (corrupts the protocol); no pre-spawn process scan
(risks the ~5s spawn timeout, #61524).

## Cross-cutting finding: Cowork's "Update" button is stale-cache-bound
Cinopsis v2.1.3 is live on GitHub (main marketplace.json = 2.1.3, release = Latest), yet the
Cowork Plugins panel still shows **v2.1.2 · "1 month ago"** with **Update greyed out**. Cause:
`~/.claude/plugins/known_marketplaces.json` shows Cowork cloned `TheDigitalGriot/Cinopsis`
**as a marketplace** to `~/.claude/plugins/marketplaces/cinopsis` on **2026-06-13** and has not
re-pulled it since. The update check compares the installed version against that **stale local
marketplace clone**, not GitHub live — so it can't see 2.1.3. (`installed_plugins.json` still
records `cinopsis@cinopsis` = 2.1.0, gitCommitSha 7661217.)

This is the **same class** as the 2026-07-17 forge-day close: full-repo-as-marketplace staleness,
solved there with a **thin marketplace mirror** (`TheDigitalGriot/prism-marketplace`) + sideload
upload. Likely remedies for Cinopsis: force a marketplace refresh (`claude plugin marketplace
update cinopsis` / re-add the marketplace), or a thin cinopsis marketplace mirror. **A separate
Cowork research prompt is investigating the exact refresh mechanism** — coordinate so we don't
duplicate.

## Success criteria
- `chore/stdio-hygiene-standard` cherry-picked/merged to `main`; ceremony run; root CHANGELOG updated.
- cl-plugin-structure change released via the normal flow.
- Fragment MCP-template decision made (add the surface, or explicitly defer with the B10 gap logged).
- (separate track) Cinopsis Update button lights up in Cowork after a marketplace refresh.

## Source / provenance
- Cowork artifacts: `cinopsis-mcp-hang-resolution`, `cinopsis-mcp-hang-handoff` (Desktop gallery).
- Cinopsis release: https://github.com/TheDigitalGriot/cinopsis/releases/tag/v2.1.3
- Prism branch: `chore/stdio-hygiene-standard` @ 26180f3.
- Related prior handoff: `.prism/shared/handoffs/2026-07-17_09-00-00_forge-day-close-4.2.0-to-4.3.1.md`
  (marketplace staleness / thin-mirror / sideload pattern).
