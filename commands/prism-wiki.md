---
description: Generate an LLM-summarized architecture wiki under .prism/shared/docs/wiki/ from the codebase-memory-mcp graph
argument-hint: "[<package-or-path>...] [--review]"
allowed-tools: mcp__codebase-memory-mcp__list_projects, mcp__codebase-memory-mcp__index_status, mcp__codebase-memory-mcp__index_repository, mcp__codebase-memory-mcp__get_graph_schema, mcp__codebase-memory-mcp__get_architecture, mcp__codebase-memory-mcp__search_graph, mcp__codebase-memory-mcp__query_graph, mcp__codebase-memory-mcp__trace_path, mcp__codebase-memory-mcp__detect_changes, Read, Write, AskUserQuestion
model: sonnet
---

# Prism Wiki — Graph → Architecture Wiki

Generate a living architecture wiki for the codebase **from the code knowledge graph**
(`codebase-memory-mcp`), not from hand-reading files. Structure is read from the indexed
graph and the prose summaries are written by **Claude itself at runtime** — no external API
key is used. The result stays grounded in what the code actually is.

Arguments (`$ARGUMENTS`):
- Optional scope tokens — one or more package names / path globs (e.g. `apps/prism-cli`)
  to limit the wiki to those units. No scope → cover every major structural unit.
- `--review` — enumerate the structural units first and **pause for the user to prune,
  rename, or merge** them before the summarization pass runs (see step 3).

## When to use

- Onboarding a new surface/contributor who needs a structural map fast.
- After a large feature lands (e.g. a new package), to regenerate the architecture overview.
- To produce a structural snapshot for onboarding. (For a live stats block *inside*
  `CLAUDE.md`, use `scripts/prism-inject-stats.py` — `/prism-wiki` never edits `CLAUDE.md`.)

## Prerequisites

- `codebase-memory-mcp` available (graph tools). If the project isn't indexed, run
  `index_repository` first.

## Real tools this command uses

Only these `codebase-memory-mcp` tools exist — use them, invent nothing:
`list_projects`, `index_status`, `index_repository`, `get_graph_schema`,
`get_architecture`, `search_graph`, `query_graph`, `trace_path`, `detect_changes`.
There is **no** "communities" / "clusters" tool — enumerate modules/areas with
`get_architecture` and/or `query_graph` over `Module`/`File`/`Folder` nodes.

## Workflow

### 1. Orient on the graph

```
list_projects()                       # confirm the project + node/edge counts
index_status(project=<P>)             # confirm the index exists / freshness
get_graph_schema(project=<P>)         # node labels + edge types available
get_architecture(project=<P>)         # packages, services, label/edge histogram
```

If `list_projects()` does not include this repo, run `index_repository(repo_path=".")`
and wait for it to finish before continuing.

### 2. Enumerate the structural units

The **primary path** derives the unit list from real codemem output:

- Read the package/service list straight from `get_architecture(project=<P>)`.
- Where `get_architecture` is coarse, enumerate module/folder nodes with `query_graph`,
  e.g.:
  ```
  query_graph(project=<P>, query="MATCH (m:Module) RETURN m.name, m.path ORDER BY m.path")
  query_graph(project=<P>, query="MATCH (f:Folder) RETURN f.path ORDER BY f.path")
  ```

Pick the unit of the wiki — usually **package/folder**. If scope tokens were passed in
`$ARGUMENTS`, keep only units matching those tokens.

> Optional: this repo's `scripts/prism-sync-skills.py` derives cluster names from the same
> graph; you MAY reuse those derived clusters as a naming hint. This is only a convenience —
> the authoritative unit list still comes from the real codemem tools above.

### 3. `--review` gate (only when `--review` is present)

Before doing any summarization, present the enumerated unit list to the user and let them
shape it. Use `AskUserQuestion` (or a plain confirmation prompt) to let the user:

- **prune** units that shouldn't get a page (generated code, vendored dirs, test-only dirs),
- **rename** a unit's page title, and/or
- **merge** several small units into one page.

Wait for the user's response and apply their edits to the unit list. Only then proceed to
step 4. Without `--review`, skip this gate and continue automatically.

### 4. Inspect each unit

For each unit in the (possibly reviewed) list:

```
search_graph(project=<P>, label="Class",     file_pattern="<pkg>/**", limit=0)
search_graph(project=<P>, label="Interface", file_pattern="<pkg>/**", limit=0)
search_graph(project=<P>, label="Function",  file_pattern="<pkg>/**", min_degree=2)   # load-bearing
search_graph(project=<P>, label="Route",     file_pattern="<pkg>/**")                  # HTTP/RPC surface
```

**Schema-gate label-specific queries.** Before running any query that names a specific node
label (e.g. `Route`, `Interface`, `Class`), check the schema you fetched in step 1
(`get_graph_schema`) to confirm that label actually exists in this graph. Skip or adjust
queries for labels the schema doesn't list — e.g. a non-HTTP repo won't have `Route`, so
running that query only returns confusing empty results. Only query labels the schema reports.

Prefer `query=` (BM25) for natural-language discovery, `name_pattern=` for exact regex,
`semantic_query=[...]` to bridge vocabulary. Use `max_degree=0, exclude_entry_points=true`
to surface dead code worth noting.

### 5. Blast-radius the key symbols

For each high-degree function/class a page highlights, trace inbound callers with the real
`trace_path` tool (`mode="calls"`):

```
trace_path(project=<P>, function_name="<name>", mode="calls", direction="inbound", depth=3, risk_labels=true)
```

Record direct + transitive caller counts so the wiki conveys *risk*, not just presence.

### 6. Summarize each unit and write the wiki (Claude, no external API)

Write Markdown to `.prism/shared/docs/wiki/` using the `Write` tool. **You (Claude) write the
prose summaries directly** from the graph facts gathered above — do not call any external
summarization API or require an API key.

- `index.md` — architecture overview: the `get_architecture` histogram, the package/module
  map, the dominant edge types (e.g. CALLS, IMPORTS), and a one-line role per unit, with
  links to each unit page.
- `<unit>.md` per unit — a short **purpose** summary, its **key symbols** (classes/interfaces
  with a one-line purpose each), its **entry points** (public routes / high-degree functions),
  and blast-radius notes for the load-bearing symbols.

Each page header records provenance: the project name, node/edge counts, and the generation
date. Note that the index may lag uncommitted changes — run `detect_changes(project=<P>)`
and mention any HIGH/CRITICAL drift so readers know the map may be slightly stale.

### 7. Live stats in CLAUDE.md — defer to the dedicated injector

For a live node/edge-count block in `CLAUDE.md`, run `python scripts/prism-inject-stats.py`
(a dedicated marker-safe injector); `/prism-wiki` never edits `CLAUDE.md`.

## Rules

1. **Graph first** — read structure from the graph (codemem), not by globbing/reading files.
   Fall back to file reads only for prose (comments/docstrings) the graph doesn't carry.
2. **Real tools only** — reference only the codemem tools listed above. No "communities" tool,
   no external API. Summaries come from Claude at runtime.
3. **Cite counts** — every "load-bearing" claim is backed by a degree/caller count from the graph.
4. **Provenance** — every generated page records the project, counts, and date, and notes that
   the index may lag uncommitted work.
5. **Idempotent, scope-aware** — regenerating replaces content in place without appending
   duplicates, but the blast radius depends on scope:
   - **FULL run** (no `$ARGUMENTS`): regenerate all unit pages and rewrite `index.md` so it
     covers all units.
   - **SCOPED run** (`$ARGUMENTS` names specific units): write/replace ONLY the in-scope
     units' pages, and **MERGE** (not replace) the `index.md` unit list — update the entries
     for in-scope units and leave every other entry intact. NEVER delete pages or `index.md`
     entries for units outside the scope; a scoped run must not destroy prior wiki content.
6. **No editorializing** — describe the structure the graph shows; this is a map, not a review.

## Output

`.prism/shared/docs/wiki/index.md` + one page per unit under `.prism/shared/docs/wiki/`.
(A live `CLAUDE.md` stats block is out of scope here — run `scripts/prism-inject-stats.py`
for that; `/prism-wiki` never edits `CLAUDE.md`.)
