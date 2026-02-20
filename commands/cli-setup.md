---
description: Check for prism-cli installation, update if outdated, install if needed, and set up shell alias
model: haiku
---

# Prism CLI Setup

Set up the Prism CLI binary so it can be launched from any project terminal.

**IMPORTANT**: The prism-cli source and releases live at `https://github.com/TheDigitalGriot/prism-plugin` — NOT on any Anthropic repository.

## Process

Follow these steps in order. Use the Bash tool for all checks and commands.

### Step 1: Check for Existing Installation

```bash
# Check PATH, then standard install location
which prism-cli 2>/dev/null || which prism-cli.exe 2>/dev/null && echo "FOUND_IN=path" || \
{ test -x "$HOME/.prism/bin/prism-cli" && echo "FOUND_IN=prism-bin"; } || \
{ test -x "$USERPROFILE/.prism/bin/prism-cli.exe" && echo "FOUND_IN=prism-bin"; } || \
echo "NOT_FOUND"
```

If found, report the location and continue to Step 1b to check for updates. If NOT found, skip to Step 2.

### Step 1b: Check for Updates

If the binary was found, compare local version against the latest GitHub release:

```bash
# Get local version
LOCAL_VERSION=$(prism-cli --version 2>/dev/null | grep -oP '\d+\.\d+\.\d+' || echo "unknown")
echo "LOCAL_VERSION=$LOCAL_VERSION"

# Get latest release version from GitHub
LATEST_VERSION=$(gh release view --repo TheDigitalGriot/prism-plugin --json tagName -q '.tagName' 2>/dev/null | sed 's/^v//')
echo "LATEST_VERSION=$LATEST_VERSION"
```

**If versions match** — report that it's up to date and skip to Step 3.

**If local is older (or "unknown")** — ask the user if they want to update using AskUserQuestion:

- **Update to latest (Recommended)** — re-download the binary from the latest release
- **Keep current version** — skip the update

If the user chooses to update, proceed to Step 2 (which will overwrite the existing binary). If they decline, skip to Step 3.

**If `gh` is not available** — skip the update check silently and continue to Step 3. Do NOT fail the setup just because the update check can't run.

### Step 2: Install Binary

Run the install script from the plugin directory. The script downloads a pre-built binary from GitHub releases at `https://github.com/TheDigitalGriot/prism-plugin/releases` and places it in `~/.prism/bin/`.

First, locate the plugin directory (where this command file lives):

```bash
# The plugin is typically at one of these paths:
for dir in \
  "$HOME/.claude/plugins/prism-plugin" \
  "$HOME/.claude/plugins/prism" \
  "$USERPROFILE/.claude/plugins/prism-plugin" \
  "$USERPROFILE/.claude/plugins/prism" \
  "$LOCALAPPDATA/claude/plugins/prism-plugin" \
  "$LOCALAPPDATA/claude/plugins/prism" \
  ; do
  test -f "$dir/scripts/prism-cli-install.sh" && echo "PLUGIN_DIR=$dir" && break
done
```

Then run the install script:

```bash
bash "$PLUGIN_DIR/scripts/prism-cli-install.sh"
```

If the install script fails, do NOT try to download from any other URL. Report the error to the user.

### Step 3: Set Up PATH / Alias

After the binary is confirmed to exist, set up the shell so `prism-cli` is accessible.

**If already in PATH** — skip this step, report that it's ready.

**If found in `~/.prism/bin/` or local build dir** — add to PATH:

**For the current session (always do this):**

```bash
export PATH="$PATH:$HOME/.prism/bin"
```

Windows Git Bash:
```bash
export PATH="$PATH:$USERPROFILE/.prism/bin"
```

**Then ask the user** if they want to make it permanent using AskUserQuestion with these options:

**Option A — Add to shell profile (Recommended):**

Detect the user's shell rc file and append the PATH entry:

```bash
# Detect rc file
if [ -f "$HOME/.zshrc" ]; then
  RC_FILE="$HOME/.zshrc"
elif [ -f "$HOME/.bashrc" ]; then
  RC_FILE="$HOME/.bashrc"
elif [ -f "$HOME/.bash_profile" ]; then
  RC_FILE="$HOME/.bash_profile"
fi

# Check if already added
grep -q '.prism/bin' "$RC_FILE" 2>/dev/null || \
  echo '' >> "$RC_FILE" && \
  echo '# Prism CLI' >> "$RC_FILE" && \
  echo 'export PATH="$PATH:$HOME/.prism/bin"' >> "$RC_FILE"
```

For PowerShell users who want it in their `$PROFILE`:
```powershell
# Check if profile exists, create if not
if (!(Test-Path $PROFILE)) { New-Item -Path $PROFILE -Force }

# Append PATH addition
Add-Content $PROFILE "`n# Prism CLI`n`$env:PATH += `";$env:USERPROFILE\.prism\bin`""
```

**Option B — Session only:**

Just use the export already done. User will need to re-export in new terminals.

### Step 4: Verify Installation

```bash
prism-cli --version
```

If this succeeds, report the version. If it fails, troubleshoot the PATH.

### Step 5: Initialize .prism/ Directory

Check if the current project has a `.prism/` directory:

```bash
test -d .prism && echo "PRISM_DIR=exists" || echo "PRISM_DIR=missing"
```

If missing, find and run `init_prism.py`:

```bash
# Find init script in plugin directory
python "$(dirname "$(which prism-cli 2>/dev/null || echo "$HOME/.prism/bin/prism-cli")")"/../../skills/prism/scripts/init_prism.py .
```

If the script can't be located, create the directory structure manually:

```bash
mkdir -p .prism/stories .prism/shared/{research,plans,validation,handoffs,prs,spectrum,ref,docs} .prism/local/{ref,docs}
```

And add `.prism/local/` to `.gitignore` if not already present.

### Step 6: Report Results

Print a summary:

```
Prism CLI Setup Complete

  Binary:    ~/.prism/bin/prism-cli (v X.X.X)
  PATH:      Added to ~/.zshrc (permanent)
  Project:   .prism/ initialized

  Launch commands:
    prism-cli              # auto-detect stories in current project
    prism-cli --demo       # preview with demo stories
    prism-cli --onboarding # run setup wizard

  Next: Use /prism-research to start researching your codebase
```

## Error Handling

- If install script is not found: tell the user to check their plugin installation
- If download fails: tell the user to check https://github.com/TheDigitalGriot/prism-plugin/releases for available binaries
- If PATH update fails: print the export command for the user to run manually
- If .prism/ init fails: print the mkdir commands for manual creation
- NEVER attempt to download from any URL other than `https://github.com/TheDigitalGriot/prism-plugin/releases`
