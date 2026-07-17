# PRISM Documentation — v4.3.0

> **Release theme: resilience.** After the 2026-07-17 cloud fail-close incident, this release
> hardens the three layers that let it happen: hook fail-modes (proven fail-open for
> environmental errors), the release process (parallel-session race guard + bump-script trap
> documented), and the collaboration protocol itself (mid-task interjections encoded in
> CLAUDE.md). Ships on top of the v4.2.1 hotfix.

---

## 1. The incident (what 4.2.1 + 4.3.0 answer)

A Claude Desktop/Cowork cloud session synced the Prism plugin and every tool call died with
`line 33: set: pipefail: invalid option name`. Four stacked causes:

0. **CRLF line endings — the primary trigger (found by Gavin's parallel session).**
   `core.autocrlf=true` checks out `.sh` files with CRLF on Windows; the cloud syncs disk
   bytes verbatim; Linux sh reads `set -o pipefail\r` — carriage return included — as an
   invalid option name. Even a fully POSIX script dies when synced with CRLF. Fix:
   `.gitattributes` pins `*.sh` + `hooks/hooks.json` to `text eol=lf` (+ index renormalize
   + working-tree re-smudge, verified 0 CR bytes on disk).
1. **Bashisms in a matcher-`""` PreToolUse hook** — `set -euo pipefail` + `[[ ]]` in
   `spectrum-approval.sh`. Cloud sandboxes run hooks under dash/busybox, where `set -o pipefail`
   exits 2; the PreToolUse protocol reads non-zero as DENY → **every tool fail-closed**
   (Skill/Read/Bash/Glob/Grep/ToolSearch), a catch-22 with no in-session escape.
2. **The fix existed but never landed** — a parallel session had POSIX-hardened all five sh
   hooks in the working tree, uncommitted. v4.2.0 released around it; the tag shipped the bug.
3. **Stale plugin cache** — the cloud surface was additionally pinned to the documented
   "3.9.5" stale-package tree, so even committed fixes wouldn't have reached it without a
   version bump or sideload.

**Resolution:** 5-file fix landed (`47582e7`) → v4.2.1 hotfix tag + release → clean
`/prism-sideload` zip for cache-bypassing upload.

## 2. Hook fail-mode audit (the proof, line-level)

Contract: **a hook may exit non-zero only as a deliberate decision — never environmentally.**

| Hook | Event / matcher | Fail-mode proof |
|---|---|---|
| `spectrum-approval.sh` | PreToolUse `""` | `set -eu` (POSIX-legal) → guarded pipefail probe → **fast-path `exit 0` when `SPECTRUM_WORKER_STORY_ID` unset** (line 41) — every non-spectrum session exits before any fallible statement. Spectrum sessions: polling guarded with `|| true`. |
| `fable-gate.sh` | PreToolUse `Task` | Guarded pipefail; node/grep paths carry `|| true` / `|| echo`; non-Fable dispatches `exit 0` early. The only DENY is the deliberate Fable-flag-off decision (exit 0 with a `deny` JSON — the *protocol* denies, not the exit code). |
| `detect-changes-gate.sh` | PostToolUse `Write\|Edit` | Advisory-only; every pipeline `|| true`; missing node/codemem/project → silent `exit 0`; **`exit 0` on every path**. PostToolUse cannot block regardless. |
| `worktree-setup.sh` / `worktree-cleanup.sh` | Worktree events | Guarded pipefail; package-manager and git steps individually `|| echo`-guarded (non-fatal); missing payload → status JSON + `exit 0`. |
| Python hooks (`pre/post-compact`, `log-observation`, `log-agent`) | Compact/PostToolUse/Subagent | Logging/state only; none gate PreToolUse; failure cannot fail-close tools. |

Verification: `sh -n` passes on all five (2026-07-17); guarded-pipefail pattern
`if (set -o pipefail) 2>/dev/null; then set -o pipefail; fi` everywhere a pipeline exists.

## 3. Release-process hardening (prism-release SKILL.md)

- **Step 1c (new, MANDATORY): clean-tree guard** — `git status --porcelain` review before any
  staging; every unexpected entry must be explained, landed deliberately, or confirmed out.
  Direct lesson: parallel sessions share the working tree; v4.2.0 raced past an uncommitted fix.
- **Step 2 warning (new):** never hand-edit `VERSION` before `bump-version.py` — the script keys
  off it and silently no-ops when it already equals the target (`--set` shares the trap).

## 4. Collaboration protocol (encoded in CLAUDE.md, project + global)

**Mid-task interjections are steering, not noise.** When Gavin speaks mid-flight it is almost
always a live course correction or context Claude lacks. Protocol: stop, answer first,
integrate, resume on his go. Never queue him behind the task.

## 5. Also in 4.3.0 (housekeeping landed with this release)

- prism-eval embedded repo healed: stale 5-day `index.lock` cleared, author-name change
  committed (`7db4497`), pushed to backup branch `prism-eval-app`; parent gitlink updated.
- Adopted into the repo: `AGENTS.md` (GitNexus), `.claude/skills/gitnexus/*`, the 2026-07-12
  semantic-layer plan; `.superpowers/` session state gitignored.
- The "excellent option" operating principle (previously uncommitted in CLAUDE.md) landed.

## 6a. 4.3.1 addendum — the marketplace `failed_content` root cause

Claude Desktop's `main.log` showed every marketplace sync settling
`pollSyncUntilDone … status=failed_content` (~18–20s): the backend reached the repo and
rejected its **content**. Suspect confirmed by elimination (0 tracked zips, manifest
anonymously reachable, repo public): the **orphan `prism-eval` gitlink** — a mode-160000
submodule entry with no `.gitmodules`, unresolvable by any fetcher — in the tree since Jul 7.
The stale-package saga began Jul 8 (3.9.5). `git archive` skips gitlinks, which is why
sideload zips always worked while marketplace sync silently failed and the backend kept
serving its last good (pre-gitlink, CRLF-era) package — the very tree that caused the cloud
outage. Fixed in 4.3.1: gitlink untracked, `prism-eval/` gitignored (directory intact on disk;
remote backup `prism-eval-app` @ `7db4497`).

**Lesson:** never leave a bare gitlink in a plugin-distributed tree — either declare it in
`.gitmodules` or keep embedded repos untracked.

## 6. References

- `CHANGELOG.md` §4.3.0, §4.2.1, §4.2.0
- `.prism/shared/handoffs/2026-07-17_04-33-12_v420-shipped-connector-artifact-kickoff.md`
  (connector/artifact mission + PASEO audit spec + parked pairing findings — all still queued)
- `skills/prism-release/SKILL.md` Steps 1c & 2
- `scripts/*.sh` headers — the POSIX contract, documented in-file
