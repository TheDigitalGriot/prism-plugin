---
description: Generate professional MVP pricing proposals with delivery roadmaps and Gantt charts
model: opus
---

# Generate Pricing

Generate professional pricing proposals with cost breakdowns, delivery timelines, Gantt charts, milestone-based payment schedules, and scope documentation.

## Initial Response

When this command is invoked:

1. **Check if parameters were provided**:
   - If a PRD or requirements file was provided, read it FULLY
   - Begin analyzing scope for estimation

2. **If no parameters provided**, respond with:
```
I'll help you create a professional pricing proposal.

Please provide:
1. The PRD or feature list (or describe the project scope)
2. Budget range (if known)
3. Desired timeline
4. Currency preference (CAD/USD/etc.)

Tip: You can invoke with a PRD: `/generate_pricing thoughts/shared/plans/MY-PRODUCT-PRD.md`
```

Then wait for user input.

## Workflow

1. **Understand Scope** — Review PRD/requirements or gather feature list
2. **Estimate Effort** — Break down into modules with hour estimates
3. **Determine Rate** — Apply hourly/daily rates based on market and complexity
4. **Build Timeline** — Create realistic delivery schedule
5. **Structure Payments** — Align milestones with deliverables
6. **Generate Document** — Create client-ready proposal

## Clarifying Questions

Before generating, understand:

- What's the budget range (if known)?
- What's the desired timeline?
- Team size/composition preferences?
- Fixed price or time & materials?
- Currency preference?
- Any must-have vs nice-to-have features?
- Risk tolerance (aggressive vs conservative estimates)?

## Estimation Guidelines

### T-Shirt Sizing to Hours

| Size | Hours | Description |
|------|-------|-------------|
| XS | 2-4 | Simple task, well-defined |
| S | 4-8 | Straightforward feature |
| M | 8-16 | Moderate complexity |
| L | 16-32 | Complex feature, unknowns |
| XL | 32-60 | Major feature, high complexity |
| XXL | 60+ | Epic, should be broken down |

### Complexity Multipliers

| Factor | Multiplier | When to Apply |
|--------|------------|---------------|
| First-time tech | 1.3x | New framework/language |
| Integration | 1.2x | Third-party APIs |
| Compliance | 1.4x | HIPAA, SOC2, etc. |
| Legacy system | 1.5x | Working with old code |
| Unclear requirements | 1.3x | Vague scope |

### Rate Guidelines (2025 CAD)

| Role | Junior | Mid | Senior | Lead |
|------|--------|-----|--------|------|
| Developer | $60-80 | $85-110 | $120-150 | $150-200 |
| Designer | $50-70 | $75-100 | $110-140 | $140-175 |
| PM | $60-80 | $85-110 | $120-150 | $150-180 |
| QA | $45-60 | $65-85 | $90-120 | $120-150 |

**AI-Assisted Development:** Reduce estimates by 20-40% for capable teams using AI tooling.

## Output Template

```markdown
# [Project Name] — Pricing & Delivery Schedule

**Version:** 1.0
**Date:** [Current Date]
**Currency:** [CAD/USD/etc.]

---

## 1. Executive Summary

| Item | Details |
|------|---------|
| **Project** | [Project Name] — [Brief description] |
| **Duration** | [X weeks/months] |
| **Total Investment** | **$[Amount]** |

### What's Included
✅ [Feature 1]
✅ [Feature 2]

### What's Excluded (Future Phases)
❌ [Feature A]
❌ [Feature B]

---

## 2. Scope & Deliverables

### Module Breakdown

| Module | Features | Hours |
|--------|----------|-------|
| **[Module 1]** | [Details] | [X] |
| **Testing & QA** | Unit tests, UAT | [X] |
| **Deployment** | Production setup | [X] |
| **Total** | | **[X]** |

---

## 3. Pricing

### Development Cost

| Item | Hours | Rate | Cost |
|------|-------|------|------|
| Development | [X] | $[Y]/hr | $[Z] |
| Design | [X] | $[Y]/hr | $[Z] |
| **Total** | **[X]** | | **$[Amount]** |

### Third-Party Costs (Monthly)

| Service | Monthly | Notes |
|---------|---------|-------|
| [Service] | $[X] | [Notes] |

---

## 4. Delivery Schedule

### Gantt Chart

```
         [MONTH 1]        [MONTH 2]        [MONTH 3]
Week   1  2  3  4  │  5  6  7  8  │  9 10 11 12
       │  │  │  │  │  │  │  │  │  │  │  │  │
SETUP  ████████
[FEAT1]     ████████████████
[FEAT2]               ████████████████
TESTING                         ████████████████
DEPLOY                                    ████████
       ▲        ▲              ▲            ▲
    Kickoff    M1            M2         Launch

LEGEND:
████ = Active development
▲    = Milestone / Payment Point
```

---

## 5. Payment Schedule

| Milestone | Week | Deliverable | Amount | % |
|-----------|------|-------------|--------|---|
| **Kickoff** | 0 | Contract signed | $[X] | [Y]% |
| **M1** | [X] | [Deliverable] | $[X] | [Y]% |
| **Launch** | [X] | Production | $[X] | [Y]% |
| **Total** | | | **$[Total]** | 100% |

---

## 6. Deliverables

1. **Production Application** — Deployed, SSL configured
2. **Source Code** — Full repository access
3. **Documentation** — Setup guide, API docs

### Post-Launch Support
- **[X] days** bug fixes included
- Additional support: $[X]/hr

---

## 7. Assumptions & Exclusions

### Assumptions
1. Client provides feedback within [X] days
2. [Technical assumption]

### Exclusions
| Exclusion | Notes |
|-----------|-------|
| [Item] | [Can be added for $X] |

---

## 8. Terms

- Start date: Upon contract + first payment
- Timeline: [X] weeks from start
- IP transfers on final payment

---

## Summary

| Item | Value |
|------|-------|
| **Timeline** | [X weeks] |
| **Total Price** | **$[Amount]** |
| **Deliverables** | App, source, docs |

*Quote valid for [X] days*
```

## File Output

Save as: `[PROJECT-NAME]-PRICING.md`
