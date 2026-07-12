# GitNexus Dual-Index — Semantic Search Alongside codemem (Local-Only)

> Code-intel note for the Fable 5 / memory / browser-tooling work
> Date: 2026-07-12
> Decision: Gap 3 (semantic search) → dual-index GitNexus **locally** (brainstorm B1)
> Provenance: [2026-04-11-memory-and-context-research.md](./2026-04-11-memory-and-context-research.md) §2.7 + the 5 gaps · [../../brainstorms/2026-07-12-fable5-memory-browser-tooling.md](../../brainstorms/2026-07-12-fable5-memory-browser-tooling.md) decision B1

---

## ⚠️ License Boundary (read this first)

**GitNexus is licensed PolyForm Noncommercial.** It is used here as an *external, locally-run tool* only.

- **NEVER** add GitNexus to the plugin's committed / distributed `.mcp.json` (the repo-root `.mcp.json` ships with the plugin).
- **NEVER** bundle the GitNexus binary or its code inside the plugin.
- Register it **only** at project/user scope in a config that is **not committed** — e.g. `.claude/settings.local.json` or a local `.mcp.json` kept out of version control.
- Adopting GitNexus *patterns* (the 5 gaps in the 2026-04-11 research) is fine; **copying its code or shipping the binary is not.**

Shipping GitNexus inside Prism would ship a noncommercial dependency inside a distributed plugin — a license violation. The committed `.mcp.json` must contain no reference to `gitnexus`. This boundary is asserted by an automated grep in the Phase 5 verification: `grep -ri gitnexus .mcp.json` must return nothing.

---

## 1. The Split — Structural vs Semantic

Prism's code-intelligence layer answers two different kinds of question, and each has a different backing tool.

| Query kind | Example | Tool | Status |
|---|---|---|---|
| **Structural** | "What calls `LoginHandler`?" · "Show the call chain" · "Is this dead code?" · blast-radius before an edit | **codebase-memory-mcp** (codemem) | Already indexed (this repo, ~61k nodes) — shipped |
| **Semantic** | "Find the auth flow" when nothing is literally named `auth` · "Where is rate limiting handled?" · concept-level lookup | **GitNexus** (local, external MCP) | Local dual-index experiment — never shipped |

codemem exposes `search_graph` (structural/keyword) and `search_code` (grep-like text) but has **no embedding-based semantic search and no result fusion**. GitNexus's `query` tool combines BM25 + ONNX embeddings + Reciprocal Rank Fusion (RRF) in a single call, so "find the authentication flow" returns conceptually relevant results even when no symbol is literally named `auth`. That embedding + RRF capability is exactly Gap 3 from the 2026-04-11 research (§2.7).

```
  Question
     │
     ├── structural? ──► codemem  (search_graph / trace_path / query_graph)
     │                   "what calls X", "blast radius", "dead code"
     │
     └── semantic?  ──► GitNexus (local `query`: BM25 + vector + RRF)
                         "find the auth flow", concept with no literal name
```

This is a **dual-tool** arrangement: both run at once, each answering the query kind it is good at. It is the research's #1-ranked next action (~30 min, zero-risk) precisely because it requires no changes to Prism's shipped code — only a local MCP registration.

---

## 2. Setup Is Manual (User Step — Nothing Is Installed by Prism)

Installing the GitNexus binary and registering the local MCP is a **manual, per-developer step**. Prism does not install, bundle, or auto-register it. Do this only on your own machine.

### 2.1 Install the GitNexus binary locally

Follow GitNexus's own upstream install instructions ([abhigyanpatwari/GitNexus](https://github.com/abhigyanpatwari/GitNexus)). It is a TypeScript/Node.js tool (not Go), so it runs as a local stdio subprocess — it cannot be embedded in Prism's Go CLI, only called as an external MCP server. Index this repo locally per GitNexus's docs before querying.

### 2.2 Register it as a local, uncommitted stdio MCP (project scope)

Register GitNexus following the local-stdio conventions in [`skills/cl-plugin-structure/references/mcp-patterns.md`](../../../../skills/cl-plugin-structure/references/mcp-patterns.md) (a local stdio server runs as a local process with the user's permissions — the default, lowest-latency server type). Put the registration in an **uncommitted** file. Two equivalent options:

**Option A — `.claude/settings.local.json`** (the per-project, gitignored settings file):

```json
{
  "mcpServers": {
    "gitnexus": {
      "type": "stdio",
      "command": "gitnexus",
      "args": ["mcp"]
    }
  }
}
```

**Option B — a local `.mcp.json` kept out of version control.** If you use this route, ensure the file is gitignored and is NOT the repo-root committed `.mcp.json`. Do not add the `gitnexus` block to the committed `.mcp.json`.

> Adjust `command` / `args` to match GitNexus's actual MCP-server invocation from its upstream docs. The exact binary name and subcommand are set by GitNexus, not by Prism.

### 2.3 Verify it registered locally (and that the boundary holds)

- `claude mcp list` (or `/mcp` in an interactive session) should show `gitnexus` among the active servers.
- The GitNexus tools appear in the tool list under the local MCP namespace.
- The committed `.mcp.json` still lists **only** `codebase-memory-mcp` and `chrome-devtools` — `grep -ri gitnexus .mcp.json` returns nothing.

To remove it (e.g. the experiment is over): delete the `gitnexus` block from your local settings file. Nothing was shipped, so there is nothing in the plugin to revert.

---

## 3. Routing Note (for research / graph-navigator)

When both tools are available locally, route by query kind:

- **Prefer codemem for structure.** Any "what calls X", call-path, dependency, blast-radius, or dead-code question goes to codebase-memory-mcp (`search_graph`, `trace_path`, `query_graph`, `detect_changes`). The `graph-navigator` agent already targets codemem — keep it there.
- **Prefer GitNexus for semantic.** Concept-level lookups where no symbol is literally named after the concept ("find the auth flow", "where is retry/backoff handled") go to GitNexus's `query`.
- **Default to codemem when unsure** — it is the shipped, always-present tool; GitNexus is an optional local add-on that may not be registered on every machine. Never make a shipped workflow *depend* on GitNexus being present.

This routing lives here in the code-intel doc (not in a distributed file that could imply GitNexus is a Prism dependency). Research agents should treat GitNexus as an opportunistic semantic assist, not a required part of the pipeline.

---

## 4. Where This Fits (Provenance & End-State)

- **Research:** [2026-04-11-memory-and-context-research.md](./2026-04-11-memory-and-context-research.md) — §2.7 "GitNexus — richer than codebase-memory-mcp in 5 specific ways", specifically **Gap 3: Hybrid BM25 + vector + RRF search**. The research explicitly flags GitNexus as PolyForm Noncommercial ("patterns can be adopted, code cannot be copied") and offers two paths to close Gap 3: (a) wait for codemem to add embeddings upstream, or (b) run GitNexus alongside codemem. This doc documents path (b), local-only.
- **Decision:** [2026-07-12-fable5-memory-browser-tooling.md](../../brainstorms/2026-07-12-fable5-memory-browser-tooling.md) **B1** — "Gap 3 (semantic search) → Dual-index GitNexus locally now… **NEVER** bundle/ship it inside Prism." The other four gaps (1 community skill-gen, 2 live-stats CLAUDE.md injection, 4 `detect_changes` hard gate, 5 `/prism-wiki`) are built as-researched, from scratch — not by copying GitNexus.
- **Shippable end-state (not this doc):** the brainstorm's §2 parking lot records **Option C** — a *native* semantic layer in Prism (`sqlite-vec` + BM25 + vector + RRF, à la Atomic), which would replace the GitNexus dependency entirely and is the real distributable answer. This dual-index note is the zero-risk interim experiment that validates the hybrid-search value before that heavier native build is planned.
