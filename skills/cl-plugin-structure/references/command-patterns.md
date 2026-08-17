# Slash Command Patterns

Commands are **token-efficient**: a `/foo` runs a fixed prompt with no skill-load overhead. Use them for parametric, repeatable, or interactive workflows. (Skills load context for discoverable knowledge; commands just *do the thing*.) The only "legacy" part is the top-level `.claude/commands/` *layout* vs `skills/name/` — commands themselves are first-class.

A command is a `.md` file in `commands/`. The filename is the command name (`commands/deploy.md` → `/deploy`). Subdirs namespace it (`commands/git/sync.md` → `/git:sync`).

## Frontmatter

```yaml
---
description: Deploy the app to an environment      # shown in the / picker — keep it specific
argument-hint: <env> [--dry-run]                   # UX hint rendered after the command name
allowed-tools: Bash(git:*), Bash(npm:*), Read, Edit   # capability gate — see tool filters below
model: haiku                                        # haiku for mechanical; omit to inherit
disable-model-invocation: false                    # true = manual-only (Claude can't auto-invoke it)
---
```

| Field | Purpose |
|-------|---------|
| `description` | Discoverability in the `/` picker and for model-invocation. Required for the command to be useful. |
| `argument-hint` | Inline UX hint (`<env> [--flag]`). Not enforced — purely informational. |
| `allowed-tools` | Restricts what the command may do. Filters: `Bash(git:*)`, `Bash(npm:*)`, or bare tool names (`Read`, `Write`, `AskUserQuestion`). The security/capability gate. |
| `model` | `haiku` \| `sonnet` \| `opus` — pin a cheap/fast model for deterministic commands. Omit to inherit. |
| `disable-model-invocation` | `true` makes the command manual-only (a safety gate for destructive ops Claude shouldn't trigger on its own). |

## Arguments

| Token | Resolves to |
|-------|-------------|
| `$ARGUMENTS` | Everything the user typed after the command name (one string). |
| `$1`, `$2`, … | Positional args. `$1` = first word, `$2` = second, etc. |

```markdown
Deploy $1 to the $2 cluster. Remaining args: $ARGUMENTS
```

## Live context injection — `!` (bash) and `@` (files)

These make a command's prompt *dynamic* at invocation time — the cheapest way to give Claude exactly the context the task needs without a tool round-trip.

- **`!`​`command`​`​`** — runs the shell command and injects its stdout into the prompt. Requires the matching `Bash(...)` filter in `allowed-tools`.
- **`@path`** — inlines a file's contents. Supports dynamic paths: `@config/$1.json` pulls the file named by the first arg.

```markdown
---
description: Summarize what changed and propose a commit message
allowed-tools: Bash(git:*), Read
---
Current status:
!`git status --short`

Staged diff:
!`git diff --cached`

Project conventions: @CONTRIBUTING.md

Write a Conventional-Commits message for the staged changes.
```

`!` injection error-handling: a failing command still injects its (error) output, so guard with `|| true` or check inside the command when a non-zero exit shouldn't poison the prompt.

## Interactive commands — `AskUserQuestion`

When a command needs input it can't infer, declare `AskUserQuestion` in `allowed-tools` and ask. Supports single- and multi-select, conditional follow-ups, and validation loops.

```markdown
---
description: Scaffold a new service interactively
allowed-tools: AskUserQuestion, Write, Bash(mkdir:*)
---
Use AskUserQuestion:
- Question: "Which datastore?"  Header: "Datastore"  multiSelect: false
  Options: PostgreSQL (relational, ACID) · MongoDB (document) · Redis (in-memory cache)
- Then, based on the answer, ask the datastore-specific follow-ups (e.g. Postgres → "Managed or self-hosted?").

Generate the service scaffold + a matching config file from the collected answers.
```

Patterns worth knowing: **conditional flows** (branch follow-ups on prior answers), **iterative collection** (loop AskUserQuestion to gather N items, e.g. team members), **validation loops** (re-ask on invalid input), **dynamic options** (detect context first, then offer only the valid choices).

## Command vs skill — when to use which

| Use a **command** when… | Use a **skill** when… |
|---|---|
| The user will type `/x args` and wants it done now | The capability should trigger from natural language / be discoverable |
| It's parametric or interactive (args, AskUserQuestion) | It's a reusable knowledge module with references/scripts |
| You want minimal token overhead (fixed prompt, no skill load) | The task needs progressive disclosure of a lot of guidance |

They coexist — a plugin commonly ships both. Use `${CLAUDE_PLUGIN_ROOT}` for any bundled scripts a command calls.
