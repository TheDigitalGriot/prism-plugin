---
description: Generate comprehensive Technical Specifications with API contracts, data models, and implementation details
model: opus
---

# Generate Technical Spec

Generate detailed Technical Specifications covering architecture decisions, API contracts, data models, business logic, validation rules, and implementation guidance.

## Initial Response

When this command is invoked:

1. **Check if parameters were provided**:
   - If a PRD or requirements file was provided, read it FULLY
   - Begin analyzing the technical requirements

2. **If no parameters provided**, respond with:
```
I'll help you create a comprehensive Technical Specification.

Please provide:
1. The PRD or requirements document (or describe the system)
2. Technology stack preferences (or I'll recommend based on requirements)
3. Any existing systems to integrate with

Tip: You can invoke with a PRD: `/generate_tech_spec thoughts/shared/plans/MY-PRODUCT-PRD.md`
```

Then wait for user input.

## Workflow

1. **Review Context** — Examine PRD, user flows, or gather requirements
2. **Identify Scope** — Determine which technical areas need specification
3. **Design Architecture** — Define system components and interactions
4. **Specify Details** — Document APIs, data models, algorithms
5. **Add Constraints** — Validation, error handling, edge cases
6. **Generate Document** — Create comprehensive technical spec

## Clarifying Questions

Before generating, understand:

- What's the technology stack (or preferences)?
- Are there existing systems to integrate with?
- What are the performance/scale requirements?
- Any security or compliance requirements?
- Which components need the most detailed specification?
- Is there complex business logic that needs documentation?

## Output Template

```markdown
# [Product Name] — Technical Specification

**Version:** 1.0
**Date:** [Current Date]
**Companion to:** PRD v[X.X]

---

## 1. Overview

### 1.1 Purpose
Technical implementation details for [Product Name].

### 1.2 Scope
This document covers:
- [Component/Feature 1]
- [Component/Feature 2]

---

## 2. Architecture

### 2.1 System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENTS                                  │
├─────────────┬─────────────┬─────────────────────────────────────┤
│  Web App    │  Mobile     │  API Consumers                      │
└──────┬──────┴──────┬──────┴─────────────────────────────────────┘
       │             │
       └─────────────┼─────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                      API GATEWAY                                 │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        DATA LAYER                                │
├─────────────────┬─────────────────┬─────────────────────────────┤
│   PostgreSQL    │     Redis       │    Object Storage           │
└─────────────────┴─────────────────┴─────────────────────────────┘
```

### 2.2 Technology Stack

| Layer | Technology | Version | Rationale |
|-------|------------|---------|-----------|
| Frontend | [Framework] | [version] | [Why] |
| Backend | [Framework] | [version] | [Why] |
| Database | [DB] | [version] | [Why] |

---

## 3. Data Model

### 3.1 Entity Relationship Diagram

[ASCII diagram of entities and relationships]

### 3.2 Table Definitions

#### Table: `[table_name]`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | Unique identifier |

**Indexes:**
- `idx_[name]` on `[column]`

---

## 4. API Specification

### 4.1 API Overview

**Base URL:** `https://api.[product].com/v1`
**Authentication:** Bearer token (JWT)

### 4.2 Endpoints

#### POST `/[resource]`

**Request:**
```json
{
  "field": "value"
}
```

**Response (200):**
```json
{
  "id": "uuid",
  "field": "value"
}
```

**Errors:**
| Code | Message | Cause |
|------|---------|-------|
| 400 | Invalid request | Missing fields |

---

## 5. Business Logic

### 5.1 [Algorithm/Calculation Name]

**Purpose:** [What this calculates]

**Pseudocode:**
```python
def calculate(input):
    # Logic here
    return result
```

**Edge Cases:**
| Scenario | Handling |
|----------|----------|
| [Case] | [How handled] |

---

## 6. Error Handling

### 6.1 Error Response Format

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "details": []
  }
}
```

### 6.2 Error Codes

| HTTP | Code | Description |
|------|------|-------------|
| 400 | VALIDATION_ERROR | Invalid input |
| 401 | UNAUTHORIZED | Missing auth |
| 404 | NOT_FOUND | Resource missing |

---

## 7. Security

### 7.1 Authentication
[JWT structure, token lifetime]

### 7.2 Authorization
[RBAC model, permissions]

---

## 8. Performance

### 8.1 Targets

| Metric | Target |
|--------|--------|
| API Response (p95) | < 500ms |
| Availability | 99.9% |

### 8.2 Rate Limiting

| Endpoint | Limit | Window |
|----------|-------|--------|
| API (auth) | 100 | 1 min |

---

## 9. Deployment

### 9.1 Environments

| Environment | URL | Purpose |
|-------------|-----|---------|
| Development | dev.[product].com | Dev |
| Production | [product].com | Live |

### 9.2 Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | DB connection |
```

## File Output

Save as: `[PRODUCT-NAME]-TECHNICAL-SPEC.md`
