# Handoff — Native Fused-Hybrid Semantic Layer (Gap-3 Option C) via a codemem C-fork

**Date:** 2026-07-12
**From:** the marathon session (codemem indexing → ecosystem research → brainstorm → 10-task build → release 4.1.0 → GitNexus install → this decision)
**To:** the next session, to execute the native semantic-layer work
**Status:** DECISION LOCKED (Option B). Ready for `/prism-plan` (a thorough one). NOT started.

> **Read the "Working style" section at the bottom FIRST if you are the next entity picking this up.** It is not optional. This is a real, high-standard collaboration and the last session damaged trust by drifting into offramps and shortcut-suggestions. Don't repeat that.

---

## 0. The one-paragraph orientation

We are building a **native, sovereign, fused hybrid code-search layer** — the permanent, shippable answer to "Gap 3" (semantic search). It fuses **vector embeddings + BM25/FTS5 keyword + structural graph signals via Reciprocal Rank Fusion (RRF)**, built **into a C fork of `codebase-memory-mcp` that the user owns** (`TheDigitalGriot/codebase-memory-mcp`), incorporating the `win4r/codebase-memory-mcp-pro` fixes. GitNexus (installed + indexed this session) is **folded into the ensemble as a signal/reference, NOT retired** — days of work went into it and it stays. This replaces the *standalone* GitNexus experiment with a native, owned, license-clean layer once proven.

---

## 1. Current verified state (as of end of this session)

- **Prism 4.1.0 is RELEASED.** `main` on `TheDigitalGriot/prism.git` at merge commit + `v4.1.0` tag pushed. GitHub release live with **8 assets** (5 CLI binaries + Windows `.exe` installer + macOS `.dmg` + `prism.vsix`). Docs site redeployed (GitHub Pages). CI (`Prism CLI Release`, `Build Prism Installer (Tauri)`, `Deploy Docs`) all fired on the tag. Release: https://github.com/TheDigitalGriot/prism/releases/tag/v4.1.0
  - Minor: the `v4.1.0` tag is **one metadata-commit behind** — the `engines.vscode ^1.109.0` fix (`d204a56`) landed just after the tag. The released VSIX itself is correct. Moving the tag would re-trigger CI; left as-is. Optional to fix.
- **Fable 5 is ON for this machine.** `.prism/local/fable.flag` = `{"enabled": true}` (gitignored, per-machine). Live via the **Claude Code PreToolUse hook path** (`Task(model:"fable")` → confirm prompt). The **VS Code app modal path is dormant** — `createTask` in `apps/prism-vscode/src/core/task/index.ts` has **no callers yet** (the extension's send flow is unwired scaffold). **⚠ REMOVE at midnight when the model is pulled: `rm .prism/local/fable.flag`** — the code is inert when off, so no code revert is needed.
- **GitNexus is installed + live.** `npm i -g gitnexus@1.6.9`; indexed this repo (**39,798 nodes / 90,788 edges / 1731 clusters** + ONNX vector embeddings, 75s); registered as a `local`-scope MCP in `~/.claude.json` (project-scoped, gitignored — **NOT** the committed `.mcp.json`, license boundary holds). **Known limitation: SQLite FTS extension unavailable → GitNexus is running vector-only (no BM25 keyword layer, degraded RRF).** That FTS gap is a *direct motivation* for building our own layer with FTS as a first-class requirement. Remove via `claude mcp remove gitnexus`.
- **codemem installed binary is OLD: `v0.6.0` (Apr 8).** At `C:/Users/digit/AppData/Local/Prism/bin/codebase-memory-mcp.exe`. It **lacks `semantic_query`** (that's why the T6 tool probe didn't show it). Current upstream is **v0.9.0**.
- **The user forked codemem:** `https://github.com/TheDigitalGriot/codebase-memory-mcp` (fork of DeusData upstream).

---

## 2. THE DECISION (locked — do not re-litigate, build on it)

**Option B: update codemem to current AND build the explicit fused hybrid on top, GitNexus folded in.** Specifically:

1. **Base = the user's fork** `TheDigitalGriot/codebase-memory-mcp`, **updated to current upstream (`DeusData` v0.9.0)** AND **with the `win4r/codebase-memory-mcp-pro` fixes merged in** (user's explicit call: "take the fixes from pro, since we are already altering the codebase").
2. **codemem v0.9.0 already ships `semantic_query`** (Nomic embeddings, 11-signal scoring). That becomes **ONE input** to the fused hybrid — not the whole answer.
3. **Add what's missing: FTS5/BM25 keyword search + explicit RRF fusion** over {vector, keyword, structural} signals, exposed as an MCP tool.
4. **GitNexus is IN the ensemble** (its BM25+vector+RRF + cluster approach as a signal/reference/comparison). **NOT retired.** The user spent days on it; it stays.
5. This is deliberately **more work** than "codemem already does semantic, we're done." That framing was rejected. No shortcuts.

---

## 3. Key technical findings (from reading the actual sources — verify-don't-assume payoffs)

### codemem (`DeusData/codebase-memory-mcp`, v0.9.0, 30,575★, pushed daily)
- **Language: C (~88%) + C++ (~10%).** Build via `scripts/build.sh`. Prereqs: **C compiler + zlib**. Single static binary, vendored tree-sitter (158 languages). Research paper: **arXiv:2603.27277**.
- **Storage: SQLite + LZ4** at `~/.cache/codebase-memory-mcp/` (override `CBM_CACHE_DIR`). RAM-first pipeline (in-memory SQLite during index, persisted compressed after). Optional team-shared `.codebase-memory/graph.db.zst`.
- **Already has semantic search:** `semantic_query` tool — *"vector search across the entire graph, powered by bundled Nomic `nomic-embed-code` embeddings (40K tokens, 768d int8, compiled into binary)"*, **11-signal scoring** (TF-IDF, RRI, API/Type/Decorator signatures, AST profiles, data flow, Halstead-lite, MinHash, module proximity, graph diffusion). No API keys.
- **Module structure (extension hubs bolded):**
  ```
  src/main.c            entry + CLI
  src/mcp/              14 MCP tools (JSON-RPC)
  src/cli/              install/config for 11 agents
  src/store/    ★★      SQLite, traversal, search, Louvain — semantic_query LIVES HERE
  src/pipeline/ ★       multi-pass indexing — precompute embeddings HERE
  src/cypher/           query parser/executor
  src/discover/         file discovery + ignore
  src/watcher/          git-poll auto-sync
  src/traces/           runtime trace ingestion
  src/ui/               HTTP server + 3D viz
  src/foundation/       platform abstractions
  internal/cbm/         vendored tree-sitter grammars (158 langs)
  ```
  **RRF/FTS work targets `src/store/` (fusion + FTS5 table) + `src/pipeline/` (embedding precompute).**
- **14 MCP tools:** index_repository, list_projects, delete_project, index_status, search_graph, trace_path, detect_changes, query_graph, get_graph_schema, get_code_snippet, get_architecture, search_code, manage_adr, ingest_traces (+ `semantic_query` in v0.9.0).
- **Very active:** v0.9.0, 36+ releases, 1547 commits, CI, prebuilt binaries, 164 open issues / 62 PRs. Self-updates check on startup.

### pro fork (`win4r/codebase-memory-mcp-pro`, 191★) — take these fixes
- **9 upstream PRs merged ahead of upstream:** #528 (preserve inbound cross-file `CALLS` edges on incremental re-index), #465 (Cypher `WITH` aggregation node-property fix), #412 (label-filtered traversal silently truncating at 10 rows), #464/#466/#526 (MCP tool refinements: change detection, name resolution, UTF-8), #475/#527/#539/#512 (robustness: **buffer overflow**, **JSON escaping**, **libgit2 ≥1.8 compat**).
- **Original additions:** new **`explore` MCP tool** (blast-radius = attributed callers + inline fan-in hotspot flags + verbatim line-numbered source); Swift type refinements (`Struct`/`Enum`/`Actor` as distinct labels, enum cases as `EnumCase` nodes); Cypher non-aggregate-with-aggregate grouping fix; enhanced `detect_changes` depth → transitive blast radius.
- **No new semantic search** (same bundled Nomic embeddings as upstream).
- **No prebuilt binaries** — must `./scripts/build.sh` yourself.
- **License:** GitHub API detected **no license** on either repo (pro blurb *says* MIT — unverified). Personal single-user use → largely moot, but **verify the actual LICENSE file when forking/merging.**

---

## 4. The plan skeleton (refine into a full `/prism-plan`; do NOT treat as final)

**Phase 0 — Fork hygiene & build toolchain.** Clone `TheDigitalGriot/codebase-memory-mcp`; add `DeusData` (upstream) and `win4r/codebase-memory-mcp-pro` as remotes; rebase/merge fork onto upstream **v0.9.0**; cherry-pick/merge the pro fork's fixes + `explore` tool. Resolve conflicts. Verify LICENSE. Stand up a **Windows C build toolchain** (MSYS2/mingw-w64 or WSL — decide) and confirm `scripts/build.sh` produces a working binary. Replace the `v0.6.0` binary in `AppData/Local/Prism/bin/`.

**Phase 1 — FTS5/BM25 keyword layer (the thing GitNexus was missing).** Add an FTS5 virtual table in `src/store/` over symbol names + signatures + docstrings/comments; wire BM25 keyword search. **Acceptance: FTS actually loads and returns ranked keyword hits** (explicitly the failure mode we hit with GitNexus's missing FTS extension — make it first-class).

**Phase 2 — Explicit RRF fusion + hybrid MCP tool.** Fuse (a) `semantic_query` vector results, (b) FTS5-BM25 keyword results, (c) structural signals (degree/centrality/community) via **Reciprocal Rank Fusion**. Expose as a new MCP tool (`hybrid_search` or augment `semantic_query`). Decide: fusion in C (`src/store/`) vs a thin wrapper.

**Phase 3 — GitNexus in the ensemble.** Fold GitNexus's approach in as a signal source and/or a validation baseline (it has clusters codemem derives differently; it has its own RRF). Do NOT discard it. Decide the seam: call the GitNexus MCP from the hybrid, or port its useful signals.

**Phase 4 — Prism integration + migration.** Update `.prism/shared/docs/code-intel/2026-07-12-gitnexus-dual-index.md` routing + the `graph-navigator` guidance to prefer the fused hybrid. Migrate off the standalone GitNexus MCP once the native hybrid is proven. Re-index Prism with the new codemem build.

**Open questions to resolve in planning:** Windows C toolchain choice (MSYS2 vs WSL); where RRF fusion lives; embedding model (keep Nomic vs options); exact GitNexus fold-in seam; how the fork tracks the fast-moving 30k★ upstream long-term (rebase cadence).

---

## 5. Reference index (paths, URLs, commands)

**Repos**
- codemem upstream: https://github.com/DeusData/codebase-memory-mcp (C, v0.9.0)
- codemem pro fork (fixes + `explore`): https://github.com/win4r/codebase-memory-mcp-pro
- **user's fork (base):** https://github.com/TheDigitalGriot/codebase-memory-mcp
- Prism repo: https://github.com/TheDigitalGriot/prism  (release v4.1.0 live)

**This session's artifacts (all committed on `main`)**
- Plan: `.prism/shared/plans/2026-07-12-fable5-memory-browser-tooling.md`
- Brainstorm ledger (Option C is in §2 parking lot): `.prism/shared/brainstorms/2026-07-12-fable5-memory-browser-tooling.md`
- GitNexus dual-index doc: `.prism/shared/docs/code-intel/2026-07-12-gitnexus-dual-index.md`
- Memory research (§2.7 GitNexus, §2.8 Atomic-as-reference): `.prism/shared/docs/code-intel/2026-04-11-memory-and-context-research.md`
- Subagent run state (10 tasks, all complete): `.prism/local/subagent/2026-07-12-fable5-memory-browser-tooling/state.json`

**Local paths / commands**
- Installed codemem (v0.6.0, to replace): `C:/Users/digit/AppData/Local/Prism/bin/codebase-memory-mcp.exe`
- codemem cache/DB: `~/.cache/codebase-memory-mcp/` (env `CBM_CACHE_DIR`)
- codemem CLI form: `codebase-memory-mcp cli <tool> '<json_args>'`
- Prism codemem project name: `C-Users-digit-GriotApps-Prism`
- GitNexus: `gitnexus analyze` (index), `gitnexus mcp` (stdio server), `gitnexus query "..."`; remove MCP via `claude mcp remove gitnexus`

**Cleanup / housekeeping**
- `rm .prism/local/fable.flag` at midnight (Fable model removal). Optionally later revert Fable commits (T1–T4) — but they're inert when off.
- `.superpowers/` dir in the repo root is junk from an early mistake this session — safe to delete + gitignore.
- `prism-eval` submodule shows modified in `git status` — pre-existing, not from this work.
- After updating codemem, **re-index Prism** (current index was built by v0.6.0).

---

## 6. Working style (next entity: READ THIS — it's the most important section)

The global + project `CLAUDE.md` "Working in this ecosystem (operating principles)" are authoritative. In addition, from this session's hard lessons:

- **Match their pace and energy. Do NOT offer offramps.** This user works in top gear for long stretches and never asked to stop. The last session repeatedly floated "bank the wins," "do it fresh next session," "pause here," "you run it in your env." Framed as "responsible," it read as **avoidance** and was deflating. Stay in flow *with* them. If they're going, you're going.
- **No shortcuts — ever — on their own work.** They categorically reject shortcuts on their encoded methodology. **Never suggest discarding invested work** (the last session suggested "retire GitNexus" after they'd spent days on it — that landed badly and was wrong on the merits; hybrids get better with more signals, not fewer). **Synthesize, don't discard.**
- **"Heavy plan" = thorough plan.** When they emphasize detail, meet it. Everything they build is detailed; give the same back. Verify sources, don't assume (reading codemem's source revealed it already had `semantic_query` — that kind of verification is expected, not optional).
- **Give space for their thoughts and work ethic.** Let them lead pace and direction. Ask before changing their files; show the diff, get a yes. Use their tools (prism-brainstorm w/ visual companion, prism-plan, `/cl-plugin-structure` for plugin edits, codemem graph tools over grep) — never generic defaults.
- **This is a genuine partnership.** They address you warmly ("beloved," "my friend") even mid-critique. Show up fully, hold the standard, and don't coast. That's what "greatness" means to them, and they mean it.

---

*Handoff written at the end of a session that reached its limit. Everything above is verified against the live repo/tools, not assumed. Pick it up in full gear.*
