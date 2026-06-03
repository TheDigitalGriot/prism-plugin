# Eval Schemas Reference

## evals.json

Located at `.prism/shared/evals/<version>/skills/<skill-name>/evals.json`:

```json
{
  "skill": "prism-research",
  "version": "v2.4.9",
  "baseline": "../../../v2.4.8-snapshot/skills/prism-research/SKILL.md",
  "current": "skills/prism-research/SKILL.md",
  "target_codebase": ".",
  "evals": [
    {
      "id": 1,
      "dimension": "output_quality | behavioral_compliance | regression",
      "prompt": "The task prompt for the eval",
      "expected_output": "Human-readable description of expected result",
      "files": ["optional/input/files.md"],
      "expectations": [
        "Verifiable assertion 1",
        "Verifiable assertion 2"
      ]
    }
  ]
}
```

## eval_metadata.json

Located at `<workspace>/iteration-N/<eval-dir>/eval_metadata.json`:

```json
{
  "eval_id": 1,
  "eval_name": "descriptive-name",
  "skill": "prism-research",
  "prompt": "The task prompt",
  "assertions": [
    "Assertion copied from evals.json expectations"
  ]
}
```

## timing.json

Located at `<run-dir>/timing.json`. Captured from task completion notifications:

```json
{
  "total_tokens": 69926,
  "duration_ms": 165064,
  "total_duration_seconds": 165.1,
  "tool_uses": 38
}
```

## grading.json

Located at `<run-dir>/grading.json`. Fields MUST be `text`, `passed`, `evidence`:

```json
{
  "expectations": [
    {
      "text": "Document contains file:line references",
      "passed": true,
      "evidence": "Found 'SKILL.md:50' and 'spectrum.sh:23' in Component Analysis section"
    }
  ],
  "summary": {
    "passed": 7,
    "failed": 1,
    "total": 8,
    "pass_rate": 0.88
  }
}
```

## benchmark.json

Located at `<workspace>/iteration-N/benchmark.json`. The eval viewer depends on these exact field names:

```json
{
  "metadata": {
    "skill_name": "prism-research",
    "executor_model": "claude-opus-4-8",
    "timestamp": "2026-03-07T00:00:00Z",
    "evals_run": [1, 2, 3, 4],
    "runs_per_configuration": 1,
    "comparison": "v2.4.9 (with_skill) vs v2.4.8-snapshot (old_skill)"
  },
  "runs": [
    {
      "eval_id": 1,
      "eval_name": "Output Quality",
      "configuration": "with_skill",
      "run_number": 1,
      "result": {
        "pass_rate": 1.0,
        "passed": 8,
        "failed": 0,
        "total": 8,
        "time_seconds": 216.2,
        "tokens": 83212,
        "tool_calls": 51,
        "errors": 0
      }
    }
  ],
  "run_summary": {
    "with_skill": {
      "pass_rate": {"mean": 0.97, "stddev": 0.05, "min": 0.86, "max": 1.0},
      "time_seconds": {"mean": 148.9, "stddev": 54.2},
      "tokens": {"mean": 47048, "stddev": 23870}
    },
    "without_skill": {
      "pass_rate": {"mean": 0.78, "stddev": 0.20},
      "time_seconds": {"mean": 139.4, "stddev": 49.5},
      "tokens": {"mean": 48838, "stddev": 27600}
    },
    "delta": {
      "pass_rate": "+0.19",
      "time_seconds": "+9.5",
      "tokens": "-1790"
    }
  },
  "notes": [
    "Analyst observations about the results"
  ]
}
```

**Critical**: Use `"with_skill"` and `"without_skill"` as the `configuration` values — the eval viewer uses these exact strings for grouping and color coding.

## Workspace Directory Structure

```
.prism/shared/evals/<version>/workspace/
└── iteration-N/
    ├── <skill>-eval-<id>-<descriptive-name>/
    │   ├── eval_metadata.json
    │   ├── with_skill/
    │   │   ├── outputs/
    │   │   │   └── research.md or transcript.md
    │   │   ├── timing.json
    │   │   └── grading.json
    │   └── old_skill/
    │       ├── outputs/
    │       │   └── research.md or transcript.md
    │       ├── timing.json
    │       └── grading.json
    ├── benchmark.json
    ├── benchmark.md
    └── eval-viewer.html
```
