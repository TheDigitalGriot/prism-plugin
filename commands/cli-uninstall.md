---
description: Remove prism-cli binary, PATH entries, and global ~/.prism/ directory
model: sonnet
---

# Prism CLI Uninstall

Completely remove prism-cli from the system. This reverses everything done by `cli-install`.

**IMPORTANT**: Always confirm with the user before proceeding. This is a destructive operation.

## Process

### Step 1: Detect Platform

```bash
case "$(uname -s)" in
  MINGW*|MSYS*|CYGWIN*) PLATFORM="windows" ;;
  Darwin*)               PLATFORM="macos" ;;
  *)                     PLATFORM="linux" ;;
esac
echo "PLATFORM=$PLATFORM"
```

### Step 2: Confirm with User

Use AskUserQuestion to confirm what should be removed:

- **Full uninstall (Recommended)** — Remove binary, PATH entries from shell profiles, and the entire `~/.prism/` directory (including `workspaces.json`)
- **Binary only** — Remove the binary and PATH entries, keep `~/.prism/workspaces.json` intact
- **Cancel** — Abort the uninstall

### Step 3: Remove Binary

```bash
PRISM_HOME="$HOME/.prism"

# Remove binary
rm -f "$PRISM_HOME/bin/prism-cli" "$PRISM_HOME/bin/prism-cli.exe"
echo "Removed binary from $PRISM_HOME/bin/"

# Windows: also check USERPROFILE path
if [ "$PLATFORM" = "windows" ] && [ -n "$USERPROFILE" ] && [ "$HOME" != "$USERPROFILE" ]; then
  rm -f "$USERPROFILE/.prism/bin/prism-cli" "$USERPROFILE/.prism/bin/prism-cli.exe"
  echo "Removed binary from $USERPROFILE/.prism/bin/"
fi
```

### Step 4: Clean Shell Profiles

Remove the `# Prism CLI` block and PATH export from all shell profiles.

**On macOS / Linux:**

```bash
for RC_FILE in "$HOME/.zshrc" "$HOME/.bashrc" "$HOME/.bash_profile"; do
  if [ -f "$RC_FILE" ] && grep -q '.prism/bin' "$RC_FILE" 2>/dev/null; then
    # Remove only the exact Prism CLI comment and PATH line added by installer
    sed -i.bak '/# Prism CLI$/d' "$RC_FILE"
    sed -i.bak '/.prism\/bin/d' "$RC_FILE"
    # Clean up any resulting blank lines (two+ consecutive)
    sed -i.bak '/^$/N;/^\n$/d' "$RC_FILE"
    rm -f "${RC_FILE}.bak"
    echo "Cleaned $RC_FILE"
  fi
done
```

**On Windows — clean both Git Bash and PowerShell:**

```bash
# 1. Git Bash profiles
for RC_FILE in "$HOME/.bashrc" "$HOME/.bash_profile"; do
  if [ -f "$RC_FILE" ] && grep -q '.prism/bin' "$RC_FILE" 2>/dev/null; then
    sed -i.bak '/# Prism CLI/d' "$RC_FILE"
    sed -i.bak '/.prism\/bin/d' "$RC_FILE"
    sed -i.bak '/^$/N;/^\n$/d' "$RC_FILE"
    rm -f "${RC_FILE}.bak"
    echo "Cleaned $RC_FILE"
  fi
done

# 2. PowerShell profile — only remove the exact lines the installer adds
PWSH_CMD=$(command -v pwsh.exe 2>/dev/null || command -v powershell.exe 2>/dev/null)
if [ -n "$PWSH_CMD" ]; then
  PWSH_PROFILE=$("$PWSH_CMD" -NoProfile -Command 'echo $PROFILE' 2>/dev/null | tr -d '\r')
  PWSH_PROFILE_UNIX=$(cygpath -u "$PWSH_PROFILE" 2>/dev/null || echo "$PWSH_PROFILE")

  if [ -n "$PWSH_PROFILE_UNIX" ] && [ -f "$PWSH_PROFILE_UNIX" ] && grep -q '\.prism\\bin' "$PWSH_PROFILE_UNIX" 2>/dev/null; then
    sed -i.bak '/# Prism CLI$/d' "$PWSH_PROFILE_UNIX"
    sed -i.bak '/\\\.prism\\\\bin/d' "$PWSH_PROFILE_UNIX"
    sed -i.bak '/^$/N;/^\n$/d' "$PWSH_PROFILE_UNIX"
    rm -f "${PWSH_PROFILE_UNIX}.bak"
    echo "Cleaned PowerShell profile: $PWSH_PROFILE"
  fi
fi
```

### Step 5: Remove Global ~/.prism/ Directory

**Only if the user chose "Full uninstall".**

```bash
PRISM_HOME="$HOME/.prism"

if [ -d "$PRISM_HOME" ]; then
  rm -rf "$PRISM_HOME"
  echo "Removed $PRISM_HOME"
fi

# Windows: also check USERPROFILE path
if [ "$PLATFORM" = "windows" ] && [ -n "$USERPROFILE" ] && [ "$HOME" != "$USERPROFILE" ]; then
  PRISM_HOME_WIN="$USERPROFILE/.prism"
  if [ -d "$PRISM_HOME_WIN" ]; then
    rm -rf "$PRISM_HOME_WIN"
    echo "Removed $PRISM_HOME_WIN"
  fi
fi
```

**If the user chose "Binary only"**, just remove the empty bin directory:

```bash
rmdir "$PRISM_HOME/bin" 2>/dev/null
# Leave ~/.prism/ and workspaces.json intact
```

### Step 6: Report Results

Print a summary:

```
Prism CLI Uninstall Complete

  Binary:      Removed from ~/.prism/bin/
  Shell config: Cleaned (bash/zsh/PowerShell)
  Global home:  Removed ~/.prism/         # or "Kept ~/.prism/workspaces.json"

  Note: Per-project .prism/ directories were NOT touched.
        Remove them manually if no longer needed.

  To reinstall: /prism:cli-install
```

## Error Handling

- If shell profile cleanup fails: print the lines the user should manually remove
- If `~/.prism/` removal fails: report which files couldn't be deleted (may be locked)
- NEVER touch per-project `.prism/` directories — only the global `~/.prism/` in the home directory
- NEVER run `rm -rf` on any path other than `~/.prism/` or `$USERPROFILE/.prism/`
