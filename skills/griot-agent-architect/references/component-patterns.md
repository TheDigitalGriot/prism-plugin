# Component Organization Patterns

Advanced patterns for organizing plugin components effectively.

## Component Lifecycle

### Discovery Phase

When Claude Code starts:

1. **Scan enabled plugins**: Read `.claude-plugin/plugin.json` for each
2. **Discover components**: Look in default and custom paths
3. **Parse definitions**: Read YAML frontmatter and configurations
4. **Register components**: Make available to Claude Code
5. **Initialize**: Start MCP servers, register hooks

**Timing**: Component registration happens during Claude Code initialization, not continuously.

### Activation Phase

When components are used:

**Commands**: User types slash command → Claude Code looks up → Executes
**Agents**: Task arrives → Claude Code evaluates capabilities → Selects agent (also available via `/agents`)
**Skills**: Task context matches description → Claude Code loads skill
**Hooks**: Event occurs → Claude Code calls matching hooks (4 types: command, http, prompt, agent)
**MCP Servers**: Tool call matches server capability → Forwards to server
**LSP Servers**: File edit/read triggers → Code intelligence returned (diagnostics, definitions, hover)
**Output Styles**: Response formatting → Applied to Claude's output
**Channels**: External event arrives → Channel server pushes `<channel>` tag into Claude's context → Claude reacts per channel `instructions`

## Command Organization Patterns

### Flat Structure

Single directory with all commands:

```
commands/
├── build.md
├── test.md
├── deploy.md
├── review.md
└── docs.md
```

**When to use**:
- 5-15 commands total
- All commands at same abstraction level
- No clear categorization

**Advantages**:
- Simple, easy to navigate
- No configuration needed
- Fast discovery

### Categorized Structure

Multiple directories for different command types:

```
commands/              # Core commands
├── build.md
└── test.md

admin-commands/        # Administrative
├── configure.md
└── manage.md

workflow-commands/     # Workflow automation
├── review.md
└── deploy.md
```

**Manifest configuration**:
```json
{
  "commands": [
    "./commands",
    "./admin-commands",
    "./workflow-commands"
  ]
}
```

**When to use**:
- 15+ commands
- Clear functional categories
- Different permission levels

**Advantages**:
- Organized by purpose
- Easier to maintain
- Can restrict access by directory

### Hierarchical Structure

Nested organization for complex plugins:

```
commands/
├── ci/
│   ├── build.md
│   ├── test.md
│   └── lint.md
├── deployment/
│   ├── staging.md
│   └── production.md
└── management/
    ├── config.md
    └── status.md
```

**Note**: Claude Code doesn't support nested command discovery automatically. Use custom paths:

```json
{
  "commands": [
    "./commands/ci",
    "./commands/deployment",
    "./commands/management"
  ]
}
```

**When to use**:
- 20+ commands
- Multi-level categorization
- Complex workflows

**Advantages**:
- Maximum organization
- Clear boundaries
- Scalable structure

## Agent Organization Patterns

### Role-Based Organization

Organize agents by their primary role:

```
agents/
├── code-reviewer.md        # Reviews code
├── test-generator.md       # Generates tests
├── documentation-writer.md # Writes docs
└── refactorer.md          # Refactors code
```

**When to use**:
- Agents have distinct, non-overlapping roles
- Users invoke agents manually
- Clear agent responsibilities

### Capability-Based Organization

Organize by specific capabilities:

```
agents/
├── python-expert.md        # Python-specific
├── typescript-expert.md    # TypeScript-specific
├── api-specialist.md       # API design
└── database-specialist.md  # Database work
```

**When to use**:
- Technology-specific agents
- Domain expertise focus
- Automatic agent selection

### Workflow-Based Organization

Organize by workflow stage:

```
agents/
├── planning-agent.md      # Planning phase
├── implementation-agent.md # Coding phase
├── testing-agent.md       # Testing phase
└── deployment-agent.md    # Deployment phase
```

**When to use**:
- Sequential workflows
- Stage-specific expertise
- Pipeline automation

## Skill Organization Patterns

### Topic-Based Organization

Each skill covers a specific topic:

```
skills/
├── api-design/
│   └── SKILL.md
├── error-handling/
│   └── SKILL.md
├── testing-strategies/
│   └── SKILL.md
└── performance-optimization/
    └── SKILL.md
```

**When to use**:
- Knowledge-based skills
- Educational or reference content
- Broad applicability

### Tool-Based Organization

Skills for specific tools or technologies:

```
skills/
├── docker/
│   ├── SKILL.md
│   └── references/
│       └── dockerfile-best-practices.md
├── kubernetes/
│   ├── SKILL.md
│   └── examples/
│       └── deployment.yaml
└── terraform/
    ├── SKILL.md
    └── scripts/
        └── validate-config.sh
```

**When to use**:
- Tool-specific expertise
- Complex tool configurations
- Tool best practices

### Workflow-Based Organization

Skills for complete workflows:

```
skills/
├── code-review-workflow/
│   ├── SKILL.md
│   └── references/
│       ├── checklist.md
│       └── standards.md
├── deployment-workflow/
│   ├── SKILL.md
│   └── scripts/
│       ├── pre-deploy.sh
│       └── post-deploy.sh
└── testing-workflow/
    ├── SKILL.md
    └── examples/
        └── test-structure.md
```

**When to use**:
- Multi-step processes
- Company-specific workflows
- Process automation

### Skill with Rich Resources

Comprehensive skill with all resource types:

```
skills/
└── api-testing/
    ├── SKILL.md              # Core skill (1500 words)
    ├── references/
    │   ├── rest-api-guide.md
    │   ├── graphql-guide.md
    │   └── authentication.md
    ├── examples/
    │   ├── basic-test.js
    │   ├── authenticated-test.js
    │   └── integration-test.js
    ├── scripts/
    │   ├── run-tests.sh
    │   └── generate-report.py
    └── assets/
        └── test-template.json
```

**Resource usage**:
- **SKILL.md**: Overview and when to use resources
- **references/**: Detailed guides (loaded as needed)
- **examples/**: Copy-paste code samples
- **scripts/**: Executable test runners
- **assets/**: Templates and configurations

## Hook Organization Patterns

### Monolithic Configuration

Single hooks.json with all hooks:

```
hooks/
├── hooks.json     # All hook definitions
└── scripts/
    ├── validate-write.sh
    ├── validate-bash.sh
    └── load-context.sh
```

**hooks.json**:
```json
{
  "PreToolUse": [...],
  "PostToolUse": [...],
  "Stop": [...],
  "SessionStart": [...]
}
```

**When to use**:
- 5-10 hooks total
- Simple hook logic
- Centralized configuration

### Event-Based Organization

Separate files per event type:

```
hooks/
├── hooks.json              # Combines all
├── pre-tool-use.json      # PreToolUse hooks
├── post-tool-use.json     # PostToolUse hooks
├── stop.json              # Stop hooks
└── scripts/
    ├── validate/
    │   ├── write.sh
    │   └── bash.sh
    └── context/
        └── load.sh
```

**hooks.json** (combines):
```json
{
  "PreToolUse": ${file:./pre-tool-use.json},
  "PostToolUse": ${file:./post-tool-use.json},
  "Stop": ${file:./stop.json}
}
```

**Note**: Use build script to combine files, Claude Code doesn't support file references.

**When to use**:
- 10+ hooks
- Different teams managing different events
- Complex hook configurations

### Purpose-Based Organization

Group by functional purpose:

```
hooks/
├── hooks.json
└── scripts/
    ├── security/
    │   ├── validate-paths.sh
    │   ├── check-credentials.sh
    │   └── scan-malware.sh
    ├── quality/
    │   ├── lint-code.sh
    │   ├── check-tests.sh
    │   └── verify-docs.sh
    └── workflow/
        ├── notify-team.sh
        └── update-status.sh
```

**When to use**:
- Many hook scripts
- Clear functional boundaries
- Team specialization

## Script Organization Patterns

### Flat Scripts

All scripts in single directory:

```
scripts/
├── build.sh
├── test.py
├── deploy.sh
├── validate.js
└── report.py
```

**When to use**:
- 5-10 scripts
- All scripts related
- Simple plugin

### Categorized Scripts

Group by purpose:

```
scripts/
├── build/
│   ├── compile.sh
│   └── package.sh
├── test/
│   ├── run-unit.sh
│   └── run-integration.sh
├── deploy/
│   ├── staging.sh
│   └── production.sh
└── utils/
    ├── log.sh
    └── notify.sh
```

**When to use**:
- 10+ scripts
- Clear categories
- Reusable utilities

### Language-Based Organization

Group by programming language:

```
scripts/
├── bash/
│   ├── build.sh
│   └── deploy.sh
├── python/
│   ├── analyze.py
│   └── report.py
└── javascript/
    ├── bundle.js
    └── optimize.js
```

**When to use**:
- Multi-language scripts
- Different runtime requirements
- Language-specific dependencies

## Cross-Component Patterns

### Shared Resources

Components sharing common resources:

```
plugin/
├── commands/
│   ├── test.md        # Uses lib/test-utils.sh
│   └── deploy.md      # Uses lib/deploy-utils.sh
├── agents/
│   └── tester.md      # References lib/test-utils.sh
├── hooks/
│   └── scripts/
│       └── pre-test.sh # Sources lib/test-utils.sh
└── lib/
    ├── test-utils.sh
    └── deploy-utils.sh
```

**Usage in components**:
```bash
#!/bin/bash
source "${CLAUDE_PLUGIN_ROOT}/lib/test-utils.sh"
run_tests
```

**Benefits**:
- Code reuse
- Consistent behavior
- Easier maintenance

### Layered Architecture

Separate concerns into layers:

```
plugin/
├── commands/          # User interface layer
├── agents/            # Orchestration layer
├── skills/            # Knowledge layer
└── lib/
    ├── core/         # Core business logic
    ├── integrations/ # External services
    └── utils/        # Helper functions
```

**When to use**:
- Large plugins (100+ files)
- Multiple developers
- Clear separation of concerns

### Plugin Within Plugin

Nested plugin structure:

```
plugin/
├── .claude-plugin/
│   └── plugin.json
├── core/              # Core functionality
│   ├── commands/
│   └── agents/
└── extensions/        # Optional extensions
    ├── extension-a/
    │   ├── commands/
    │   └── agents/
    └── extension-b/
        ├── commands/
        └── agents/
```

**Manifest**:
```json
{
  "commands": [
    "./core/commands",
    "./extensions/extension-a/commands",
    "./extensions/extension-b/commands"
  ]
}
```

**When to use**:
- Modular functionality
- Optional features
- Plugin families

## LSP Server Patterns

### Single Language

Simple plugin supporting one language:

```
my-plugin/
├── .claude-plugin/
│   └── plugin.json
└── .lsp.json
```

**.lsp.json**:
```json
{
  "go": {
    "command": "gopls",
    "args": ["serve"],
    "extensionToLanguage": { ".go": "go" }
  }
}
```

**When to use**: Providing code intelligence for a specific language.

### Multi-Language

Plugin providing intelligence for multiple languages:

```json
{
  "python": {
    "command": "pyright-langserver",
    "args": ["--stdio"],
    "extensionToLanguage": { ".py": "python", ".pyi": "python" }
  },
  "typescript": {
    "command": "typescript-language-server",
    "args": ["--stdio"],
    "extensionToLanguage": { ".ts": "typescript", ".tsx": "typescriptreact" }
  }
}
```

**Note**: Users must install the language server binaries separately. The plugin only configures how Claude Code connects to them.

### With Custom Settings

LSP server with initialization options and workspace settings:

```json
{
  "rust": {
    "command": "rust-analyzer",
    "extensionToLanguage": { ".rs": "rust" },
    "initializationOptions": {
      "cargo": { "buildScripts": { "enable": true } }
    },
    "settings": {
      "rust-analyzer": { "checkOnSave": { "command": "clippy" } }
    },
    "restartOnCrash": true,
    "maxRestarts": 3
  }
}
```

## Output Style Patterns

Output styles live in `output-styles/` as markdown files that define formatting rules for Claude's responses.

```
output-styles/
├── terse.md           # Minimal, concise output
├── detailed.md        # Verbose, explanatory output
└── structured.md      # Formatted with headers and lists
```

## Hook Type Patterns

Hooks support four types, each for different use cases:

### Command Hooks

Execute shell commands or scripts. Most common type:

```json
{
  "type": "command",
  "command": "${CLAUDE_PLUGIN_ROOT}/scripts/lint.sh"
}
```

The command receives hook input as JSON on stdin.

### HTTP Hooks

Send event JSON as POST to a URL. Useful for external service integration:

```json
{
  "type": "http",
  "url": "https://api.example.com/hooks/claude-event"
}
```

### Prompt Hooks

Evaluate a prompt with an LLM. Uses `$ARGUMENTS` placeholder for context:

```json
{
  "type": "prompt",
  "prompt": "Evaluate if this code change follows our security guidelines. Check for injection vulnerabilities and data exposure. $ARGUMENTS"
}
```

### Agent Hooks

Run an agentic verifier with tools for complex verification:

```json
{
  "type": "agent",
  "prompt": "Verify the deployment configuration is correct and all required resources exist."
}
```

## Expanded Hook Event Patterns

### File Watching with FileChanged

Watch specific files for changes using the `matcher` field:

```json
{
  "FileChanged": [
    {
      "matcher": "package.json",
      "hooks": [
        { "type": "command", "command": "${CLAUDE_PLUGIN_ROOT}/scripts/check-deps.sh" }
      ]
    }
  ]
}
```

### Worktree Lifecycle

Handle worktree creation and removal:

```json
{
  "WorktreeCreate": [
    {
      "hooks": [
        { "type": "command", "command": "${CLAUDE_PLUGIN_ROOT}/scripts/setup-worktree.sh" }
      ]
    }
  ],
  "WorktreeRemove": [
    {
      "hooks": [
        { "type": "command", "command": "${CLAUDE_PLUGIN_ROOT}/scripts/cleanup-worktree.sh" }
      ]
    }
  ]
}
```

### Context Compaction

Run actions before and after context compaction:

```json
{
  "PreCompact": [
    {
      "hooks": [
        { "type": "command", "command": "${CLAUDE_PLUGIN_ROOT}/scripts/save-state.sh" }
      ]
    }
  ],
  "PostCompact": [
    {
      "hooks": [
        { "type": "command", "command": "${CLAUDE_PLUGIN_ROOT}/scripts/restore-state.sh" }
      ]
    }
  ]
}
```

### Subagent Lifecycle

Track subagent spawning and completion:

```json
{
  "SubagentStart": [
    {
      "hooks": [
        { "type": "command", "command": "${CLAUDE_PLUGIN_ROOT}/scripts/log-agent-start.sh" }
      ]
    }
  ],
  "SubagentStop": [
    {
      "hooks": [
        { "type": "command", "command": "${CLAUDE_PLUGIN_ROOT}/scripts/log-agent-stop.sh" }
      ]
    }
  ]
}
```

## Harness Architecture

A plugin's individual components (skills, agents, hooks, MCP servers) are building blocks. The **harness** is the composed system that ties them together into a coherent agent runtime. Understanding the harness concept helps you design plugins that enhance the full system rather than just adding isolated capabilities.

### What a Harness Is

An agent harness is the full stack of primitives an agent needs beyond just a model and tools:

| Primitive | Plugin Component | Purpose |
|---|---|---|
| **Dynamic system prompts** | SKILL.md bodies, CLAUDE.md, agent frontmatter | Runtime-assembled instructions that change based on task context |
| **Steering** | Skills (slash-command activated) | User-directed mode switching via `/skill-name` |
| **Workspaces** | MCP servers, LSP servers, hook scripts | The filesystem, sandbox, tools, and capabilities available to the agent |
| **Modes** | Agent definitions with different model/effort/tools | Fully rewire the agent per task type (different prompt, tools, model per mode) |
| **Plan approval** | Hook events (PreToolUse, Stop) | Human-in-the-loop checkpoints before irreversible actions |
| **Tool approval** | `disallowedTools`, hook-based tool policies | Controlling which tools are available and under what conditions |

### How Plugin Components Map to the Harness

```
┌─────────────────────────────────────────────────────┐
│                   AGENT HARNESS                      │
│                                                      │
│  ┌──────────┐  ┌──────────┐  ┌───────────────────┐  │
│  │  MODES   │  │ STEERING │  │    WORKSPACES     │  │
│  │          │  │          │  │                   │  │
│  │ agents/  │  │ skills/  │  │ .mcp.json         │  │
│  │ *.md     │  │ */       │  │ .lsp.json         │  │
│  │          │  │ SKILL.md │  │ hooks/hooks.json  │  │
│  └──────────┘  └──────────┘  └───────────────────┘  │
│                                                      │
│  ┌──────────────────┐  ┌──────────────────────────┐  │
│  │  TOOL POLICIES   │  │   APPROVAL FLOWS         │  │
│  │                  │  │                          │  │
│  │ disallowedTools  │  │ PreToolUse hooks         │  │
│  │ Hook-based gates │  │ Stop hooks (validation)  │  │
│  └──────────────────┘  └──────────────────────────┘  │
│                                                      │
│  ┌──────────────────────────────────────────────────┐│
│  │  CONTEXT MANAGEMENT                              ││
│  │                                                  ││
│  │ Progressive disclosure (SKILL.md → references)   ││
│  │ State externalization (${CLAUDE_PLUGIN_DATA})     ││
│  │ Compaction survival (PreCompact/PostCompact)      ││
│  │ Observation hooks (append-only session log)       ││
│  └──────────────────────────────────────────────────┘│
│                                                      │
│  ┌──────────────────────────────────────────────────┐│
│  │  EXTERNAL EVENT CHANNELS                         ││
│  │                                                  ││
│  │ One-way: CI alerts, monitoring, webhooks          ││
│  │ Two-way: Chat bridges with reply tools            ││
│  │ Permission relay: Remote tool approval            ││
│  │ Bound to MCP servers in .mcp.json                 ││
│  └──────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────┘
```

### Designing Plugins as Harness Extensions

When building a plugin, consider which harness primitives it touches:

1. **Mode-adding plugins**: Define agents with distinct model/effort/tools combinations. Each agent is a mode the harness can switch into.
2. **Workspace-extending plugins**: Add MCP/LSP servers that give the agent new capabilities (database access, cloud APIs, code intelligence).
3. **Policy-enforcing plugins**: Use hooks to add tool approval flows, security gates, or validation checkpoints.
4. **Context-managing plugins**: Use progressive disclosure, state externalization, and observation patterns to keep the harness efficient over long sessions.

The best plugins enhance multiple primitives. A deployment plugin might add modes (deploy-agent, rollback-agent), workspace tools (kubernetes MCP), policies (PreToolUse hook gating destructive commands), and context management (PostCompact state restoration).

### Observational Context Pattern

An alternative to snapshot/restore compaction survival. Instead of saving state only at compaction boundaries, maintain a running observation log throughout the session. Use a cross-platform script to ensure the pattern works on Windows, macOS, and Linux.

**Hook configuration:**

```json
{
  "PostToolUse": [
    {
      "matcher": "Write|Edit",
      "hooks": [
        {
          "type": "command",
          "command": "python3 ${CLAUDE_PLUGIN_ROOT}/scripts/observe.py"
        }
      ]
    }
  ],
  "PreCompact": [
    {
      "hooks": [
        {
          "type": "command",
          "command": "python3 ${CLAUDE_PLUGIN_ROOT}/scripts/inject-observations.py"
        }
      ]
    }
  ],
  "SessionEnd": [
    {
      "hooks": [
        {
          "type": "command",
          "command": "python3 ${CLAUDE_PLUGIN_ROOT}/scripts/cleanup-observations.py"
        }
      ]
    }
  ]
}
```

**`scripts/observe.py`** — Appends one-line observation on each Write/Edit:

```python
#!/usr/bin/env python3
"""PostToolUse hook: append observation to session log. Cross-platform."""
import json, sys, os
from datetime import datetime, timezone

data_dir = os.environ.get("CLAUDE_PLUGIN_DATA", "")
if not data_dir:
    sys.exit(0)

event = json.load(sys.stdin)
file_path = (event.get("tool_input") or {}).get("file_path", "")
if not file_path:
    sys.exit(0)

log_path = os.path.join(data_dir, "observations.log")
timestamp = datetime.now(timezone.utc).isoformat(timespec="seconds")
with open(log_path, "a", encoding="utf-8") as f:
    f.write(f"{timestamp} | Modified: {file_path}\n")
```

**`scripts/inject-observations.py`** — Injects last 50 observations into context before compaction:

```python
#!/usr/bin/env python3
"""PreCompact hook: print recent observations to stdout (injected into context)."""
import os, sys

data_dir = os.environ.get("CLAUDE_PLUGIN_DATA", "")
log_path = os.path.join(data_dir, "observations.log") if data_dir else ""
if not log_path or not os.path.isfile(log_path):
    sys.exit(0)

with open(log_path, "r", encoding="utf-8") as f:
    lines = f.readlines()

print("--- SESSION OBSERVATIONS ---")
for line in lines[-50:]:
    print(line, end="")
print("--- END OBSERVATIONS ---")
```

**`scripts/cleanup-observations.py`** — Removes log on session end:

```python
#!/usr/bin/env python3
"""SessionEnd hook: remove observation log."""
import os, sys

data_dir = os.environ.get("CLAUDE_PLUGIN_DATA", "")
log_path = os.path.join(data_dir, "observations.log") if data_dir else ""
if log_path and os.path.isfile(log_path):
    os.remove(log_path)
```

**Why this works:** The observation log grows incrementally (one line per significant action) and is always available as a compressed session history. When compaction hits, the log is injected into context — providing continuity without the full conversation history. This is a deterministic (free, command-type) approximation of the Observer/Reflector pattern from observational memory research. Python ensures the scripts run identically on Windows, macOS, and Linux.

**Escalation path:** For LLM-powered observation, replace the `command` type with a `prompt` type on the PostToolUse hook, with a narrow matcher. A haiku-class prompt compresses each action into a semantic observation (~200 tokens per invocation). Only worth the cost for sessions where compaction is frequent and context continuity is critical.

## Channel Integration Patterns

Channels are MCP servers that push external events into Claude's context. They integrate with other plugin primitives at multiple points.

### Channel + MCP Server Binding

Every channel must be backed by an MCP server declared in the plugin's `mcpServers`. The channel entry in `plugin.json` references the server by key:

```json
{
  "mcpServers": {
    "ci-alerts": {
      "command": "node",
      "args": ["${CLAUDE_PLUGIN_ROOT}/servers/ci-alerts/index.js"]
    }
  },
  "channels": [
    { "server": "ci-alerts" }
  ]
}
```

### Channel + Hook Integration

Channels interact with hooks through two events:

| Hook Event | Channel Interaction |
|---|---|
| `Notification` | Fires when channel events arrive. Use to log, filter, or trigger side effects. |
| `PermissionRequest` | Fires when a permission dialog appears. Permission relay channels forward these to remote devices. |

**Example: Log all channel events to disk**

```json
{
  "Notification": [
    {
      "hooks": [
        {
          "type": "command",
          "command": "${CLAUDE_PLUGIN_ROOT}/scripts/log-channel-event.sh"
        }
      ]
    }
  ]
}
```

### Channel + Skill Pairing

Channel `instructions` (on the MCP server constructor) are brief -- they tell Claude *when* to reply and basic constraints. For complex reactive behavior, pair with a skill:

- **Channel instructions**: "You receive CI failure alerts. Summarize errors. Use the `ci-runbook` skill for diagnosis."
- **Skill**: Full diagnostic knowledge, loaded on demand when Claude needs it.

### Channel + Agent Coordination

Channels can provide context that triggers agent selection. A deployment failure arriving via a channel may cause Claude to select a `rollback-manager` agent if its description matches the incoming event context.

### Three Capability Tiers

| Tier | Capabilities | Use Case |
|---|---|---|
| **One-way** | `claude/channel` | CI alerts, monitoring, log forwarding |
| **Two-way** | `claude/channel` + `tools` | Chat bridges, interactive notifications |
| **Permission relay** | `claude/channel` + `tools` + `claude/channel/permission` | Remote tool approval from phone/tablet |

For full implementation details, server constructor patterns, security guidance, and code examples: [references/channel-patterns.md](./channel-patterns.md)

## Best Practices

### Naming

1. **Consistent naming**: Match file names to component purpose
2. **Descriptive names**: Indicate what component does
3. **Avoid abbreviations**: Use full words for clarity

### Organization

1. **Start simple**: Use flat structure, reorganize when needed
2. **Group related items**: Keep related components together
3. **Separate concerns**: Don't mix unrelated functionality

### Scalability

1. **Plan for growth**: Choose structure that scales
2. **Refactor early**: Reorganize before it becomes painful
3. **Document structure**: Explain organization in README

### Maintainability

1. **Consistent patterns**: Use same structure throughout
2. **Minimize nesting**: Keep directory depth manageable
3. **Use conventions**: Follow community standards

### Performance

1. **Avoid deep nesting**: Impacts discovery time
2. **Minimize custom paths**: Use defaults when possible
3. **Keep configurations small**: Large configs slow loading
