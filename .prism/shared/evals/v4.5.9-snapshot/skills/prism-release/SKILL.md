---
name: prism-release
description: Create a versioned release of prism-plugin. Bumps semantic version across all version files, builds CLI binaries + VSIX + Electron + Tauri installer + NSIS installer + Cowork sideload zip, commits, tags, pushes, and creates a GitHub release with all assets. Use when the user says "release", "bump version", "new version", "cut a release", "prism-release", or wants to publish a new version.
model: sonnet
---

# Prism Release

Full release pipeline: bump version → build all artifacts → commit → tag → push → GitHub release.

**Repository**: `TheDigitalGriot/prism`

## Process

### Step 1: Determine bump type

Ask the user which semver component to bump using AskUserQuestion:

- **patch** (Recommended) — bug fixes, small changes
- **minor** — new features, backward-compatible
- **major** — breaking changes

Read the current version from `VERSION` file and show it so the user knows what they're bumping from:

```bash
cat VERSION
```

### Step 1b: Validate plugin manifest + invariant tests

**MANDATORY** — run before proceeding. Catches schema errors and CSS drift that would silently break the released plugin.

```bash
# Plugin manifest validation — catches schema errors that prevent plugin loading
claude plugin validate .

# Porter drift check — ensures frame-template.html is in sync with griotwave tokens.
# Exits 0 (pass or skip) / 1 (drift detected). Skips gracefully if griotwave-library unavailable.
bash scripts/tests/test_porter_check.sh
```

Both must exit 0. If `claude plugin validate .` fails, fix the errors before continuing. If `test_porter_check.sh` fails, run `node skills/prism-brainstorm/scripts/port-griotwave.cjs` to regenerate `frame-template.html`, then re-check.

### Step 1c: Clean-tree guard (parallel-session race check)

**MANDATORY** — parallel Claude sessions (cloud, Cowork, other terminals) share this working
tree and may write into it while a release is in flight (observed live 2026-07-17: a 5-file
hook fix appeared uncommitted mid-release and v4.2.0 shipped without it).

```bash
git status --porcelain
```

Review EVERY entry before proceeding. For each unexpected modification: identify its origin
(another session? a build artifact?), then either **land it deliberately** (own commit, before
the release) or **confirm it must stay out**. Never let the release's staged-file list silently
race against concurrent work — and never proceed with unexplained modifications to files the
release will package (`scripts/`, `skills/`, `hooks/`, `agents/`, `commands/`).

### Step 1d: Branch-integration guard (releases land on `main`, never a cherry-pick)

**MANDATORY.** Cut releases from `main` with the whole branch integrated — fast-forward or merge —
never a cherry-picked extract, which strands the rest of the branch and drifts `main` from what
shipped (observed live: v4.5.7 + v4.5.8 were bookended on a feature branch, never merged or tagged;
`main` sat two releases behind).

```bash
node scripts/verify-branch-integrated.mjs
```

Must exit 0. It fails if HEAD is not `main`, the base version has no reachable tag, or a finalized
release is left untagged. (It does not detect an arbitrary cherry-pick — infeasible from `main`
alone — it enforces release-from-`main`, which makes extracting one commit unnecessary.) If it fails,
integrate the branch to `main` (`git checkout main && git merge --ff-only <branch>`) and backfill any
missing release tags before continuing. The closing ceremony runs this automatically at its Step-0
audit; run it here too when invoking `prism-release` standalone.

### Step 2: Bump version across all files

```bash
python scripts/bump-version.py <major|minor|patch> --root .
```

> ⚠️ **Never hand-edit `VERSION` before running this script.** It keys off root `VERSION` to
> detect the current version — if `VERSION` already equals the target, it reports success while
> updating **nothing** (observed live 2026-07-17: "already at 4.2.0", 0 files updated). The
> `--set X.Y.Z` flag has the same trap. Let the script move `VERSION` itself, then verify the
> printed "Updated (N)" list is non-empty.

This updates version locations including: VERSION, plugin.json, marketplace.json, main.go, footer.go, package.json files (prism-vscode, prism-electron, prism-installer), PrismState.ts, PrismStateContext.tsx. Verify the output shows all files updated.

**Manual verification** — the bump script may miss these files. Check and update manually if needed:
- `apps/prism-installer/src-tauri/Cargo.toml` — `version = "{NEW_VERSION}"`
- `apps/prism-installer/src-tauri/tauri.conf.json` — `"version": "{NEW_VERSION}"`

### Step 3: Build all artifacts

Run these builds. CLI + VSIX can run in parallel, then Electron, then Tauri, then NSIS.

Load `references/build-commands.md` for the full build command reference.

#### 3a. Cross-compile CLI binaries
`cd apps/prism-cli && make build-all` — produces 5 binaries in `apps/prism-cli/bin/`.

#### 3b. Package VSIX extension
`npx @vscode/vsce package` from `apps/prism-vscode/` — outputs to `apps/prism-setup/resources/extensions/prism.vsix`.

#### 3c. Populate NSIS installer resources
Copy CLI binary and plugin files into `apps/prism-setup/resources/`.

#### 3d. Build Electron desktop app
`cd apps/prism-electron && npm run make` — outputs Squirrel installer to `out/make/squirrel.windows/x64/`.

#### 3e. Build Tauri installer (Prism Setup)
`npm run tauri build -- --bundles nsis` — outputs NSIS installer to `src-tauri/target/release/bundle/nsis/`. Use `--bundles dmg` on macOS.

#### 3f. Compile legacy NSIS installer
`makensis -V4 -DVERSION={NEW_VERSION} installer/prism-setup.nsi` — outputs `installer/Prism-Setup-{NEW_VERSION}.exe`.

### Step 4: Commit and tag

```bash
git add VERSION .claude-plugin/ apps/prism-cli/main.go apps/prism-cli/app/footer.go \
  apps/prism-vscode/package.json apps/prism-electron/package.json \
  apps/prism-installer/package.json apps/prism-installer/src-tauri/Cargo.toml \
  apps/prism-installer/src-tauri/tauri.conf.json apps/prism-installer/src-tauri/src/ \
  apps/prism-installer/src/ \
  apps/prism-setup/resources/extensions/prism.vsix \
  apps/prism-setup/resources/plugin/ \
  packages/prism-core/src/shared/PrismState.ts \
  packages/prism-ui/src/context/PrismStateContext.tsx \
  installer/ scripts/

git commit -m "v{NEW_VERSION}"
git tag v{NEW_VERSION}
```

### Step 4.5: Build the Cowork sideload zip

Archive the tagged plugin components into an uploadable zip. This runs **after** the commit+tag
(not during Step 3) because the script packages the **committed** ref and verifies the archived
`.claude-plugin/plugin.json` version matches `VERSION` — running it pre-commit would archive the
old `plugin.json` and fail verification.

```bash
python skills/prism-sideload/scripts/build-sideload.py --ref v{NEW_VERSION}
```

Outputs `.prism/local/sideload/prism-sideload-{NEW_VERSION}.zip` (gitignored local artifact,
uploaded to the GitHub release in Step 6). The script archives only the plugin components
(`.claude-plugin`, `skills`, `agents`, `commands`, `hooks`, `scripts`) — excluding `apps/`,
`packages/`, docs, `node_modules/`, and nested zips — then self-verifies: no nested zips,
`plugin.json` present, version match. If it exits non-zero, fix the reported problem before
continuing; **do not upload an unverified zip**. Bypasses Cowork's GitHub-sync cache (users
install it via Cowork → Customize → Browse plugins → Upload plugin).

### Step 5: Push

```bash
git push && git push origin v{NEW_VERSION}
```

### Step 6: Create GitHub release

**IMPORTANT: Upload assets in small chunks (2-3 at a time).** GitHub's upload API returns 404 on bulk uploads with large files. Create the release first with a few small assets, then upload remaining assets separately.

```bash
# Step 6a: Create release with CLI binaries (small files, reliable)
gh release create v{NEW_VERSION} \
  apps/prism-cli/bin/prism-cli-darwin-amd64 \
  apps/prism-cli/bin/prism-cli-darwin-arm64 \
  apps/prism-cli/bin/prism-cli-windows-amd64.exe \
  --title "Prism v{NEW_VERSION}" \
  --notes "Release notes here"

# Step 6b: Upload remaining CLI binaries
gh release upload v{NEW_VERSION} \
  apps/prism-cli/bin/prism-cli-linux-amd64 \
  apps/prism-cli/bin/prism-cli-linux-arm64

# Step 6c: Upload large installers one at a time
gh release upload v{NEW_VERSION} \
  "apps/prism-electron/out/make/squirrel.windows/x64/Prism-{NEW_VERSION} Setup.exe"

gh release upload v{NEW_VERSION} \
  "apps/prism-installer/src-tauri/target/release/bundle/nsis/Prism Setup_{NEW_VERSION}_x64-setup.exe"

gh release upload v{NEW_VERSION} \
  installer/Prism-Setup-{NEW_VERSION}.exe

# Step 6d: Upload the Cowork sideload zip (built in Step 4.5)
gh release upload v{NEW_VERSION} \
  .prism/local/sideload/prism-sideload-{NEW_VERSION}.zip

# Step 6e: Update release notes with full changelog
gh release edit v{NEW_VERSION} --notes "Full release notes here"
```

The release should include 9 assets:
- 5 CLI binaries (all platforms)
- 1 Electron desktop app installer (`Prism-{VERSION} Setup.exe`)
- 1 Tauri installer (`Prism Setup_{VERSION}_x64-setup.exe`)
- 1 Legacy NSIS all-in-one installer (`Prism-Setup-{VERSION}.exe`)
- 1 Cowork sideload zip (`prism-sideload-{VERSION}.zip`)

### Step 6.5: Sync the marketplace mirror

```bash
sh scripts/sync-marketplace.sh
```

Pushes the six plugin dirs to `TheDigitalGriot/prism-marketplace` (thin mirror, single fresh
commit per sync). Claude Desktop's marketplace points at the mirror — the full monorepo
settles `failed_content` in the backend (observed 2026-07-17); the mirror doesn't.

### Step 7: Create eval snapshot

Snapshot the current skills, agents, commands, and scripts for future eval comparisons:

```bash
VERSION=$(cat VERSION)
SNAPSHOT_DIR=".prism/shared/evals/v${VERSION}-snapshot"

mkdir -p "$SNAPSHOT_DIR"
cp -r skills/ "$SNAPSHOT_DIR/skills/"
cp -r agents/ "$SNAPSHOT_DIR/agents/"
cp -r commands/ "$SNAPSHOT_DIR/commands/"
cp -r scripts/ "$SNAPSHOT_DIR/scripts/"
```

Verify the snapshot:
```bash
echo "Snapshot created at $SNAPSHOT_DIR"
ls "$SNAPSHOT_DIR/"
echo "Skills: $(ls "$SNAPSHOT_DIR/skills/" | wc -l)"
echo "Agents: $(ls "$SNAPSHOT_DIR/agents/" | wc -l)"
echo "Commands: $(ls "$SNAPSHOT_DIR/commands/" | wc -l)"
```

### Step 8: Generate eval cases for all skills

For each skill in the new snapshot, create an `evals.json` with eval cases covering the 4 evaluation dimensions. Read each SKILL.md and the previous version's SKILL.md (if a prior snapshot exists) to identify what changed.

```bash
PREV_SNAPSHOT=$(ls -d .prism/shared/evals/v*-snapshot 2>/dev/null | sort -V | tail -2 | head -1)
```

For each skill directory in `$SNAPSHOT_DIR/skills/*/`:

1. Read the current `SKILL.md`
2. If a previous snapshot exists, diff against the previous version's `SKILL.md`
3. Create `.prism/shared/evals/v${VERSION}/skills/<skill-name>/evals.json` with eval cases:

   - **Output quality eval** — tests that outputs meet format/content requirements defined in the skill
   - **Behavioral compliance eval** — tests new workflow steps or behavioral changes vs the previous version
   - **Regression eval** — tests that core behaviors from the previous version are still present

4. If the skill uses test fixtures (like stories.json for prism-spectrum), create them under `fixtures/`

The `evals.json` schema:

```json
{
  "skill": "<skill-name>",
  "version": "v<X.Y.Z>",
  "baseline": "../../../v<PREV>-snapshot/skills/<skill-name>/SKILL.md",
  "current": "skills/<skill-name>/SKILL.md",
  "target_codebase": ".",
  "evals": [
    {
      "id": 1,
      "dimension": "output_quality",
      "prompt": "A realistic task prompt for this skill",
      "expected_output": "Description of expected result",
      "files": [],
      "expectations": [
        "Verifiable assertion about the output"
      ]
    }
  ]
}
```

Write eval cases that are specific to what the skill does — not generic. For example:
- **prism-research**: "Research the [X] system in this codebase" → expects file:line refs, research template, no suggestions
- **prism-spectrum**: "Execute the next story from [fixture]" → expects state loading, quality gates, correct signals
- **prism-plan**: "Create a plan for [feature]" → expects interactive approval, two-category success criteria
- **prism-debug**: "Debug this [error]" → expects parallel investigators spawned

If no changes exist between versions (skill unchanged), still create a minimal regression eval to confirm the skill works correctly at this version.

Add the eval files to the release commit:
```bash
git add .prism/shared/evals/
git commit --amend --no-edit
git tag -f v${VERSION}
```

### Step 9: Report results

Print a summary with the release URL, snapshot path, and eval case counts.

## Error Handling

- If `gh` is not installed or not authenticated: tell the user to run `gh auth login`
- If `make build-all` fails: check that Go 1.22+ is installed
- If `npm run make` fails: check Electron Forge dependencies with `cd apps/prism-electron && npm install`
- If `tauri build` fails: check Rust toolchain with `rustup show`, ensure NSIS is installed for bundling
- If `makensis` fails: check NSIS 3.x is installed (`winget install NSIS.NSIS`)
- If git push fails: report the error, do NOT force-push
- If `gh release create` fails because the tag already exists: ask the user if they want to delete and recreate
