# Ralph TUI Command

Launch the Ralph TUI for visual autonomous execution.

## Behavior

1. **Check if ralph-tui is installed** by looking for:
   - `ralph-tui` or `ralph-tui.exe` in PATH
   - `~/.prism/bin/ralph-tui`
   - `./bin/ralph-tui` (local plugin build)

2. **If not found**, offer installation options:
   - **Download pre-built** (recommended): Run the install script
   - **Build from source**: Requires Go installed
   - **Use bash version**: Fall back to `scripts/ralph.sh`

3. **If found**, launch the TUI with the stories.json path

## Installation Check

```bash
# Check common locations
which ralph-tui 2>/dev/null || \
  test -x ~/.prism/bin/ralph-tui || \
  test -x ./bin/ralph-tui
```

## Installation Commands

### Unix/macOS
```bash
./scripts/ralph-tui-install.sh
```

### Windows (PowerShell)
```powershell
.\scripts\ralph-tui-install.ps1
```

### Build from source (requires Go 1.22+)
```bash
cd cmd/ralph-tui && go build -o ~/.prism/bin/ralph-tui .
```

## Usage

Once installed:
```bash
ralph-tui                                    # Auto-detect stories.json
ralph-tui -f path/to/stories.json           # Custom path
ralph-tui -n 100 -p 5                       # Custom max iterations and pause
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

The TUI is a drop-in replacement for `ralph.sh` with the same signal protocol:
- `<promise>COMPLETE</promise>` - All stories done
- `<ralph-continue>` - Continue to next story
- `<ralph-retry>` - Retry current story
- `<ralph-blocked>` - Skip blocked story
- `<ralph-error>` - Fatal error, stop

## Example Response

When the user runs `/ralph_tui`:

1. If TUI is installed:
   ```
   Launching Ralph TUI...

   ralph-tui -f thoughts/shared/ralph/stories.json
   ```

2. If TUI is not installed:
   ```
   Ralph TUI is not installed. Would you like to install it?

   Options:
   1. Download pre-built binary (recommended)
   2. Build from source (requires Go)
   3. Use bash version instead (ralph.sh)
   ```
