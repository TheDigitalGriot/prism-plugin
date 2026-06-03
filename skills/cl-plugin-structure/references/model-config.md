# Model Configuration (Claude Code, Current Model Line)

> Last updated June 2026. This is the Claude-Code-specific guidance that drifts fastest as new models ship. When in doubt, cross-check [docs.claude.com/en/docs/claude-code/model-config](https://docs.claude.com/en/docs/claude-code/model-config) and [docs.claude.com/en/docs/about-claude/models/overview](https://docs.claude.com/en/docs/about-claude/models/overview) — the model line moves quarterly.

---

## Table of Contents

1. [Current Model Line](#1-current-model-line)
2. [Aliases vs Pinned IDs — The Rule Changed at 4.6](#2-aliases-vs-pinned-ids--the-rule-changed-at-46)
3. [Per-Provider Alias Resolution](#3-per-provider-alias-resolution)
4. [Effort Levels — Per-Model Capability](#4-effort-levels--per-model-capability)
5. [`ultrathink` — One-Off Deep Reasoning](#5-ultrathink--one-off-deep-reasoning)
6. [1M-Token Context — `opus[1m]` and `sonnet[1m]`](#6-1m-token-context--opus1m-and-sonnet1m)
7. [Minimum Claude Code Versions](#7-minimum-claude-code-versions)
8. [Currency Check Protocol](#8-currency-check-protocol)

---

## 1. Current Model Line

As of **June 2026**:

| Model | Full Model ID | Alias | Pricing (in / out per MTok) | Context | Effort levels |
|---|---|---|---|---|---|
| **Opus 4.8** | `claude-opus-4-8` | `opus`, `best` | $5 / $25 | 1M | low, medium, high (default), xhigh, max |
| **Sonnet 4.6** | `claude-sonnet-4-6` | `sonnet` | $3 / $15 | 1M | low, medium, high (default), max |
| **Haiku 4.5** | `claude-haiku-4-5-20251001` | `haiku` (also `claude-haiku-4-5`) | $1 / $5 | 200K | none (no adaptive thinking) |

Opus 4.8 was released May 28, 2026 and is the current Anthropic API default for `opus`. It fixes the verbosity and tool-calling regressions found in Opus 4.7, and is the only model to complete every case on the Super-Agent benchmark end-to-end.

---

## 2. Aliases vs Pinned IDs — The Rule Changed at 4.6

| Before Claude 4.6 | From Claude 4.6 onward |
|---|---|
| Dateless IDs like `claude-opus-4-1` were **evergreen pointers** that resolved to a dated ID | Dateless IDs like `claude-opus-4-8` are **pinned snapshots** — the same string always refers to the same release |
| Aliases (`opus`, `sonnet`, `haiku`) rolled forward at each release | Aliases still roll forward — but the dateless IDs themselves are now also pinned |

**Practical impact:**

- Use `model: sonnet` / `model: opus` / `model: haiku` in agent/skill frontmatter when you want automatic updates to the latest model in that family.
- Use `model: claude-opus-4-8` (the dateless pinned form) when you want to lock to a specific version — useful for reproducible eval runs, marketplace plugin pins, or freezing critical-path agents.
- For Haiku, the date suffix is still meaningful: `claude-haiku-4-5` is the alias that resolves to the dated `claude-haiku-4-5-20251001`.

This change matters most for plugin authors. A plugin shipping `model: claude-opus-4-6` in 2025 used to drift forward automatically; today the same string is pinned to the 4.6 release. Update intentionally.

---

## 3. Per-Provider Alias Resolution

Aliases resolve differently per provider — the same `model: opus` runs a different model depending on where Claude Code is connecting:

| Provider | `opus` resolves to | `sonnet` resolves to |
|---|---|---|
| Anthropic API (direct) | Opus 4.8 | Sonnet 4.6 |
| Claude Platform on AWS | Opus 4.7 | Sonnet 4.6 |
| Bedrock / Vertex AI / Microsoft Foundry | Opus 4.6 | Sonnet 4.5 |

**If you ship plugins to third-party providers**, set the env vars rather than rely on alias resolution:

```bash
export ANTHROPIC_DEFAULT_OPUS_MODEL='claude-opus-4-8'
export ANTHROPIC_DEFAULT_SONNET_MODEL='claude-sonnet-4-6'
export ANTHROPIC_DEFAULT_HAIKU_MODEL='claude-haiku-4-5-20251001'
```

For Bedrock specifically, use the provider-prefixed form: `us.anthropic.claude-opus-4-8`.

---

## 4. Effort Levels — Per-Model Capability

The `effort` field in agent or skill frontmatter controls adaptive reasoning. Higher effort = deeper thinking = more tokens spent. Models 4.6+ use adaptive reasoning by default (no fixed thinking budget).

| Model | Supported effort levels |
|---|---|
| **Opus 4.8**, Opus 4.7 | `low`, `medium`, `high`, `xhigh`, `max` |
| Opus 4.6, Sonnet 4.6 | `low`, `medium`, `high`, `max` |
| Earlier / Haiku | typically none |

**Defaults:**

- Opus 4.8: `high`
- Opus 4.7: `xhigh`
- Opus 4.6 / Sonnet 4.6: `high`

If you set a level the active model doesn't support, Claude Code falls through to the highest supported level at or below it. Example: `xhigh` runs as `high` on Opus 4.6.

**Usage in plugin agent/skill frontmatter:**

```yaml
---
name: my-deep-reasoner
model: opus
effort: xhigh
---
```

**`max` caveat:** session-only. It can't be set persistently through `effortLevel` in settings, and applies to the current session only. Use for one-shot critical work, not as a default.

**`ultracode` (Claude Code only, not in agent frontmatter):** beyond effort levels. Sets `xhigh` per-message PLUS triggers an orchestrated dynamic workflow for substantive tasks. Set via `/effort` interactively or `"ultracode": true` in an Agent SDK control request. Session-only.

---

## 5. `ultrathink` — One-Off Deep Reasoning

Include the literal keyword `ultrathink` anywhere in a prompt, and Claude Code adds an in-context instruction for deeper reasoning on that single turn. Doesn't change session-level effort. Doesn't persist across messages.

Cheap pattern: weave `ultrathink` into the prompt body of specific skill files where one hard turn of reasoning matters more than steady-state effort:

```markdown
# In skill body:
For this brainstorm, ultrathink the problem space and surface assumptions
that aren't being questioned yet.
```

Other phrases (`think`, `think hard`, `think more`) are passed through as ordinary prompt text and are **not** recognized as keywords. Only `ultrathink` is the trigger.

---

## 6. 1M-Token Context — `opus[1m]` and `sonnet[1m]`

Opus 4.6+ and Sonnet 4.6 support a 1M-token context window. Append `[1m]` to the alias or pinned ID:

```yaml
model: opus[1m]
# or
model: claude-opus-4-8[1m]
# or for Sonnet:
model: sonnet[1m]
```

**When to reach for it:**

- Long autonomous runs that need to keep a large state file in context (autoresearch-style multi-cycle execution)
- Multi-document analysis where the docs themselves total 200K+ tokens
- Compaction-survival-sensitive workflows where holding the full history is safer than risking a summary

**Availability and cost:**

| Plan | Opus 1M | Sonnet 1M |
|---|---|---|
| Max / Team / Enterprise | Included | Requires usage credits |
| Pro | Requires usage credits | Requires usage credits |
| API / pay-as-you-go | Full access | Full access |

1M context uses standard model pricing — no premium per token beyond 200K. Disable globally with `CLAUDE_CODE_DISABLE_1M_CONTEXT=1`.

The `[1m]` suffix only applies when the underlying model supports it. Claude Code strips the suffix before sending the request to the provider.

---

## 7. Minimum Claude Code Versions

| Feature | Minimum Claude Code |
|---|---|
| Opus 4.8 access | v2.1.154 |
| `xhigh` effort level | v2.1.111 |
| `/model` saves default | v2.1.153 |
| Sonnet 4.6 1M context | latest stable |

Run `claude update` before relying on the newest model. If you're shipping a plugin that targets Opus 4.8 features, document the minimum version in your README.

---

## 8. Currency Check Protocol

When auditing a plugin against the current model line:

1. **Grep for pinned IDs** in runtime code:
   ```bash
   grep -rE 'claude-(opus|sonnet|haiku)-[0-9]' . --include='*.ts' --include='*.js' --include='*.json' --include='*.md'
   ```
2. **Check the alias defaults** by reading any provider-specific env-var pins (`ANTHROPIC_DEFAULT_*_MODEL`).
3. **Confirm current model line** against [docs.claude.com](https://docs.claude.com/en/docs/about-claude/models/overview) — don't trust this file's table alone; it ages.
4. **Verify Claude Code version** with `claude --version` if any agent uses `effort: xhigh` or `effort: max`.
5. **Skill/agent frontmatter using aliases** (`model: sonnet`) — usually fine, auto-updates. Skill/agent frontmatter using pinned IDs (`model: claude-opus-4-6`) — audit each one.

Historical pins in `.claude/shared/docs/` or `.prism/shared/research/` style notes are time capsules — leave them alone unless the user asks. Research docs date themselves intentionally.

---

## Cross-References

- [token-optimization-research.md](./token-optimization-research.md) — full theory for picking the lowest-effort model that does the job
- [folder-architecture-routing.md](./folder-architecture-routing.md) — cheap-context-first principle (Cliefnotes routing-table pattern)
- [component-patterns.md](./component-patterns.md) — agent / skill / command frontmatter rules
- [manifest-reference.md](./manifest-reference.md) — plugin.json and marketplace.json schema, including the dateless-snapshot rule for marketplace pins

---

*Source: [docs.claude.com — Models overview](https://docs.claude.com/en/docs/about-claude/models/overview) and [Claude Code model-config](https://code.claude.com/docs/en/model-config), retrieved 2026-06-03.*
