# Layer 3: App Integration Updates — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update prism-cli Go TUI to handle new v3.0.1 signal types and display new skills in the UI.

**Architecture:** Add `SignalNeedsContext` to the signal enum, add regex parsing for `<spectrum-needs-context>`, handle it in the Spectrum plugin's signal handler, and update the hardcoded skill list in the files plugin.

**Tech Stack:** Go 1.22, Bubble Tea TUI framework.

**Scope:** Only `apps/prism-cli/` needs changes. VSCode and Electron apps have no hardcoded plugin references.

---

## File Structure

| Action | Path | What Changes |
|--------|------|-------------|
| Modify | `apps/prism-cli/domain/signals.go` | Add SignalNeedsContext + SignalConcerns types, regex, String() |
| Modify | `apps/prism-cli/app/plugin_spectrum.go` | Add handleSignal case for new types |
| Modify | `apps/prism-cli/app/plugin_files.go` | Add 3 new skills to README table |

---

### Task 1: Add New Signal Types to Domain

**Files:**
- Modify: `apps/prism-cli/domain/signals.go`

- [ ] **Step 1: Read the current signals.go to understand the exact enum and regex patterns**

Read `apps/prism-cli/domain/signals.go` completely.

- [ ] **Step 2: Add SignalNeedsContext to the SignalType enum**

Find the `const` block with `SignalComplete`, `SignalContinue`, `SignalRetry`, `SignalBlocked`, `SignalError`. Add after `SignalError`:

```go
	SignalNeedsContext
```

- [ ] **Step 3: Add regex for the new signal tag**

Find the `var` block with the regex patterns (e.g., `reComplete`, `reContinue`, etc.). Add:

```go
	reNeedsContext = regexp.MustCompile(`<spectrum-needs-context>`)
	reConcerns     = regexp.MustCompile(`<concerns>([\s\S]*?)</concerns>`)
```

- [ ] **Step 4: Add String() case for SignalNeedsContext**

Find the `String()` method's switch statement. Add:

```go
	case SignalNeedsContext:
		return "needs-context"
```

- [ ] **Step 5: Add parsing logic in the Parse/Extract function**

Find the function that checks output against regexes (likely `ParseSignal` or `ExtractSignal`). Add a check for `reNeedsContext` — it should return `SignalNeedsContext` with the extracted content. Place it AFTER the `reBlocked` check and BEFORE the default/fallthrough.

Also add: if `reContinue` matches AND `reConcerns` matches, extract the concerns text and include it in the signal result (e.g., as a `Details` or `Reason` field).

- [ ] **Step 6: Verify Go builds**

Run: `cd apps/prism-cli && go build ./...`
Expected: No errors

- [ ] **Step 7: Run existing signal tests**

Run: `cd apps/prism-cli && go test ./domain/ -v -run Signal 2>&1 | tail -20`
Expected: Existing tests pass

- [ ] **Step 8: Commit**

```bash
git add apps/prism-cli/domain/signals.go
git commit -m "feat(prism-cli): add SignalNeedsContext type and concerns parsing to signal domain"
```

---

### Task 2: Handle New Signals in Spectrum Plugin

**Files:**
- Modify: `apps/prism-cli/app/plugin_spectrum.go`

- [ ] **Step 1: Read the handleSignal function**

Read `apps/prism-cli/app/plugin_spectrum.go` and find the `handleSignal()` function (around line 818).

- [ ] **Step 2: Add case for SignalNeedsContext**

In the switch statement inside `handleSignal()`, add a new case. Model it after the existing `SignalBlocked` case but with appropriate messaging:

```go
	case domain.SignalNeedsContext:
		// Story needs additional context — pause and show warning
		p.status = "needs-context"
		p.addLog("⚠️ Story needs additional context")
		if signal.Reason != "" {
			p.addLog("  Questions: " + signal.Reason)
		}
		// Treat like blocked — move to next available story
```

Adapt variable names and method calls to match the existing code patterns. Read the SignalBlocked case first and follow its pattern.

- [ ] **Step 3: Verify Go builds**

Run: `cd apps/prism-cli && go build ./...`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add apps/prism-cli/app/plugin_spectrum.go
git commit -m "feat(prism-cli): handle SignalNeedsContext in Spectrum TUI plugin"
```

---

### Task 3: Update Skills List in Files Plugin

**Files:**
- Modify: `apps/prism-cli/app/plugin_files.go`

- [ ] **Step 1: Read the README table section**

Read `apps/prism-cli/app/plugin_files.go` around line 1360 to find the hardcoded skill/command table.

- [ ] **Step 2: Add the 3 new skills**

Find the table entries and add after the existing skills:

```go
		{Name: "/prism-brainstorm", Desc: "Interactive design brainstorming with visual companion"},
		{Name: "/prism-design", Desc: "Design phase — architectural decisions before planning"},
		{Name: "/prism-finish", Desc: "Branch completion — merge, PR, keep, or discard"},
```

Adapt the exact struct field names to match the existing entries.

- [ ] **Step 3: Verify Go builds**

Run: `cd apps/prism-cli && go build ./...`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add apps/prism-cli/app/plugin_files.go
git commit -m "feat(prism-cli): add prism-brainstorm, prism-design, prism-finish to TUI skill list"
```

---

## Success Criteria

### Automated Verification
- [ ] `cd apps/prism-cli && go build ./...` — builds successfully
- [ ] `cd apps/prism-cli && go test ./domain/ -v -run Signal` — signal tests pass
- [ ] `grep "NeedsContext" apps/prism-cli/domain/signals.go` — new signal type exists
- [ ] `grep "needs-context" apps/prism-cli/app/plugin_spectrum.go` — handler exists
- [ ] `grep "prism-brainstorm" apps/prism-cli/app/plugin_files.go` — new skills listed

### Manual Verification
- [ ] Run `apps/prism-cli` TUI and verify the Spectrum screen doesn't crash with new signal types
- [ ] The Files screen README shows all skills including the 3 new ones
