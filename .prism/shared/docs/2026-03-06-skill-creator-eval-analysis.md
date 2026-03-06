# Prism Plugin: Skill-Creator Eval & Benchmark Analysis

**Date**: 2026-03-06
**Context**: Analyzing how the skill-creator plugin's eval/benchmark/comparator features apply to the Prism plugin ecosystem, specifically for comparing v2.4.8 vs v2.4.9 changes.

---

## 1. Prism Skills Through the Skill-Creator Taxonomy

The skill-creator article defines two categories of skills. Here's how Prism's 13 skills map:

### Capability Uplift Skills (Claude can't do this well without them)

| Skill | Why it's capability uplift |
|-------|--------------------------|
| **prism-research** | Forces "documentarian, not critic" behavior — base Claude *wants* to suggest improvements |
| **prism-plan** | Enforces interactive iteration — base Claude dumps full plans in one shot |
| **prism-spectrum** | Fresh-context-per-story orchestration doesn't exist in base Claude at all |
| **prism-debug** | Parallel investigator pattern (log/state/git agents) is a structural technique |
| **prism-verify** | Browser verification workflow via playwright-cli is beyond base capabilities |

These skills teach Claude **techniques it doesn't have natively**. The article notes these may become less necessary as models improve — evals tell you exactly when that happens.

### Encoded Preference Skills (Claude can do the pieces, but Prism sequences them)

| Skill | Why it's encoded preference |
|-------|---------------------------|
| **prism** (meta) | Routes to the right phase — Claude could do each phase, but the workflow demands this sequence |
| **prism-implement** | Phase-by-phase execution with verification checkpoints is a team process |
| **prism-iterate** | "Get approval before changing the plan" is a team preference |
| **prism-validate** | Two-category success criteria (automated + manual) is a convention |
| **prism-release** | 7-step release pipeline is entirely project-specific process |
| **prism-prd / prism-visual-docs / prism-docs-update** | Document generation following project templates and formats |

These are more **durable** — they encode workflow, not a model limitation. But evals still verify fidelity to that workflow.

---

## 2. Skill-Creator Plugin: Built-In Infrastructure

The skill-creator plugin (installed at `~/.claude/plugins/cache/claude-plugins-official/skill-creator/`) already includes everything needed:

| Feature | What it is | Where it lives |
|---------|-----------|---------------|
| **Evals** | Test prompts + expectations + grading | `evals/evals.json` per skill |
| **Multi-agent parallel runs** | Each eval spawns independent subagents (with-skill + baseline) simultaneously | Built into workflow — "spawn all runs in the same turn" |
| **Token & timing metrics** | Captured from each subagent's `total_tokens` + `duration_ms` | `timing.json` per run |
| **Grader agent** | Grades expectations, extracts claims, critiques eval quality | `agents/grader.md` |
| **Comparator agent** | Blind A/B judging with rubric scoring (content + structure, 1-5 scale) | `agents/comparator.md` |
| **Analyzer agent** | Post-hoc analysis of WHY one version beat another | `agents/analyzer.md` |
| **Benchmark aggregation** | Pass rate, time, tokens with mean +/- stddev and deltas | `scripts/aggregate_benchmark.py` |
| **Regression detection** | Run same evals, compare `benchmark.json` across versions | `history.json` tracks version progression |
| **Model outgrowth detection** | Run evals *without* skill loaded — if they pass, skill is unnecessary | `without_skill` configuration in every benchmark |
| **Description tuning** | Generate trigger eval queries, optimize via `run_loop.py` | `scripts/improve_description.py` + `run_loop.py` |
| **Visual eval viewer** | HTML viewer with Outputs tab + Benchmark tab + feedback collection | `eval-viewer/generate_review.py` |

### Key Schemas

- **evals.json** — eval definitions with id, prompt, expected_output, files, expectations
- **timing.json** — total_tokens, duration_ms, total_duration_seconds per run
- **grading.json** — expectations pass/fail with evidence, execution_metrics, claims, eval_feedback
- **benchmark.json** — metadata, individual runs, run_summary (mean/stddev/delta per config), analyst notes
- **comparison.json** — blind A/B winner, rubric scores, output_quality, expectation_results
- **analysis.json** — post-hoc unblinding with winner_strengths, loser_weaknesses, improvement_suggestions
- **history.json** — version progression tracking (version, parent, pass_rate, grading_result, is_current_best)

---

## 3. Multi-Agent Support: How It Works

The skill-creator uses Claude Code's subagent system for parallel, isolated execution:

```
For each eval case, spawn TWO subagents simultaneously:
+-- with_skill (v2.4.9 SKILL.md) --> outputs/ + timing.json
+-- old_skill (v2.4.8 snapshot)  --> outputs/ + timing.json

While running --> draft assertions for grading

When all complete:
+-- Grader agent     --> grades each output against expectations --> grading.json
+-- Comparator agent --> blind A/B comparison                   --> comparison.json
+-- Analyzer agent   --> unblind + explain WHY                  --> analysis.json
+-- Benchmark agg    --> aggregate stats                        --> benchmark.json
+-- Eval viewer      --> HTML dashboard                         --> browser opens
```

Each subagent runs in **clean context** with its own token and timing metrics. No cross-contamination between runs. This is identical to Spectrum's "fresh context per iteration" principle — the skill-creator applies it to evaluation rather than implementation.

### Workspace Structure

```
<skill-name>-workspace/
+-- skill-snapshot/           # v2.4.8 baseline (copied before editing)
+-- iteration-1/
|   +-- eval-<name>/
|   |   +-- eval_metadata.json
|   |   +-- with_skill/
|   |   |   +-- outputs/      # Files produced by v2.4.9 skill
|   |   |   +-- timing.json   # Token + duration metrics
|   |   +-- old_skill/
|   |   |   +-- outputs/      # Files produced by v2.4.8 skill
|   |   |   +-- timing.json
|   |   +-- grading.json      # Grader results
|   |   +-- comparison.json   # Blind A/B result (optional)
|   |   +-- analysis.json     # Post-hoc analysis (optional)
|   +-- benchmark.json        # Aggregated stats
|   +-- benchmark.md          # Human-readable summary
|   +-- feedback.json         # User feedback from eval viewer
+-- iteration-2/              # After skill improvements
|   +-- ...
+-- history.json              # Version progression
```

---

## 4. v2.4.8 vs v2.4.9 Comparison Plan

### What Changed in v2.4.9

1. **Graph-navigator agent** added (new Haiku agent for codebase-memory-mcp)
2. **Graph-first strategy** added to research agents (codebase-locator, codebase-analyzer, codebase-pattern-finder)
3. **prism-spectrum expanded** with epic context extraction, graph verification, debug integration
4. **Token tracking** added across the workflow
5. **prism-release expanded** with clarified build pipeline

### Step 1: Snapshot v2.4.8 Skills

```bash
# Create baseline snapshots from the previous version tag
git show v2.4.8:skills/prism-research/SKILL.md > /tmp/prism-research-v248.md
git show v2.4.8:skills/prism-spectrum/SKILL.md > /tmp/prism-spectrum-v248.md
git show v2.4.8:agents/codebase-locator.md > /tmp/codebase-locator-v248.md
git show v2.4.8:agents/codebase-analyzer.md > /tmp/codebase-analyzer-v248.md
```

### Step 2: Write Eval Cases (Four Dimensions)

#### Output Quality Evals

```json
{
  "id": 1,
  "prompt": "Research the authentication module in this codebase and document how it works",
  "expected_output": "Comprehensive research document with file:line references",
  "expectations": [
    "Research document covers all auth-related files",
    "Document includes file:line references, not just file names",
    "No improvement suggestions appear (documentarian principle)",
    "Document follows YYYY-MM-DD-topic.md naming convention"
  ]
}
```

#### Behavioral Compliance Evals

```json
{
  "id": 2,
  "prompt": "Research the API layer of this codebase",
  "expected_output": "Research using graph-first queries when codebase-memory-mcp is available",
  "expectations": [
    "Agent calls search_graph or trace_call_path before using Grep/Glob",
    "Agent spawns graph-navigator agent when codebase-memory-mcp is available",
    "Research output references structural relationships, not just file contents",
    "Token usage is reported in research output"
  ]
}
```

#### Efficiency Evals (captured automatically)

Token and timing metrics are captured in `timing.json` per run:
```json
{
  "total_tokens": 84852,
  "duration_ms": 23332,
  "total_duration_seconds": 23.3
}
```

The benchmark aggregation computes `mean +/- stddev` for tokens and time across both versions, plus the delta.

#### Regression Detection

Same evals run against both versions. `history.json` tracks progression:
```json
{
  "iterations": [
    {"version": "v2.4.8", "expectation_pass_rate": 0.65, "grading_result": "baseline"},
    {"version": "v2.4.9", "expectation_pass_rate": 0.85, "grading_result": "won"}
  ]
}
```

### Step 3: Run the Eval Loop

Invoke skill-creator and it handles the full flow:

1. Spawns parallel subagents for each eval (with-skill + baseline)
2. Captures timing/token data from each subagent completion notification
3. Grader evaluates expectations against outputs
4. Comparator does blind A/B judging
5. Analyzer explains why the winner won
6. Benchmark aggregation produces stats
7. Eval viewer opens in browser for human review

### Step 4: Model Outgrowth Check

Run evals **without any skill loaded** to test if base Claude has caught up:

- Does Claude naturally do graph-first queries without v2.4.9 guidance?
- Does Claude follow documentarian-not-critic without prism-research?
- Does Claude do interactive planning without prism-plan?

If `without_skill` runs pass these expectations, the capability uplift is no longer needed.

### Step 5: Description Tuning

After evals are solid, optimize SKILL.md descriptions for trigger accuracy:

```bash
python -m scripts.run_loop \
  --eval-set trigger-evals.json \
  --skill-path skills/prism-research \
  --model claude-opus-4-6 \
  --max-iterations 5
```

This tests 20 realistic prompts (10 should-trigger, 10 should-not), evaluates the current description 3x per query for reliability, then iteratively improves it using Claude with extended thinking.

---

## 5. Connections Between Prism and Skill-Creator Concepts

| Prism Concept | Skill-Creator Equivalent | Insight |
|--------------|------------------------|---------|
| Spectrum (fresh context per story) | Multi-agent eval runs (fresh context per eval) | Same isolation principle, different purpose |
| Quality gates in stories.json | Expectations in evals.json | Both define verifiable success criteria |
| prism-validate (automated + manual) | Grader (automated) + Eval viewer (manual review) | Same two-category verification pattern |
| Spectrum progress.md (accumulated learnings) | history.json (version progression) | Both track improvement over iterations |
| prism-debug (parallel investigators) | Grader + Comparator + Analyzer (parallel evaluation agents) | Same parallel-agent-for-different-angles pattern |
| stories.json status tracking | history.json grading_result tracking | Both track pass/fail progression |

---

## 6. Recommended Skills to Eval First

Priority order based on v2.4.9 change impact:

1. **prism-research** — Graph-first strategy is the biggest behavioral change; most testable
2. **prism-spectrum** — Largest SKILL.md expansion; epic context extraction and debug integration
3. **codebase-locator** (agent) — Graph-first search strategy directly measurable
4. **codebase-analyzer** (agent) — Graph-first trace_call_path usage measurable
5. **prism-release** — Pipeline expansion is encoded preference; test fidelity to new steps

---

## 7. Key Takeaways

1. **You don't need to build eval infrastructure** — the skill-creator plugin already has it all
2. **The workflow is: write evals -> spawn parallel runs -> grade -> compare -> analyze -> iterate**
3. **v2.4.8 snapshots serve as the baseline** for A/B comparison
4. **Model outgrowth detection** is free — just run `without_skill` and see what passes
5. **Description tuning** is a separate optimization pass after evals are solid
6. **Prism's Spectrum and skill-creator's multi-agent evals share the same core principle**: fresh context isolation prevents cross-contamination
