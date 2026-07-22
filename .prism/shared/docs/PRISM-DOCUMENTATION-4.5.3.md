# Prism 4.5.3

**Release date:** 2026-07 (backfilled 2026-07-22 from git)
**Tag:** `v4.5.3`
**Type:** fix (skill-guard)

## Summary

**skill-guard exempts Fragment scaffold templates** — the skill-guard hook no longer flags the template
files Fragment emits.

## What changed

- The skill-guard (which polices skill/plugin edits) now exempts Fragment's scaffold template files, so
  legitimate scaffolding isn't blocked.

*(Backfill note: reconstructed from commit `b487fcf`.)*
