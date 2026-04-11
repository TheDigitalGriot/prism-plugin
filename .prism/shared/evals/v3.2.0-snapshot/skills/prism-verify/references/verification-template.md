# Verification Output Template

Reference for `verification-result.json` schema and human-readable summary format.

## verification-result.json Schema

```json
{
  "timestamp": "2026-02-22T14:30:00Z",
  "url": "http://localhost:3000",
  "devCommand": "npm run dev",
  "status": "pass",
  "checks": [
    {
      "type": "screenshot",
      "status": "pass",
      "artifactPath": ".prism/local/verifications/2026-02-22-home/screenshot.png",
      "details": "Screenshot captured successfully"
    },
    {
      "type": "console",
      "status": "pass",
      "artifactPath": null,
      "details": "No console errors detected"
    }
  ],
  "errors": [],
  "artifactDir": ".prism/local/verifications/2026-02-22-home/",
  "summary": "All checks passed. UI renders without errors."
}
```

### Status Values

| Status | Meaning |
|--------|---------|
| `pass` | All checks passed |
| `fail` | One or more checks failed |
| `partial` | Some checks passed, some failed |
| `skipped` | playwright-cli not installed or check skipped |

### Check Types

| Type | What it checks |
|------|---------------|
| `screenshot` | Captures page screenshot (always runs) |
| `console` | Checks for JavaScript console errors |
| `snapshot` | DOM structure assertion (for regression) |
| `network` | Checks for failed network requests |
| `visual-regression` | Pixel-level comparison against stored baseline |

### Visual Regression Check Fields

When a `visual-regression` check is included, it contains additional fields:

```json
{
  "type": "visual-regression",
  "status": "pass",
  "artifactPath": ".prism/shared/validation/diffs/2026-03-08/login-form-diff.png",
  "details": "0.3% change (threshold: 1%)",
  "baseline_path": ".prism/shared/validation/baselines/STORY-001/login-form.png",
  "diff_path": null,
  "change_pct": 0.003,
  "threshold": 0.01,
  "new_baseline": false,
  "verdict": null,
  "grader_output": null
}
```

When the grader agent is invoked (change exceeds threshold):

```json
{
  "type": "visual-regression",
  "status": "fail",
  "artifactPath": ".prism/shared/validation/diffs/2026-03-08/login-form-diff.png",
  "details": "5.2% change exceeds 1% threshold — grader verdict: regression",
  "baseline_path": ".prism/shared/validation/baselines/STORY-001/login-form.png",
  "diff_path": ".prism/shared/validation/diffs/2026-03-08/login-form-diff.png",
  "change_pct": 0.052,
  "threshold": 0.01,
  "new_baseline": false,
  "verdict": "regression",
  "grader_output": {
    "verdict": "regression",
    "confidence": 0.85,
    "evidence": "...",
    "recommendation": "revert",
    "affected_elements": ["submit button", "form padding"]
  }
}
```

## Human-Readable Summary Template

```markdown
## Verification Results — {YYYY-MM-DD HH:MM}

**URL**: {url}
**Status**: ✓ PASS / ✗ FAIL / ⚠ PARTIAL

### Checks

| Check | Status | Details |
|-------|--------|---------|
| Screenshot | ✓ Pass | .prism/local/verifications/.../screenshot.png |
| Console Errors | ✓ Pass | No errors detected |

### Artifacts

- Screenshot: `.prism/local/verifications/{date}-{context}/screenshot.png`
- Report: `.prism/local/verifications/{date}-{context}/verification-result.json`
```

## Example Scenarios

### Scenario: All Pass

```json
{
  "status": "pass",
  "checks": [
    {"type": "screenshot", "status": "pass", "details": "Screenshot captured"},
    {"type": "console", "status": "pass", "details": "No console errors"}
  ],
  "errors": [],
  "summary": "Homepage renders correctly with no JavaScript errors."
}
```

### Scenario: Console Errors (Fail)

```json
{
  "status": "fail",
  "checks": [
    {"type": "screenshot", "status": "pass", "details": "Screenshot captured"},
    {
      "type": "console",
      "status": "fail",
      "details": "3 errors: TypeError: Cannot read property 'map' of undefined at App.jsx:42"
    }
  ],
  "errors": ["Console check failed: JavaScript errors detected"],
  "summary": "UI renders but has JavaScript errors that need fixing."
}
```

### Scenario: Partial (Screenshot Pass, Other Skipped)

```json
{
  "status": "partial",
  "checks": [
    {"type": "screenshot", "status": "pass", "details": "Screenshot captured"},
    {"type": "console", "status": "skipped", "details": "Console check skipped: timeout"}
  ],
  "errors": [],
  "summary": "Screenshot captured. Console check skipped due to timeout."
}
```
