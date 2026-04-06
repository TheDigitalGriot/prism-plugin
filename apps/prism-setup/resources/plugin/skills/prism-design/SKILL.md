---
name: prism-design
description: Design phase between research and planning. Creates design documents with architectural decisions, interface definitions, and visual documentation. Triggers on "design this", "create a design", "design the architecture", or after research completes when design decisions are needed.
model: opus
---

# Prism Design Phase

Create design documents that bridge research findings and implementation planning. This phase produces the architectural decisions, interface contracts, and visual documentation that the planning phase turns into actionable tasks.

## When to Use

Use this phase when:
- Research has identified multiple viable approaches that need a decision
- The feature involves user-facing design (layouts, interactions, flows)
- Cross-cutting concerns need architectural decisions before planning
- The user explicitly asks to "design" something

Skip this phase when:
- The implementation approach is obvious from research
- The feature is purely backend with no design decisions
- The user wants to go straight to planning

## Workflow

### 1. Load Context

1. Read the most recent research in `.prism/shared/research/`
2. If a PRD exists, read it from `.prism/shared/plans/`
3. Summarize what the research found and present to user

### 2. Identify Design Decisions

List the decisions that need to be made before planning:
- Architecture approach (which pattern? which library?)
- Data model design (what entities? what relationships?)
- Interface contracts (what APIs? what props?)
- Visual design (what layout? what UX flow?)

### 3. Brainstorm Options

For each decision, use `/prism-brainstorm` to explore options interactively. This may include the visual companion for UI-related decisions.

### 4. Generate Visual Documentation (Optional)

If the design involves user-facing features, invoke `/generate_user_flows` for:
- User personas and journey maps
- Screen inventory with wireframes
- Component library
- Interaction patterns

### 5. Write Design Document

Save to `.prism/shared/plans/YYYY-MM-DD-<topic>-design.md` with:
- Problem statement and goals
- Chosen approach with rationale
- Alternatives considered
- Technical architecture
- Interface contracts
- Visual documentation (if applicable)
- Success criteria

### 6. Transition to Planning

After design approval, offer:
- `/prism-plan` — Create implementation plan from the design document

## Integration

```
prism-research → prism-design → prism-plan → prism-implement → prism-validate
                  ↑ YOU ARE HERE
```

- **Input:** Research document from `.prism/shared/research/`
- **Output:** Design document in `.prism/shared/plans/`
- **Next:** `/prism-plan` uses the design document as primary input

## Rules

1. **Decisions, not implementation** — This phase produces decisions, not code
2. **User approval required** — Every major decision needs explicit user buy-in
3. **Visual when visual** — Use brainstorm visual companion for UI decisions
4. **Document everything** — Design documents are the contract for planning
