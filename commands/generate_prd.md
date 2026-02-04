---
description: Generate comprehensive Product Requirements Documents (PRDs) for software projects
model: opus
---

# Generate PRD

Generate professional Product Requirements Documents following a proven structure that covers vision, market analysis, features, technical architecture, and go-to-market strategy.

## Initial Response

When this command is invoked:

1. **Check if parameters were provided**:
   - If a product description or file path was provided, begin gathering context immediately
   - Read any provided files FULLY

2. **If no parameters provided**, respond with:
```
I'll help you create a comprehensive Product Requirements Document.

Please provide:
1. What problem does this product solve?
2. Who is the target user/customer?
3. What's the core value proposition?

Or provide an existing document/description I can work from.

Tip: You can invoke with context: `/generate_prd thoughts/shared/research/my-product.md`
```

Then wait for user input.

## Workflow

1. **Gather Context** — Ask clarifying questions about the product vision, target users, and core problem being solved
2. **Research** — If web search is available, research competitors, market size, and existing solutions
3. **Structure** — Follow the output template below
4. **Generate** — Create the full PRD document
5. **Review** — Offer to expand any section or adjust based on feedback

## Clarifying Questions

Before generating, gather essential context (skip questions already answered):

- What problem does this product solve?
- Who is the target user/customer?
- What's the core value proposition?
- Are there existing competitors? (research if not provided)
- What's the intended business model?
- Any technical constraints or preferences?
- Timeline expectations?

Limit to 3-5 questions max per exchange.

## Output Template

Generate a Markdown document with these sections:

```markdown
# [Product Name] — Product Requirements Document

**Version:** 1.0
**Date:** [Current Date]
**Status:** Draft

---

## 1. Executive Summary

### 1.1 Vision Statement
[One paragraph describing the product vision and why it matters]

### 1.2 Problem Statement
[Clear articulation of the problem being solved]

### 1.3 Proposed Solution
[High-level description of the solution]

### 1.4 Success Metrics
[3-5 measurable KPIs for success]

---

## 2. Market Analysis

### 2.1 Target Market
[Market size, segments, TAM/SAM/SOM if applicable]

### 2.2 Target Users
[User personas with demographics, needs, pain points]

### 2.3 Competitive Landscape
| Competitor | Strengths | Weaknesses | Differentiator |
|------------|-----------|------------|----------------|
| [Name] | [List] | [List] | [How we differ] |

### 2.4 Market Opportunity
[Why now? What trends support this product?]

---

## 3. Product Overview

### 3.1 Core Value Proposition
[Single clear statement of value]

### 3.2 Key Features
| Feature | Description | Priority | Phase |
|---------|-------------|----------|-------|
| [Name] | [Description] | P0/P1/P2 | MVP/V2/V3 |

### 3.3 User Stories
**As a [user type], I want to [action] so that [benefit].**

### 3.4 Out of Scope
[Explicitly list what is NOT included]

---

## 4. Functional Requirements

### 4.1 [Feature Category]
- **Description:** [What it does]
- **User Flow:** [Step-by-step interaction]
- **Acceptance Criteria:**
  - [ ] Criterion 1
  - [ ] Criterion 2
- **Edge Cases:** [List edge cases to handle]

---

## 5. Non-Functional Requirements

### 5.1 Performance
- Response time: [target]
- Availability: [target, e.g., 99.9%]

### 5.2 Security
- Authentication: [method]
- Data protection: [encryption, compliance]

### 5.3 Compliance
[Regulatory requirements: GDPR, HIPAA, SOC 2, etc.]

---

## 6. Technical Architecture

### 6.1 Technology Stack
| Layer | Technology | Rationale |
|-------|------------|-----------|
| Frontend | [Tech] | [Why] |
| Backend | [Tech] | [Why] |
| Database | [Tech] | [Why] |

### 6.2 Integrations
[Third-party services, APIs, external systems]

---

## 7. Roadmap

### Phase 1: MVP
- [Feature list]

### Phase 2: [Name]
- [Feature list]

---

## 8. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| [Risk] | High/Med/Low | High/Med/Low | [Strategy] |

---

## 9. Open Questions

- [ ] [Question requiring decision]
- [ ] [Question requiring research]
```

## Section Guidelines

### Depth Calibration

**Lightweight PRD (startup/MVP):** 5-10 pages, focus on Sections 1, 3, 4, 6
**Standard PRD (most projects):** 15-25 pages, all sections at moderate depth
**Enterprise PRD (large org):** 30+ pages, exhaustive detail

## File Output

Save the PRD as: `[PRODUCT-NAME]-PRD.md`
