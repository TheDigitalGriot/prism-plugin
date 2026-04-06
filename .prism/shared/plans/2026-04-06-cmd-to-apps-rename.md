# cmd/ → apps/ Rename — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the `cmd/` directory to `apps/` to align with the Fragment scaffolding pattern, updating all 147+ references across 22 files.

**Architecture:** Git `mv` for the directory rename, then systematic find-and-replace of `cmd/prism-` → `apps/prism-` across configs, scripts, skills, workflows, docs, and Go source. The rename is atomic — all references must be updated before committing.

**Tech Stack:** Git, bash (find/sed), Python (bump-version.py), Go (test files), YAML (GitHub Actions), JSON (package.json, tsconfig), Markdown (skills, commands, docs).

---

## File Structure

| Action | Path | References to Update |
|--------|------|---------------------|
| Rename | `cmd/` → `apps/` | Git mv |
| Modify | `package.json` (root) | 7 workspace paths |
| Modify | `.vscode/launch.json` | 2 paths |
| Modify | `.vscode/tasks.json` | 2 paths |
| Modify | `CLAUDE.md` | 3 paths |
| Modify | `scripts/bump-version.py` | 9 paths |
| Modify | `scripts/prism-cli-install.sh` | 1 path |
| Modify | `commands/cli-install.md` | 1 path |
| Modify | `commands/prism_cli.md` | 1 path |
| Modify | `skills/prism-release/SKILL.md` | ~24 paths |
| Modify | `skills/prism-release/references/build-commands.md` | ~18 paths |
| Modify | `.github/workflows/prism-cli-release.yml` | 3 paths |
| Modify | `.github/workflows/prism-setup-release.yml` | 11 paths |
| Modify | `.github/workflows/prism-installer-release.yml` | 38 paths |
| Modify | `apps/prism-cli/` (Go source — mock data + test comments) | ~29 paths |
| Modify | `apps/prism-setup/scripts/prepare-resources.sh` | 9 paths |
| Modify | `installer/prism-setup.nsi` | 1 path |

---

### Task 1: Rename the Directory

**Files:**
- Rename: `cmd/` → `apps/`

- [ ] **Step 1: Perform the git rename**

```bash
git mv cmd apps
```

- [ ] **Step 2: Verify the rename succeeded**

Run: `ls apps/`
Expected: `prism-cli/  prism-electron/  prism-installer/  prism-setup/  prism-vscode/`

Run: `ls cmd/ 2>&1`
Expected: Error (directory no longer exists)

- [ ] **Step 3: Commit the rename only**

```bash
git add -A
git commit -m "refactor: rename cmd/ to apps/ for Fragment pattern alignment"
```

This commit captures ONLY the directory rename. All reference updates happen in subsequent commits so git tracks the rename properly.

---

### Task 2: Update Root Configuration Files

**Files:**
- Modify: `package.json` (root)
- Modify: `.vscode/launch.json`
- Modify: `.vscode/tasks.json`

- [ ] **Step 1: Update root package.json workspace paths**

In `package.json`, replace all `cmd/prism-` references with `apps/prism-`:

```bash
sed -i 's|"cmd/prism-|"apps/prism-|g' package.json
```

Verify: `grep -c "apps/prism-" package.json` — should be 7

- [ ] **Step 2: Update .vscode/launch.json**

Replace `cmd/prism-vscode` with `apps/prism-vscode`:

```bash
sed -i 's|cmd/prism-vscode|apps/prism-vscode|g' .vscode/launch.json
```

- [ ] **Step 3: Update .vscode/tasks.json**

```bash
sed -i 's|cmd/prism-vscode|apps/prism-vscode|g' .vscode/tasks.json
```

- [ ] **Step 4: Verify all three files**

Run: `grep -r "cmd/prism-" package.json .vscode/`
Expected: No matches (all replaced)

- [ ] **Step 5: Commit**

```bash
git add package.json .vscode/
git commit -m "refactor: update workspace and VSCode configs for apps/ rename"
```

---

### Task 3: Update Scripts

**Files:**
- Modify: `scripts/bump-version.py`
- Modify: `scripts/prism-cli-install.sh`

- [ ] **Step 1: Update bump-version.py**

This Python script uses `pathlib` paths with `root / "cmd" / "prism-..."`. Replace all instances:

```bash
sed -i 's|"cmd"|"apps"|g' scripts/bump-version.py
```

Verify: `grep -c '"apps"' scripts/bump-version.py` — should be 6+
Verify: `grep -c '"cmd"' scripts/bump-version.py` — should be 0

- [ ] **Step 2: Update prism-cli-install.sh**

```bash
sed -i 's|cmd/prism-cli|apps/prism-cli|g' scripts/prism-cli-install.sh
```

- [ ] **Step 3: Verify Python syntax**

Run: `python -c "import py_compile; py_compile.compile('scripts/bump-version.py', doraise=True)"`
Expected: No errors

- [ ] **Step 4: Verify bash syntax**

Run: `bash -n scripts/prism-cli-install.sh`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add scripts/bump-version.py scripts/prism-cli-install.sh
git commit -m "refactor: update scripts for apps/ rename"
```

---

### Task 4: Update Commands

**Files:**
- Modify: `commands/cli-install.md`
- Modify: `commands/prism_cli.md`

- [ ] **Step 1: Update cli-install.md**

```bash
sed -i 's|cmd/prism-cli|apps/prism-cli|g' commands/cli-install.md
```

- [ ] **Step 2: Update prism_cli.md**

```bash
sed -i 's|cmd/prism-cli|apps/prism-cli|g' commands/prism_cli.md
```

- [ ] **Step 3: Verify**

Run: `grep -r "cmd/" commands/cli-install.md commands/prism_cli.md`
Expected: No matches

- [ ] **Step 4: Commit**

```bash
git add commands/cli-install.md commands/prism_cli.md
git commit -m "refactor: update commands for apps/ rename"
```

---

### Task 5: Update Release Skill and Build Commands

**Files:**
- Modify: `skills/prism-release/SKILL.md`
- Modify: `skills/prism-release/references/build-commands.md`

- [ ] **Step 1: Update prism-release SKILL.md**

```bash
sed -i 's|cmd/prism-|apps/prism-|g' skills/prism-release/SKILL.md
```

Verify: `grep -c "cmd/prism-" skills/prism-release/SKILL.md` — should be 0
Verify: `grep -c "apps/prism-" skills/prism-release/SKILL.md` — should be 24+

- [ ] **Step 2: Update build-commands.md**

```bash
sed -i 's|cmd/prism-|apps/prism-|g' skills/prism-release/references/build-commands.md
```

Verify: `grep -c "cmd/prism-" skills/prism-release/references/build-commands.md` — should be 0

- [ ] **Step 3: Commit**

```bash
git add skills/prism-release/SKILL.md skills/prism-release/references/build-commands.md
git commit -m "refactor: update release skill and build commands for apps/ rename"
```

---

### Task 6: Update GitHub Workflows

**Files:**
- Modify: `.github/workflows/prism-cli-release.yml`
- Modify: `.github/workflows/prism-setup-release.yml`
- Modify: `.github/workflows/prism-installer-release.yml`

- [ ] **Step 1: Update all three workflow files**

```bash
sed -i 's|cmd/prism-|apps/prism-|g' .github/workflows/prism-cli-release.yml
sed -i 's|cmd/prism-|apps/prism-|g' .github/workflows/prism-setup-release.yml
sed -i 's|cmd/prism-|apps/prism-|g' .github/workflows/prism-installer-release.yml
```

- [ ] **Step 2: Verify no remaining cmd/ references**

Run: `grep -r "cmd/prism-" .github/workflows/`
Expected: No matches

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/
git commit -m "refactor: update CI/CD workflows for apps/ rename"
```

---

### Task 7: Update Documentation

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update CLAUDE.md**

Replace `cmd/prism-cli` references with `apps/prism-cli`:

```bash
sed -i 's|cmd/prism-cli|apps/prism-cli|g' CLAUDE.md
sed -i 's|`cmd/prism-cli/`|`apps/prism-cli/`|g' CLAUDE.md
```

Also update the CLI Dashboard section header if it references cmd/:

```bash
sed -i 's|## CLI Dashboard (cmd/prism-cli/)|## CLI Dashboard (apps/prism-cli/)|g' CLAUDE.md
```

- [ ] **Step 2: Verify**

Run: `grep -c "cmd/" CLAUDE.md`
Expected: 0 (or only generic "cmd" references not related to our directories)

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md for apps/ rename"
```

---

### Task 8: Update Go Source Files (Mock Data & Tests)

**Files:**
- Modify: `apps/prism-cli/app/model.go` (mock data paths)
- Modify: `apps/prism-cli/app/file_finder_test.go` (test paths)
- Modify: `apps/prism-cli/domain/stories_extended_test.go` (comments)
- Modify: `apps/prism-cli/domain/config_integration_test.go` (comments)
- Modify: `apps/prism-cli/app/model_integration_test.go` (comments)
- Modify: `apps/prism-cli/state/state_test.go` (test data)

- [ ] **Step 1: Bulk replace in Go source files**

```bash
find apps/prism-cli -name "*.go" -exec sed -i 's|cmd/prism-cli|apps/prism-cli|g' {} +
find apps/prism-cli -name "*.go" -exec sed -i 's|"cmd/|"apps/|g' {} +
```

- [ ] **Step 2: Verify Go tests still compile**

Run: `cd apps/prism-cli && go build ./...`
Expected: No errors

- [ ] **Step 3: Run Go tests**

Run: `cd apps/prism-cli && go test ./... -count=1 2>&1 | tail -20`
Expected: All tests pass (or known failures unrelated to rename)

- [ ] **Step 4: Commit**

```bash
git add apps/prism-cli/
git commit -m "refactor: update Go mock data and test paths for apps/ rename"
```

---

### Task 9: Update Installer Resources

**Files:**
- Modify: `apps/prism-setup/scripts/prepare-resources.sh`
- Modify: `installer/prism-setup.nsi`

- [ ] **Step 1: Update prepare-resources.sh**

```bash
sed -i 's|cmd/prism-|apps/prism-|g' apps/prism-setup/scripts/prepare-resources.sh
```

- [ ] **Step 2: Update prism-setup.nsi comment**

```bash
sed -i 's|cmd/prism-installer|apps/prism-installer|g' installer/prism-setup.nsi
```

- [ ] **Step 3: Verify bash syntax**

Run: `bash -n apps/prism-setup/scripts/prepare-resources.sh`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add apps/prism-setup/scripts/prepare-resources.sh installer/prism-setup.nsi
git commit -m "refactor: update installer scripts for apps/ rename"
```

---

### Task 10: Final Sweep and Verification

**Files:**
- Verify: All files in repository

- [ ] **Step 1: Global sweep for remaining cmd/ references**

Run: `grep -r "cmd/prism-" --include="*.md" --include="*.json" --include="*.yml" --include="*.yaml" --include="*.py" --include="*.sh" --include="*.go" --include="*.ts" --include="*.nsi" . | grep -v node_modules | grep -v .git | grep -v dist | grep -v out | grep -v target | grep -v build | grep -v bin`

Expected: Zero matches (or only in .prism/shared/docs/ historical documentation and CHANGELOG.md which are intentional historical references)

- [ ] **Step 2: Verify directory structure**

Run: `ls apps/`
Expected: `prism-cli/  prism-electron/  prism-installer/  prism-setup/  prism-vscode/`

Run: `ls cmd/ 2>&1`
Expected: Error (no such directory)

- [ ] **Step 3: Verify root package.json workspaces resolve**

Run: `cat package.json | grep -A 10 workspaces`
Expected: All entries start with `apps/`

- [ ] **Step 4: Fix any remaining references found in Step 1**

If any `cmd/prism-` references remain in active files (not historical docs/changelog), fix them.

- [ ] **Step 5: Final commit if needed**

```bash
git add -A
git commit -m "refactor: fix remaining cmd/ references from rename sweep"
```

---

## Success Criteria

### Automated Verification
- [ ] `ls apps/` — shows all 5 app directories
- [ ] `test ! -d cmd` — cmd/ directory no longer exists
- [ ] `grep -r "cmd/prism-" --include="*.json" --include="*.yml" --include="*.py" --include="*.sh" --include="*.md" . | grep -v node_modules | grep -v .git | grep -v ".prism/shared/docs" | grep -v CHANGELOG | wc -l` — returns 0
- [ ] `cd apps/prism-cli && go build ./...` — Go builds successfully
- [ ] `python -c "import py_compile; py_compile.compile('scripts/bump-version.py', doraise=True)"` — Python syntax valid
- [ ] `bash -n scripts/prism-cli-install.sh` — bash syntax valid

### Manual Verification
- [ ] `git log --follow --oneline apps/prism-cli/main.go | head -5` — git tracks rename history
- [ ] Read CLAUDE.md — all references point to `apps/`
- [ ] Read prism-release SKILL.md — all build paths use `apps/`
- [ ] CI workflows reference `apps/` not `cmd/`
