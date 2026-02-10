# Prism TUI Command

Launch the Prism TUI for visual autonomous execution.

## Behavior

1. **Check if prism-tui is installed** by looking for:
   - `prism-tui` or `prism-tui.exe` in PATH
   - `~/.prism/bin/prism-tui`
   - `./bin/prism-tui` (local plugin build)

2. **If not found**, offer installation options:
   - **Download pre-built** (recommended): Run the install script
   - **Build from source**: Requires Go installed
   - **Use bash version**: Fall back to `scripts/spectrum.sh`

3. **If found**, launch the TUI with the stories.json path

## Installation Check

```bash
# Check common locations
which prism-tui 2>/dev/null || \
  test -x ~/.prism/bin/prism-tui || \
  test -x ./bin/prism-tui
```

## Installation Commands

### Unix/macOS
```bash
./scripts/prism-tui-install.sh
```

### Windows (PowerShell)
```powershell
.\scripts\prism-tui-install.ps1
```

### Build from source (requires Go 1.22+)
```bash
cd cmd/prism-tui && go build -o ~/.prism/bin/prism-tui .
```

## Usage

Once installed:
```bash
prism-tui                                    # Auto-detect stories.json
prism-tui -f path/to/stories.json           # Custom path
prism-tui -n 100 -p 5                       # Custom max iterations and pause
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

When the user runs `/prism_tui`:

1. If TUI is installed:
   ```
   Launching Prism TUI...

   prism-tui -f .prism/stories/stories.json
   ```

2. If TUI is not installed:
   ```
   Prism TUI is not installed. Would you like to install it?

   Options:
   1. Download pre-built binary (recommended)
   2. Build from source (requires Go)
   3. Use bash version instead (spectrum.sh)
   ```
