---
name: prism-prd
description: Generate and refine Product Requirements Documents as part of the prism workflow. Use when starting a new product, defining project scope, or needing formal requirements documentation before research/planning phases. Triggers on "create a PRD", "write product requirements", "document this product", "define the product spec", or when users describe a product idea that needs formal documentation.
model: opus
---

# Prism PRD

Orchestrate PRD generation within the prism workflow. This skill integrates the `/generate_prd` command with workflow context, proper file placement, and next-step guidance.

## Integration with Prism Workflow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  prism-prd  │────▶│   research  │────▶│    plan     │
│  (You Are   │     │  (Explore   │     │  (Create    │
│   Here)     │     │   codebase) │     │   impl plan)│
└─────────────┘     └─────────────┘     └─────────────┘
```

The PRD becomes the foundation for:
- **Research Phase**: Understanding what exists vs what's needed
- **Plan Phase**: Breaking down features into implementation steps
- **Validate Phase**: Success criteria verification

## Workflow

### Step 1: Check for Existing Context

Before starting, check if there's existing research or documentation:

```
Task(subagent_type="thoughts-locator")
"Find existing research or documentation about [topic]"
```

If found, incorporate insights into the PRD.

### Step 2: Invoke the Generate PRD Command

Use the `/generate_prd` command to create the document:

```
/generate_prd [context or file reference]
```

The command handles:
- Clarifying questions (problem, users, value proposition)
- Market research (if web search available)
- Document generation with full template
- Quality checklist verification

### Step 3: Save to Thoughts Directory

After generation, save the PRD to the proper location:

```
thoughts/shared/plans/[DATE]-[PRODUCT-NAME]-PRD.md
```

Example: `thoughts/shared/plans/2025-02-04-acme-app-PRD.md`

### Step 4: Offer Companion Documents

After the PRD is complete, offer to generate companion documents:

```
PRD saved to thoughts/shared/plans/[filename]

Would you like me to generate companion documents?

1. `/generate_user_flows` — UX flows and wireframes
2. `/generate_tech_spec` — Technical specification
3. `/generate_pricing` — Pricing proposal (if client-facing)

Or continue to the next workflow phase:

4. `/prism-research` — Explore codebase for existing patterns
5. `/prism-plan` — Create implementation plan from this PRD
```

### Step 5: Track with TodoWrite

Add PRD-related items to the todo list for tracking:

```
- [ ] PRD: Define problem statement
- [ ] PRD: Identify target users
- [ ] PRD: List key features with priorities
- [ ] PRD: Document technical requirements
- [ ] PRD: Identify risks and mitigations
```

## When to Use This Skill vs the Command

| Use `prism-prd` (this skill) when: | Use `/generate_prd` command when: |
|-----------------------------------|-----------------------------------|
| Starting a new product in prism workflow | Quick standalone PRD generation |
| Need workflow integration & next steps | Already know where to save output |
| Want companion document suggestions | Just need the document template |
| Building on existing research | No existing context to incorporate |

## Depth Calibration

Guide the `/generate_prd` command with depth preference:

- **Lightweight (startup/MVP):** "Generate a lightweight PRD focusing on core sections"
- **Standard (most projects):** "Generate a standard PRD with all sections"
- **Enterprise (large org):** "Generate a comprehensive enterprise PRD with exhaustive detail"

## Quality Gates

Before marking the PRD complete, ensure:

- [ ] Problem statement is clear and specific
- [ ] Target user is well-defined
- [ ] Features map to user needs
- [ ] Technical approach is feasible
- [ ] Scope is realistic for timeline
- [ ] Success metrics are measurable
- [ ] Risks are identified with mitigations
- [ ] Open questions are documented
