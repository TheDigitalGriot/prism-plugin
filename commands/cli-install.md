---
description: Install or update prism-cli binary with automatic PATH and workspace configuration
model: sonnet
---

# Prism CLI Install

Install the Prism CLI binary so it can be launched from any terminal. Delegates to platform-specific installer scripts that download pre-built release binaries, configure PATH for all shells, and initialize the global `~/.prism/` workspace registry.

**Repository**: `https://github.com/TheDigitalGriot/prism`

## Process

### Step 1: Check for Existing Installation

```bash
which prism-cli 2>/dev/null || which prism-cli.exe 2>/dev/null && echo "FOUND_IN=path" || \
{ test -x "$HOME/.prism/bin/prism-cli" && echo "FOUND_IN=prism-bin"; } || \
{ test -x "$USERPROFILE/.prism/bin/prism-cli.exe" && echo "FOUND_IN=prism-bin"; } || \
echo "NOT_FOUND"
```

If found, check for updates:

```bash
LOCAL_VERSION=$(prism-cli --version 2>/dev/null | grep -oP '\d+\.\d+\.\d+' || echo "unknown")
LATEST_VERSION=$(gh release view --repo TheDigitalGriot/prism --json tagName -q '.tagName' 2>/dev/null | sed 's/^v//')
echo "LOCAL=$LOCAL_VERSION LATEST=$LATEST_VERSION"
```

- **Versions match** — report up to date, skip to Step 3.
- **Local is older** — ask user with AskUserQuestion: "Update to latest (Recommended)" or "Keep current version". If update, continue to Step 2.
- **`gh` unavailable** — skip update check silently.
- **NOT_FOUND** — proceed to Step 2.

### Step 2: Install via Platform Script

Detect platform and run the appropriate installer script from `${CLAUDE_PLUGIN_ROOT}/scripts/`.

```bash
case "$(uname -s)" in
  MINGW*|MSYS*|CYGWIN*) PLATFORM="windows" ;;
  Darwin*)               PLATFORM="macos" ;;
  *)                     PLATFORM="linux" ;;
esac
echo "PLATFORM=$PLATFORM"
```

**On Windows (Git Bash / MSYS):**

```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/prism-cli-install.sh" download
```

This script will:
- Download the correct binary from GitHub releases to `~/.prism/bin/`
- Configure PATH in both Git Bash profile AND PowerShell `$PROFILE`
- Initialize `~/.prism/workspaces.json`

**On macOS / Linux:**

```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/prism-cli-install.sh" download
```

This script will:
- Download the correct binary from GitHub releases to `~/.prism/bin/`
- Configure PATH in `~/.zshrc`, `~/.bashrc`, or `~/.bash_profile`
- Initialize `~/.prism/workspaces.json`

**If running from a native PowerShell terminal** (not Git Bash), use the PowerShell script instead:

```powershell
& "${CLAUDE_PLUGIN_ROOT}\scripts\prism-cli-install.ps1" -Method download
```

**If the script fails**, do NOT try alternate URLs. Report the error and suggest the user check https://github.com/TheDigitalGriot/prism/releases.

### Step 3: Verify Installation

```bash
prism-cli --version
```

If this fails, try the full path:

```bash
"$HOME/.prism/bin/prism-cli" --version 2>/dev/null || "$USERPROFILE/.prism/bin/prism-cli.exe" --version 2>/dev/null
```

If verification fails, tell the user to open a **new terminal** (shell profiles were just updated).

### Step 4: Report Results

Print a summary:

```
Prism CLI Install Complete

  Binary:      ~/.prism/bin/prism-cli (vX.X.X)
  PATH:        Configured for all platform shells
                 macOS/Linux: ~/.zshrc or ~/.bashrc
                 Windows: Git Bash profile + PowerShell $PROFILE
  Registry:    ~/.prism/workspaces.json initialized

  Launch:
    prism-cli              # auto-detect stories in current project
    prism-cli --demo       # preview with demo stories
    prism-cli --onboarding # run setup wizard

  Note: Open a new terminal for PATH changes to take effect.
```

## Manual Source Build (Developer Fallback)

If Go 1.22+ is installed and you need to build from source instead of downloading:

```bash
cd "${CLAUDE_PLUGIN_ROOT}/apps/prism-cli" && make build
mkdir -p "$HOME/.prism/bin"
cp bin/prism-cli* "$HOME/.prism/bin/"
```

This is NOT the default method — only use when explicitly requested or when no pre-built release exists.

## Error Handling

- If download fails: check https://github.com/TheDigitalGriot/prism/releases for available binaries
- If PATH update fails: the installer prints manual instructions
- If verification fails: suggest opening a new terminal
- NEVER download from any URL other than `https://github.com/TheDigitalGriot/prism/releases`
- NEVER attempt `make build` unless the user explicitly requests a source build
