# Plugin Manifest Reference

Complete reference for `plugin.json` configuration.

## File Location

**Path**: `.claude-plugin/plugin.json`

The manifest is **required** for Claude Code to recognize the plugin (per the current official `plugin-structure` docs, updated 2026-06-02): `.claude-plugin/plugin.json` must exist, and `name` is its only required field. *(Earlier behavior auto-discovered manifest-less plugins and derived the name from the directory; if you rely on that, verify against your CLI version.)*

## Complete Field Reference

### Core Fields

#### name (required)

**Type**: String
**Format**: kebab-case
**Example**: `"test-automation-suite"`

The unique identifier for the plugin. Used for:
- Plugin identification in Claude Code
- Namespacing components (e.g., `/plugin-name:skill-name` in UI)
- Conflict detection with other plugins

**Requirements**:
- Must be unique across all installed plugins
- Use only lowercase letters, numbers, and hyphens
- Start with a letter, end with a letter or number

**Validation**:
```javascript
/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/
```

**Examples**:
- Good: `api-tester`, `code-review`, `git-workflow-automation`
- Bad: `API Tester`, `code_review`, `-git-workflow`, `test-`

#### version

**Type**: String
**Format**: Semantic versioning (MAJOR.MINOR.PATCH)
**Example**: `"2.1.0"`

Claude Code uses the version to determine whether to update the plugin. If you change code but don't bump the version, existing users won't see changes due to caching. If the plugin is within a marketplace directory, you can manage the version through `marketplace.json` instead and omit this field.

**Pre-release versions**: `"2.0.0-beta.1"` for testing

#### description

**Type**: String
**Length**: 50-200 characters recommended
**Example**: `"Automates code review workflows with style checks and automated feedback"`

### Metadata Fields

#### author

**Type**: Object or String
**Fields**: name (required), email (optional), url (optional)

```json
{
  "author": {
    "name": "Jane Developer",
    "email": "jane@example.com",
    "url": "https://janedeveloper.com"
  }
}
```

#### homepage

**Type**: String (URL)
Link to plugin documentation or landing page. Not for source code (use `repository`).

#### repository

**Type**: String (URL) or Object

```json
{
  "repository": "https://github.com/user/plugin-name"
}
```

Or detailed object format:
```json
{
  "repository": {
    "type": "git",
    "url": "https://github.com/user/plugin-name.git",
    "directory": "packages/plugin-name"
  }
}
```

#### license

**Type**: String (SPDX identifier)
Common: `"MIT"`, `"Apache-2.0"`, `"GPL-3.0"`, `"BSD-3-Clause"`, `"ISC"`, `"UNLICENSED"`

Compound: `"(MIT OR Apache-2.0)"`

#### keywords

**Type**: Array of strings
**Example**: `["testing", "automation", "ci-cd", "quality-assurance"]`
Recommend 5-10 keywords for plugin discovery.

### Component Path Fields

**Important**: Per the current official docs (2026-06-02), custom component paths **supplement** the default directory — components in BOTH the default dir and your custom paths load. *(This skill previously documented the opposite "replace" behavior — i.e. that specifying `commands` stopped the default `commands/` from being scanned. If you depend on excluding the default dir, verify empirically against your CLI version, since the official docs now state supplement.)*

Hooks, MCP servers, and LSP servers have different semantics for handling multiple sources.

#### commands

**Type**: String or Array of strings
**Default directory**: `commands/`

```json
{
  "commands": ["./commands/", "./extras/deploy.md"]
}
```

Legacy; prefer `skills/` for new work.

#### agents

**Type**: String or Array of strings
**Default directory**: `agents/`

```json
{
  "agents": ["./agents/", "./specialized-agents/reviewer.md"]
}
```

#### skills

**Type**: String or Array of strings
**Default directory**: `skills/`

```json
{
  "skills": ["./skills/", "./custom-skills/"]
}
```

#### hooks

**Type**: String, Array, or Object (inline configuration)
**Default location**: `hooks/hooks.json`

File path:
```json
{
  "hooks": "./config/hooks.json"
}
```

Inline:
```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [{ "type": "command", "command": "${CLAUDE_PLUGIN_ROOT}/scripts/format.sh" }]
      }
    ]
  }
}
```

#### mcpServers

**Type**: String, Array, or Object (inline configuration)
**Default location**: `.mcp.json`

```json
{
  "mcpServers": {
    "my-server": {
      "command": "node",
      "args": ["${CLAUDE_PLUGIN_ROOT}/server.js"],
      "env": { "DB_PATH": "${CLAUDE_PLUGIN_DATA}/db" }
    }
  }
}
```

#### lspServers

**Type**: String, Array, or Object (inline configuration)
**Default location**: `.lsp.json`

```json
{
  "lspServers": {
    "go": {
      "command": "gopls",
      "args": ["serve"],
      "extensionToLanguage": { ".go": "go" }
    }
  }
}
```

**Required LSP fields:**

| Field | Description |
|---|---|
| `command` | The LSP binary to execute (must be in PATH) |
| `extensionToLanguage` | Maps file extensions to language identifiers |

**Optional LSP fields:**

| Field | Description |
|---|---|
| `args` | Command-line arguments |
| `transport` | `stdio` (default) or `socket` |
| `env` | Environment variables |
| `initializationOptions` | Options passed during server initialization |
| `settings` | Passed via `workspace/didChangeConfiguration` |
| `workspaceFolder` | Workspace folder path |
| `startupTimeout` | Max startup wait (ms) |
| `shutdownTimeout` | Max shutdown wait (ms) |
| `restartOnCrash` | Auto-restart on crash |
| `maxRestarts` | Max restart attempts |

#### outputStyles

**Type**: String or Array of strings
**Default directory**: `output-styles/`

```json
{
  "outputStyles": "./styles/"
}
```

### User Configuration (userConfig)

Declare values Claude Code prompts for when the plugin is enabled. Use this instead of requiring users to hand-edit `settings.json`.

```json
{
  "userConfig": {
    "api_endpoint": {
      "description": "Your team's API endpoint",
      "sensitive": false
    },
    "api_token": {
      "description": "API authentication token",
      "sensitive": true
    }
  }
}
```

**Keys** must be valid identifiers.

**Value availability:**
- Substituted as `${user_config.KEY}` in MCP/LSP server configs, hook commands, and (non-sensitive only) skill/agent content
- Exported as `CLAUDE_PLUGIN_OPTION_<KEY>` environment variables to plugin subprocesses

**Storage:**
- Non-sensitive: `settings.json` under `pluginConfigs[<plugin-id>].options`
- Sensitive: System keychain (or `~/.claude/.credentials.json` where unavailable). Shared with OAuth tokens, ~2 KB total limit — keep sensitive values small.

### Channels

Declare message channels that inject content into the conversation, bound to an MCP server the plugin provides.

```json
{
  "channels": [
    {
      "server": "telegram",
      "userConfig": {
        "bot_token": { "description": "Telegram bot token", "sensitive": true },
        "owner_id": { "description": "Your Telegram user ID", "sensitive": false }
      }
    }
  ]
}
```

**`server`** (required): Must match a key in the plugin's `mcpServers`.

**`userConfig`** (optional): Per-channel configuration using the same schema as the top-level `userConfig`. Prompts for values (like bot tokens or owner IDs) when the plugin is enabled.

## Complete Schema Example

```json
{
  "name": "plugin-name",
  "version": "1.2.0",
  "description": "Brief plugin description",
  "author": {
    "name": "Author Name",
    "email": "author@example.com",
    "url": "https://github.com/author"
  },
  "homepage": "https://docs.example.com/plugin",
  "repository": "https://github.com/author/plugin",
  "license": "MIT",
  "keywords": ["keyword1", "keyword2"],
  "commands": ["./custom/commands/special.md"],
  "agents": "./custom/agents/",
  "skills": "./custom/skills/",
  "hooks": "./config/hooks.json",
  "mcpServers": "./mcp-config.json",
  "lspServers": "./.lsp.json",
  "outputStyles": "./styles/",
  "userConfig": {
    "api_endpoint": { "description": "API endpoint", "sensitive": false },
    "api_token": { "description": "API token", "sensitive": true }
  },
  "channels": [
    {
      "server": "notifications",
      "userConfig": {
        "bot_token": { "description": "Bot token", "sensitive": true }
      }
    }
  ]
}
```

## Path Resolution

### Rules

1. All paths must be relative and start with `./`
2. Cannot use `../` (no parent directory navigation)
3. Forward slashes only (even on Windows)
4. Cannot reference files outside the plugin directory (use symlinks as workaround)

### Path Behavior

For `commands`, `agents`, `skills`, and `outputStyles`:
- Custom paths **supplement** the default directory — both the default dir and your custom paths load (per current official docs, 2026-06-02)
- There is no auto-exclude of the default; omit a default dir deliberately if you don't want it scanned

For `hooks`, `mcpServers`, and `lspServers`:
- Different merge semantics for handling multiple sources

### Resolution Order

1. Read `.claude-plugin/plugin.json` for custom paths
2. If custom paths specified: scan those paths only
3. If no custom paths: scan default directories
4. Register all discovered components (name conflicts cause errors)

## Validation

Run `claude plugin validate` or `/plugin validate` to check for errors.

### Common Validation Errors

**Manifest errors:**
- `Invalid JSON syntax: Unexpected token }`: missing commas, extra commas, or unquoted strings
- `name: Required`: a required field is missing
- `JSON parse error`: JSON syntax error

**Loading errors:**
- `No commands found in plugin custom directory`: path exists but contains no valid files
- `Plugin directory not found at path`: marketplace entry points to non-existent directory
- `conflicting manifests`: remove duplicate component definitions

## Environment Variables

Both `${CLAUDE_PLUGIN_ROOT}` and `${CLAUDE_PLUGIN_DATA}` are:
- Substituted inline in skill content, agent content, hook commands, and MCP/LSP server configs
- Exported as environment variables to hook processes and MCP/LSP server subprocesses

### ${CLAUDE_PLUGIN_ROOT}

Absolute path to the plugin's installation directory. Changes when the plugin updates — files written here don't survive updates.

### ${CLAUDE_PLUGIN_DATA}

Persistent directory at `~/.claude/plugins/data/{id}/` that survives updates. `{id}` is the plugin identifier with non-alphanumeric characters (except `_` and `-`) replaced by `-`.

Deleted automatically when uninstalling from the last scope. Use `--keep-data` to preserve it. The `/plugin` interface shows directory size before deleting.

## Installation Scopes

| Scope | Settings File | Use Case |
|---|---|---|
| `user` | `~/.claude/settings.json` | Personal plugins across all projects (default) |
| `project` | `.claude/settings.json` | Team plugins shared via version control |
| `local` | `.claude/settings.local.json` | Project-specific plugins, gitignored |
| `managed` | Managed settings | Managed plugins (read-only, update only) |

## Plugin Caching

Claude Code copies marketplace plugins to `~/.claude/plugins/cache` rather than using them in-place. Installed plugins cannot reference files outside their directory — paths like `../shared-utils` won't work after installation.

**Workaround:** Create symbolic links within the plugin directory. Symlinks are honored during the copy process:
```bash
ln -s /path/to/shared-utils ./shared-utils
```

## Marketplace Manifest Reference

Complete reference for `.claude-plugin/marketplace.json`. This is a **separate schema** from plugin.json — do not confuse the two.

### File Location

**Path**: `.claude-plugin/marketplace.json`

Required when distributing plugins via a marketplace. This file lists the plugins available in the marketplace and where to find them.

### Required Root Fields

| Field | Type | Description |
|---|---|---|
| `name` | string | Marketplace identifier (kebab-case). Users see this when installing: `plugin@marketplace-name` |
| `owner` | object | Marketplace maintainer. `name` required, `email` optional |
| `plugins` | array | List of available plugins |

### Optional Root Fields

| Field | Type | Description |
|---|---|---|
| `metadata` | object | Optional metadata object containing `description`, `version`, `pluginRoot` |

**IMPORTANT:** Only `name`, `owner`, `plugins`, and `metadata` are valid at the root level. Do NOT place `description`, `version`, `$schema`, or any other field at the root — they will cause validation failure. The marketplace schema is strict about unrecognized keys.

### metadata Object

| Field | Type | Description |
|---|---|---|
| `description` | string | Brief marketplace description |
| `version` | string | Marketplace version |
| `pluginRoot` | string | Base directory for relative plugin source paths (e.g., `"./plugins"`) |

### Plugin Entry Fields

Each entry in the `plugins` array:

**Required:**

| Field | Type | Description |
|---|---|---|
| `name` | string | Plugin identifier (kebab-case) |
| `source` | string or object | Where to fetch the plugin. String for relative paths (`"./plugins/my-plugin"`), object for remote sources |

**Optional:**

| Field | Type | Description |
|---|---|---|
| `description` | string | Plugin description |
| `version` | string | Plugin version |
| `author` | object | Plugin author (`name` required, `email` optional) |
| `homepage` | string | Plugin homepage URL |
| `repository` | string | Source code URL |
| `license` | string | SPDX license identifier |
| `keywords` | array | Tags for discovery |
| `category` | string | Plugin category |
| `tags` | array | Tags for searchability |
| `strict` | boolean | Whether plugin.json is authority for components (default: true) |
| `commands` | string or array | Custom command paths |
| `agents` | string or array | Custom agent paths |
| `hooks` | string or object | Hook configuration |
| `mcpServers` | string or object | MCP server configuration |
| `lspServers` | string or object | LSP server configuration |

### Plugin Source Types

| Source | Format | Example |
|---|---|---|
| Relative path | string | `"./plugins/my-plugin"` |
| GitHub | object | `{"source": "github", "repo": "owner/repo", "ref": "v1.0"}` |
| Git URL | object | `{"source": "url", "url": "https://gitlab.com/team/plugin.git"}` |
| Git subdirectory | object | `{"source": "git-subdir", "url": "https://github.com/org/monorepo.git", "path": "tools/plugin"}` |
| npm | object | `{"source": "npm", "package": "@org/plugin", "version": "^2.0.0"}` |

### Complete Example

```json
{
  "name": "my-marketplace",
  "metadata": {
    "description": "Tools for my team",
    "version": "1.0.0"
  },
  "owner": {
    "name": "Team Name",
    "email": "team@example.com"
  },
  "plugins": [
    {
      "name": "local-plugin",
      "source": "./plugins/local-plugin",
      "description": "A plugin in this repo",
      "category": "productivity"
    },
    {
      "name": "remote-plugin",
      "source": {
        "source": "github",
        "repo": "org/remote-plugin",
        "ref": "v2.0.0"
      },
      "description": "A plugin from GitHub"
    }
  ]
}
```

## File Naming Conventions

- **Commands**: kebab-case `.md` files (`code-review.md` -> `/code-review`)
- **Agents**: kebab-case `.md` files describing role (`code-reviewer.md`)
- **Skills**: kebab-case directory names (`api-testing/`)
- **Scripts**: descriptive kebab-case with extensions (`validate-input.sh`)
- **Configuration**: standard names (`hooks.json`, `.mcp.json`, `.lsp.json`, `plugin.json`)

## Validation

**MANDATORY: Always run `claude plugin validate .` after generating or modifying any plugin file.** This validates plugin.json, marketplace.json, skill/agent/command frontmatter, and hooks.json. Unrecognized fields, bad frontmatter, or schema mismatches will silently prevent the plugin from loading — the validator is the only reliable way to catch these.

```bash
claude plugin validate .        # CLI
/plugin validate .              # Inside Claude Code
```

## Troubleshooting

**Component not loading:**
- Run `claude plugin validate .` first — this catches most issues
- Verify directories are at plugin root (not in `.claude-plugin/`)
- Run `claude --debug` to see plugin loading details

**Hooks not firing:**
- Check script is executable (`chmod +x script.sh`)
- Verify event name is case-sensitive (`PostToolUse`, not `postToolUse`)
- Confirm hook type is valid: `command`, `http`, `prompt`, or `agent`
- Use `${CLAUDE_PLUGIN_ROOT}` for all plugin paths

**MCP/LSP server fails:**
- Verify all paths use `${CLAUDE_PLUGIN_ROOT}`
- For LSP: ensure the language server binary is installed (`Executable not found in $PATH`)
- Check `claude --debug` for initialization errors

**Path errors after installation:**
- All paths must be relative starting with `./`
- Cannot reference files outside plugin directory (use symlinks if needed)

## Best Practices

1. **Start at 1.0.0** for first stable release; bump version before distributing changes
2. **Complete metadata** before publishing to marketplace
3. **Use `userConfig`** instead of requiring users to edit settings manually
4. **Keep sensitive values small** due to keychain size limits
5. **Use `${CLAUDE_PLUGIN_DATA}`** for dependencies that should persist across updates
6. **Test on clean install** to verify the plugin works without dev environment
7. **Document changes** in a CHANGELOG.md file
