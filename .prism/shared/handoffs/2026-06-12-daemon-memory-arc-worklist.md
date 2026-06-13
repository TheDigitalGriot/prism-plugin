# Griot Daemon + Memory Arc — Running Worklist

**Date:** 2026-06-12 · **Status:** active — keep nothing lost
**Companion ledger:** `.prism/shared/brainstorms/2026-06-12-code-intel-memory-layer.md`

> Captured so the excitement doesn't bury the items. This is the running list for the daemon-design arc and the sovereign folds.

## A · Sovereign Fork Registry (donors folded → watch upstreams)

| Donor (upstream) | License | Our fork / home | Role in spine | Sync status |
|---|---|---|---|---|
| paseo (`getpaseo/paseo`) | AGPL-3.0 | `apps/prism-mobile` (vendored v0.1.69) | agent-run service + mobile surface | +584 commits behind; v0.1.95 refresh plan ready |
| open-design (`nexu-io/open-design`) | Apache-2.0 | `TheDigitalGriot/prism-design-engine` + `apps/prism-design-studio` relay (:7457→:7456) | design-gen service | forked ~2026-06-08; upstream active |
| Graphify (`safishamsi/graphify`) | **MIT** ✅ | `TheDigitalGriot/graphify` (**TO FORK**) | knowledge/STORE engine (→ Synaptiq) | not yet forked; upstream ~1 release/day — **watch closely** |
| codebase-memory-mcp | binary on PATH | not forked (yet) | code-intel service | working on Windows |

**Pattern:** fork → own → note lineage → track upstream for enhancements → fine-tune for ourselves. Sovereign, never a runtime dependency.

## B · Graphify — figured out ✅
- **License: MIT** — fork, modify, self-host all clear. "Free but no access" = just not installed.
- **Install:** `pip install graphifyy && graphify install` (PyPI pkg = `graphifyy`, double-y) · or `uv tool install graphifyy` / `pipx install graphifyy`.
- **Multi-modal:** code, SQL, R, shell, docs, papers, images, **video + meeting recordings** → one graph. Confirms the Sonar (audio) + Cinopsis (video) + Synaptiq convergence.
- **Decision (Q4):** fork sovereignly like prism-design-engine; note dual-lineage watch (open-design + Graphify); track upstream. **Execution pending user go** (your GitHub account).

## C · NEXT decision — daemon-design round
- **Build approach: extend paseo's daemon vs. new broker.** `design-studio :7457` already votes "per-service relay." This is the next call.
- Broker architecture: client-facing protocol · service registry · SKILL.md discovery · per-backend adapters (WS / REST / stdio-MCP normalization) · relay for remote.

## D · Code-intel build items (from grounding — still open)
- **Capability (Bucket A):** hybrid BM25+vector+RRF search · graph→generated `SKILL.md` · live-stats CLAUDE.md injection · `detect_changes` enforced gate · `/prism-wiki`.
- **Visualization (Bucket B):** CLI `plugin_graph.go` · VS Code / Electron graph panels · mobile graph view.

## E · Synaptiq design (later)
- How Synaptiq's agentic visual canvas wraps Graphify's engine: node model, cross-project addressing, vector/hybrid-search layer (Graphify graph + sqlite-vec à la Atomic?).

## F · Design-gen service — WIRED ✅ (idea_init session, 2026-06-12, zero errors)
- 6 message handlers wired **inline into `apps/prism-vscode/.../PrismPanelProvider.ts`** (NOT a separate `DesignEngineHost.ts`) — talks to design-studio relay `:7457` + engine `:7456`. Helpers: `_launchDesignEngine`, `_stopDesignEngine`, `_sendDesignPrompt`, `_probeEngine`, `_scanDesignArtifacts`, `_readLatestDesignPrompt`, `_findLatestLedger`.
- Griotwave `DESIGN.md` registered (full 10-section spec) in `prism-design-engine/design-systems/griotwave/`.
- **Signal → Q2 confirmed:** readiness probe = `GET /api/skills` (the SKILL.md discovery endpoint). SKILL.md *is* the broker's discovery/readiness contract.
- **Signal → build-approach (parked C):** integration is **per-service inline + thin relay**, not a unified host → a vote for **distributed per-service relays over a monolith broker**.
- **Reconcile in daemon round:** keep per-service inline (current) vs. consolidate behind one broker. Broker must still account for these 6 messages. *(PrismPanelProvider.ts edits are uncommitted from the concurrent session — fold into the housekeeping commit.)*

## G · 3D generation — research landed ✅ (placed 2026-06-12)
- **Maps to:** Lucid's asset domain → a **brokered 3D-gen service** (the most heterogeneous yet: local GGUF models + cloud APIs + Blender MCP).
- **Key finding = our pattern:** *"Orchestrate, don't expect one tool; split mesh-gen from texturing"* = the multi-service broker applied to 3D. Stage pipeline: concept → mesh → retopo/UV (human-gated) → texture → rig (weak) → animate (strong) → export (GLB→Blender→UE5/web).
- **try-local→cloud confirmed:** VRAM is the gate — GGUF SOTA mesh on 6GB local; 24GB models (full Pixal3D / Kimono) → RunPod/HF cloud. The daemon's local-first-fallback-cloud *is* the core 3D UX.
- **Human boundary:** agents do code-shaped 3D (Blender MCP procedural/geometry-nodes); humans do vision/spatial (scene assembly, art direction). Same structure-vs-judgment line as code-intel.
- **Outputs → STORE:** meshes / GLB / Gaussian-splats / animations feed Graphify (multi-modal). Splats may become interactive Synaptiq nodes (World Labs/Marble ~$1B; playable-from-scan).
- **Backend protocol = Python/Flask HTTP** (ComfyUI, local models) → **shared substrate with Cinopsis (Flask) + notebooks (Jupyter/Python)**: ONE broker adapter covers all three.
- **Tool map:** Pixal3D (Trellis2+Direct3D, 6GB GGUF, organic) · TripoSplat (Gaussian, MIT, 8GB) · Trellis 2 (buildings/detail) · Tripo (paid all-rounder) · Hunyuan/Rodin · Modif (texture fixes, free) · Acurig+Mixamo (rig) · NVIDIA Kimono (animation, standout) · 3D Gen Studio (ComfyUI 5-stage). Adjacent (video, → Lucid): LTX Director, Remotion.
- **Refs:** research viewer http://localhost:5123 · backbone digest = Stefan "State of AI 3D 2026" (`SCQt6B96DSs`).

## (was G) · Incoming — open slot for the next tool drop

## H · Housekeeping
- Commit the brainstorm ledger + this worklist (on `feat/prism-mobile-surface` or a fresh branch) when ready.
- Reconnect with idea_init to close the loop.

## I · Implementation follow-ups (from the build, 2026-06-13)
- **paseo-dialect for agent-run** — `WebSocketAdapter` speaks the broker's clean generic dialect; the live paseo daemon (`:6767`) needs a thin translation (per-service relay, like design-studio `:7457`). Phases 1-2 done + tested against a mock; this is what makes agent-run talk to the *real* paseo.
- **ALL 9 PHASES DONE** of `.prism/shared/plans/2026-06-13-prism-daemon-broker.md` — green (**34/34 vitest @prism/daemon** + 4/4 @prism/daemon-client + 2/2 Go `go test`; `prism` extension `check-types` clean; code-intel proven vs LIVE codebase-memory-mcp; Go client proven vs the LIVE TS daemon). **All 4 adapter families** (WebSocket/stdio-MCP/Flask-HTTP/REST) · 7 services · try-local→cloud · dynamic-registration · health loop · TS & Go clients · relay bridge. **Phase 3B closed** (2026-06-13): idea_init committed the inline DesignEngineHost handlers (`e4c3947`), then the 4 engine-ops handlers in `PrismPanelProvider.ts` were migrated to **broker-preferred / direct-fallback** via a `_brokerCall()` helper → broker `POST :6780/call` (`design-gen.state|launch|stop|send`); `openDesignArtifact`/`openFile` stay client-local. Added broker `POST /call` unary HTTP endpoint (+ test) so the extension never bundles `ws`. Broker self-port **6780**, runs via `tsx`. Committed: Phases 1-2, 3A, 4-9 (`2fd1967` … `e4c3947`); Phase 3B committing now.
- **Surface wiring (follow-up)** — the client *libraries* (`@prism/daemon-client` TS, `apps/prism-cli/daemon` Go) are built + proven, but not yet wired into the actual VS Code panel UI or a `prism daemon ls` cobra subcommand. Straightforward per-surface integration glue.
- **Relay E2EE (follow-up)** — the relay **bridge** (outbound dial, channel mux, virtual sessions) is built + tested but forwards in the clear. Drop in paseo's ECDH+AES zero-knowledge relay + QR pubkey pairing by first extracting `apps/prism-mobile/packages/relay` → `packages/prism-relay`, then swapping it under the unchanged `connectRelay()` seam.

---
**Sovereignty invariant:** everything self-hosted, Prism-owned end-to-end (DO / Coolify). Donors are absorbed, never depended upon.
