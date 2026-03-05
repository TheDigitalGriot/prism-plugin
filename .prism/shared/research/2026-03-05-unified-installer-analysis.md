---
title: Unified Prism Installer — Deep Analysis
date: 2026-03-05
topic: installation-wizard
status: complete
components_analyzed:
  - prism-cli
  - prism-vscode
  - prism-electron
  - claude-plugin
---

# Research: Unified Prism Installer

## Research Question

How are each of the four Prism ecosystem components (prism-cli, prism-vscode, prism-electron, Claude Code plugin) currently installed, updated, and uninstalled? What would be needed to create a single native OS installation wizard that handles all four in one unified experience?

## Summary

The Prism ecosystem currently has four completely independent installation mechanisms with no coordination between them. The Claude plugin is manually added via Claude Code CLI commands, the CLI binary has bash/PowerShell scripts that download from GitHub releases, the VSCode extension has no automated install pipeline (user manually runs `code --install-extension`), and the Electron app uses Electron Forge's Squirrel/DMG/deb makers but has no mechanism for the other three components. A unified installer wizard is achievable using the existing Electron Forge infrastructure extended with electron-builder NSIS packaging, where the Electron app itself serves as the installation wizard UI.

---

## Files Discovered

| Path | Purpose |
|------|---------|
| `scripts/prism-cli-install.sh` | Bash installer for prism-cli binary (macOS/Linux/Git Bash) |
| `scripts/prism-cli-install.ps1` | PowerShell installer for prism-cli binary (Windows) |
| `scripts/tests/prism-cli-install.bats` | BATS test suite for bash installer |
| `scripts/tests/test_install.sh` | Zero-dependency test runner for installer |
| `cmd/prism-cli/Makefile` | Go build system (build, build-all, test, install, clean) |
| `cmd/prism-cli/build.sh` | Simple single-platform build script |
| `.github/workflows/prism-cli-release.yml` | GitHub Actions: cross-compile 5 platforms → GitHub Release |
| `.claude-plugin/plugin.json` | Claude plugin manifest (name, version, author) |
| `.claude-plugin/marketplace.json` | Claude marketplace registry (GitHub source) |
| `commands/cli-install.md` | Claude command: orchestrates CLI binary install |
| `commands/cli-uninstall.md` | Claude command: removes CLI binary + PATH entries |
| `cmd/prism-vscode/package.json` | VSCode extension build scripts (package, compile, watch) |
| `cmd/prism-vscode/.vscodeignore` | VSIX exclusion rules |
| `cmd/prism-vscode/esbuild.mjs` | Extension host bundler (esbuild → dist/extension.js) |
| `cmd/prism-electron/package.json` | Electron app scripts (start, package, make, publish) |
| `cmd/prism-electron/forge.config.ts` | Electron Forge: makers, Vite builds, ASAR, Fuses |
| `package.json` | Root npm workspaces (7 workspace members) |
| `skills/prism/scripts/init_prism.py` | Per-project .prism/ directory initializer |
| `skills/prism-release/SKILL.md` | Release skill: bumps version across 8 files |

---

## Component Analysis

### 1. prism-cli (Go TUI Dashboard)

**Current install path:** `~/.prism/bin/prism-cli` (Unix) / `%USERPROFILE%\.prism\bin\prism-cli.exe` (Windows)

**Install mechanism:**

```
bash scripts/prism-cli-install.sh [auto|source|download]
# OR
.\scripts\prism-cli-install.ps1 [-Method auto|source|download]
```

**Three modes (both scripts):**
1. `download` — fetches pre-built binary from `https://github.com/TheDigitalGriot/prism-plugin/releases/latest/download/prism-cli-{platform}{ext}`
2. `source` — runs `go build` in `cmd/prism-cli/` (requires Go installed)
3. `auto` — tries download first, falls back to source, errors if neither works

**Platform detection:** Bash uses `uname -s` + `uname -m` normalized to 5 targets. PowerShell hardcodes `windows-amd64` (no arm64 detection).

**PATH configuration:**
- Unix: appends `export PATH="$PATH:$HOME/.prism/bin"` to `.zshrc` → `.bashrc` → `.bash_profile` (priority order)
- Windows: appends `$env:Path += ";$env:USERPROFILE\.prism\bin"` to PowerShell `$PROFILE`
- Both are idempotent (check before appending)

**Post-install:** Creates `~/.prism/workspaces.json` = `{"projects":[]}` if not exists.

**Update mechanism:** None in install scripts. The `/cli-install` Claude command checks `gh release view` against local version, prompts user to re-run installer.

**Uninstall mechanism:** `/cli-uninstall` Claude command removes binary + PATH entries from shell configs + optionally removes `~/.prism/`.

**CI/CD:** `.github/workflows/prism-cli-release.yml` — triggers on `v*` tag push, builds 5 platform binaries (Go 1.22), creates GitHub Release with auto-generated notes.

**Build outputs:**
- `bin/prism-cli` (current platform) via `make build`
- `bin/prism-cli-{os}-{arch}` (5 platforms) via `make build-all`
- Version injected via `-ldflags "-X main.version=..."`

---

### 2. prism-vscode (VSCode Extension)

**Current install path:** `~/.vscode/extensions/prism-prism-2.4.1/` (auto-managed by VSCode)

**Build pipeline:**
```
npm run package  (= vscode:prepublish lifecycle hook)
  ↓
tsc --noEmit              (type check)
  ↓
cd webview-panel && npm run build    (→ dist/webview-panel/)
  ↓
cd webview-ui && npm run build       (→ webview-ui/build/)
  ↓
node esbuild.mjs --production        (→ dist/extension.js)
```

**Package command:**
```bash
cd cmd/prism-vscode
npm run package          # builds
vsce package             # produces prism-2.4.1.vsix
```

**VSIX contents** (what gets distributed):
- `package.json` — extension manifest
- `dist/extension.js` — minified CJS bundle (all extension host code)
- `dist/assets/` — office sprites/tiles
- `dist/webview-panel/` — built bottom panel React app
- `webview-ui/build/` — built sidebar React app
- `media/prism-icon.svg`

**Install method:**
```bash
code --install-extension prism-2.4.1.vsix
# OR via VSCode marketplace (if published)
```

**No automated install pipeline exists.** The `.vscodeignore` and `vsce package` are the full extent of distribution tooling.

**Update:** VSCode handles auto-update for marketplace-published extensions. VSIX files don't auto-update.

**Uninstall:** VSCode Extensions panel → Uninstall. Or `code --uninstall-extension prism.prism`.

---

### 3. prism-electron (Standalone Desktop App)

**Current install path (platform-specific):**
- Windows: `%LocalAppData%\Prism\` (Squirrel installer, no admin required)
- macOS: `/Applications/Prism.app` (user drags from ZIP)
- Linux: System package locations (deb/rpm)

**Build & package commands:**
```bash
cd cmd/prism-electron
npm run make       # → out/make/  (all platform installers)
npm run package    # → out/Prism-{platform}-{arch}/  (app directory, no installer)
```

**Electron Forge makers:**
| Maker | Platform | Output |
|-------|----------|--------|
| MakerSquirrel | Windows | `out/make/squirrel.windows/x64/Prism-{version} Setup.exe` |
| MakerZIP (darwin only) | macOS | `out/make/zip/darwin/x64/Prism-darwin-x64-{version}.zip` |
| MakerDeb | Linux | `out/make/deb/x64/prism-electron_{version}_amd64.deb` |
| MakerRpm | Linux | `out/make/rpm/x64/prism-electron-{version}-1.x86_64.rpm` |

**Vite build targets (via VitePlugin in forge.config.ts):**
1. `src/main.ts` → `.vite/build/main.js` (main process, `@prism-core` alias resolved)
2. `src/preload.ts` → `.vite/build/preload.js` (preload sandbox bridge)
3. `webview-ui/` → `.vite/renderer/` (React SPA renderer)

**Key configuration:**
- `asar: true` — app compressed into single ASAR archive
- `extraResource: ['../prism-vscode/assets']` — office sprites shared from vscode package
- `FusesPlugin` — security hardening (no NODE_OPTIONS, no node inspect, ASAR integrity, OnlyLoadFromAsar)

**Squirrel lifecycle events:** Handled by `electron-squirrel-startup` package. Manages first-run install/uninstall shortcuts.

**No Claude plugin or prism-cli installation happens** during Electron app install/launch.

**`@prism-core` resolution:** Vite main config resolves `@prism-core/*` → `packages/prism-core/src/*` first, then falls back to `../prism-vscode/src/*`.

---

### 4. Claude Code Plugin (Markdown Prompt Engineering)

**Current install path:** `~/.claude/plugins/cache/prism-marketplace/prism/{version}/` (managed by Claude Code)

**What constitutes the plugin:**
- `.claude-plugin/plugin.json` — manifest (name, version, author)
- `.claude-plugin/marketplace.json` — marketplace source (GitHub repo reference)
- `commands/*.md` — 25 slash commands with YAML frontmatter
- `agents/*.md` — 10 subagent definitions
- `skills/*/SKILL.md` — 13 skill entry points

**No build step.** The plugin is pure markdown files loaded at runtime by Claude Code.

**Current install flow (manual, 2 steps):**
```
Step 1 (inside Claude session):
  /plugin marketplace add TheDigitalGriot/prism-plugin

Step 2:
  /plugin install prism@prism-marketplace
```

OR for local development:
```bash
claude --plugin-dir /path/to/prism-plugin
```

**How Claude Code loads the plugin:**
1. Reads `.claude-plugin/plugin.json` for plugin identity/version
2. Scans `commands/`, `agents/`, `skills/*/SKILL.md` for auto-discovery
3. Sets `CLAUDE_PLUGIN_ROOT` env var to the plugin root directory
4. Loads YAML frontmatter from each `.md` to get metadata (name, description, model)
5. Skills are namespaced: `/prism:<skill-name>`

**Programmatic installation options:**
```bash
# Option A: via claude CLI
claude plugin marketplace add TheDigitalGriot/prism-plugin
claude plugin install prism@prism-marketplace

# Option B: direct file copy (no CLI needed)
mkdir -p ~/.claude/commands ~/.claude/agents
cp commands/*.md ~/.claude/commands/
cp agents/*.md ~/.claude/agents/
# Skills are not supported standalone yet (require plugin context)
```

**`CLAUDE_PLUGIN_ROOT` bridge:** Commands can reference scripts at `${CLAUDE_PLUGIN_ROOT}/scripts/...`. Used by `commands/cli-install.md` to locate the bash/PowerShell installers at runtime.

**Update mechanism:** None automatic. User must re-run install commands or pull the git repo.

**No uninstall command exists** for the Claude plugin itself (only for prism-cli).

---

## Current Installation Gaps

| Gap | Impact |
|-----|--------|
| No unified installer | User must run 4 separate installation procedures |
| No VSCode extension install automation | User must find and run `code --install-extension` manually |
| No Electron app installer packaging in CI/CD | No GitHub Release for Electron app binaries |
| Claude plugin: 2-step manual process | Must be inside a Claude session to install |
| No cross-component update check | Each component has its own version, no coordinated update |
| PowerShell installer hardcodes windows-amd64 | No arm64 Windows support |
| No macOS installer format (only ZIP) | No DMG, no macOS-native install experience |
| Squirrel installer installs Electron app only | Doesn't configure PATH, Claude plugin, or VSCode extension |
| No rollback/uninstall for VSCode ext, Claude plugin | Partial uninstall possible |

---

## Installer Technology Analysis

### Option A: Electron-Based Wizard (electron-builder)

**Recommended.** Leverages the existing `cmd/prism-electron/` Electron stack.

**How it works:**
- A separate `cmd/prism-installer/` Electron app (or repurpose `cmd/prism-electron/`) serves as the wizard UI
- React frontend renders the step-by-step wizard interface
- Node.js main process executes actual install operations
- electron-builder packages it with NSIS (Windows), DMG (macOS), AppImage (Linux)

**Install operations from Node.js main process:**
```javascript
// Install prism-cli binary
const binaryPath = path.join(process.resourcesPath, 'binaries', platform + arch);
fs.copyFileSync(binaryPath, path.join(os.homedir(), '.prism', 'bin', 'prism-cli'));

// Add to PATH (Unix)
fs.appendFileSync(path.join(os.homedir(), '.zshrc'), '\nexport PATH="$PATH:$HOME/.prism/bin"');

// Install VSCode extension
execSync(`code --install-extension ${path.join(process.resourcesPath, 'extensions', 'prism.vsix')}`);

// Install Claude plugin
execSync(`claude plugin marketplace add TheDigitalGriot/prism-plugin`);
execSync(`claude plugin install prism@prism-marketplace`);
// OR: copy files directly
```

**Bundled resources via `extraResources`:**
```json
{
  "extraResources": [
    { "from": "binaries/${os}-${arch}/prism-cli${ext}", "to": "binaries/" },
    { "from": "../prism-vscode/dist/prism.vsix", "to": "extensions/" },
    { "from": "../../", "to": "plugin/", "filter": ["commands/**", "agents/**", "skills/**", ".claude-plugin/**"] }
  ]
}
```

**Platforms:** Windows (NSIS .exe), macOS (DMG), Linux (AppImage + deb)

**Strengths:**
- Polished React wizard UI (existing team skill)
- Full Node.js access for all install operations
- PATH modification, process spawning, file I/O all trivial
- Single output per platform
- electron-builder NSIS provides PATH env modification for Windows

**Weaknesses:**
- ~150MB installer (Chromium bundled)
- Separate from the Electron app itself (needs its own Electron window or reuse existing)

---

### Option B: Wails (Go-Based Wizard)

**Strong alternative.** Uses Go (same language as prism-cli) with a web frontend.

**How it works:**
- Go backend: direct access to `os`, `exec`, `registry` packages for install operations
- Web frontend: same React/Tailwind design system
- Wails compiler produces a single binary (~15-20MB vs Electron's 150MB)
- Uses OS native WebView (no Chromium)

**Packaging:**
- Windows: NSIS installer via Wails Taskfile
- macOS: DMG via `create-dmg` in Taskfile
- Linux: AppImage, deb via platform tools

**Strengths:**
- ~10x smaller installer binary
- Go backend shares code with prism-cli (e.g., platform detection, PATH utilities)
- Native WebView looks more OS-appropriate on macOS/Windows
- No Chromium dependency

**Weaknesses:**
- New dependency stack (Go + Wails)
- Wails v3 is alpha (v2 is stable but older)
- Packaging must be set up manually vs electron-builder's turnkey approach
- Separate from existing Electron infrastructure

---

### Option C: Tauri (Rust + WebView)

**Viable but different language.** Rust backend with WebView frontend.

**Strengths:**
- Smallest binaries (~5-10MB)
- Best security model
- NSIS hooks for Windows PATH modification
- Well-documented `extraResources` bundling

**Weaknesses:**
- Rust is not used elsewhere in the project
- Steeper learning curve for the team
- NSIS hooks are the only way to handle Windows PATH at install time (not in wizard UI)

---

### Option D: Enhance Existing Electron Forge (Squirrel)

**Partial solution.** Keep the Squirrel installer but add first-run setup.

**How it works:**
- On `squirrel-install` event, run install scripts
- Bundle prism-cli binary in `resources/`
- On first launch, wizard UI checks what's installed and runs setup

**Weaknesses:**
- No wizard during the install itself (Squirrel = spinner only)
- First-run setup only works after Electron is already installed
- Cannot bootstrap the rest of the Prism ecosystem before Electron is running

---

## Recommended Architecture: "Prism Setup Wizard"

### Concept

Create a dedicated `cmd/prism-setup/` Electron application (separate from `cmd/prism-electron/`) built with **electron-builder** for packaging. This wizard:

1. Detects what's already installed (prism-cli version, VSCode, Claude CLI, existing Prism plugin)
2. Presents a component selection screen with checkboxes
3. Downloads/installs selected components with a progress UI
4. Configures PATH and shell environments
5. Verifies installation of each component
6. Supports repair/update/uninstall modes

### Wizard Steps

```
Welcome Screen
     ↓
System Check (detect: Node, Go, VSCode, Claude CLI, existing installs)
     ↓
Component Selection:
  [x] prism-cli (Go TUI Dashboard)       — version: 2.4.1
  [x] Prism VSCode Extension             — requires: VS Code
  [x] Prism Desktop App (Electron)       — standalone
  [x] Prism Claude Code Plugin           — requires: Claude Code CLI
     ↓
Install Location (for prism-cli binary)
     ↓
Installation Progress (per-component progress bars)
     ↓
Post-Install Verification
     ↓
Done (restart terminal / open VSCode)
```

### Installer Binary per Platform

| Platform | Format | Mechanism |
|----------|--------|-----------|
| Windows | `Prism-Setup-{version}.exe` | NSIS (electron-builder), PATH via registry |
| macOS | `Prism-Setup-{version}.dmg` | DMG with wizard app |
| Linux | `Prism-Setup-{version}.AppImage` | Portable AppImage |
| Linux | `prism-setup_{version}_amd64.deb` | Debian package |

### Bundled Resources

All components bundled inside the installer:

```
resources/
├── binaries/
│   ├── prism-cli-darwin-arm64
│   ├── prism-cli-darwin-amd64
│   ├── prism-cli-linux-amd64
│   ├── prism-cli-windows-amd64.exe
│   └── prism-cli-linux-arm64
├── extensions/
│   └── prism-{version}.vsix
├── plugin/
│   ├── .claude-plugin/
│   ├── commands/
│   ├── agents/
│   └── skills/
└── app/
    └── prism-electron-{version}.zip  (or installed in-place)
```

### Install Operations by Component

**prism-cli:**
```
1. Copy binary from resources/binaries/{platform} to ~/.prism/bin/prism-cli
2. chmod +x (Unix)
3. Append PATH to ~/.zshrc / ~/.bashrc / ~/.zprofile (Unix)
4. Append PATH to PowerShell $PROFILE and registry (Windows)
5. Create ~/.prism/workspaces.json if not exists
```

**VSCode Extension:**
```
1. Check: execSync('code --version') — detect if code CLI is in PATH
2. If VSCode not found: check common paths (/Applications/Visual Studio Code.app on macOS)
3. Run: execSync(`code --install-extension ${vsixPath}`)
4. Also check: cursor, windsurf (same --install-extension flag)
```

**Electron App:**
```
Option A: Bundle within setup installer, extract to Applications/Program Files
Option B: Link to GitHub Release download page (lighter setup binary)
Option C: Separate Electron Forge installer used as-is, setup wizard just launches it
```

**Claude Plugin:**
```
1. Check: execSync('claude --version') — detect Claude CLI
2. Option A: execSync('claude plugin marketplace add TheDigitalGriot/prism-plugin')
             execSync('claude plugin install prism@prism-marketplace')
3. Option B: Copy plugin files directly
   - Copy commands/*.md to ~/.claude/commands/
   - Copy agents/*.md to ~/.claude/agents/
   - Copy skills/ to appropriate location
   Note: full plugin (with skill namespacing) requires proper plugin install, not file copy
```

### Update Wizard

Re-running the installer detects existing versions:
```
System Check:
  prism-cli:      v2.3.0 → v2.4.1 (update available)
  VSCode ext:     v2.4.1 (up to date)
  Electron app:   not installed
  Claude plugin:  v2.4.0 → v2.4.1 (update available)
```

User selects what to update. Installer overwrites binaries, re-runs `code --install-extension`, re-installs plugin.

### Uninstall

A separate "Uninstall Prism" option (or re-run setup in repair mode):
1. Remove `~/.prism/bin/prism-cli`
2. Remove PATH entries from shell configs
3. Run `code --uninstall-extension prism.prism`
4. Run `claude plugin uninstall prism@prism-marketplace` (or remove cached files)
5. Optionally remove `~/.prism/` directory

---

## Open Questions for Planning

1. **Separate installer app vs. wizard mode in existing Electron app?**
   - Option A: `cmd/prism-setup/` — new dedicated installer Electron app
   - Option B: wizard mode built into `cmd/prism-electron/` (first-run detection)
   - Option B is simpler but the Electron app requires setup to run → chicken-and-egg problem

2. **Should the Electron Desktop App be bundled inside the setup wizard or downloaded separately?**
   - Bundling: larger setup binary (~200MB) but fully offline
   - Downloading: smaller setup (~50MB) but requires internet connection
   - Best UX: bundle by default with option to skip

3. **Wails vs Electron for the wizard?**
   - Wails: smaller binary, Go codebase shared with prism-cli, native WebView
   - Electron: existing infrastructure, React UI already built, faster to implement
   - Decision point: team preference and binary size importance

4. **How should macOS distribution work?**
   - Currently: ZIP → manual drag to /Applications
   - Better: DMG with installer wizard that runs the setup logic
   - Best: Notarized and signed DMG (requires Apple Developer account)

5. **Claude plugin: copy files directly vs. `claude plugin install` command?**
   - Direct copy: faster, no claude CLI dependency, works even before claude is installed
   - `claude plugin install`: proper namespacing, version tracking, update management
   - Hybrid: copy commands/agents directly AND run `claude plugin install` if available

6. **Auto-update mechanism after initial install?**
   - prism-cli: already handles update detection via `/cli-install` command
   - VSCode extension: marketplace handles updates if published there
   - Electron app: Squirrel handles auto-update
   - Claude plugin: no mechanism currently
   - Setup wizard could be the update mechanism for all (user re-runs it)

7. **Version source of truth for update detection?**
   - Currently: 8 files must be manually synchronized
   - Setup wizard needs a single endpoint to check: GitHub Releases latest tag vs. local
   - Could use `https://api.github.com/repos/TheDigitalGriot/prism-plugin/releases/latest`

---

## Patterns Found

### Existing Version Injection Pattern
```makefile
# cmd/prism-cli/Makefile
VERSION := $(shell git describe --tags --always --dirty)
LDFLAGS := -X main.version=$(VERSION)
go build -ldflags "$(LDFLAGS)" -o bin/prism-cli .
```
Same pattern in bash installer's `build_from_source()` and GitHub Actions workflow.

### Existing PATH Modification Pattern (Bash)
```bash
# scripts/prism-cli-install.sh lines 116-148
if ! grep -q ".prism/bin" "$RC_FILE" 2>/dev/null; then
    printf '\n# Prism CLI\nexport PATH="$PATH:$HOME/.prism/bin"\n' >> "$RC_FILE"
fi
```
Idempotent, priority order: `.zshrc` > `.bashrc` > `.bash_profile`.

### Existing Cross-Platform Binary Bundling Pattern
```typescript
// cmd/prism-electron/forge.config.ts lines 14-16
packagerConfig: {
  extraResource: ['../prism-vscode/assets'],
}
```
Can be extended for bundling prism-cli binaries per-platform.

### Existing Installer Tests Pattern
```bash
# scripts/tests/test_install.sh
sandbox_setup() {
  SANDBOX_DIR=$(mktemp -d)
  export HOME="$SANDBOX_DIR"
  export PRISM_BIN_DIR="$SANDBOX_DIR/.prism/bin"
}
```
Isolated temp HOME for testing without touching real user environment.

### Existing Claude Plugin Auto-Discovery
```
.claude-plugin/plugin.json     → plugin identity
commands/*.md                  → slash commands (auto-discovered)
agents/*.md                    → subagents (auto-discovered)
skills/*/SKILL.md              → skills (auto-discovered by directory scan)
CLAUDE_PLUGIN_ROOT             → env var pointing to plugin root
```
