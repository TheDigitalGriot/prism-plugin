---
name: prism-visual-docs
description: Generate visual documentation including user flows, wireframes, screen inventories, and UX specifications as part of the prism workflow. Use when designing user experiences, mapping user journeys, creating wireframes, or documenting interaction patterns. Triggers on "create user flows", "design the screens", "map user journeys", "create wireframes", "document the UX", or when visual/interaction design documentation is needed.
model: opus
---

# Prism Visual Docs

Orchestrate visual documentation generation within the prism workflow. This skill integrates the `/generate_user_flows` command with workflow context, proper file placement, and next-step guidance.

## Integration with Prism Workflow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  prism-prd  │────▶│ visual-docs │────▶│    plan     │
│  (Product   │     │  (You Are   │     │  (Impl      │
│   Reqs)     │     │   Here)     │     │   Steps)    │
└─────────────┘     └─────────────┘     └─────────────┘
```

Visual docs inform:
- **Plan Phase**: UI implementation steps and component breakdown
- **Implement Phase**: Screen-by-screen development guidance
- **Validate Phase**: Visual verification criteria

## Workflow

### Step 1: Locate the PRD

First, find the relevant PRD to base visual docs on:

```
Task(subagent_type="thoughts-locator")
"Find the PRD or product requirements for [product name]"
```

Read the PRD FULLY before proceeding.

### Step 2: Invoke the Generate User Flows Command

Use the `/generate_user_flows` command to create the document:

```
/generate_user_flows thoughts/shared/plans/[PRD-file].md
```

The command handles:
- Clarifying questions (user types, primary tasks, design preferences)
- User persona creation
- Flow diagram generation (ASCII)
- Wireframe creation
- Component library documentation
- Responsive design specifications

### Step 3: Optionally Add Technical Spec

If technical documentation is also needed, invoke:

```
/generate_tech_spec thoughts/shared/plans/[PRD-file].md
```

This creates companion technical documentation covering:
- System architecture
- API contracts
- Data models
- Business logic

### Step 4: Save to Thoughts Directory

Save visual documentation to the proper location:

```
thoughts/shared/plans/[DATE]-[PRODUCT-NAME]-USER-FLOWS.md
thoughts/shared/plans/[DATE]-[PRODUCT-NAME]-TECHNICAL-SPEC.md
```

### Step 5: Offer Next Steps

After visual docs are complete:

```
Visual documentation saved to thoughts/shared/plans/[filename]

Related documents:
- PRD: thoughts/shared/plans/[prd-file].md
- Tech Spec: [if generated]

Next steps in the prism workflow:

1. `/prism-plan` — Create implementation plan using these screens
2. `/prism-implement` — Begin building with wireframes as reference
3. `/generate_pricing` — Create pricing proposal (if client-facing)
```

### Step 6: Track with TodoWrite

Add visual doc items to the todo list:

```
- [ ] Visual: Define user personas
- [ ] Visual: Map primary user flows
- [ ] Visual: Create screen inventory
- [ ] Visual: Design key wireframes
- [ ] Visual: Document component library
- [ ] Visual: Specify responsive breakpoints
```

## When to Use This Skill vs the Commands

| Use `prism-visual-docs` (this skill) when: | Use commands directly when: |
|-------------------------------------------|----------------------------|
| Part of prism workflow with PRD | Quick standalone generation |
| Need both user flows AND tech spec | Only need one document type |
| Want workflow integration & tracking | Already know output location |
| Building on existing PRD | No PRD exists yet |

## Available Commands

This skill orchestrates these commands:

| Command | Purpose |
|---------|---------|
| `/generate_user_flows` | User flows, wireframes, UX specs |
| `/generate_tech_spec` | Architecture, APIs, data models |

## Depth Calibration

Guide the commands with depth preference:

- **Low-fidelity (MVP):** "Generate low-fidelity wireframes, focus on key flows only"
- **Medium-fidelity (standard):** "Generate medium-fidelity with all screens and states"
- **High-fidelity (detailed):** "Generate high-fidelity with spacing, variants, all interactions"

## Quality Gates

Before marking visual docs complete, ensure:

- [ ] All user personas defined
- [ ] Primary user flows documented (5-10 flows)
- [ ] Screen inventory complete with priorities
- [ ] Key screens have wireframes
- [ ] Component library documented
- [ ] Responsive breakpoints specified
- [ ] Accessibility requirements noted
- [ ] States covered (empty, loading, error, success)
