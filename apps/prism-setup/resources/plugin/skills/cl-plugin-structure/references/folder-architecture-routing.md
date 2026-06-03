# Folder Architecture: The Routing-Table Pattern

> Practitioner pattern for organizing project context so the agent loads only what each task needs. Framing adapted from Clief Sundberg's Quantum Quill Lyceum (Skool) — Section 3 "Folder Architecture: The Full Method." The patterns are consistent with the research in [token-optimization-research.md](./token-optimization-research.md); this doc gives them a single, audit-friendly name.

---

## Table of Contents

1. [The Four Leaks (Audit Framing)](#1-the-four-leaks-audit-framing)
2. [Three Layers, Named](#2-three-layers-named)
3. [Layer 1 — The Map (CLAUDE.md as Routing Table)](#3-layer-1--the-map-claudemd-as-routing-table)
4. [Layer 2 — The Rooms (Workspace Context Files)](#4-layer-2--the-rooms-workspace-context-files)
5. [Layer 3 — The Tools (Skills Wired Per Room)](#5-layer-3--the-tools-skills-wired-per-room)
6. [Naming Conventions as Structural Shortcuts](#6-naming-conventions-as-structural-shortcuts)
7. [Why It Works (Connection to Existing Research)](#7-why-it-works-connection-to-existing-research)
8. [Plugin Implications](#8-plugin-implications)
9. [Sources](#9-sources)

---

## 1. The Four Leaks (Audit Framing)

Before designing the layers, name what's leaking. Every project context system that fails fails at one of these four points. Use this as a checklist when auditing an existing plugin or project setup.

| Leak | Symptom | Fix |
|---|---|---|
| **The cold-start leak** | Every new chat begins with the user re-explaining who they are, what the project is, and what good output looks like | A persistent `CLAUDE.md` carrying identity, project, and quality bar — paid for on first read, free on every subsequent message |
| **The one-bucket leak** | Unrelated context (video production notes during blog drafting, frontend code during admin work) sits in the window competing for attention | Workspace separation — split the project into "rooms" with per-room context files that only load when the agent is operating in that room |
| **The guess-what-to-read leak** | Agent reads everything just in case (token-expensive) OR guesses wrong about what's relevant (bad output, user corrects, more tokens) | A **routing table** at the top of `CLAUDE.md` that names, for each task type, the exact files to read and the skills to use |
| **The always-loaded-skill leak** | Every skill, instruction, and process spec gets front-loaded into the system prompt or memory, whether or not it's relevant to the current task | Skills as on-demand packages routed in from the table, not preloaded globally — the same progressive-disclosure principle that makes SKILL.md work |

These four leaks compound: a project with all four loses more tokens to orientation overhead than to actual work. A project with none of them spends its context budget on the conversation that matters.

Reference: Clief, "1.2 Your First Folder" (the cold-start leak) and "3.1 The Full Walkthrough" (the other three).

---

## 2. Three Layers, Named

| Layer | Name | What it is | When it loads |
|---|---|---|---|
| **1** | **The Map** | `CLAUDE.md` at project root — identity, folder structure, naming conventions, **routing table** | On every task, automatically |
| **2** | **The Rooms** | Per-workspace context files — one room per kind of work (Writing, Production, Community, etc.) | When the routing table says this task belongs in that room |
| **3** | **The Tools** | Skills, MCP servers, scripts — wired into specific rooms, not globally available | When the task in the room calls for that tool |

The labels are Clief's; the structure mirrors the AI memory hierarchy described in his lesson 2.3 (system prompt → retrieved context → on-demand tooling), which itself mirrors the traditional memory hierarchy (registers → cache → RAM → disk).

---

## 3. Layer 1 — The Map (`CLAUDE.md` as Routing Table)

The single most under-used pattern. Most `CLAUDE.md` files describe the project. A routing-table `CLAUDE.md` *also* tells the agent **where to go next for each kind of task**.

### Anatomy

```markdown
# Identity
You are helping [USER] with [WORK].

# Folder Structure
- /writing-room — drafts, blog posts, newsletters
- /production — scripts, animations, builds
- /community — content, docs, discord

# Naming Conventions
- Drafts: `<slug>_draft.md`
- Newsletters: `YYYY-MM-<topic>.md`
- Scripts versioned: `<name>_v<N>.md`

# Routing Table
| Task | Read first | Skip | Use skills |
|------|------------|------|------------|
| Draft a blog post | /writing-room/CONTEXT.md, /writing-room/voice.md | /production, /community | doc-coauthoring, humanizer |
| Build a scene | /production/CONTEXT.md, /production/beat-map.md | /writing-room, /community | r3f-scene-editor, motion-design |
| Reply to a community post | /community/CONTEXT.md, /community/tone.md | /production, /writing-room | (none — direct response) |

# Rules
- Read this file first on every new task
- The routing table is authoritative; do not read files outside the listed paths
- When unsure, ask before reading
```

### Why the table is the load-bearing element

Without a routing table, the agent has two failure modes — both expensive:

1. **Read-everything-just-in-case.** Loads 30 files (most irrelevant), context window saturates with noise, output degrades per Chroma's context-rot study (see [token-optimization-research.md §1](./token-optimization-research.md#1-context-rot-the-core-problem)).
2. **Guess-and-miss.** Reads the wrong files, produces wrong output, user corrects, agent re-reads, conversation grows, compaction triggers, nuance lost.

The routing table replaces both with a deterministic load list. The user pays for it once at the top of every task; the agent never has to deliberate about what to read.

### Budget

Keep `CLAUDE.md` under **5,000 tokens total** ([token-optimization-research.md §8](./token-optimization-research.md#8-claudemd-hygiene)). The routing table is what earns its place; everything else is on probation. If a line doesn't either (a) route to a file, (b) name a convention the agent can't infer, or (c) state a constraint that affects output — delete it.

---

## 4. Layer 2 — The Rooms (Workspace Context Files)

Each workspace folder gets its own `CONTEXT.md` (or differently named per-room context file referenced by the routing table). The room file describes:

- What this workspace is for
- The process inside it (first I do X, then Y)
- File organization within the room
- Voice / quality bar / constraints specific to this room

### What this isolates

Token-wise, the writing-room context never enters the window while the agent is in production. Attention-wise, the production-only conventions never compete with writing decisions. The room boundary is enforced by the routing table in Layer 1.

### Example: Writing Room context file

```markdown
# Writing Room

## What this room is for
Long-form drafts: blog posts, newsletters, essay-form thinking pieces. Not short-form social or scripts.

## Process
1. Read /writing-room/voice.md before drafting
2. Output to /writing-room/drafts/<slug>_draft.md
3. Wait for review; do not auto-promote drafts to /writing-room/final/

## Files in this room
- voice.md — voice and tone reference
- past-posts/ — recent published posts (do not modify)
- drafts/ — work in progress
- final/ — approved, published, do not modify

## Quality bar
- One idea per paragraph
- Concrete examples before abstractions
- Cut anything that sounds like AI default phrasing
```

### Directory-scoped CLAUDE.md as an alternative

Claude Code natively loads child-directory `CLAUDE.md` files on demand when work happens in those directories ([token-optimization-research.md §8](./token-optimization-research.md#8-claudemd-hygiene)). Two valid ways to implement Layer 2:

| Option | Pattern | When to pick |
|---|---|---|
| **Per-room CONTEXT.md** | Root `CLAUDE.md` routes explicitly to `/writing-room/CONTEXT.md` | When you want the routing table to be the single source of truth and the room files to be passive |
| **Directory-scoped CLAUDE.md** | Each room has its own `CLAUDE.md`; Claude Code auto-loads when working in that directory | When you want the agent's behavior to shift automatically as it moves between rooms |

Both work. The routing-table version is more explicit (easier to audit), the directory-scoped version is more ergonomic in long sessions.

---

## 5. Layer 3 — The Tools (Skills Wired Per Room)

This is where the routing-table framing connects directly to skill design.

A skill is a folder with a `SKILL.md` and supporting files (see this skill's main `SKILL.md` for the format). The mistake most people make is treating skills like always-on system instructions — "load the humanizer skill globally because every output should be humanized." That's the always-loaded-skill leak.

The routing-table fix: name skills in the routing table, per task. The humanizer skill is wired into "draft a blog post" but not into "build a scene." The r3f-scene-editor skill is wired into "build a scene" but not into "reply to a community post."

### Skill wiring as Layer 3

```markdown
# In Layer 1 routing table:
| Draft a blog post | /writing-room/CONTEXT.md | ... | doc-coauthoring, humanizer |

# In Layer 2 room file (/writing-room/CONTEXT.md):
## Skills wired into this room
- doc-coauthoring — for structured drafting workflows
- humanizer — pass drafts through before promoting to /final/
```

Both layers reference the skill so the routing is visible from either entry point. Skills themselves stay generic (work in any project); the wiring decision is project-specific (which rooms get which skills).

### Connection to skill design

The same progressive-disclosure principle applies inside the skill. From [token-optimization-research.md §3](./token-optimization-research.md#3-progressive-disclosure-the-highest-leverage-fix):

- **Discovery layer** (frontmatter): ~80 tokens, read at startup
- **Activation layer** (SKILL.md body): ~400-800 tokens, loads when routed to
- **Execution layer** (reference files): loaded on demand by the skill itself

The whole architecture is fractal: routing tables route to rooms route to skills route to reference files. Each level only loads what the next level explicitly names.

---

## 6. Naming Conventions as Structural Shortcuts

From Clief 3.1: naming conventions in `CLAUDE.md` let the agent find, organize, and move files without any database, vector store, or code-side index.

```markdown
# Naming Conventions
- Blog drafts:        <slug>_draft.md
- Blog published:     <slug>_final.md
- Newsletters:        YYYY-MM-<topic>.md
- Demo scripts:       demo_v<N>.md  (versioned)
- Beat maps:          <scene-id>_beats.md
- Project state:      <project>-project.json  (single source of truth)
```

When the user says "pull my demo v2 and build a spec from it," the agent already knows the file is named `demo_v2.md`, where it lives (Production room, per routing table), and what shape the output should take (per the room's CONTEXT.md). No retrieval needed; the filename is the retrieval.

This is the same principle as the autoresearch pattern of using filesystem paths as state ([token-optimization-research.md §2 Pattern 2](./token-optimization-research.md#2-autoresearch-architectural-lessons)) — keep structure in the names, not the conversation.

---

## 7. Why It Works (Connection to Existing Research)

Clief's framing is the practitioner-facing surface of patterns this skill's research already validates from other angles:

| Clief layer / leak | Underlying research in this skill |
|---|---|
| Routing table replaces guess-and-read | Selective retrieval over cumulative accumulation — [Attention Residuals §2.5](./token-optimization-research.md#25-attention-residuals-theoretical-foundation-for-selective-context). Loading the routed slice mimics what attention residuals do inside the model. |
| Workspace rooms isolate context | Bounded scope ([§2 Pattern 1](./token-optimization-research.md#2-autoresearch-architectural-lessons)) and subagent isolation. Per-room context is the project-level analog of agent-level scope constraints. |
| Skills as on-demand packages | Progressive disclosure ([§3](./token-optimization-research.md#3-progressive-disclosure-the-highest-leverage-fix)) — 85-100x reduction by loading instructions only when the routing table calls for them. |
| Naming conventions = structural lookup | State on disk, re-read from disk ([§2 Patterns 2 + 8](./token-optimization-research.md#2-autoresearch-architectural-lessons)). The filename *is* the index. |
| Cold-start leak fixed by persistent CLAUDE.md | CLAUDE.md hygiene ([§8](./token-optimization-research.md#8-claudemd-hygiene)) — the file Claude loads automatically becomes the cheapest possible source of identity and constraints. |

The Mad Libs / template insight from Clief 2.3 — that all programming is filling typed slots, and code and data are the same thing in an LLM — is the conceptual case for why structured context (typed slots in the routing table) produces structured output. It's the same principle the Attention Residuals paper proves at the architecture level: selective, structured loading beats undifferentiated accumulation, every time.

---

## 8. Plugin Implications

When designing a plugin (rather than a project), the routing-table pattern shifts:

- **Plugin `CLAUDE.md`** doesn't exist at the plugin level — Claude Code reads project-level `CLAUDE.md`, not plugin-level. The plugin contributes routing-aware *skills* that a project's `CLAUDE.md` can route to.
- **The plugin's job** is to make its skills routable: precise `description:` frontmatter (so the project's routing table can name the skill confidently), tight SKILL.md bodies (so loading the skill doesn't blow the budget), and on-demand references (so the skill itself does progressive disclosure inside it).
- **The plugin's MCP servers** are tools the routing table at the project level can name. Token-cheap servers (small tool counts, two-stage tool exposure — see [token-optimization-research.md §9](./token-optimization-research.md#9-mcp-server-token-patterns)) make routing decisions easier.
- **A plugin can ship example `CLAUDE.md` templates** in `examples/` showing how to route to the plugin's skills from a project — concrete routing-table syntax that users can adapt.

The audit question for a plugin shipping a skill becomes: "If a project's routing table names this skill for a specific task, what's the smallest, most relevant set of tokens the skill needs to deliver?" That's the same progressive-disclosure question, framed at the consumption side.

---

## 9. Sources

### Clief Notes Archive (local)

- [1.2 Your First Folder](file:///C:/Users/digit/Developer/clief-notes-archive/02-the-foundation/01-module-1-quick-start-get-building-today/02-12-your-first-folder/lesson.md) — minimum viable folder, three-file starter, the cold-start leak.
- [2.3 How a 1953 Word Game Explains AI Memory](file:///C:/Users/digit/Developer/clief-notes-archive/02-the-foundation/02-module-2-why-this-works-the-abstraction-series/06-23-how-a-1953-word-game-explains-ai-memory/lesson.md) — templates with typed slots, AI memory hierarchy, why code and data are the same thing in an LLM.
- [3.1 The Full Walkthrough](file:///C:/Users/digit/Developer/clief-notes-archive/02-the-foundation/03-module-3-folder-architecture-the-full-method/11-31-the-full-walkthrough-23-min-video/lesson.md) — the full three-layer routing system: Map / Rooms / Tools, with naming conventions.

### Cross-references in this skill

- [token-optimization-research.md](./token-optimization-research.md) — the architectural and empirical research underneath the Clief framing.
- [component-patterns.md](./component-patterns.md) — observation hooks and harness composition patterns.
- [cowork-compatibility.md](./cowork-compatibility.md) — per-surface support for skills, MCP servers, and other components named in routing tables.

---

*Last updated: 2026-06-02. Framing adapted from Clief Sundberg's Quantum Quill Lyceum (Skool); patterns validated against the architectural and empirical research in this skill's other reference documents.*
