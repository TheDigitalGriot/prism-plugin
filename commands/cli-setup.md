---
description: Check for prism-cli installation, install if needed, and set up shell alias
model: haiku
---

# Prism CLI Setup

Set up the Prism CLI binary so it can be launched from any project terminal.

## Process

Follow these steps in order. Use the Bash tool for all checks and commands.

### Step 1: Detect Platform

Determine the user's platform and shell:

```bash
# Check for PowerShell (Windows)
echo "$OS" | grep -qi windows && echo "PLATFORM=windows" || echo "PLATFORM=unix"
echo "SHELL=$SHELL"
```

- If `PLATFORM=windows`: use PowerShell commands
- If `PLATFORM=unix`: use bash/zsh commands

### Step 2: Check for Existing Installation

Check these locations in order. Stop at the first match:

**Unix/Git Bash:**
```bash
# 1. Already in PATH?
which prism-cli 2>/dev/null && echo "FOUND_IN=path"

# 2. Standard install location?
test -x "$HOME/.prism/bin/prism-cli" && echo "FOUND_IN=prism-bin"

# 3. Local plugin build? (find plugin dir from this command's context)
# Check common locations
for dir in \
  "$HOME/.claude/plugins/prism/cmd/prism-cli/bin" \
  "$HOME/.claude/plugins/prism-plugin/cmd/prism-cli/bin" \
  ; do
  test -x "$dir/prism-cli" && echo "FOUND_IN=$dir" && break
done
```

**PowerShell/Windows:**
```bash
# 1. Already in PATH?
which prism-cli.exe 2>/dev/null && echo "FOUND_IN=path"

# 2. Standard install location?
test -x "$USERPROFILE/.prism/bin/prism-cli.exe" && echo "FOUND_IN=prism-bin"

# 3. Local plugin build?
for dir in \
  "$USERPROFILE/.claude/plugins/prism/cmd/prism-cli/bin" \
  "$USERPROFILE/.claude/plugins/prism-plugin/cmd/prism-cli/bin" \
  "$LOCALAPPDATA/claude/plugins/prism/cmd/prism-cli/bin" \
  ; do
  test -x "$dir/prism-cli.exe" && echo "FOUND_IN=$dir" && break
done
```

If found, report the location and skip to Step 4.

### Step 3: Install Binary

If not found, ask the user which installation method they prefer using AskUserQuestion:

**Option 1 — Download pre-built binary (Recommended):**

Find the plugin's `scripts/` directory and run the appropriate install script:

```bash
# Unix
./scripts/prism-cli-install.sh

# Windows (from Git Bash in IDE)
./scripts/prism-cli-install.sh
```

Or if PowerShell is preferred:
```powershell
.\scripts\prism-cli-install.ps1
```

**Option 2 — Build from source (requires Go 1.22+):**

```bash
cd cmd/prism-cli && go build -o "$HOME/.prism/bin/prism-cli" .
```

Windows:
```bash
cd cmd/prism-cli && go build -o "$USERPROFILE/.prism/bin/prism-cli.exe" .
```

The install scripts automatically place the binary in `~/.prism/bin/`.

### Step 4: Set Up PATH / Alias

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

### Step 5: Verify Installation

```bash
prism-cli --version
```

If this succeeds, report the version. If it fails, troubleshoot the PATH.

### Step 6: Initialize .prism/ Directory

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

### Step 7: Report Results

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

- If install script is not found: offer to build from source or download manually
- If Go is not installed and download fails: provide manual download URL
- If PATH update fails: print the export command for the user to run manually
- If .prism/ init fails: print the mkdir commands for manual creation
