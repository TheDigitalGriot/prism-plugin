# Deep Integration: playwright-cli → Prism Claude Plugin

## Context

I want to deeply integrate Microsoft's `playwright-cli` into my Prism Claude Plugin so that my skills, commands, and agents can verify the UI and visual fidelity of whatever they are automated-coding. This should not be a shallow wrapper — I want playwright-cli to become a first-class capability within the Prism plugin ecosystem.

## Prerequisites — Read These First

Before writing any code or proposing any changes:

1. **Read the deep-integrate skill**: Load and follow `.claude/skills/deep-integrate/SKILL.md` — this defines the methodology we use for all integrations. Follow its 3-phase workflow (Discovery → Decomposition → Layered Implementation) exactly.

2. **Read the playwright-cli fork**: I have a fork/reference copy at `.prism/shared/ref/playwright-cli/` (or check `ref/playwright-cli/` if the migration hasn't happened yet). Read the full repo structure:
   - `README.md` — command reference and installation patterns
   - `.claude-plugin/` — their plugin manifest structure
   - `skills/playwright-cli/SKILL.md` — how they structured the skill definition
   - `playwright-cli.js` — the entry point architecture

3. **Read the Prism plugin architecture**: Analyze the full structure of the current Prism Claude Plugin:
   - `skills/prism/` — all skill definitions (commands, skills, agents)
   - `scripts/` — automation scripts
   - `.claude-plugin/` or plugin manifest
   - The stories system at `.prism/stories/stories.json`
   - The spectrum execution state at `.prism/shared/spectrum/`
   - Any existing commands, their YAML frontmatter patterns, trigger patterns

## Phase 1: Discovery (Do Not Skip)

Following the deep-integrate skill's discovery phase, produce an **Integration Manifest** that answers:

### Source Analysis (playwright-cli)
- What is the full command surface? (Core, Navigation, Keyboard, Mouse, Save-as, Tabs, DevTools, Sessions)
- How does their session isolation work? (`--session`, `PLAYWRIGHT_CLI_SESSION` env var, persistent profiles)
- How is their `.claude-plugin/` structured vs ours?
- How is their `SKILL.md` structured? What patterns can we adopt?
- What is the dependency chain? (`@playwright/mcp@latest` etc.)
- What are the headed vs headless modes and when would each matter for our use case?
- How does `snapshot` work for obtaining element refs vs `screenshot` for visual capture?

### Target Analysis (Prism Plugin)
- Map the current plugin architecture: skills, commands, agents, scripts, workflows
- What is the current skill trigger pattern convention?
- How do skills reference each other or compose?
- How does the stories/spectrum execution system work?
- What existing hooks or patterns exist for post-generation validation?
- Where would browser verification fit in the workflow lifecycle?

### Concept Mapping
Produce a table mapping playwright-cli concepts → Prism plugin equivalents:

| playwright-cli | Prism Plugin | Notes |
|---|---|---|
| Session | Story execution context | One browser session per story? |
| Snapshot | Verification checkpoint | After code generation step |
| Screenshot | Visual artifact | Stored alongside story state |
| Skills-less mode | Fallback / agent discovery | When skill not installed |
| `--headed` | Debug mode | For human review |
| Tab management | Multi-page verification | Testing navigation flows |
| Console/Network | Runtime diagnostics | Post-deploy validation |
| Tracing | Execution recording | Debug failed verifications |

Refine this mapping based on what you find in the actual code.

## Phase 2: Decomposition

Break the integration into vertical slices. Here is my initial thinking on what the slices might be, but refine based on your discovery:

### Slice 1: Foundation — Skill & Command Scaffolding
- Create the Prism skill definition for playwright-cli integration
- Create commands: `/prism-verify`, `/prism-screenshot`, `/prism-browse`
- Define the session lifecycle tied to story execution
- Ensure `@playwright/mcp` dependency is handled (install check, version pinning)

### Slice 2: Visual Verification Loop
- After an agent generates UI code → auto-spin up dev server → open in playwright → screenshot → feed back to agent context
- This is the core value prop: **agents that can see what they built**
- Define the verification result schema (pass/fail, screenshot path, assertions, diff)
- Store verification artifacts in `.prism/shared/spectrum/verifications/`

### Slice 3: Session Management Integration
- Map playwright sessions to Prism story sessions
- `PLAYWRIGHT_CLI_SESSION=story-{id}` pattern
- Session lifecycle: create on story start, persist across agent steps, cleanup on story complete
- Session list/stop/delete tied to story management

### Slice 4: Agent Capabilities
- Create an agent definition that can autonomously browse, verify, and report
- Agent can: navigate, snapshot, screenshot, assert element presence, check console for errors, capture network failures
- Agent reports back structured verification results, not just screenshots
- Integration with existing Prism agent patterns

### Slice 5: Advanced — Tracing, Network, Console
- Wire up `tracing-start`/`tracing-stop` for debugging failed verifications
- Console message capture for runtime error detection
- Network request monitoring for API validation
- PDF generation for verification reports

## Phase 3: Layered Implementation

For each slice above, follow the 6-layer approach from deep-integrate:

1. **Domain Model** — Types, interfaces, schemas for verification results, session state, visual assertions
2. **Events/Messages** — What triggers verification? What events flow between playwright and the story system?
3. **State Machine** — Verification states: idle → launching → browsing → capturing → comparing → reporting
4. **Logic/Event Handling** — The actual command handlers, session managers, artifact storage
5. **View/Rendering** — Skill markdown, command definitions, agent prompts, TUI dashboard integration
6. **Cross-Component Integration** — How verification plugs into the existing story workflow, how results appear in progress.md

**Critical constraint: Do NOT write Layer 5 or 6 before Layers 1-3 are defined and approved.**

## Deliverables

At the end of this integration, I expect:

1. **Integration Manifest** (Phase 1 output) — reviewed before proceeding
2. **Decomposition Plan** (Phase 2 output) — slice ordering, dependencies, sizing
3. **For each slice**: working implementation following the 6-layer order
4. **Updated README** reflecting new capabilities
5. **Updated stories.json** with integration stories if applicable
6. **Verification that the integration works** — use playwright-cli to verify itself (meta!)

## Important Notes

- Do NOT create a shallow wrapper that just shells out to playwright-cli commands. The integration should understand sessions, manage lifecycle, store artifacts in the right places, and compose with existing Prism workflows.
- Follow the spectral brand identity in any new UI elements (blue→teal→green→amber gradient)
- Any new documentation should be `.md` format
- Check if there are patterns from the playwright-cli `.claude-plugin/` that should be adopted into Prism's plugin manifest
- If the ref folder location has changed due to the namespace migration, search for it before assuming a path