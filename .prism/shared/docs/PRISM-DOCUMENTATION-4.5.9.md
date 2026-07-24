# Prism 4.5.9 — No-orphan stdio hygiene standard + release-integration guard

**Release date:** 2026-07-24
**Type:** standard + release governance (self-hardening)
**Builds on:** 4.5.8 (closing-ceremony Review & Audit gate)

## Summary

Two hardening standards land together, both proven by a real incident:

1. **No-orphan stdio hygiene** — a reusable standard for local stdio MCP servers, codified into
   `cl-plugin-structure` after it fixed the Cinopsis MCP hang (shipped as Cinopsis v2.1.3). Every Griot
   local plugin that shells out now has a 5-rule checklist to inherit.
2. **Release-integration guard** — `scripts/verify-branch-integrated.mjs` extends 4.5.8's "the release
   reviews itself" from *is the code good?* to *is `main` the truth?*. It makes it unshippable to cut a
   release off an unintegrated branch or leave a release untagged — the exact drift that had stranded
   **v4.5.7 + v4.5.8** on a feature branch with `main` two releases behind.

This release also heals that drift: v4.5.7 and v4.5.8 are now tagged and in the CHANGELOG, and `main`
carries the full history as a fast-forward (no cherry-pick).

## What changed

### No-orphan stdio hygiene standard (cl-plugin-structure 0.7.2 → 0.7.3)
- `skills/cl-plugin-structure/references/mcp-patterns.md` — new **"Local stdio server hygiene"** section:
  5 rules + 2 anti-patterns.
  1. **stdout is sacred** — it IS the JSON-RPC channel; route wrapped-subprocess stdout → stderr.
  2. **`stdin=subprocess.DEVNULL`** on every shelled-out child (the Windows 60s hang; python-sdk #671).
  3. **Sanitize child env** — strip `HTTP/HTTPS/ALL_PROXY` the host/VM may inject.
  4. **Interpreter-first binary resolution** — prefer the venv's own binary over PATH / user-site.
  5. **`KILL_ON_JOB_CLOSE` Job Object** in self-bootstrapping launchers (Windows) so the host reaps children.
  - Anti-patterns: no second stdin reader (corrupts the protocol); no pre-spawn process scan (~5s spawn
    timeout risk, #61524).
- `skills/fragment-sync/references/conformance-checklist.md` — new item **B10** flagging that Fragment
  has no MCP-server template yet, so the standard has nothing to emit against (gap logged for a future
  gated Layer-B pass).

### Release-integration guard (release governance)
- `scripts/verify-branch-integrated.mjs` — auto-discovered by `scripts/pre-release-audit.mjs`, so it runs
  as part of the closing-ceremony Step-0 audit with zero wiring. It fails a release unless: (1) HEAD is
  `main` (not merely ahead of it), (2) the base `VERSION` has a reachable tag, (3) no finalized release
  commit is left untagged. The in-flight softener is provenance-bound — a bare VERSION bump with no
  matching release commit is treated as drift, not waved through.
- `skills/prism-closing-ceremony/SKILL.md` — integration invariant added to the Rules.
- `skills/prism-release/SKILL.md` — Step 1d branch-integration guard (mandatory, for standalone releases).
- `skills/prism-closing-ceremony/references/review-audit-gate.md` — names the guard in the audit set.
- Root `CLAUDE.md` — "Integration invariant" so every session inherits the rule.
- It does **not** detect an arbitrary cherry-pick (infeasible from `main` alone); it removes the *reason*
  to cherry-pick by requiring whole-branch integration.

### Drift healing + housekeeping
- Backfilled tags **v4.5.7** + **v4.5.8** at their release commits; CHANGELOG entries for both.
- Backfilled the 4.5.0–4.5.6 doc snapshots that were missed at their release times.
- Landed session artifacts (stdio-hygiene handoff, refraction plan, Cowork plugin-update research) on `main`.

## Dogfood / proof

The integration guard was itself reviewed by 4.5.8's Step-0 gate before shipping. The independent
two-stage review caught a real High — the in-flight softener was defeatable by a stray, non-release
VERSION bump — which was fixed (provenance-bound softener) and re-verified against the exact adversarial
scenario before this release. The gate demonstrably hardened the very tool that hardens the gate.

## Compatibility

Additive. The stdio standard is documentation/checklist content. The integration guard is a new
release-gate check that passes on any repo where releases already land on `main` from a tagged base; it
degrades to warnings (never a false block) on a bootstrap repo with no tags. No app/binary code changed.

## Verification

- `node scripts/verify-branch-integrated.mjs` → INTEGRATION OK (happy path); FAILs on the incident shape,
  a feature-branch release, and a stray untagged VERSION bump.
- `node scripts/pre-release-audit.mjs` → AUDIT CLEAN (includes the new guard, auto-discovered).
- `node scripts/verify-ceremony-gate.mjs` → ALL PASS.
- `node scripts/verify-story-unification.mjs --all` → PASS (4.5.7 intact).
- `claude plugin validate .` → passed.
