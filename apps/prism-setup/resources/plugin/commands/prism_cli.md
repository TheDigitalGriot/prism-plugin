# Prism CLI Command

Launch the Prism CLI for visual autonomous execution.

## Behavior

1. **Check if prism-cli is installed** by looking for:
   - `prism-cli` or `prism-cli.exe` in PATH
   - `~/.prism/bin/prism-cli`
   - `./bin/prism-cli` (local plugin build)

2. **If not found**, offer installation options:
   - **Download pre-built** (recommended): Run the install script
   - **Build from source**: Requires Go installed
   - **Use bash version**: Fall back to `scripts/spectrum.sh`

3. **If found**, launch the TUI with the stories.json path

## Installation Check

```bash
# Check common locations
which prism-cli 2>/dev/null || \
  test -x ~/.prism/bin/prism-cli || \
  test -x ./bin/prism-cli
```

## Installation Commands

### Unix/macOS
```bash
./scripts/prism-cli-install.sh
```

### Windows (PowerShell)
```powershell
.\scripts\prism-cli-install.ps1
```

### Build from source (requires Go 1.22+)
```bash
cd cmd/prism-cli && go build -o ~/.prism/bin/prism-cli .
```

## Usage

Once installed:
```bash
prism-cli                                    # Auto-detect stories.json
prism-cli -f path/to/stories.json           # Custom path
prism-cli -n 100 -p 5                       # Custom max iterations and pause
```

## Keyboard Controls

| Key | Action |
|-----|--------|
| `q` / `Ctrl+C` | Quit (graceful shutdown) |
| `p` | Pause/Resume execution |
| `s` | Skip current story |
| `Enter` | Start (when idle) |
| `j/k` | Scroll log |
| `?` | Toggle help |

## Workflow Integration

The TUI is a drop-in replacement for `spectrum.sh` with the same signal protocol:
- `<promise>COMPLETE</promise>` - All stories done
- `<spectrum-continue>` - Continue to next story
- `<spectrum-retry>` - Retry current story
- `<spectrum-blocked>` - Skip blocked story
- `<spectrum-error>` - Fatal error, stop

## Example Response

When the user runs `/prism_cli`:

1. If TUI is installed:
   ```
   Launching Prism CLI...

   prism-cli -f .prism/stories/stories.json
   ```

2. If TUI is not installed:
   ```
   Prism CLI is not installed. Would you like to install it?

   Options:
   1. Download pre-built binary (recommended)
   2. Build from source (requires Go)
   3. Use bash version instead (spectrum.sh)
   ```
