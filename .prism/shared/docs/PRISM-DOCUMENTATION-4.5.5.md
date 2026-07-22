# Prism 4.5.5

**Release date:** 2026-07 (backfilled 2026-07-22 from git — snapshot was missed at release time)
**Tag:** `v4.5.5`
**Type:** release-pipeline

## Summary

Wired the **sideload zip into the release pipeline** so `prism-release` builds the Cowork-uploadable
plugin bundle as part of a normal release, and relocated the conductor mockups into `designs/`.

## What changed

- **Sideload in the release pipeline** — `prism-release` now produces `.prism/local/sideload/prism-sideload-<version>.zip`
  (lean, tracked plugin components only, zero nested zips) so Cowork/Desktop can be updated by hand when
  the marketplace GitHub-sync cache serves a stale version. See `prism-sideload`.
- **Conductor mockups relocated** to `designs/` for a cleaner tree.

*(Backfill note: this snapshot is reconstructed from commits `9414a64` / `f6033f9`; it was not written
at release time — one of the missed doc snapshots that motivated the 4.5.8 closing-ceremony gate.)*
