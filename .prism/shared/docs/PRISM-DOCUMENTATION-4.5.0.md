# Prism 4.5.0

**Release date:** 2026-07 (backfilled 2026-07-22 from git — snapshot missed at release time; untagged)
**Type:** feature (auth + Fable + ceremony)

## Summary

The 4.5 line's foundation: **strict subscription-only auth**, **Fable 5 enablement**, unified auth
propagation into Fragment, and the first **closing-ceremony** skill.

## What changed

- **Strict subscription-only auth** — `resolveAnthropicAuth` / `GRIOT_ALLOW_METERED`; never silently
  bills metered usage.
- **Fable 5 enabled under Max** — HITL-gated (opt-in escalation via the fable gate, never a routing
  default). Auth unified across surfaces.
- **fragment-sync auth propagation** — the strict-auth resolver flows into Fragment-scaffolded surfaces.
- **closing-ceremony skill** — first version of the bookend → docs-update → release meta-skill.

*(Backfill note: reconstructed from commits `36ccf23` / `dd1b0eb`. Untagged release — a missed snapshot
the 4.5.8 ceremony gate now prevents.)*
