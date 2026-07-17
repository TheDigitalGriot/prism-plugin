---
name: prism-eval
description: Run skill evaluations and version comparisons for the Prism plugin. Use when the user wants to evaluate skills, compare skill versions, run benchmarks, check for regressions, or measure skill performance. Triggers on "run evals", "compare versions", "benchmark skills", "evaluate v2.4.9", "regression check", "skill performance", or any mention of evaluating/comparing Prism skill versions. Also use when the user says "run evals for [version]" or "compare [version] vs [version]".
model: sonnet
---

# Prism Eval

Run evaluations against Prism plugin skill versions — either a single version or a side-by-side comparison between two versions.

## Two Modes

**Single version**: `"run evals for v2.4.9"` — runs all eval cases for that version and grades them against expectations.

**Comparative**: `"compare v2.4.8 vs v2.4.9"` — runs each eval case twice (once per version), grades both, produces a benchmark comparison, and opens the eval viewer.

## Directory Convention

All eval data lives under `.prism/shared/evals/`:

```
.prism/shared/evals/
├── v2.4.8-snapshot/              # Baseline skill snapshots
│   ├── skills/<name>/SKILL.md
│   ├── agents/<name>.md
│   └── commands/<name>.md
├── v2.4.9/
│   ├── skills/<name>/
│   │   ├── evals.json            # Eval case definitions
│   │   └── fixtures/             # Test data (stories.json etc.)
│   └── workspace/
│       └── iteration-N/          # Run results
└── v2.5.0/                       # Future versions follow same pattern
```

## Workflow

### 1. Parse the Request

Determine mode and versions from the user's prompt:

- **Single version**: Extract one version number → run evals from that version's `evals.json` files
- **Comparative**: Extract two version numbers → the newer version has `evals.json`, the older version is the baseline snapshot

If versions are ambiguous, list available versions:
```
Glob(".prism/shared/evals/v*")
```
Ask the user to clarify.

### 2. Discover Eval Cases

Find all `evals.json` files for the target version:

```
Glob(".prism/shared/evals/<version>/skills/*/evals.json")
Glob(".prism/shared/evals/<version>/agents/*/evals.json")
Glob(".prism/shared/evals/<version>/commands/*/evals.json")
```

Read each `evals.json`. Each contains an array of eval cases with `id`, `dimension`, `prompt`, `expected_output`, `expectations`, and optional `files`.

If no eval cases exist, tell the user and offer to help write them. See [references/eval-schemas.md](references/eval-schemas.md) for the evals.json schema.

### 3. Set Up Workspace

Create the iteration workspace:

```
.prism/shared/evals/<version>/workspace/iteration-<N>/
└── <skill>-eval-<id>-<name>/
    ├── eval_metadata.json
    ├── with_skill/
    │   └── outputs/
    └── old_skill/          # comparative mode only
        └── outputs/
```

Determine the iteration number by checking for existing `iteration-*` directories.

Write `eval_metadata.json` for each eval case with the assertions from the `expectations` field in `evals.json`.

### 4. Spawn Eval Runs

Launch all runs in parallel using the Agent tool with `run_in_background: true`.

**For each eval case in single-version mode** — spawn ONE subagent:

```
Agent(description="<skill> eval <id> run", run_in_background=true)

Prompt:
"You are running a skill evaluation. Follow the skill instructions EXACTLY.

STEP 1: Read the skill file at: skills/<skill-name>/SKILL.md
STEP 2: Follow its workflow to execute this task:
<eval prompt from evals.json>
STEP 3: Save your output to: <workspace>/<eval-dir>/with_skill/outputs/<output-file>

IMPORTANT:
- Follow the skill's workflow steps in order
- For research skills: save output as research.md
- For spectrum/execution skills: save a transcript as transcript.md
  - DO NOT actually commit or modify source files — simulate and document
  - DO run quality gates if they are safe (echo commands)
- Record everything you do in the output"
```

**For each eval case in comparative mode** — spawn TWO subagents simultaneously:

One reads the current version's SKILL.md, the other reads the baseline snapshot's SKILL.md. Both get the same eval prompt. Save outputs to `with_skill/outputs/` and `old_skill/outputs/` respectively.

The baseline subagent prompt explicitly notes which features the old version lacks, so it follows the old workflow faithfully rather than using knowledge of the new version.

### 5. Capture Timing

When each subagent task completes, you receive a notification with `total_tokens` and `duration_ms`. Save immediately to `timing.json` in the run directory:

```json
{
  "total_tokens": 69926,
  "duration_ms": 165064,
  "total_duration_seconds": 165.1,
  "tool_uses": 38
}
```

This data is only available at notification time — capture it as each agent finishes. Don't batch.

### 6. Grade Outputs

Once all runs complete, spawn a grader agent (or grade inline) to evaluate each output against its assertions.

For each run directory, read:
- `eval_metadata.json` for assertions
- `outputs/research.md` or `outputs/transcript.md` for the actual output

Write `grading.json` to each run directory:

```json
{
  "expectations": [
    {"text": "assertion text", "passed": true, "evidence": "quote from output"}
  ],
  "summary": {"passed": 6, "failed": 1, "total": 7, "pass_rate": 0.86}
}
```

Grade strictly — only mark as passed if there is clear evidence in the output.

### 7. Aggregate Benchmark

Build `benchmark.json` in the iteration directory. See [references/eval-schemas.md](references/eval-schemas.md) for the full schema.

Key fields:
- `metadata`: skill name, model, timestamp, evals run
- `runs[]`: one entry per eval per configuration, with `pass_rate`, `tokens`, `time_seconds`
- `run_summary`: mean ± stddev per configuration, delta between them
- `notes[]`: analyst observations (non-discriminating assertions, high-variance evals, token tradeoffs)

In comparative mode, use `"with_skill"` for the newer version and `"without_skill"` for the baseline — these exact strings are required by the eval viewer.

### 8. Generate Eval Viewer

Generate the HTML viewer using the skill-creator's generate_review.py:

```bash
python "<skill-creator-path>/eval-viewer/generate_review.py" \
  "<workspace>/iteration-<N>" \
  --skill-name "<skill-name> (<version> vs <baseline>)" \
  --benchmark "<workspace>/iteration-<N>/benchmark.json" \
  --static "<workspace>/iteration-<N>/eval-viewer.html"
```

The skill-creator path is typically `~/.claude/plugins/cache/claude-plugins-official/skill-creator/*/skills/skill-creator/`.

Open the viewer:
```bash
start "" "<workspace>/iteration-<N>/eval-viewer.html"   # Windows
open "<workspace>/iteration-<N>/eval-viewer.html"       # macOS
```

Tell the user: "The eval viewer is open in your browser. The Outputs tab shows each eval case with pass/fail grades. The Benchmark tab shows the aggregate comparison. When you're done reviewing, let me know."

### 9. Present Results Summary

After generating the viewer, present a concise summary:

```markdown
## Results: <skill> (<version> vs <baseline>)

| Eval | v2.4.9 | v2.4.8 | Delta |
|------|--------|--------|-------|
| ...  | 100%   | 71%    | +29%  |

**Mean pass rate**: 97% vs 78% (+19%)
**Mean tokens**: 47K vs 49K (-4%)
**Key findings**: [2-3 bullet points]
```

## Creating New Eval Cases

If the user asks to add evals for a skill that doesn't have them yet:

1. Identify what changed between versions (diff the SKILL.md files)
2. Write eval cases covering 4 dimensions:
   - **Output quality** — does the output meet format/content requirements?
   - **Behavioral compliance** — does it follow new workflow steps?
   - **Regression** — are existing behaviors preserved?
   - **Efficiency** — captured automatically via timing.json
3. Save to `.prism/shared/evals/<version>/skills/<skill-name>/evals.json`
4. Create fixtures if needed (test stories.json, etc.)

## Creating New Version Snapshots

If the user wants to snapshot the current version for future comparison:

```bash
# Determine current version
cat .claude-plugin/plugin.json | grep version

# Create snapshot directory and copy all skills, agents, commands
mkdir -p .prism/shared/evals/v<X.Y.Z>-snapshot
cp -r skills/ .prism/shared/evals/v<X.Y.Z>-snapshot/skills/
cp -r agents/ .prism/shared/evals/v<X.Y.Z>-snapshot/agents/
cp -r commands/ .prism/shared/evals/v<X.Y.Z>-snapshot/commands/
cp -r scripts/ .prism/shared/evals/v<X.Y.Z>-snapshot/scripts/
```

## Rules

1. **Parallel execution** — spawn all eval runs simultaneously, don't serialize
2. **Capture timing immediately** — token/time data is only available at task completion notification
3. **Grade strictly** — only pass assertions with clear evidence
4. **Use exact field names** — grading.json uses `text`/`passed`/`evidence`, benchmark.json uses `configuration: "with_skill"/"without_skill"`
5. **Don't modify source files** — spectrum/execution evals simulate changes, they don't commit
6. **Generate the viewer** — always produce the eval-viewer.html for human review

> See also: [cl-plugin-structure/references/token-optimization-research.md](../cl-plugin-structure/references/token-optimization-research.md) §10 (Plugin Audit Checklist) for token-budget and quality-gate patterns applicable when designing new eval dimensions.
