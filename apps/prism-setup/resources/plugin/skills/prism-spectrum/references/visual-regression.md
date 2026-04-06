# Visual Regression Protocol

After quality gates and browser verification pass, check for visual regression baselines:

1. **Detect UI files**: Check if any files in the story's `files` array have UI extensions (`.tsx`, `.jsx`, `.vue`, `.svelte`, `.css`, `.scss`, `.html`, `.svg`). If no UI files, skip.

2. **Check for baselines**:
   ```bash
   ls .prism/shared/validation/baselines/{story-id}/*.png 2>/dev/null
   ```
   If no baselines exist, skip with note in progress.md: "Visual regression skipped: no baselines for {story-id}"

3. **Run visual regression**: For each baseline, run against the live dev server (reuse from browser verification or start one):
   ```bash
   bash scripts/visual-regression.sh {url} \
     .prism/shared/validation/baselines/{story-id} {baseline-name}
   ```

4. **Handle results**:
   - `passed: true` → log in progress.md, continue to commit
   - `passed: false` → spawn grader:
     ```
     Task(subagent_type="visual-regression-grader")
     "Diff JSON: {JSON output}
     Diff image: {diff_path}
     Story: {story-id}, modifies: {files}
     Plan criteria: {manual verification criteria}"
     ```
   - Grader verdict `regression` → record in progress.md, emit `<spectrum-retry reason="VISUAL_REGRESSION">[grader evidence]</spectrum-retry>`
   - Grader verdict `intentional` → update baseline automatically (copy current screenshot over baseline), log in progress.md
   - Grader verdict `inconclusive` → log in progress.md, proceed with commit (don't block on uncertainty)

5. **Story manifest update**: If `story-manifest.json` exists, update the relevant requirement's `passes` field based on visual regression result.

6. **Graceful skip**: If `playwright-cli` is not installed or `scripts/visual-regression.sh` is not found, skip silently (log, don't fail).
