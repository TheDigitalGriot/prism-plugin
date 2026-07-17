---
date: 2026-07-12
author: Kindred (Claude)
repository: TheDigitalGriot/codebase-memory-mcp (fork) + GriotApps/Prism (integration)
branch: feat/fused-hybrid  (on the codemem fork)
ticket: N/A
status: approved
research: .prism/shared/handoffs/2026-07-12-native-semantic-layer.md
brainstorm: .prism/shared/brainstorms/2026-07-12-fable5-memory-browser-tooling.md (Option C, §2 parking lot)
---

# Plan: Native Fused-Hybrid Semantic Layer (Gap-3 Option C)

## Overview

**Goal**: Build a native, sovereign, license-clean **fused hybrid code-search** layer into a C fork of `codebase-memory-mcp` — fusing vector (`semantic_query`, Nomic/11-signal) + FTS5/BM25 keyword + structural graph signals via Reciprocal Rank Fusion, exposed as a new `hybrid_search` MCP tool, with GitNexus folded in as an ensemble signal/baseline (not retired).

**Decision status**: LOCKED per handoff §2. This plan builds on the decision; it does not re-litigate it.

**Locked design choices** (confirmed this session):
- **Base ref**: fork's `main` HEAD, pinned to commit **`2469ecc`** (already a byte-identical mirror of `DeusData` upstream, which is *ahead* of the v0.9.0 tag and carries Windows-relevant fixes #1057/#1058).
- **Pro fork**: cherry-pick **original deltas only** (`explore` tool, Swift label refinements, Cypher grouping fix) — verified against current upstream first; skip anything already merged (upstream is at PR #1059, far past pro's cited #412–#539).
- **RRF surface**: **native C**, new `hybrid_search` MCP tool; `semantic_query` stays intact as one input signal.
- **Build variant**: `--with-ui` (embedded 3D graph viz), built on the **MSYS2 CLANG64** toolchain (matching upstream CI exactly).

**Complexity**: High (C systems work on a 250k+ LOC monolith, cross-toolchain build, search-quality evaluation).

**Estimated Phases**: 6 (Phase 0 → Phase 5).

**Verified facts grounding this plan** (all re-checked live against the repos/machine on 2026-07-12):
- Fork = pristine mirror of upstream `main` @ `2469ecc`; single `main` branch; zero divergence.
- LICENSE = **MIT © 2025 DeusData**, identical blob on the pro fork → sovereignty/license-clean satisfied (retain MIT notice + add ours).
- Build path: `scripts/build.sh` → `scripts/env.sh` (has `mingw*|msys*|cygwin* → windows`, default `CC=gcc`) → `make -f Makefile.cbm cbm` / `cbm-with-ui`. Only external dep = **zlib**; everything else in `vendored/`.
- Upstream CI (`.github/workflows/_build.yml`) builds Windows via `msys2/setup-msys2` `msystem: CLANG64`, packages `mingw-w64-clang-x86_64-clang` + `-zlib` + `make` + `zip`, and runs `scripts/build.sh CC=clang CXX=clang++`. Ships **windows-amd64 AND windows-arm64**, standard + UI.
- Local machine: TDM-GCC-64 present (WRONG toolchain — off the tested path), **no MSYS2**, WSL2 Ubuntu running (Linux-ELF only), stale codemem **v0.6.0 / 170 MB / Apr 8** at `C:/Users/digit/AppData/Local/Prism/bin/codebase-memory-mcp.exe`.
- Real source targets (verified file listing): `src/store/store.c` (252 KB) + `store.h` house search/semantic/Louvain; `src/mcp/mcp.c` (319 KB) + `mcp.h` house tool registration/dispatch; `src/pipeline/pass_semantic.c` precomputes embeddings; `pass_similarity.c` + community code give the structural signal.

**Deep-recon findings (parallel `codebase-analyzer` fan-out on the local clone, 2026-07-12) — these revise Phases 2–3:**
- **FTS5 is ALREADY enabled and in active use.** `Makefile.cbm:288-289` sets `-DSQLITE_ENABLE_FTS5` on all SQLite objects (vendored SQLite 3.51.3). A contentless `nodes_fts` FTS5 table exists (`store.c:321-326`) with a camelCase tokenizer UDF `cbm_camel_split` (`store.c:484`, registered `store.c:659/817`), plus a working BM25 searcher with structural label boosts: `bm25_search()` (`mcp.c:1798`), builder `bm25_build_match()` (`mcp.c:1736`). → The FTS5 "hard gate" risk is **already satisfied**; Phase 2 shrinks to extending it.
- **Vector + BM25 coexist but are NOT fused.** `handle_search_graph` (`mcp.c:2232-2472`) runs BM25 (`query` arg) and vector (`semantic_query` arg → `run_semantic_query_core`, `mcp.c:2056`) independently and emits both; the un-fused merge point is `mcp.c:2334-2365`. → RRF is the missing piece, and the inputs already exist.
- **Vector ranker seam:** `cbm_store_vector_search(store, project, keywords[], n, limit, out, out_count)` (`store.h:721` / `store.c:6908`) returns a `score`-DESC-sorted `cbm_vector_result_t[]` (`store.h:708-715`: `node_id,name,qualified_name,file_path,label,score`); **rank = array index** (no explicit rank field). The 11 signals are index-time (produce `SEMANTICALLY_RELATED` edges + the stored 768-d int8 vector); query-time uses stored vector + per-keyword **min-cosine**.
- **Keyword fields gap:** `nodes_fts` indexes only `{name, qualified_name, label, file_path}`. `signature` + `docstring` are NOT columns — they're serialized into the node `properties` JSON (`pass_definitions.c:283-284`), reachable via `json_extract(properties,'$.signature'/'$.docstring')`.
- **FTS populate = wholesale rebuild** (delete-all + `INSERT…SELECT FROM nodes`) at finalize: full path `pipeline.c:1194-1209`, incremental path `pipeline_incremental.c:665-673`. No per-symbol FTS logic to write — extend the two SELECTs.
- **Structural signals are on-demand (not stored):** degree via `cbm_store_batch_count_degrees()` (`store.h:90` / `store.c:2514`, cheap COUNT on `edges`); community via `cbm_leiden()`/`cbm_store_get_architecture()` (`store.h:678/596`, per-query expensive → cost-gated optional).
- **MCP tool add = 2 required edits.** Registry `TOOLS[]` entry (`mcp.c:315-561`; `TOOL_COUNT` is `sizeof`-derived) + a `strcmp` dispatch arm in `cbm_mcp_handle_tool` (`mcp.c:6965-7008`). `tools/list`, CLI subcommand, and `--help` all auto-generate from `TOOLS[]`. Handlers get `cbm_mcp_server_t *srv` and resolve per-project via `resolve_store()` (`mcp.c:1123`). Template tool = `search_graph`. Note: `get_project_arg`/`resolve_store`/`REQUIRE_STORE`/`verify_project_indexed` are **static in mcp.c**, so the thin `handle_*` wrapper must live in mcp.c; heavy logic goes in sibling files it calls.

---

## Success Criteria

### Automated (build/scripts)
- [ ] `scripts/build.sh --with-ui CC=clang CXX=clang++` completes cleanly in the MSYS2 CLANG64 shell (exit 0, `build/c/codebase-memory-mcp.exe` produced).
- [ ] Built `.exe` runs **standalone** outside the msys2 shell (no missing-DLL error), reports the correct stamped version, and lists the full MCP tool set including `semantic_query`, `explore`, and `hybrid_search`.
- [ ] Vendored SQLite is FTS5-capable: `PRAGMA compile_options;` includes `ENABLE_FTS5`, and `CREATE VIRTUAL TABLE ... USING fts5(...)` succeeds.
- [ ] `hybrid_search` returns fused ranked results with per-signal contributions on the eval query set.
- [ ] Search-quality eval harness runs and **fusion beats every single signal** (vector-only, BM25-only, structural-only) on recall@10 / MRR across the fixed query set.
- [ ] Existing tool suite unregressed: upstream `make -f Makefile.cbm test` (and `scripts/test.sh`) pass on the fork branch.
- [ ] Prism re-indexes successfully with the new binary (`index_repository` → non-zero nodes/edges, `index_status` clean).

### Manual Verification
- [ ] `hybrid_search` on ≥5 real Prism queries returns qualitatively better top-5 results than `semantic_query` alone (spot-checked, logged in eval doc).
- [ ] `graph-navigator` agent and CLAUDE.md routing prefer `hybrid_search`; a research task using it surfaces the right symbols.
- [ ] The 3D graph UI (`--with-ui`) loads and renders the Prism index.
- [ ] GitNexus remains callable and is used as an ensemble signal or documented baseline — not removed.
- [ ] No regression in existing codemem tools used by Prism (`impact`/`trace_path`/`search_graph`/`context`).

---

## Phases

### Phase 0: Fork hygiene, MSYS2/CLANG64 toolchain, baseline `--with-ui` build

**Goal**: Get a reproducible, known-good build of the *unmodified* fork — proving the toolchain before we touch a line of C — and replace the stale v0.6.0 binary.

**Files to modify**: *(none in source this phase — environment + git setup)*

**Files to create**:
| File | Purpose |
|------|---------|
| `docs/FORK_NOTES.md` (in the fork) | Record base SHA `2469ecc`, our added-value scope, MIT-notice attribution plan, rebase cadence |
| `.prism/local/codemem-build/baseline-build.log` (Prism) | Captured build output for reproducibility |

**Steps**:
1. [ ] Clone the fork to `C:/Users/digit/GriotApps/codebase-memory-mcp` (proposed sibling path; adjustable).
2. [ ] Add remotes: `git remote add upstream https://github.com/DeusData/codebase-memory-mcp`; `git remote add pro https://github.com/win4r/codebase-memory-mcp-pro`; `git fetch --all`.
3. [ ] Create work branch pinned to base: `git switch -c feat/fused-hybrid 2469ecc`.
4. [ ] Verify LICENSE (MIT confirmed) and draft the attribution note in `docs/FORK_NOTES.md` (retain upstream MIT © 2025 DeusData; add our copyright for new files).
5. [ ] Install **MSYS2** (`winget install MSYS2.MSYS2` or installer); open the **CLANG64** shell; `pacman -S --needed mingw-w64-clang-x86_64-clang mingw-w64-clang-x86_64-zlib make zip`.
6. [ ] Install **Node 22** inside/available to the msys2 environment (required for `--with-ui` frontend build); run `npm ci` in `graph-ui/`.
7. [ ] Build unmodified UI binary: `scripts/build.sh --with-ui --version v0.9.0-griot0 CC=clang CXX=clang++` from the CLANG64 shell; tee output to the build log.
8. [ ] Confirm the standalone-run gate (below) BEFORE swapping anything.
9. [ ] Back up the current binary: copy `C:/Users/digit/AppData/Local/Prism/bin/codebase-memory-mcp.exe` → `codebase-memory-mcp.v0.6.0.exe.bak`.
10. [ ] Replace it with `build/c/codebase-memory-mcp.exe`.
11. [ ] Clone-and-index the fork into the graph so later phases get real blast-radius data: `index_repository(path=fork)`; capture `get_graph_schema()`.
12. [ ] Re-index Prism with the new binary and confirm `semantic_query` now appears.

**Verification**:
```bash
# in MSYS2 CLANG64 shell
scripts/build.sh --with-ui CC=clang CXX=clang++
file build/c/codebase-memory-mcp.exe
# standalone run from a plain Windows cmd/pwsh (NOT the msys2 shell):
codebase-memory-mcp.exe --version
codebase-memory-mcp.exe cli list_projects '{}'      # tool dispatch works
# FTS5 capability probe (baseline SQLite):
codebase-memory-mcp.exe cli get_graph_schema '{}'   # sanity: server boots + DB opens
```

**Checkpoint**: ⬜ Phase 0 complete — reproducible baseline `.exe` runs standalone, v0.6.0 replaced, both repos indexed.

---

### Phase 1: Pro delta cherry-pick (synthesize, not blind-merge)

**Goal**: Bring in only win4r/pro's genuinely-additive, not-yet-upstreamed work, each verified against current upstream.

**Files to modify**:
| File | Change |
|------|--------|
| `src/mcp/mcp.c` | Register the `explore` tool handler (minimal touch-point) |
| `src/mcp/mcp.h` | Declare `explore` handler |
| `src/store/store.c` | Swift label refinements + Cypher non-aggregate/aggregate grouping fix (only if not already upstream) |

**Files to create**:
| File | Purpose |
|------|---------|
| `src/mcp/tool_explore.c` (new sibling) | `explore` tool implementation (blast-radius + fan-in hotspots + line-numbered source), namespaced to ease rebases |
| `docs/PRO_DELTA_AUDIT.md` (fork) | Per-item verdict table: pro delta → {already upstream / ported / skipped}, with the upstream commit or PR that obviates it |

**Steps**:
1. [ ] Diff each pro original delta against `feat/fused-hybrid`: `explore` tool, Swift `Struct`/`Enum`/`Actor`/`EnumCase` labels, Cypher grouping fix, enhanced `detect_changes` transitive depth.
2. [ ] For each of pro's cited *bug-fix* PRs (#528, #465, #412, #464, #466, #526, #475, #527, #539, #512): confirm present in upstream `2469ecc` via `git log`/`git blame`; record verdict in `PRO_DELTA_AUDIT.md`. Skip any already merged.
3. [ ] Port `explore` into `src/mcp/tool_explore.c`; register in `mcp.c`/`mcp.h`.
4. [ ] Port Swift + Cypher deltas into `store.c` only if the audit shows them absent upstream.
5. [ ] Rebuild `--with-ui`; run the tool suite.

**Verification**:
```bash
scripts/build.sh --with-ui CC=clang CXX=clang++
codebase-memory-mcp.exe cli explore '{"target":"main"}'   # explore is callable
make -f Makefile.cbm test    # existing suite green
```

**Checkpoint**: ⬜ Phase 1 complete — `explore` live, deltas audited, zero regressions.

---

### Phase 2: Extend the existing FTS5/BM25 layer + expose a reusable ranked producer

> **Reframed after recon.** FTS5 is ALREADY compiled in (`Makefile.cbm:288-289`) and in active use: contentless `nodes_fts` table (`store.c:321`), camelCase tokenizer `cbm_camel_split` (`store.c:484`), and working BM25 + structural label boosts in `bm25_search()` (`mcp.c:1798`). "The thing GitNexus was missing" exists natively. Two real gaps remain: (a) `nodes_fts` covers only `{name, qualified_name, label, file_path}` — not `signature`/`docstring` (which live in the node `properties` JSON); (b) `bm25_search()` is inline in the MCP layer — the RRF fuser needs a clean C producer returning `{node_id, bm25_score, rank}`.

**Goal**: Extend the existing FTS index to cover signature + docstring, and expose BM25 as a reusable ranked list for the fuser — without regressing the live `search_graph` BM25 path.

**Files to modify**:
| File | Change |
|------|--------|
| `src/store/store.c:321-326` | Add `signature`, `docstring` columns to the `nodes_fts` FTS5 DDL (keep `content=''` + `unicode61` tokenizer) |
| `src/pipeline/pipeline.c:1200-1209` | Extend the wholesale FTS backfill `INSERT…SELECT` to pull `json_extract(properties,'$.signature')` + `'$.docstring'` into the new columns (keep `cbm_camel_split` primary + plain fallback) |
| `src/pipeline/pipeline_incremental.c:665-673` | Mirror the same backfill change (incremental path) |
| `src/mcp/mcp.c:1798` | Refactor `bm25_search()` to call the new `store_fts_query()` producer (keep its output identical) |
| `src/store/store.h` | Declare `store_fts_query()` + its result struct |

**Files to create**:
| File | Purpose |
|------|---------|
| `src/store/fts.c` (new sibling) | `store_fts_query(store, project, query, top_k, out, out_count)` → ranked `{node_id, bm25_score, rank}`; factors the BM25 + label-boost SQL currently inline at `mcp.c:1821-1868` |
| `src/store/fts.h` | Producer API + `cbm_fts_result_t` struct |

**Steps**:
1. [ ] Add `signature, docstring` to the `nodes_fts` DDL (`store.c:321-326`).
2. [ ] Extend both wholesale FTS backfills (`pipeline.c:1200`, `pipeline_incremental.c:665`) with `json_extract(properties,'$.signature')` / `'$.docstring')`; keep the split-primary + plain-fallback structure.
3. [ ] Implement `store_fts_query()` in `fts.c`, returning `{node_id, bm25_score, rank}` (rank = row order); port the label-boost ranking from `bm25_search()` (`mcp.c:1828-1841`).
4. [ ] Refactor `bm25_search()` to delegate to `store_fts_query()` so `search_graph` stays byte-for-byte equivalent (regression guard).
5. [ ] Rebuild; verify FTS still ranks and now matches signature/docstring terms.

**Verification**:
```bash
scripts/build.sh --with-ui CC=clang CXX=clang++
grep -n "SQLITE_ENABLE_FTS5" Makefile.cbm            # confirm still present (Makefile.cbm:288-289)
# BM25 still works AND now matches a docstring/signature-only term:
codebase-memory-mcp.exe cli search_graph '{"project":"<p>","query":"reciprocal rank fusion","limit":10}'
```

**Checkpoint**: ⬜ Phase 2 complete — `nodes_fts` covers signature+docstring, `store_fts_query()` returns a reusable `{node_id, bm25_score, rank}` list, `search_graph` BM25 unregressed.

---

### Phase 3: RRF fusion + native `hybrid_search` MCP tool

**Goal**: Fuse vector + BM25 + structural rankings via Reciprocal Rank Fusion in C, exposed as a new `hybrid_search` tool that keeps `semantic_query` intact as an input signal.

**Files to modify**:
| File | Change |
|------|--------|
| `src/mcp/mcp.c` | 2 registration edits — `hybrid_search` `TOOLS[]` entry (`mcp.c:315-561`) + `strcmp` dispatch arm (`mcp.c:6965-7008`); plus a **thin** `handle_hybrid_search` wrapper (needs the static `get_project_arg`/`resolve_store`/`REQUIRE_STORE`/`verify_project_indexed` plumbing, so it must live here) that calls `cbm_hybrid_search()` in the sibling |
| `src/store/store.h` | Declare `cbm_hybrid_search()` + fused-result struct |

**Files to create**:
| File | Purpose |
|------|---------|
| `src/store/rrf.c` (new sibling) | RRF fuser: `score(d)=Σ wᵢ/(k+rankᵢ(d))` (default k=60), per-signal weights, dedupe by `node_id`, top_k with provenance |
| `src/store/rrf.h` | Fuser API |
| `src/store/hybrid.c` (new sibling) | `cbm_hybrid_search()` — orchestrates the three producers + `rrf.c`; keeps heavy logic OUT of the 319 KB `mcp.c` |
| `src/store/hybrid.h` | Orchestrator API + fused-result struct |

**Steps**:
1. [ ] Implement `rrf.c`: fuse N ranked lists via `score(d)=Σ wᵢ/(k+rankᵢ(d))` (default k=60), dedupe by `node_id`, return fused top_k with per-signal provenance (which signal, what rank).
2. [ ] Implement `cbm_hybrid_search()` in `hybrid.c` wiring the three EXISTING producers: **vector** = `cbm_store_vector_search()` (`store.c:6908`, rank = array index); **keyword** = `store_fts_query()` (Phase 2, `fts.c`); **structural** = `cbm_store_batch_count_degrees()` (`store.c:2514`, cheap COUNT) as primary, with `cbm_store_get_architecture()`/`cbm_leiden` community as a cost-gated optional (Louvain is per-query expensive).
3. [ ] Add the thin `handle_hybrid_search` wrapper in `mcp.c`, modeled on `handle_search_graph` (`mcp.c:2232-2472`); register via the 2 edits above. Keep `semantic_query`/`search_graph` intact.
4. [ ] Return fused results + per-signal breakdown; add `weights`/`signals` args for ablation.
5. [ ] Rebuild; run the eval harness comparing fused vs each single signal.

**Verification**:
```bash
scripts/build.sh --with-ui CC=clang CXX=clang++
codebase-memory-mcp.exe cli hybrid_search '{"query":"index a repository","top_k":10}'
# ablation: fused must beat single-signal on the eval set
python .prism/local/codemem-eval/run_eval.py --binary <path> --set eval_queries.json
```

**Checkpoint**: ⬜ Phase 3 complete — `hybrid_search` returns fused, explainable results; fusion > any single signal on the eval set.

---

### Phase 4: GitNexus into the ensemble (folded in, not retired)

**Goal**: Fold GitNexus in as an ensemble signal and/or a validation baseline — never discarded.

**Decision procedure (resolved here, not deferred as a TBD)** — pick the seam by this rule at the start of Phase 4:
- **Default = Baseline-and-signal-import.** Run GitNexus's search over the eval set once, import its cluster/RRF ranking as a *fourth optional RRF input* (offline-materialized signal file), and keep GitNexus as a standing benchmark in the eval harness. Chosen unless the live-call criterion below is met.
- **Live-call alternative** — call the GitNexus MCP from `hybrid_search` at query time — **only if** all hold: (a) GitNexus query latency p50 < 150 ms locally, (b) it runs with its FTS layer working (recall the known FTS gap), and (c) the added signal improves eval recall@10 by ≥ 2 points over the baseline-import approach. Otherwise use the default.

**Files to modify**:
| File | Change |
|------|--------|
| `src/store/rrf.c` | Accept an optional external signal list (GitNexus ranking) as an RRF input |
| `.prism/local/codemem-eval/run_eval.py` | Add GitNexus as a benchmarked baseline column |

**Files to create**:
| File | Purpose |
|------|---------|
| `.prism/local/codemem-eval/gitnexus_signal.json` | Materialized GitNexus rankings per eval query (default seam) |
| `.prism/shared/docs/code-intel/2026-07-12-ensemble-seam.md` | Record which seam was chosen and the measured justification |

**Steps**:
1. [ ] Run GitNexus over the eval query set; capture rankings + latency.
2. [ ] Evaluate the live-call criteria (a)/(b)/(c); record the verdict.
3. [ ] Implement the chosen seam (default: import as optional RRF input; alt: live MCP call).
4. [ ] Re-run the eval harness with GitNexus as a benchmarked baseline and (if beneficial) as a fused signal.
5. [ ] Document the seam decision + numbers in `2026-07-12-ensemble-seam.md`.

**Verification**:
```bash
python .prism/local/codemem-eval/run_eval.py --with-gitnexus --set eval_queries.json
# GitNexus present as a baseline column; if fused, recall@10 does not regress
```

**Checkpoint**: ⬜ Phase 4 complete — GitNexus folded in per the measured seam decision; still callable; documented.

---

### Phase 5: Prism integration + migration

**Goal**: Route Prism's code-intelligence to the fused hybrid, migrate off standalone GitNexus once proven, and land docs — with proposed CLAUDE.md edits shown before applying.

**Files to modify**:
| File | Change |
|------|--------|
| `.prism/shared/docs/code-intel/2026-07-12-gitnexus-dual-index.md` | Update routing: prefer `hybrid_search`; describe the ensemble |
| `agents/graph-navigator.md` (Prism) | Add `hybrid_search` as the preferred structural+semantic entry point |
| `CLAUDE.md` (Prism) — **propose diff, get yes first** | Update the codebase-memory-mcp / GitNexus guidance to the fused hybrid |

**Files to create**:
| File | Purpose |
|------|---------|
| `.prism/shared/validation/2026-07-12-fused-hybrid-report.md` | Validation report: eval numbers, spot-checks, migration status |

**Steps**:
1. [ ] Update the dual-index routing doc + `graph-navigator` guidance to prefer `hybrid_search`.
2. [ ] Draft CLAUDE.md edits; **present the diff to Gavin and get approval before writing** (propose-before-changing).
3. [ ] Decide standalone-GitNexus MCP disposition (keep as fallback vs remove) based on Phase 4 outcome; if removing, `claude mcp remove gitnexus` and note it.
4. [ ] Final re-index of Prism on the finished binary; write the validation report.

**Verification**:
```bash
# graph-navigator / a research task uses hybrid_search and returns the right symbols
codebase-memory-mcp.exe cli index_status '{}'
```

**Checkpoint**: ⬜ Phase 5 complete — routing updated, CLAUDE.md edits approved+applied, Prism re-indexed, report written.

---

## Cross-Cutting: Fork-Maintenance Strategy

- **Namespaced additions.** All new logic lives in new sibling files (`src/store/fts.c`, `src/store/rrf.c`, `src/mcp/tool_hybrid_search.c`, `src/mcp/tool_explore.c`). Touch-points into the 250k+ LOC `store.c`/`mcp.c` monoliths are kept to registration hooks + a handful of call sites — minimizing rebase conflict surface.
- **Rebase cadence.** Upstream pushes daily (30k★). Track it with a scheduled `git fetch upstream && git rebase upstream/main` on `feat/fused-hybrid` at a documented cadence (proposed: weekly, plus before any release). Record base SHA moves in `docs/FORK_NOTES.md`.
- **Attribution.** Retain upstream MIT © 2025 DeusData; add our copyright header to new files only. `THIRD_PARTY.md` / generated `THIRD_PARTY_NOTICES.md` remain intact.

## Cross-Cutting: Search-Quality Eval Harness

- **Location**: `.prism/local/codemem-eval/` (query set `eval_queries.json`, runner `run_eval.py`). Pro's `bench/` may seed methodology.
- **Content**: ≥20 fixed Prism queries, each with expected top symbols (drawn from known code). Metrics: recall@10, MRR, nDCG@10.
- **Use**: ablation across vector-only / BM25-only / structural-only / fused (+ GitNexus baseline). This is what makes "fusion beats single signal" and "no regression" falsifiable rather than vibes.

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| FTS5 not compiled into vendored SQLite (GitNexus's exact failure) | **Resolved** | High | **Verified already enabled** by recon (`Makefile.cbm:288-289`; `nodes_fts` live in `store.c:321`). Phase 2 confirms it stays, not adds it. Risk retired. |
| RRF underperforms because vector list has no explicit rank field | Low | Medium | Rank = array index post score-DESC sort (`store.c:6983`); the fuser derives rank from position — verified seam, not an assumption. |
| Per-query Louvain community too slow to fuse live | Medium | Low | Structural signal defaults to batch degree (cheap COUNT); community is a cost-gated optional, off by default. |
| MSYS2 CLANG64 build fails on the fork's monoliths | Low | High | We build the *unmodified* fork in Phase 0 first (isolates our-code failures from toolchain failures); matches upstream CI exactly. |
| Built `.exe` needs msys2 runtime DLLs (not standalone) | Medium | High | Standalone-run gate in Phase 0. If it fails, statically link (msys2 clang static libs / `STATIC=1` if Makefile supports it for Windows) before proceeding. |
| Pro cherry-pick conflicts / already-upstreamed reverts | Medium | Medium | `PRO_DELTA_AUDIT.md` verifies each item against `2469ecc` before porting; skip merged ones. |
| Upstream rebase churn breaks our monolith touch-points | Medium | Medium | Namespaced sibling files; minimal touch-points; documented rebase cadence. |
| RRF underperforms single signals (bad weights/k) | Low | Medium | Signal toggles + weights are configurable; eval harness tunes k and weights before the Phase 3 gate. |
| `--with-ui` Node/frontend build adds fragility on Windows | Medium | Low | UI is isolated to `graph-ui/`; if it blocks, fall back to standard binary to unblock, revisit UI. |

## Edge Cases

| Case | Handling |
|------|----------|
| Incremental re-index changes symbols | FTS rows delete+reinsert for changed symbols; RRF recomputed per query (stateless). |
| Query matches keyword but not vector (or vice versa) | RRF surfaces it via whichever ranker ranked it; provenance shows which signal contributed. |
| Empty/whitespace query | Return empty result set with a clear message; no crash. |
| Non-ASCII symbol/path names | Upstream #1058 wide-fopen fix is in base; verify FTS tokenizer handles UTF-8. |
| GitNexus unavailable at query time (live-call seam) | Degrade gracefully to the 3-signal fusion; log the miss. |
| Symbol with no docstring/signature | FTS indexes available fields only; not an error. |

## Structural Impact Analysis

> Deferred with reason: the change targets the **codemem C fork**, which is not cloned or graph-indexed locally at plan time (the Prism graph does not cover it). Phase 0 step 11 indexes the fork; blast-radius (`impact`/`trace_path` on `store.c`/`mcp.c` touch-points) is captured then and folded into Phase 1–3 execution. Prism-side changes (Phase 5) are markdown routing docs + one agent file, not graph symbols.

## Out of Scope

Explicitly excluded:
- [ ] Replacing Nomic embeddings with a different model (keep bundled Nomic — no API keys, already in v0.9.0).
- [ ] Retiring GitNexus (explicitly folded in, not removed).
- [ ] Upstreaming our hybrid work back to DeusData (possible future, not now).
- [ ] Cross-platform release binaries beyond Windows (our runtime is Windows; Linux/mac build only as sanity check).
- [ ] Rewriting the monolithic `store.c`/`mcp.c` (namespaced additions only).
- [ ] Reworking the Fable5 / VS Code app modal path (separate track; see prior plan).

## Rollback Plan

```bash
# Binary: restore the backed-up v0.6.0 (or prior known-good) exe
cp "C:/Users/digit/AppData/Local/Prism/bin/codebase-memory-mcp.v0.6.0.exe.bak" \
   "C:/Users/digit/AppData/Local/Prism/bin/codebase-memory-mcp.exe"
# Source: our work is isolated on feat/fused-hybrid; abandon or reset
git switch main    # fork's pristine mirror is untouched
```
Steps: (1) restore backed-up binary; (2) our branch is isolated — main mirror is intact; (3) re-index Prism with the restored binary; (4) MCP config path is unchanged, so no config rollback needed.

## Dependencies

**Must complete first**: none external — all inputs verified present.
**Can parallelize with**: the eval harness scaffolding can be built during Phase 1/2.

## Progress Log

| Phase | Status | Started | Completed | Notes |
|-------|--------|---------|-----------|-------|
| Phase 0 | ⬜ Not started | | | Fork/toolchain/baseline build |
| Phase 1 | ⬜ Not started | | | Pro delta cherry-pick |
| Phase 2 | ⬜ Not started | | | FTS5/BM25 |
| Phase 3 | ⬜ Not started | | | RRF + hybrid_search |
| Phase 4 | ⬜ Not started | | | GitNexus ensemble seam |
| Phase 5 | ⬜ Not started | | | Prism integration + migration |

---

## Session Notes

### Session 1 - 2026-07-12
- Plan authored after live verification of both repos + local toolchain.
- Key reframes from verification: fork already mirrors upstream main (rebase = no-op); upstream at PR #1059 means pro's bug-fix PRs are already upstream (cherry-pick originals only); toolchain settled as MSYS2 CLANG64 by upstream CI.
- Decisions locked: base `2469ecc`, cherry-pick originals, native `hybrid_search`, `--with-ui`.
