---
title: Prism Setup Wizard — Unified Installer
date: 2026-03-05
status: draft
research: .prism/shared/research/2026-03-05-unified-installer-analysis.md
target: cmd/prism-setup/
phases: 10
---

# Plan: Prism Setup Wizard — Unified Installer

## Goal

Build a native cross-platform installation wizard (`cmd/prism-setup/`) that installs, updates, and uninstalls all four Prism ecosystem components from a single UI:

1. **prism-cli** — Go TUI dashboard binary → `~/.prism/bin/`
2. **prism-vscode** — VSCode extension → via `code --install-extension`
3. **prism-electron** — Standalone desktop app → downloaded from GitHub Releases
4. **Claude Code plugin** — Markdown prompt files → via `claude plugin install`

## Starting Point

`cmd/prism-setup/` already exists as a clean Electron Forge + React 19 + Vite + TypeScript boilerplate with:
- Electron 40, React 19, Vite 5, TypeScript 4.5
- Forge config with Squirrel/ZIP/Deb/RPM makers
- Basic `main.ts`, empty `preload.ts`, "Hello World" `App.tsx`
- No Tailwind, no IPC bridge, no installer logic yet

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Build system | Keep Electron Forge, add NSIS maker | Scaffold already uses Forge; team familiar from prism-electron |
| Windows installer | NSIS (via `electron-forge-maker-nsis`) | Custom wizard pages, PATH via EnVar plugin, `installer.nsh` hooks |
| macOS installer | DMG (via `@electron-forge/maker-dmg`) | Native macOS look; drag-to-Applications + custom background |
| Linux installer | AppImage + deb | AppImage for universal; deb for Debian/Ubuntu |
| Electron app delivery | Download at install time from GitHub Releases | Keeps setup binary smaller (~50MB vs ~200MB) |
| Claude plugin | `claude plugin install` with direct-copy fallback | Proper namespacing when Claude CLI available |
| Design system | Tailwind v4 + `@prism-ui` bridge.css + `data-platform="setup"` | Consistent Prism visual identity |
| Binary bundling | `packagerConfig.extraResource` + Forge `packageAfterCopy` hook | Per-platform prism-cli binary + VSIX + plugin files |

## What We're NOT Doing

- NOT migrating prism-electron from Forge to electron-builder (separate concern)
- NOT building auto-update for the setup wizard itself (users re-download)
- NOT code-signing or notarizing (can be added later with certificates)
- NOT building a silent/headless CLI installer mode (wizard-only for now)
- NOT creating CI/CD for prism-electron or prism-vscode builds (prerequisite, but separate task — we'll manually build artifacts for now)

## Success Criteria

### Automated Verification
- [ ] `cd cmd/prism-setup && npm start` launches wizard window
- [ ] `cd cmd/prism-setup && npm run make` produces platform installer
- [ ] TypeScript compiles: `npm run lint` passes
- [ ] Installer detects existing prism-cli version correctly
- [ ] Installer detects VSCode/Cursor/Windsurf CLI availability
- [ ] Installer detects Claude CLI availability
- [ ] PATH modification is idempotent (running twice doesn't duplicate entries)
- [ ] Uninstall removes prism-cli binary and PATH entries

### Manual Verification
- [ ] Wizard UI flows through all 7 screens without errors
- [ ] prism-cli binary installs to `~/.prism/bin/` and is executable
- [ ] VSCode extension installs and appears in Extensions panel
- [ ] Claude plugin installs and `/prism:` commands appear in Claude session
- [ ] Electron app downloads and launches
- [ ] Update mode detects outdated components and updates them
- [ ] Uninstall mode cleanly removes all components
- [ ] NSIS installer on Windows modifies system PATH correctly
- [ ] DMG on macOS shows custom background with drag-to-Applications layout

---

## Phase 1: Project Configuration & Dependencies

**Goal**: Transform the boilerplate into a properly configured Prism Setup Wizard project with correct dependencies, Tailwind, and workspace integration.

### Files to modify:
- `cmd/prism-setup/package.json` — rename, update version, add Tailwind + lucide-react deps, add NSIS/DMG makers
- `cmd/prism-setup/tsconfig.json` — update TypeScript to 5.x, add path aliases
- `cmd/prism-setup/vite.renderer.config.mts` — add Tailwind plugin, path aliases
- `cmd/prism-setup/forge.config.ts` — add extraResource, swap Squirrel for NSIS maker, add DMG maker
- `cmd/prism-setup/index.html` — add `data-platform="setup"` to root div, update title
- `package.json` (root) — add `cmd/prism-setup` to workspaces array

### Steps:

1. **Update `package.json`**:
   ```json
   {
     "name": "prism-setup",
     "productName": "Prism Setup",
     "version": "2.4.1",
     "description": "Unified installer for the Prism development ecosystem"
   }
   ```
   Add dependencies:
   - `@tailwindcss/vite` (devDep)
   - `tailwindcss` ^4.2.1 (devDep)
   - `lucide-react` (dep) — icons
   - `tailwind-merge`, `clsx`, `class-variance-authority` (deps) — utility classes
   - `electron-forge-maker-nsis` (devDep) — NSIS Windows installer
   - `@electron-forge/maker-dmg` (devDep) — macOS DMG

   Remove:
   - `@electron-forge/maker-squirrel` (replaced by NSIS)
   - `@types/electron-squirrel-startup` (no longer needed)
   - `electron-squirrel-startup` (NSIS handles lifecycle differently)

   Update:
   - `typescript` to `^5.4.5` (match prism-electron)
   - `vite` to `^6.0.0` (match prism-electron)

2. **Update `tsconfig.json`**:
   - Add `"strict": true`
   - Add `"paths"` for `@/*` → `src/*` and `@prism-ui/*` → `../../packages/prism-ui/src/*`
   - Add `"include": ["src/**/*"]`, `"exclude": ["node_modules"]`

3. **Update `vite.renderer.config.mts`**:
   ```typescript
   import { defineConfig } from 'vite';
   import react from '@vitejs/plugin-react';
   import tailwindcss from '@tailwindcss/vite';
   import path from 'path';

   export default defineConfig({
     plugins: [react(), tailwindcss()],
     resolve: {
       alias: {
         '@': path.resolve(__dirname, 'src'),
         '@prism-ui': path.resolve(__dirname, '../../packages/prism-ui/src'),
       },
     },
   });
   ```

4. **Update `forge.config.ts`**:
   - Replace `MakerSquirrel` with NSIS maker
   - Add `MakerDMG` for macOS
   - Add `packagerConfig.extraResource` array (empty for now, populated in Phase 4)
   - Remove `electron-squirrel-startup` guard from main.ts

5. **Update `index.html`**:
   ```html
   <title>Prism Setup</title>
   <div id="root" data-platform="setup"></div>
   ```

6. **Add to root `package.json` workspaces**:
   ```json
   "workspaces": [
     "packages/*",
     "cmd/prism-vscode",
     "cmd/prism-vscode/webview-ui",
     "cmd/prism-vscode/webview-office",
     "cmd/prism-vscode/webview-panel",
     "cmd/prism-electron",
     "cmd/prism-electron/webview-ui",
     "cmd/prism-setup"
   ]
   ```

### Verification:
- [ ] `cd cmd/prism-setup && npm install` succeeds
- [ ] `npm start` opens an Electron window with "Prism Setup" title
- [ ] No TypeScript errors

---

## Phase 2: IPC Bridge & Preload

**Goal**: Establish the typed IPC communication layer between main process and renderer, following the `prism-electron` pattern.

### Files to create:
- `cmd/prism-setup/src/preload.ts` — contextBridge with typed installer API
- `cmd/prism-setup/src/types.ts` — shared types (InstallerAPI, ComponentStatus, InstallProgress, etc.)

### Files to modify:
- `cmd/prism-setup/src/main.ts` — add `contextIsolation: true`, `nodeIntegration: false`, resize window to 900x640 (wizard size)

### Types to define (`src/types.ts`):

```typescript
export type Platform = 'win32' | 'darwin' | 'linux';
export type Arch = 'x64' | 'arm64';

export type ComponentId = 'prism-cli' | 'prism-vscode' | 'prism-electron' | 'claude-plugin';

export type ComponentStatus = {
  id: ComponentId;
  name: string;
  description: string;
  installed: boolean;
  currentVersion: string | null;
  latestVersion: string | null;
  updateAvailable: boolean;
  prerequisiteMet: boolean;       // e.g., VSCode installed for prism-vscode
  prerequisiteMessage: string | null;
};

export type SystemInfo = {
  platform: Platform;
  arch: Arch;
  homedir: string;
  vscodeAvailable: boolean;
  vscodePath: string | null;       // path to `code` CLI
  cursorAvailable: boolean;
  windsurf Available: boolean;
  claudeAvailable: boolean;
  claudePath: string | null;
  nodeAvailable: boolean;
  goAvailable: boolean;
  existingPrismDir: boolean;       // ~/.prism/ exists
  components: ComponentStatus[];
};

export type InstallProgress = {
  componentId: ComponentId;
  status: 'pending' | 'downloading' | 'installing' | 'configuring' | 'verifying' | 'complete' | 'error' | 'skipped';
  percent: number;                 // 0-100
  message: string;
  error?: string;
};

export type InstallOptions = {
  components: ComponentId[];
  installDir: string;              // default: ~/.prism/bin
  addToPath: boolean;
  editor: 'vscode' | 'cursor' | 'windsurf' | null;
};

export type WizardMode = 'install' | 'update' | 'uninstall';
```

### IPC Channels:

| Channel | Direction | Pattern | Purpose |
|---------|-----------|---------|---------|
| `setup:getSystemInfo` | renderer→main | invoke | Detect system, installed tools, versions |
| `setup:startInstall` | renderer→main | invoke | Begin installation with selected components |
| `setup:startUninstall` | renderer→main | invoke | Begin uninstallation |
| `setup:cancelInstall` | renderer→main | send | Cancel in-progress installation |
| `setup:progress` | main→renderer | push | Per-component progress updates |
| `setup:openExternal` | renderer→main | invoke | Open URL in default browser |
| `setup:selectDirectory` | renderer→main | invoke | Show folder picker dialog |
| `setup:getLatestVersion` | renderer→main | invoke | Check GitHub API for latest release |

### Preload pattern (following `prism-electron/src/preload.ts`):

```typescript
contextBridge.exposeInMainWorld('setupAPI', {
  getSystemInfo: () => ipcRenderer.invoke('setup:getSystemInfo'),
  startInstall: (options: InstallOptions) => ipcRenderer.invoke('setup:startInstall', options),
  startUninstall: (components: ComponentId[]) => ipcRenderer.invoke('setup:startUninstall', components),
  cancelInstall: () => ipcRenderer.send('setup:cancelInstall'),
  onProgress: (cb: (progress: InstallProgress) => void) => {
    const handler = (_: any, p: InstallProgress) => cb(p);
    ipcRenderer.on('setup:progress', handler);
    return () => ipcRenderer.removeListener('setup:progress', handler);
  },
  openExternal: (url: string) => ipcRenderer.invoke('setup:openExternal', url),
  selectDirectory: (defaultPath: string) => ipcRenderer.invoke('setup:selectDirectory', defaultPath),
  getLatestVersion: () => ipcRenderer.invoke('setup:getLatestVersion'),
});
```

### Verification:
- [ ] `npm start` opens wizard window with correct size (900x640)
- [ ] DevTools console shows no errors
- [ ] TypeScript types compile without errors
- [ ] `window.setupAPI` is accessible from renderer (test in DevTools console)

---

## Phase 3: Wizard UI Shell

**Goal**: Build the multi-step wizard React UI with navigation, all 7 screens as stub components, and the Prism design system.

### Files to create:
- `cmd/prism-setup/src/index.css` — Tailwind imports + `@theme` block (model after `prism-electron/webview-ui/src/index.css`)
- `cmd/prism-setup/src/theme/setup.css` — `[data-platform="setup"]` CSS variables (dark theme matching Prism brand)
- `cmd/prism-setup/src/hooks/useWizard.ts` — wizard step state machine (current step, navigation, mode)
- `cmd/prism-setup/src/hooks/useSystemInfo.ts` — calls `setupAPI.getSystemInfo()` on mount
- `cmd/prism-setup/src/hooks/useInstaller.ts` — manages install progress state via `setupAPI.onProgress()`
- `cmd/prism-setup/src/components/WizardLayout.tsx` — outer frame: step indicator + content area + nav buttons
- `cmd/prism-setup/src/components/StepIndicator.tsx` — horizontal step progress bar (numbered dots connected by lines)
- `cmd/prism-setup/src/screens/WelcomeScreen.tsx` — Prism logo, tagline, Install/Update/Uninstall mode selection
- `cmd/prism-setup/src/screens/SystemCheckScreen.tsx` — shows detected tools with green/yellow/red indicators
- `cmd/prism-setup/src/screens/ComponentSelectScreen.tsx` — checkboxes for each component with version info
- `cmd/prism-setup/src/screens/InstallLocationScreen.tsx` — directory picker for prism-cli install path
- `cmd/prism-setup/src/screens/ProgressScreen.tsx` — per-component progress bars with status messages
- `cmd/prism-setup/src/screens/VerificationScreen.tsx` — post-install check results (pass/fail per component)
- `cmd/prism-setup/src/screens/DoneScreen.tsx` — success summary with action buttons (Open VSCode, Open Prism, etc.)

### Files to modify:
- `cmd/prism-setup/src/App.tsx` — replace "Hello World" with `<WizardLayout>`
- `cmd/prism-setup/src/renderer.tsx` — wrap with providers if needed

### Wizard Step Flow:

```
Welcome → SystemCheck → ComponentSelect → InstallLocation → Progress → Verification → Done
   ↑                                                                                    |
   └────────────────── (can restart if user wants to change selections) ────────────────┘
```

Navigation rules:
- Back/Next buttons at bottom of each screen
- "Back" disabled on Welcome, "Next" disabled on Done
- Progress screen has no Back (installation is in progress)
- Done screen has "Install More" button that returns to Welcome
- Update mode skips InstallLocation (uses existing path)
- Uninstall mode skips InstallLocation and ComponentSelect shows only installed components

### Design Tokens (`theme/setup.css`):

Use the Prism spectral color system from `packages/prism-ui/src/styles/bridge.css`:
```css
[data-platform="setup"] {
  --prism-bg: #0a0e14;
  --prism-bg-panel: #111820;
  --prism-fg: #c9d1d9;
  --prism-fg-muted: #768390;
  --prism-border: #1c2533;
  --prism-accent: #3b82f6;
  /* ... (same token set as Electron platform) */
}
```

### Verification:
- [ ] `npm start` shows the Welcome screen with Prism branding
- [ ] Clicking Next/Back navigates through all 7 screens
- [ ] Step indicator highlights current step
- [ ] All screens render without errors
- [ ] Dark theme with Prism colors applied correctly

---

## Phase 4: System Detection Engine

**Goal**: Implement the main process logic that detects the user's system state — installed tools, existing Prism installations, available versions.

### Files to create:
- `cmd/prism-setup/src/installer/detect.ts` — system detection functions
- `cmd/prism-setup/src/installer/version.ts` — version comparison and GitHub API check
- `cmd/prism-setup/src/installer/paths.ts` — platform-aware path utilities

### Functions in `detect.ts`:

```typescript
// Detect if a CLI tool is available and return its path + version
async function detectCli(name: string, versionFlag?: string): Promise<{ available: boolean; path: string | null; version: string | null }>;

// Specific detectors
async function detectVSCode(): Promise<{ available: boolean; path: string; variant: 'vscode' | 'cursor' | 'windsurf' }>;
async function detectClaude(): Promise<{ available: boolean; path: string; version: string }>;
async function detectPrismCli(): Promise<{ available: boolean; path: string; version: string }>;
async function detectPrismPlugin(): Promise<{ available: boolean; version: string }>;
async function detectPrismElectron(): Promise<{ available: boolean; version: string }>;

// Full system scan
async function getSystemInfo(): Promise<SystemInfo>;
```

### Detection strategies:

**VSCode detection** (cross-platform):
1. Try `code --version` (stdout first line = version)
2. If not in PATH on macOS: check `/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code`
3. Also check `cursor --version`, `windsurf --version`

**Claude CLI detection**:
1. Try `claude --version`
2. Returns version string or null

**prism-cli detection**:
1. Check `~/.prism/bin/prism-cli` exists and is executable
2. Run `~/.prism/bin/prism-cli --version` for version

**Claude plugin detection**:
1. Check `~/.claude/plugins/cache/prism-marketplace/prism/` exists
2. Read `plugin.json` from the cache directory for version
3. Or check `~/.claude/settings.json` for plugin entries

**prism-electron detection**:
- Windows: check `%LocalAppData%\Prism\` exists (Squirrel install path)
- macOS: check `/Applications/Prism.app` exists
- Linux: check `/usr/bin/prism-electron` or `~/.local/share/applications/prism*`

### Functions in `version.ts`:

```typescript
async function getLatestRelease(): Promise<{ version: string; assets: ReleaseAsset[] }>;
// Calls https://api.github.com/repos/TheDigitalGriot/prism-plugin/releases/latest

function compareVersions(current: string, latest: string): 'up-to-date' | 'update-available' | 'newer-than-latest';
// Simple semver comparison
```

### Wire to IPC:

Register `ipcMain.handle('setup:getSystemInfo', ...)` in main process, calling `getSystemInfo()`.

### Verification:
- [ ] System check screen shows green checkmarks for tools that exist
- [ ] System check screen shows yellow warnings for missing optional tools
- [ ] prism-cli version detected correctly if installed
- [ ] VSCode detection works on current platform
- [ ] Claude CLI detection works if installed
- [ ] GitHub API version check returns latest release tag

---

## Phase 5: prism-cli Installer

**Goal**: Implement the core prism-cli installation logic — binary extraction, PATH configuration, workspaces.json initialization.

### Files to create:
- `cmd/prism-setup/src/installer/install-cli.ts` — prism-cli install/update/uninstall logic
- `cmd/prism-setup/src/installer/path-config.ts` — cross-platform PATH modification

### Files to modify:
- `cmd/prism-setup/forge.config.ts` — add `extraResource` for prism-cli binaries

### Resource bundling:

Add to `forge.config.ts` `packagerConfig`:
```typescript
packagerConfig: {
  asar: true,
  extraResource: [
    './resources/binaries',   // prism-cli binaries per platform
    './resources/extensions',  // VSIX file
    './resources/plugin',      // Claude plugin files
  ],
},
```

Create directory structure:
```
cmd/prism-setup/resources/
├── binaries/
│   ├── prism-cli-darwin-arm64
│   ├── prism-cli-darwin-amd64
│   ├── prism-cli-linux-amd64
│   ├── prism-cli-linux-arm64
│   └── prism-cli-windows-amd64.exe
├── extensions/
│   └── (prism.vsix — added during build)
└── plugin/
    ├── .claude-plugin/
    │   ├── plugin.json
    │   └── marketplace.json
    ├── commands/
    ├── agents/
    └── skills/
```

For development: create a `scripts/prepare-resources.sh` that copies the correct files into `resources/` from the repo and/or GitHub Releases.

### Install logic (`install-cli.ts`):

```typescript
async function installPrismCli(options: {
  installDir: string;
  onProgress: (p: InstallProgress) => void;
}): Promise<void> {
  // 1. Determine platform binary name
  const binaryName = `prism-cli-${getPlatformString()}${process.platform === 'win32' ? '.exe' : ''}`;

  // 2. Copy binary from resources to installDir
  const src = path.join(process.resourcesPath, 'binaries', binaryName);
  const dest = path.join(options.installDir, process.platform === 'win32' ? 'prism-cli.exe' : 'prism-cli');
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);

  // 3. Make executable (Unix)
  if (process.platform !== 'win32') {
    fs.chmodSync(dest, 0o755);
  }

  // 4. Configure PATH
  await configurePath(options.installDir);

  // 5. Initialize workspaces.json
  initWorkspaces();
}
```

### PATH configuration (`path-config.ts`):

**Unix** (following existing `prism-cli-install.sh:116-148` pattern):
```typescript
async function configurePathUnix(installDir: string): Promise<void> {
  const home = os.homedir();
  const rcFiles = [
    path.join(home, '.zshrc'),
    path.join(home, '.bashrc'),
    path.join(home, '.bash_profile'),
  ];

  // Find first existing RC file, or create .bashrc
  let targetRc = rcFiles.find(f => fs.existsSync(f));
  if (!targetRc) {
    targetRc = path.join(home, '.bashrc');
    fs.writeFileSync(targetRc, '', 'utf-8');
  }

  // Idempotent: check if already present
  const content = fs.readFileSync(targetRc, 'utf-8');
  if (!content.includes('.prism/bin')) {
    fs.appendFileSync(targetRc, `\n# Prism CLI\nexport PATH="$PATH:${installDir}"\n`);
  }
}
```

**Windows** (registry-based, more reliable than shell profile):
```typescript
async function configurePathWindows(installDir: string): Promise<void> {
  // Read current user PATH from registry
  const result = execSync(
    `reg query "HKCU\\Environment" /v Path`,
    { encoding: 'utf-8' }
  );
  const currentPath = result.match(/Path\s+REG_(?:EXPAND_)?SZ\s+(.*)/)?.[1] ?? '';

  if (!currentPath.includes(installDir)) {
    const newPath = currentPath ? `${currentPath};${installDir}` : installDir;
    execSync(
      `reg add "HKCU\\Environment" /v Path /t REG_EXPAND_SZ /d "${newPath}" /f`
    );
    // Broadcast WM_SETTINGCHANGE
    // (NSIS installer.nsh handles this at install time; this is for manual/dev mode)
  }
}
```

### Workspaces initialization:
```typescript
function initWorkspaces(): void {
  const prismDir = path.join(os.homedir(), '.prism');
  const wsFile = path.join(prismDir, 'workspaces.json');
  fs.mkdirSync(path.join(prismDir, 'bin'), { recursive: true });
  if (!fs.existsSync(wsFile)) {
    fs.writeFileSync(wsFile, '{"projects":[]}', 'utf-8');
  }
}
```

### Uninstall logic:
```typescript
async function uninstallPrismCli(installDir: string): Promise<void> {
  // 1. Remove binary
  const binary = path.join(installDir, process.platform === 'win32' ? 'prism-cli.exe' : 'prism-cli');
  if (fs.existsSync(binary)) fs.unlinkSync(binary);

  // 2. Remove PATH entries from shell RC files (Unix)
  // 3. Remove PATH entry from registry (Windows)
  // 4. Optionally remove ~/.prism/ entirely (ask user first)
}
```

### Verification:
- [ ] Binary copies to `~/.prism/bin/prism-cli` and is executable
- [ ] `prism-cli --version` works after install
- [ ] PATH entry appears in appropriate shell RC file (Unix) or registry (Windows)
- [ ] Running install twice doesn't duplicate PATH entries
- [ ] `~/.prism/workspaces.json` created with `{"projects":[]}`
- [ ] Uninstall removes binary and PATH entries

---

## Phase 6: VSCode Extension Installer

**Goal**: Implement detection and installation of the Prism VSCode extension via the `code` CLI.

### Files to create:
- `cmd/prism-setup/src/installer/install-vscode.ts` — VSCode extension install/uninstall logic

### Logic:

```typescript
async function installVscodeExtension(options: {
  editor: 'vscode' | 'cursor' | 'windsurf';
  onProgress: (p: InstallProgress) => void;
}): Promise<void> {
  // 1. Get the CLI command for the selected editor
  const cli = getEditorCli(options.editor); // 'code', 'cursor', or 'windsurf'

  // 2. Get VSIX path from bundled resources
  const vsixPath = path.join(process.resourcesPath, 'extensions', 'prism.vsix');

  // 3. Verify VSIX exists
  if (!fs.existsSync(vsixPath)) {
    throw new Error('VSIX file not found in installer resources');
  }

  // 4. Install
  execSync(`"${cli}" --install-extension "${vsixPath}"`, {
    timeout: 60000,
    encoding: 'utf-8',
  });

  // 5. Verify installation
  const output = execSync(`"${cli}" --list-extensions`, { encoding: 'utf-8' });
  if (!output.includes('prism.prism')) {
    throw new Error('Extension installation verification failed');
  }
}
```

### Editor CLI detection:

```typescript
function getEditorCli(editor: string): string {
  const cliName = { vscode: 'code', cursor: 'cursor', windsurf: 'windsurf' }[editor];

  // Try PATH first
  try {
    execSync(`${cliName} --version`, { stdio: 'ignore' });
    return cliName;
  } catch {}

  // macOS fallback: check Applications folder
  if (process.platform === 'darwin') {
    const appPaths: Record<string, string> = {
      vscode: '/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code',
      cursor: '/Applications/Cursor.app/Contents/Resources/app/bin/cursor',
      windsurf: '/Applications/Windsurf.app/Contents/Resources/app/bin/windsurf',
    };
    const fullPath = appPaths[editor];
    if (fullPath && fs.existsSync(fullPath)) return fullPath;
  }

  throw new Error(`${editor} CLI not found. Install ${editor} first.`);
}
```

### Uninstall:
```typescript
async function uninstallVscodeExtension(editor: string): Promise<void> {
  const cli = getEditorCli(editor);
  execSync(`"${cli}" --uninstall-extension prism.prism`, { timeout: 30000 });
}
```

### Verification:
- [ ] Detects VSCode/Cursor/Windsurf CLI correctly
- [ ] Installs extension from bundled VSIX
- [ ] Extension appears in `--list-extensions` output
- [ ] Graceful error when no editor is found
- [ ] Uninstall removes extension

---

## Phase 7: Claude Plugin Installer

**Goal**: Implement Claude Code plugin installation via the `claude` CLI, with direct file copy fallback.

### Files to create:
- `cmd/prism-setup/src/installer/install-plugin.ts` — Claude plugin install/uninstall logic

### Logic:

```typescript
async function installClaudePlugin(options: {
  onProgress: (p: InstallProgress) => void;
}): Promise<void> {
  const claudePath = await detectClaude();

  if (claudePath.available) {
    // Primary: use claude CLI for proper installation
    try {
      options.onProgress({ status: 'installing', message: 'Adding marketplace source...', percent: 30 });
      execSync(`"${claudePath.path}" plugin marketplace add TheDigitalGriot/prism-plugin`, {
        timeout: 30000,
        encoding: 'utf-8',
      });

      options.onProgress({ status: 'installing', message: 'Installing plugin...', percent: 60 });
      execSync(`"${claudePath.path}" plugin install prism@prism-marketplace`, {
        timeout: 60000,
        encoding: 'utf-8',
      });

      options.onProgress({ status: 'verifying', message: 'Verifying installation...', percent: 90 });
      // Verification: check if plugin cache directory exists
      const cacheDir = path.join(os.homedir(), '.claude', 'plugins', 'cache', 'prism-marketplace', 'prism');
      if (fs.existsSync(cacheDir)) {
        options.onProgress({ status: 'complete', message: 'Plugin installed successfully', percent: 100 });
        return;
      }
    } catch (err) {
      // Fall through to file copy
      console.warn('Claude CLI install failed, falling back to file copy:', err);
    }
  }

  // Fallback: direct file copy
  options.onProgress({ status: 'installing', message: 'Copying plugin files (Claude CLI not available)...', percent: 50 });
  const pluginSrc = path.join(process.resourcesPath, 'plugin');
  const claudeDir = path.join(os.homedir(), '.claude');

  // Copy commands
  const commandsDest = path.join(claudeDir, 'commands');
  fs.mkdirSync(commandsDest, { recursive: true });
  copyDir(path.join(pluginSrc, 'commands'), commandsDest);

  // Copy agents
  const agentsDest = path.join(claudeDir, 'agents');
  fs.mkdirSync(agentsDest, { recursive: true });
  copyDir(path.join(pluginSrc, 'agents'), agentsDest);

  options.onProgress({
    status: 'complete',
    message: 'Plugin files copied. Note: For full /prism: commands, install Claude Code CLI and re-run setup.',
    percent: 100,
  });
}
```

### Uninstall:
```typescript
async function uninstallClaudePlugin(): Promise<void> {
  const claude = await detectClaude();
  if (claude.available) {
    try {
      execSync(`"${claude.path}" plugin uninstall prism@prism-marketplace`, { timeout: 30000 });
      return;
    } catch {}
  }
  // Fallback: remove copied files
  const claudeDir = path.join(os.homedir(), '.claude');
  // Remove prism-specific command files (prefixed with prism or matching known names)
  // Be careful not to remove other plugins' files
}
```

### Verification:
- [ ] Plugin installs via `claude plugin install` when Claude CLI is available
- [ ] Falls back to file copy when Claude CLI is not available
- [ ] Fallback message warns about limited functionality
- [ ] Plugin cache directory created after CLI install
- [ ] Uninstall removes plugin via CLI or file cleanup

---

## Phase 8: Electron App Downloader

**Goal**: Implement download of the Prism Electron desktop app from GitHub Releases with progress tracking.

### Files to create:
- `cmd/prism-setup/src/installer/install-electron.ts` — download + install Electron app
- `cmd/prism-setup/src/installer/download.ts` — generic download utility with progress callbacks

### Download utility (`download.ts`):

```typescript
async function downloadFile(options: {
  url: string;
  destPath: string;
  onProgress: (downloaded: number, total: number) => void;
  signal?: AbortSignal;
}): Promise<string> {
  // Use Node.js https module (not fetch, for progress tracking)
  // Follow redirects (GitHub Releases redirect to CDN)
  // Report progress via callback
  // Support cancellation via AbortSignal
}
```

### Electron app install logic:

```typescript
async function installElectronApp(options: {
  onProgress: (p: InstallProgress) => void;
}): Promise<void> {
  // 1. Determine platform-specific asset name from GitHub Release
  const release = await getLatestRelease();
  const assetName = getElectronAssetName(); // e.g., 'Prism-2.4.1 Setup.exe' or 'Prism-darwin-x64-2.4.1.zip'

  const asset = release.assets.find(a => a.name === assetName);
  if (!asset) throw new Error(`No Electron app release found for ${process.platform}`);

  // 2. Download to temp directory
  const tempDir = path.join(app.getPath('temp'), 'prism-setup');
  fs.mkdirSync(tempDir, { recursive: true });
  const destPath = path.join(tempDir, assetName);

  await downloadFile({
    url: asset.browser_download_url,
    destPath,
    onProgress: (downloaded, total) => {
      const percent = total > 0 ? Math.round((downloaded / total) * 100) : -1;
      options.onProgress({
        componentId: 'prism-electron',
        status: 'downloading',
        percent,
        message: `Downloading... ${(downloaded / 1024 / 1024).toFixed(1)} MB`,
      });
    },
  });

  // 3. Execute platform-specific installer
  options.onProgress({ status: 'installing', message: 'Running installer...', percent: -1 });

  if (process.platform === 'win32') {
    // Run the .exe installer silently
    execSync(`"${destPath}" /S`, { timeout: 120000 });
  } else if (process.platform === 'darwin') {
    // Unzip and move .app to /Applications
    execSync(`unzip -o "${destPath}" -d /tmp/prism-app`, { timeout: 60000 });
    execSync(`mv /tmp/prism-app/Prism.app /Applications/Prism.app`);
  } else {
    // Linux: deb or AppImage
    if (destPath.endsWith('.deb')) {
      execSync(`sudo dpkg -i "${destPath}"`, { timeout: 60000 });
    } else {
      // AppImage: copy to ~/.local/bin/ and make executable
      const appImageDest = path.join(os.homedir(), '.local', 'bin', 'Prism.AppImage');
      fs.copyFileSync(destPath, appImageDest);
      fs.chmodSync(appImageDest, 0o755);
    }
  }

  // 4. Cleanup temp
  fs.rmSync(tempDir, { recursive: true, force: true });
}
```

### Verification:
- [ ] Downloads correct platform asset from GitHub Releases
- [ ] Progress bar updates during download
- [ ] Installer runs after download completes
- [ ] Temp files cleaned up after install
- [ ] Error handling for network failures, missing release assets
- [ ] Cancellation stops download

---

## Phase 9: Update & Uninstall Mode

**Goal**: Implement the update and uninstall workflows, reusing the installer logic from Phases 5-8.

### Files to create:
- `cmd/prism-setup/src/installer/orchestrator.ts` — top-level install/update/uninstall coordinator

### Orchestrator:

```typescript
class InstallerOrchestrator {
  private win: BrowserWindow;
  private abortController: AbortController;

  constructor(win: BrowserWindow) { ... }

  private sendProgress(progress: InstallProgress): void {
    if (!this.win.isDestroyed()) {
      this.win.webContents.send('setup:progress', progress);
    }
  }

  async install(options: InstallOptions): Promise<void> {
    for (const componentId of options.components) {
      try {
        await this.installComponent(componentId, options);
      } catch (err) {
        this.sendProgress({ componentId, status: 'error', error: err.message });
      }
    }
  }

  async update(components: ComponentId[]): Promise<void> {
    // Same as install but only for components with updateAvailable=true
    // Uses existing installDir from detection
  }

  async uninstall(components: ComponentId[]): Promise<void> {
    for (const componentId of components) {
      await this.uninstallComponent(componentId);
    }
  }

  cancel(): void {
    this.abortController.abort();
  }
}
```

### Update flow:
1. `getSystemInfo()` returns `ComponentStatus[]` with `updateAvailable` flag
2. UI shows which components need updating
3. User selects components to update
4. Orchestrator re-runs install logic (overwrite binary, re-install extension, re-install plugin)

### Uninstall flow:
1. `getSystemInfo()` returns only installed components
2. User selects components to uninstall
3. Orchestrator calls component-specific uninstall functions
4. Post-uninstall: optionally remove `~/.prism/` directory

### Wire to main process IPC:

```typescript
// In main.ts or a separate ipc-handlers.ts
ipcMain.handle('setup:startInstall', async (event, options: InstallOptions) => {
  const win = BrowserWindow.fromWebContents(event.sender)!;
  const orchestrator = new InstallerOrchestrator(win);
  await orchestrator.install(options);
});

ipcMain.handle('setup:startUninstall', async (event, components: ComponentId[]) => {
  const win = BrowserWindow.fromWebContents(event.sender)!;
  const orchestrator = new InstallerOrchestrator(win);
  await orchestrator.uninstall(components);
});

ipcMain.on('setup:cancelInstall', (event) => {
  // Cancel active orchestrator
});
```

### Verification:
- [ ] Update mode shows only components with available updates
- [ ] Update correctly overwrites existing installations
- [ ] Uninstall mode shows only installed components
- [ ] Each component uninstalls cleanly
- [ ] Cancel stops in-progress operations
- [ ] Error in one component doesn't block others

---

## Phase 10: Packaging & CI/CD

**Goal**: Configure electron-builder packaging for all platforms and create the GitHub Actions workflow.

### Files to create:
- `cmd/prism-setup/build/installer.nsh` — NSIS customization (Windows PATH via EnVar)
- `cmd/prism-setup/build/background.png` — DMG background image (540x380)
- `cmd/prism-setup/build/background@2x.png` — retina DMG background (1080x760)
- `cmd/prism-setup/build/entitlements.mac.plist` — macOS entitlements
- `cmd/prism-setup/build/x86-unicode/EnVar.dll` — NSIS EnVar plugin for PATH modification
- `cmd/prism-setup/scripts/prepare-resources.sh` — downloads/copies binaries + VSIX + plugin into resources/
- `.github/workflows/prism-setup-release.yml` — CI/CD for building the setup wizard

### NSIS configuration in `forge.config.ts`:

Replace MakerSquirrel with NSIS:
```typescript
import { MakerNSIS } from 'electron-forge-maker-nsis';

makers: [
  new MakerNSIS({
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    perMachine: false,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    include: 'build/installer.nsh',
  }),
  new MakerDMG({
    background: 'build/background.png',
    icon: 'build/icon.icns',
    contents: [
      { x: 130, y: 220, type: 'file' },
      { x: 410, y: 220, type: 'link', path: '/Applications' },
    ],
  }),
  new MakerZIP({}, ['linux']),  // AppImage alternative
  new MakerDeb({}),
],
```

### `build/installer.nsh` (Windows PATH modification):

```nsis
!macro customInstall
  ; Add install directory to user PATH via EnVar plugin
  EnVar::SetHKCU
  EnVar::AddValue "PATH" "$INSTDIR"
  Pop $0

  ; Broadcast environment change
  SendMessage ${HWND_BROADCAST} ${WM_SETTINGCHANGE} 0 "STR:Environment" /TIMEOUT=500
!macroend

!macro customUnInstall
  ; Remove from user PATH
  EnVar::SetHKCU
  EnVar::DeleteValue "PATH" "$INSTDIR"
  Pop $0

  SendMessage ${HWND_BROADCAST} ${WM_SETTINGCHANGE} 0 "STR:Environment" /TIMEOUT=500
!macroend
```

### `scripts/prepare-resources.sh`:

```bash
#!/bin/bash
set -euo pipefail

# Downloads/copies all resources needed for the installer

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SETUP_DIR="$(dirname "$SCRIPT_DIR")"
RESOURCES_DIR="$SETUP_DIR/resources"
REPO_ROOT="$(git rev-parse --show-toplevel)"

# 1. Download or build prism-cli binaries
echo "=== Preparing prism-cli binaries ==="
mkdir -p "$RESOURCES_DIR/binaries"
cd "$REPO_ROOT/cmd/prism-cli"
make build-all
cp bin/prism-cli-* "$RESOURCES_DIR/binaries/"

# 2. Build and copy VSIX
echo "=== Building VSCode extension ==="
mkdir -p "$RESOURCES_DIR/extensions"
cd "$REPO_ROOT/cmd/prism-vscode"
npm run package
npx vsce package --out "$RESOURCES_DIR/extensions/prism.vsix"

# 3. Copy Claude plugin files
echo "=== Copying Claude plugin files ==="
mkdir -p "$RESOURCES_DIR/plugin"
cp -r "$REPO_ROOT/.claude-plugin" "$RESOURCES_DIR/plugin/"
cp -r "$REPO_ROOT/commands" "$RESOURCES_DIR/plugin/"
cp -r "$REPO_ROOT/agents" "$RESOURCES_DIR/plugin/"
cp -r "$REPO_ROOT/skills" "$RESOURCES_DIR/plugin/"

echo "=== Resources prepared ==="
ls -la "$RESOURCES_DIR/binaries/"
ls -la "$RESOURCES_DIR/extensions/"
ls -la "$RESOURCES_DIR/plugin/"
```

### GitHub Actions workflow (`.github/workflows/prism-setup-release.yml`):

```yaml
name: Build Prism Setup Wizard

on:
  push:
    tags: ['v*']
  workflow_dispatch:
    inputs:
      version:
        required: true

jobs:
  prepare:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with: { go-version: '1.22' }
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - name: Build prism-cli binaries
        run: cd cmd/prism-cli && make build-all
      - name: Build VSIX
        run: |
          cd cmd/prism-vscode
          npm ci
          npm run package
          npx vsce package --out ../prism-setup/resources/extensions/prism.vsix
      - name: Prepare resources
        run: bash cmd/prism-setup/scripts/prepare-resources.sh
      - uses: actions/upload-artifact@v4
        with:
          name: setup-resources
          path: cmd/prism-setup/resources/

  build:
    needs: prepare
    strategy:
      matrix:
        include:
          - os: windows-latest
            platform: win32
          - os: macos-latest
            platform: darwin
          - os: ubuntu-latest
            platform: linux
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - uses: actions/download-artifact@v4
        with:
          name: setup-resources
          path: cmd/prism-setup/resources/
      - name: Install dependencies
        run: cd cmd/prism-setup && npm ci
      - name: Build installer
        run: cd cmd/prism-setup && npm run make
      - uses: actions/upload-artifact@v4
        with:
          name: prism-setup-${{ matrix.platform }}
          path: cmd/prism-setup/out/make/**/*

  release:
    needs: build
    if: startsWith(github.ref, 'refs/tags/v')
    runs-on: ubuntu-latest
    steps:
      - uses: actions/download-artifact@v4
        with: { merge-multiple: true, path: installers/ }
      - uses: softprops/action-gh-release@v1
        with:
          files: installers/**/*
          generate_release_notes: true
```

### Verification:
- [ ] `npm run make` produces NSIS `.exe` on Windows
- [ ] `npm run make` produces `.dmg` on macOS
- [ ] `npm run make` produces `.deb` and `.zip` on Linux
- [ ] NSIS installer adds to Windows PATH (check `reg query` after install)
- [ ] NSIS uninstaller removes from Windows PATH
- [ ] DMG shows custom background with drag-to-Applications layout
- [ ] `scripts/prepare-resources.sh` populates all resources correctly
- [ ] GitHub Actions workflow builds for all 3 platforms

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| ~150MB installer binary size | Users on slow connections may not download | Compress ASAR, minimize bundled binaries. Long-term: consider Wails for smaller binary. |
| `electron-forge-maker-nsis` compatibility | May not support all NSIS features | Fall back to `electron-forge-maker-squirrel` for Windows + handle PATH in first-run |
| macOS `code` CLI not in PATH | Can't install VSCode extension | Fallback to direct app path detection (Phase 6 handles this) |
| Claude CLI `plugin install` may require interactive session | Programmatic execution might fail | Fallback to direct file copy (Phase 7 handles this) |
| No code signing | Windows SmartScreen, macOS Gatekeeper warnings | Warn users in documentation. Can add signing later. |
| Version 9th file (setup package.json) | Version drift risk | Add to `prism-release` skill's Tier 1 version files |
| Electron app not yet in GitHub Releases | Phase 8 download will fail | Add prism-electron CI/CD as prerequisite, or skip component |

---

## Dependency Chain

```
Phase 1 (Config) → Phase 2 (IPC) → Phase 3 (UI)
                                       ↓
Phase 4 (Detection) ─────────────── runs after Phase 2
                                       ↓
Phases 5-8 (Component Installers) ── run after Phases 3+4
                                       ↓
Phase 9 (Orchestrator) ─────────── runs after Phases 5-8
                                       ↓
Phase 10 (Packaging) ───────────── runs after Phase 9
```

Phases 5, 6, 7, 8 can be implemented in parallel once Phases 3 and 4 are done.
