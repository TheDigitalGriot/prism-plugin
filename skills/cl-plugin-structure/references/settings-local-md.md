# Settings — `settings.json` vs the `.local.md` pattern

Two separate mechanisms. Don't conflate them.

## `settings.json` (plugin root) — plugin defaults

Ships *with* the plugin. Sets defaults applied on enable. Currently the main documented key is `agent` (activate an agent). Surface compat: ✅ Claude Code, ⚠️ Cowork (partial). This is author-controlled, not user-editable per project.

## `.claude/<plugin-name>.local.md` — per-project, user-configurable state

A file the **user** creates in a project's `.claude/` dir to configure *your* plugin's behavior for *that* project. YAML frontmatter (config) + markdown body (notes/instructions the plugin reads). Your hooks/commands read it at runtime. This is the idiomatic way to make a plugin user-configurable without a settings UI.

```markdown
---
enabled: true
mode: auto              # auto | manual
max_iterations: 5
notify_webhook: https://hooks.example.com/abc
---
# Project notes

Free-form guidance the plugin folds into its prompts (e.g. "skip the e2e suite in this repo").
```

**Why this shape:** frontmatter is trivially parseable from bash (no JSON dependency), the markdown body lets the user pass prose to the plugin, and it lives in-repo (`.claude/`) so it's per-project and reviewable in git.

## Reading it from a hook or command (bash)

The plugin's `command`-type hooks read settings from stdin-adjacent state, not the conversation. Use the bundled helpers (zero-dependency, copied from the official toolkit):

```bash
SETTINGS="$CLAUDE_PROJECT_DIR/.claude/my-plugin.local.md"

# whole frontmatter, or one field:
MODE=$("$CLAUDE_PLUGIN_ROOT/scripts/parse-frontmatter.sh" "$SETTINGS" mode)
MAXIT=$("$CLAUDE_PLUGIN_ROOT/scripts/parse-frontmatter.sh" "$SETTINGS" max_iterations)

# bail out cleanly if the plugin is disabled for this project:
[ "$("$CLAUDE_PLUGIN_ROOT/scripts/parse-frontmatter.sh" "$SETTINGS" enabled)" = "true" ] || exit 0
```

`scripts/parse-frontmatter.sh <file> [field]` — prints the whole frontmatter, or one field's value. Handles quoted/unquoted strings, booleans, numbers. `scripts/validate-settings.sh <file>` — checks the file has frontmatter markers, well-formed fields, boolean validity, and a body; emits a human-readable report. Run it in development to catch malformed settings before they silently no-op a hook.

## Gotchas

- **Field typing is by convention** — frontmatter is YAML-ish, parsed by the helper, not a strict YAML engine. Keep values simple (strings, booleans, numbers, flat lists). For nested config, use the body or a sidecar JSON the plugin reads itself.
- **Empty / missing field** → the helper prints nothing; default it in bash (`${MODE:-auto}`).
- **It's user-authored** — never assume it exists or is valid. Guard every read; `exit 0` (not error) when the plugin should simply stay inactive.
- Surface compat: this is a Claude-Code-side, hook/command-driven pattern. Cowork has no Bash tool, so `.local.md`-from-hooks doesn't apply there — Cowork plugins surface user config via `userConfig` in `plugin.json` (Customize menu) instead.
