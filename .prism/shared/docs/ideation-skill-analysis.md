# Ideation Team Skill — Analysis

**Source:** [bladnman/ideation](https://github.com/bladnman/ideation) (MIT license)
**Installed:** `~/.claude/skills/ideation/` (global)
**Reference copy:** `.prism/shared/ref/ideation_team_skill/`

## What It Is

A Claude Code skill that runs a **multi-agent brainstorming session** using the experimental **Agent Teams** feature (requires Opus 4.6 + `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`). It separates cognitive modes — generation, evaluation, synthesis, and research — across distinct agents to avoid the bias that happens when a single agent tries to do all of them.

## Plugin Structure

Skill-only plugin (no commands, agents, hooks, or MCP servers):

| Component | Status |
|-----------|--------|
| `SKILL.md` | Present (76KB — comprehensive orchestration prompt) |
| `templates/` | 8 template files |
| `.claude-plugin/` | **Missing** — no `plugin.json` manifest |
| `commands/` | None |
| `agents/` | None (agents defined inline in SKILL.md spawn prompts) |

All 9 agent prompts are embedded directly in the SKILL.md as spawn prompt templates rather than using conventional `agents/*.md` files.

## The 4 Actions

| Action | Trigger | What It Does |
|--------|---------|-------------|
| **Plan** | `/ideation <concept>` | Solo interview — asks about depth and desired outputs, creates session directory, writes `session-config.yaml` |
| **Ideate** | Auto after Plan | Spawns agent team, runs structured dialogue, depth-aware convergence, conditional production phase |
| **Continue** | `/ideation continue <ref>` | Smart discovery of previous sessions, versioned resumption (v2, v3, v2a branching), mini-interview, references parent materials |
| **PRD** | `/ideation prd <ref>` | Solo operation — reads completed session artifacts and generates a Product Requirements Document |

## The 9 Agents

### Core Team (always spawned)

| Agent | Role |
|-------|------|
| **Arbiter** (you) | Team lead — coordinates, evaluates idea reports, signals convergence. Does NOT generate ideas. |
| **Free Thinker** | Divergent generation — creative leaps, unexpected connections, "what if..." |
| **Grounder** | Convergent editing — winnows ideas, keeps brainstorm on brief, has good taste and isn't afraid to say "that's not it" |
| **Writer** | Synthesis/memory — maintains ideation graph, snapshots, briefs, vision doc. Has no perspective to protect. |

### Conditional Agents

| Agent | Role | When Spawned |
|-------|------|-------------|
| **Explorer** | Research — web search, citations, fact-finding | Based on research mode config |
| **Image Agent** | Infographic visuals via ChatGPT image gen (Chrome MCP) | Tier 2 output selected |
| **Presentation Agent** | PPTX deck via python-pptx | Tier 2 output selected |
| **Web Page Agent** | Self-contained HTML distribution page | Tier 2 output selected |
| **Archivist** | Results PDF + Session Capsule PDF via weasyprint | Tier 2 output selected |

## How The Dialogue Works

1. Free Thinker and Grounder converse via `SendMessage` broadcasts
2. Writer silently observes, maintains the ideation graph and snapshots
3. They produce **idea reports** sent to the Arbiter
4. Arbiter evaluates each report against 4 criteria:
   - **Compelling** — a human would want to hear more
   - **Somewhat new** — not a rehash of obvious approaches
   - **A different take** — brings a non-obvious perspective
   - **Substantive** — the Grounder is genuinely excited, not just tolerating it
5. Arbiter either marks ideas "interesting" or sends them back for "needs more conversation"
6. Convergence is emergent — when min report threshold is met and further dialogue yields diminishing returns
7. Writer produces final briefs and vision document
8. Production agents (conditionally) create deliverables

## Depth System

| | Quick | Standard | Deep | Exhaustive |
|---|---|---|---|---|
| **Directions** | 2-3 | 3-5 | 5-8 | 8+ |
| **Time** | ~15-30 min | ~45-90 min | ~2-3 hrs | ~3+ hrs |
| **Min reports before convergence** | 1 | 3 | 5 | 8 |
| **Max reports before forced check** | 3 | 6 | 12 | No limit |
| **"Interesting" bar** | 1/4 criteria | 2/4 | 3/4 | 4/4 |
| **"Needs more conversation" tendency** | Rare | Moderate | Frequent | Very frequent |
| **Snapshot frequency** | 1-2 | 3-5 | 5-8 | 8+ |

## Output Structure

Each session creates a timestamped directory under `ideations/`:

```
ideations/ideation-<slug>-<YYYYMMDD-HHMMSS>/
  index.html                        # Distribution page (Tier 2)
  RESULTS_<concept>.pdf             # PDF of distribution page (Tier 2)
  CAPSULE_<concept>.pdf             # Comprehensive session archive (Tier 2)
  PRESENTATION_<concept>.pptx       # Slide deck (Tier 2)
  PRD_<concept>.md                  # Product requirements (via /ideation prd)
  images/                           # Infographic images (Tier 2)

  session/
    session-config.yaml             # Session configuration
    VISION_<concept>.md             # Consolidated vision document (source of truth)
    SESSION_SUMMARY.md              # Session summary
    ideation-graph.md               # Living graph of the dialogue
    LINEAGE.md                      # Version chain (for continuations)
    sources/                        # All original input materials (encapsulated)
    research/                       # Explorer's research reports
    briefs/                         # Final idea briefs
    idea-reports/                   # Raw idea reports from dialogue
    snapshots/                      # Writer's version snapshots

  build/
    build_capsule.py                # Regenerates both PDFs
    build_presentation.py           # Regenerates the PPTX
```

**Tier 1 (always produced):** Vision doc, briefs, session summary, ideation graph, snapshots, idea reports

**Tier 2 (user-selectable):** Distribution page (HTML), Results PDF, Capsule PDF, PPTX presentation, infographic images

## Continuation / Versioning

Sessions can be continued without modifying the parent:

```
Original:     ideation-voice-memos-20260219-143052/
Continue:     ideation-voice-memos-v2-20260221-091500/
Continue:     ideation-voice-memos-v3-20260222-140000/
Branch:       ideation-voice-memos-v2a-20260222-150000/
```

Continuation runs a mini-interview (focus + depth), copies source materials, and references parent vision doc/briefs/graph in agent spawn prompts.

## Production Phase Flow

```
                     Arbiter (Team Lead)
                     ┌────────┴────────┐
                     │                 │
               spawns + assigns   spawns + assigns
                     │                 │
          ┌──────────┼──────┐          │
          v          v      v          v
    Image Agent  Pres Agent  Web Page Agent   Archivist
    (parallel)   (parallel)  (blocked by      (blocked by
                              Image + Pres)    Web Page)
```

Agents not selected in the config are simply absent from this flow.

## Templates

| Template | Purpose |
|----------|---------|
| `idea-brief.md` | Structure for final idea briefs |
| `idea-report.md` | Structure for raw idea reports from dialogue |
| `ideation-graph.md` | Living graph tracking threads, forks, connections |
| `lineage.md` | Version chain tracking for continuations |
| `prd.md` | Product Requirements Document structure |
| `session-config.yaml` | Session configuration schema |
| `session-summary.md` | Session summary structure |
| `vision-document.md` | Consolidated vision document structure |

## Requirements

- **Agent Teams** experimental feature: `claude config set env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS 1`
- **Opus 4.6** model (agent teams require it)
- `python-pptx` and `weasyprint` for production artifacts (installed automatically)
- Chrome with Claude-in-Chrome extension (for image generation via ChatGPT)

## Key Design Principles

- **Cognitive separation**: Generation should not evaluate its own work; evaluation should not create; synthesis should have no perspective to protect; research should report facts, not generate ideas
- **Depth-aware convergence**: Emergent, not declared — but bounded by configurable thresholds
- **Source encapsulation**: All input materials are copied into `session/sources/` so sessions are fully self-contained
- **Cardinal rule for PRDs**: Err on inclusion — better to include too much than to cut something that carried intent
