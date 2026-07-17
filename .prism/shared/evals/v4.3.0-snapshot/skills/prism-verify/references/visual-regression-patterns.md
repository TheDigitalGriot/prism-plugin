# Visual Regression Patterns

Reference guide for visual regression testing with `scripts/visual-regression.sh`.

## Directory Structure

```
.prism/shared/validation/
├── baselines/                   # Committed — golden screenshots
│   ├── <story-id>/
│   │   ├── homepage.png
│   │   ├── homepage-mobile.png
│   │   └── login-form.png
│   └── <story-id>/
│       └── dashboard.png
├── diffs/                       # Gitignored — ephemeral diff output
│   └── YYYY-MM-DD/
│       ├── homepage-diff.png
│       └── login-form-diff.png
└── YYYY-MM-DD-report.md         # Validation reports
```

## Naming Convention

Baseline files follow: `<page-name>[-viewport].png`

| Pattern | Example | Use Case |
|---------|---------|----------|
| `<page>.png` | `homepage.png` | Default viewport (1280x720) |
| `<page>-desktop.png` | `homepage-desktop.png` | Explicit desktop |
| `<page>-tablet.png` | `homepage-tablet.png` | Tablet viewport |
| `<page>-mobile.png` | `homepage-mobile.png` | Mobile viewport |
| `<page>-<variant>.png` | `login-dark.png` | Theme/state variants |

## Multi-Viewport Patterns

Standard viewports for responsive testing:

| Viewport | Size | Flag |
|----------|------|------|
| Desktop | 1280x720 | `--viewport 1280x720` (default) |
| Tablet | 768x1024 | `--viewport 768x1024` |
| Mobile | 375x812 | `--viewport 375x812` |

Capture all three for a page:

```bash
BASELINES=".prism/shared/validation/baselines/STORY-001"

visual-regression.sh http://localhost:5173 "$BASELINES" homepage-desktop
visual-regression.sh http://localhost:5173 "$BASELINES" homepage-tablet --viewport 768x1024
visual-regression.sh http://localhost:5173 "$BASELINES" homepage-mobile --viewport 375x812
```

## Threshold Tuning

The `--threshold` flag controls sensitivity (changed pixels / total pixels):

| Threshold | Use Case | When to Use |
|-----------|----------|-------------|
| `0.001` (0.1%) | Pixel-perfect | Icon changes, logo updates, exact design specs |
| `0.01` (1%) | Layout stability | General UI regression — **recommended default** |
| `0.05` (5%) | Rough check | Content-heavy pages where text changes are expected |
| `0.10` (10%) | Structural only | Catch major layout breaks, ignore minor styling |

Start with the default (1%) and tighten per-page if needed.

## Baseline Update Workflow

When a visual change is intentional:

1. Delete the old baseline:
   ```bash
   rm .prism/shared/validation/baselines/STORY-001/login-form.png
   ```

2. Re-run to create a new baseline:
   ```bash
   visual-regression.sh http://localhost:5173 \
     .prism/shared/validation/baselines/STORY-001 login-form
   ```
   Output will show `"new_baseline": true`.

3. Commit the updated baseline:
   ```bash
   git add .prism/shared/validation/baselines/STORY-001/login-form.png
   ```

## Anti-Flake Patterns

Common causes of flaky visual diffs and how to avoid them:

| Cause | Mitigation |
|-------|------------|
| Font loading race | Wait for page load before capture (playwright-cli handles this) |
| Animated elements | Capture after animations complete; consider higher threshold |
| Dynamic content (timestamps, avatars) | Use fixed test data or mask regions |
| Cursor/focus state | Don't interact before capture; use headless mode |
| Sub-pixel rendering | Use threshold >= 0.001 to absorb sub-pixel differences |

## Integration with Skills

### From `prism-verify`

When baselines exist for a story, `prism-verify` auto-runs visual regression after screenshot capture. If the diff exceeds the threshold, it spawns the `visual-regression-grader` agent.

### From `prism-validate`

Visual regression runs as a "Tier 1.5" gate between automated quality gates (Tier 1) and browser verification (Tier 2). A grader verdict of `regression` counts as a validation failure.

### From `prism-spectrum`

For stories modifying UI files (`.tsx`, `.jsx`, `.css`, `.scss`, `.html`), visual regression runs automatically after quality gates pass. A regression triggers `<spectrum-retry>`.

## Continuous Validation with /loop

During active UI implementation, run visual regression continuously to catch regressions as they happen:

```
/loop 5m "Run visual-regression.sh for all baselines in
.prism/shared/validation/baselines/<story-id>/. Start dev server if
not running. Write results to .prism/shared/validation/diffs/. If
regressions detected, append to progress.md."
```

This provides near-real-time feedback on visual regressions during implementation without waiting for the Validate phase.

### When to Use

| Scenario | /loop Interval |
|----------|---------------|
| Active CSS/layout work | Every 2-3 minutes |
| Component refactoring | Every 5 minutes |
| Multi-page changes | Every 10 minutes |
| Background monitoring | Every 30 minutes |

### Scheduled Full Regression

For weekly full regression across all baselines:

```yaml
# ~/.claude/scheduled-tasks/visual-regression-weekly/SKILL.md
frequency: weekly
day: monday
time: "09:00"
---
Run visual-regression.sh for all baselines in .prism/shared/validation/baselines/.
Generate a regression report at .prism/shared/validation/YYYY-MM-DD-regression-report.md.
If regressions found, create a GitHub issue with the diff images attached.
```

## Script Interface Reference

```bash
# Usage
visual-regression.sh <url> <baseline-dir> <name> [--threshold 0.01] [--viewport 1280x720]

# Output: JSON to stdout
{
  "name": "homepage",
  "url": "http://localhost:5173",
  "viewport": "1280x720",
  "baseline_path": ".prism/shared/validation/baselines/STORY-001/homepage.png",
  "screenshot_path": "/tmp/.../homepage-current.png",
  "diff_path": ".prism/shared/validation/diffs/2026-03-08/homepage-diff.png",
  "change_pct": 0.003200,
  "threshold": 0.01,
  "passed": true,
  "new_baseline": false,
  "error": null
}

# Exit codes
# 0 = passed (change_pct <= threshold) or new baseline created
# 1 = failed (change_pct > threshold) or error
# 2 = usage error (missing arguments)
```
