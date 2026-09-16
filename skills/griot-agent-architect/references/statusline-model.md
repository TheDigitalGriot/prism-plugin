# Statusline — active-model segment (Model Control Plane)

`scripts/statusline-model.sh` is a Claude Code **statusLine** command that renders the
active model and its Model Control Plane approval mode as a compact segment, printed
LOUD when a premium model (opus5 / fable5) is active so a costly model never runs
silently in the corner.

- **ember (bold orange)** — premium model, mode `ask` / `allow` / `skip`
- **red (bold)** — premium model, mode `deny` (it will be downgraded)
- **dim** — any non-premium model (quiet name only)

The segment reads the same policy the rest of the plane uses
(`<project>/.prism/local/model-policy.json`), mirroring `model-policy.ts`
`readModelPolicy` / `effectiveMode` for the `cli` surface (a statusLine script runs as
plain `sh`/`node` and cannot import the TypeScript core).

## Enable it

statusLine is a **user/project setting**, not a plugin-declared hook. Add it to your
`settings.json` (`~/.claude/settings.json` for all projects, or
`.claude/settings.json` in a repo), pointing at the installed plugin's copy of the
script:

```jsonc
{
  "statusLine": {
    "type": "command",
    // Plugin-relative when the harness exposes CLAUDE_PLUGIN_ROOT to statusLine:
    "command": "sh \"${CLAUDE_PLUGIN_ROOT}/scripts/statusline-model.sh\"",
    "padding": 0
  }
}
```

If your harness does not expand `${CLAUDE_PLUGIN_ROOT}` for statusLine, use the
absolute path to the installed script, e.g.
`sh "~/.claude/plugins/prism/scripts/statusline-model.sh"`.

## Input / output contract

- **stdin**: the Claude Code status JSON — this script reads `model.id` /
  `model.display_name` (active model) and `workspace.project_dir` /
  `workspace.current_dir` / `cwd` (project root for the policy lookup).
- **stdout**: one line — the model segment. Compose it with other segments by wrapping
  it in your own statusLine script if you want more than the model chip.
- **fail-safe**: no stdin, no `node`, or a malformed policy prints a quiet segment (or
  nothing) rather than crashing — a throwing statusLine would spam every prompt.

## Change the mode

Edit `.prism/local/model-policy.json` (or use the VS Code chip / mobile surfaces). The
segment reflects a `surfaces.cli` override before the base `models` entry, matching
`effectiveMode`.
