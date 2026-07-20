# Fable 5 — Current vs. Desired (Auth Unification + Gate Reframe)

**Date:** 2026-07-20
**Status:** Comparison captured — feeds `.prism/shared/plans/2026-07-20-fable-subscription-unification.md`
**Owner:** Gavin
**Trigger:** Fable 5 became a permanent, *included* feature of the Max / Team Premium subscription (effective 2026-07-20), capped at 50% of the standard weekly usage limit. The metered-API cost premise the Prism gate was built on is now false for subscription surfaces.

> **Firewall (read first):** This is an **auth + framing** change. It does **NOT** touch the role-based model selection / dispatch / orchestration design built over the past year, and it is **NOT** the fable-method Router refactor ([2026-07-18-fable-method-prism-integration.md](../brainstorms/2026-07-18-fable-method-prism-integration.md)). Fable stays quarantined behind the HITL gate — opt-in, never a default, never folded into `role_defaults`.

---

## The one-line resolution

"Turn off the flag" ≠ remove Fable. It = **retire the metered / temporary / 🔒 RESERVED framing** (now false under subscription) **while keeping the HITL gate mechanism intact.** The gate's *rationale* shifts from "~2.6× metered dollars, confirm the spend" → "you're spending a **capped weekly Max Fable allowance**, confirm before you burn it."

---

## As-built today (the real state)

Fully built (T1–T4), *temporarily* switched on via `.prism/local/fable.flag`, but the reference docs still disavow it as RESERVED. That contradiction is the core defect.

```mermaid
flowchart LR
  subgraph surfaces_now[Surfaces — inconsistent auth]
    vsc[VS Code extension]
    srv[Server / daemon]
    mob[Mobile]
    dsk[Desktop]
    cli[CLI TUI]
  end

  vsc -->|"@anthropic-ai/sdk<br/>API key"| metered[[Metered API — $10/$50 MTok]]
  srv -->|"@anthropic-ai/claude-agent-sdk<br/>CLAUDE_CODE_OAUTH_TOKEN"| sub[[Max subscription]]
  mob --> srv
  dsk --> srv
  cli -. unclear/mixed .-> metered

  fable["Fable 5: BUILT + temporarily ON<br/>flag + modal + PreToolUse hook<br/>docs still say RESERVED"]:::warn

  classDef warn fill:#3a2a00,stroke:#ffb000,color:#ffd77a;
```

**Problems:** (a) VS Code is the lone metered holdout — it can never draw on your Max-included Fable; (b) `refusal` handling lives only on the metered path; (c) docs contradict the code.

---

## Desired

```mermaid
flowchart LR
  subgraph surfaces_next[Surfaces — identical auth]
    vsc2[VS Code]
    srv2[Server / daemon]
    mob2[Mobile]
    dsk2[Desktop]
    cli2[CLI TUI]
  end

  vsc2 --> sdk
  cli2 --> sdk
  srv2 --> sdk
  mob2 --> srv2
  dsk2 --> srv2
  sdk["@anthropic-ai/claude-agent-sdk<br/>Max subscription OAuth"] --> sub2[[Max subscription]]

  gate{{"HITL gate — UNCHANGED mechanism<br/>reframed: protect capped weekly allowance"}}:::keep
  sub2 -.-> gate
  gate -.-> fable2["Fable 5 — quarantined escalation only"]:::keep

  orch["Year-long orchestration &<br/>model selection — UNTOUCHED"]:::firewall

  classDef keep fill:#06302b,stroke:#00BFA6,color:#7fe9d8;
  classDef firewall fill:#2a2a2a,stroke:#888,color:#ccc,stroke-dasharray: 4 4;
```

---

## Dimension-by-dimension

| Dimension | Current (as-built) | Desired |
|---|---|---|
| **Auth** | VS Code = metered API key ([claude-sdk.ts:44](../../../apps/prism-vscode/src/core/api/claude-sdk.ts)); server/mobile = Agent SDK + subscription OAuth. Inconsistent. | All surfaces (CLI TUI, VS Code, desktop, mobile) identical: Agent SDK + Max subscription OAuth |
| **Fable enablement** | Built + *temporarily* on via flag; docs say 🔒 RESERVED | Standing subscription feature; docs trued-up |
| **Framing / rationale** | "~2.6× Opus **metered $/call**" | "**capped weekly Max allowance** + HITL control" |
| **HITL gate** | App modal + PreToolUse hook (flag ON→ask, OFF→deny/Opus) | **KEEP mechanism verbatim**; reword copy only |
| **`refusal` handling** | Only on metered extension path | Uniform in shared Agent-SDK path |
| **Docs / mirrors** | Docs contradict code; setup mirrors + frozen eval snapshots duplicate the gate | True-up live docs + setup mirrors; **leave eval snapshots frozen** |
| **Orchestration / model selection** | Stable, year-long design | **UNCHANGED — hard non-goal** |

---

## Non-goals (the firewall, restated)

- ❌ Do not change any default-model / role / dispatch behavior.
- ❌ Do not make Fable a default anywhere, or add it to `role_defaults`.
- ❌ Do not undertake the fable-method Router refactor here (separate track).
- ❌ Do not edit frozen eval snapshots under `.prism/shared/evals/*-snapshot/`.
