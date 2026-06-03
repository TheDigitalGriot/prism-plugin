---
name: prism-dispatch
description: General-purpose parallel agent dispatch pattern. Use when facing 2+ independent problem domains that can be investigated or fixed concurrently without shared state. Triggers on "fan out", "parallel agents", "investigate in parallel", "multiple unrelated failures", "split this work across agents". Sibling to prism-research (fixed agent set) and prism-debug (fixed 3-agent flow) — use prism-dispatch for ad-hoc parallelism.
model: sonnet
---

# Prism Dispatch

Dispatch one agent per **independent** problem domain. Let them work concurrently. Integrate results.

## When To Use

```
Multiple problems?  ─yes→  Independent?  ─yes→  Parallelizable?  ─yes→  prism-dispatch
                                                                  ─no→   sequential dispatch
                              ─no, related→  single investigator (prism-debug or one agent)
                  ─no, one→   direct work (no dispatch)
```

**Use when:**
- 3+ test files failing with different root causes
- Multiple subsystems broken independently
- Investigating several files/components that have no shared state
- Final-pass review across disjoint code regions
- Parallel verification of independent acceptance criteria

**Don't use when:**
- Failures are related (fixing one might fix others — investigate together first)
- Agents would touch the same files (write conflicts)
- You don't yet know what's broken (exploratory — use a single investigator)
- Tasks have ordering dependencies

## Sibling Skills (don't reinvent)

| Pattern | Skill | Why it's separate |
|---|---|---|
| Codebase research fan-out | [prism-research](../prism-research/SKILL.md) | Fixed agent roster (locator, analyzer, pattern-finder, web-search, graph-navigator) |
| Bug investigation 3-flow | [prism-debug](../prism-debug/SKILL.md) | Fixed agents: log-investigator, state-investigator, git-investigator |
| Plan execution per task | [prism-subagent](../prism-subagent/SKILL.md) | Sequential implementer, never parallel (write conflicts) |
| **Ad-hoc parallel dispatch** | **prism-dispatch** ← here | No fixed roster — caller decides |

## The Pattern

### 1. Identify Independent Domains

Group the work by what's broken or being investigated. Each domain must satisfy:
- **No shared file paths** between domains (or read-only on shared files)
- **No execution-order dependencies** (Domain B doesn't need Domain A's output)
- **Self-contained context** (can be understood without seeing other domains)

If two "domains" share state, merge them. Better one focused agent than two thrashing agents.

### 2. Construct Focused Prompts

Each agent gets:

```
## Scope
{ONE specific file, subsystem, or problem}

## Context
{Self-contained background — error messages, prior findings, file paths}

## Goal
{Concrete outcome: "make these tests pass" / "explain how X works" / "identify root cause of Y"}

## Constraints
{What NOT to touch. Other domains' files. Production code if investigating. etc.}

## Expected Output
{Specific format. Summary structure. What you need back to integrate.}
```

The critical fields are **scope** (narrow!) and **constraints** (explicit don't-touch list). Without these, agents drift.

### 3. Dispatch In Parallel

**Use a single message with multiple Task tool calls.** Sequential dispatches block on each other; parallel dispatches actually run concurrently.

```
[Single message containing:]
  Task(subagent_type="...", description="Domain A", prompt="...")
  Task(subagent_type="...", description="Domain B", prompt="...")
  Task(subagent_type="...", description="Domain C", prompt="...")
```

**Do not** dispatch one agent, wait for it, dispatch the next. That's sequential — you've lost the entire benefit.

### 4. Integrate Results

When all agents return:

1. **Read every summary.** No skimming.
2. **Check for conflicts.** Did any two agents touch the same file? If yes, audit the merged result.
3. **Verify the integration as a whole.** Run the full test suite or equivalent — agents pass individually but might fail together.
4. **Spot-check.** Agents can make systematic errors. Pick one finding from each agent and verify it independently.

## Choosing Models Per Agent

Match model to task complexity, not to "all the same for fairness":

| Task type | Model |
|---|---|
| Locate files / grep / list usages | haiku |
| Read and explain a single file | haiku |
| Trace data flow across 2-3 files | sonnet |
| Identify root cause of subtle bug | sonnet |
| Architecture analysis or design review | opus |
| Pure pattern matching ("find similar") | haiku |

A 3-agent fan-out where one needs opus and two need haiku is normal. Do not over-pay for the easy ones.

## Common Mistakes

| ❌ | ✅ |
|---|---|
| "Investigate everything" | One file or one subsystem per agent |
| No constraints — agents refactor freely | "Do NOT modify files outside {list}" |
| Vague output ("fix it") | "Return summary of root cause + diff of changes" |
| Sequential dispatch in separate messages | Single message, parallel Task calls |
| Mixing related and unrelated failures | Investigate related ones together first |
| All agents on opus by default | Match model to task — most fan-out is haiku |
| Forgetting to integrate results | Run full verification across the merged state |

## Anti-Pattern: The Fan-Out Stampede

The temptation: "I'll dispatch 8 agents in parallel to maximize speed." The reality:
- 8 contexts to integrate is a lot of cognitive load
- Conflicts compound non-linearly
- One bad agent contaminates everything
- You lose track of which fix came from where

**Cap fan-outs at 5 agents per dispatch.** If you have more than 5 independent domains, dispatch in waves of 4-5 with integration between waves. Slower wall-clock, dramatically higher quality.

## Anti-Pattern: Hidden Sequential Dependencies

You think domains are independent. They aren't — Agent B's fix relies on a file Agent A is rewriting. The agents finish, you integrate, the result is broken in ways that are hard to debug because nobody owned the merged state.

**Defense:** Before dispatching, list every file each agent will touch. If any file appears twice, merge the agents.

## Integration With Other Skills

- **From [prism-debug](../prism-debug/SKILL.md):** Already does parallel dispatch internally with a fixed 3-agent set. Use prism-dispatch when you need a different agent mix.
- **From [prism-subagent](../prism-subagent/SKILL.md):** The final-pass reviewer can be parallelized when the cumulative diff splits cleanly across files. Dispatch one quality-reviewer per file group.
- **From [prism-research](../prism-research/SKILL.md):** Already parallel by default with the standard agent roster. Use prism-dispatch when researching multiple unrelated topics in one pass.

## Real-World Example

**Scenario:** 6 test failures across 3 unrelated files after a refactoring pass.

**Decision:** Independent — abort logic, batch completion, and race conditions are different subsystems.

**Dispatch (single message):**
```
Task(description="Fix abort tests", subagent_type="general-purpose",
     prompt="Fix failing tests in src/agents/agent-tool-abort.test.ts. ...")
Task(description="Fix batch tests", subagent_type="general-purpose",
     prompt="Fix failing tests in src/agents/batch-completion.test.ts. ...")
Task(description="Fix race tests", subagent_type="general-purpose",
     prompt="Fix failing tests in src/agents/tool-approval-races.test.ts. ...")
```

**Integration:**
1. Read all 3 summaries
2. Confirm no shared files modified
3. Run full test suite — verify all 6 originally failing tests now pass AND no new failures
4. Spot check one fix from each agent

**Time saved:** 3 problems solved in time of ~1.

## Iron Laws

```
ONE DOMAIN PER AGENT. NEVER MIX UNRELATED PROBLEMS IN ONE PROMPT.
PARALLEL DISPATCH = SINGLE MESSAGE, MULTIPLE TASK CALLS.
FILE OVERLAP BETWEEN AGENTS = MERGE THE AGENTS.
CAP FAN-OUTS AT 5. WAVES IF YOU HAVE MORE.
ALWAYS RUN FULL VERIFICATION AFTER INTEGRATION.
```
