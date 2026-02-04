---
description: Generate comprehensive User Flows and UX documentation with wireframes and interaction patterns
model: opus
---

# Generate User Flows

Generate detailed User Flows documentation including screen inventories, interaction patterns, wireframes (ASCII), component specifications, and responsive design considerations.

## Initial Response

When this command is invoked:

1. **Check if parameters were provided**:
   - If a PRD or product description was provided, read it FULLY
   - Begin analyzing user experience requirements

2. **If no parameters provided**, respond with:
```
I'll help you create comprehensive User Flows and UX documentation.

Please provide:
1. The PRD or product description
2. Main user types/roles
3. The 3-5 primary tasks users need to accomplish

Tip: You can invoke with a PRD: `/generate_user_flows thoughts/shared/plans/MY-PRODUCT-PRD.md`
```

Then wait for user input.

## Workflow

1. **Understand Product** — Review PRD or gather product context
2. **Identify Users** — Define user types/personas
3. **Map Journeys** — Document primary user flows
4. **Inventory Screens** — List all screens needed
5. **Detail Interactions** — Specify UI behavior
6. **Generate Document** — Create comprehensive UX spec

## Clarifying Questions

Before generating, understand:

- What are the main user types/roles?
- What are the 3-5 primary tasks users need to accomplish?
- Is there an existing PRD or feature list?
- Any design system or UI framework preferences?
- Mobile-first or desktop-first?
- Any accessibility requirements?

## Output Template

```markdown
# [Product Name] — User Flows & UX Specification

**Version:** 1.0
**Date:** [Current Date]
**Companion to:** PRD v[X.X]

---

## 1. Overview

### 1.1 User Personas

#### Persona 1: [Name] — [Role]
| Attribute | Details |
|-----------|---------|
| **Demographics** | [Age, role, tech comfort] |
| **Goals** | [What they want to achieve] |
| **Pain Points** | [Current frustrations] |
| **Key Tasks** | [Primary actions in product] |

### 1.2 Design Principles
1. **[Principle]** — [Description]
2. **[Principle]** — [Description]

---

## 2. Information Architecture

### 2.1 Site Map
```
[Product Name]
├── Public
│   ├── Landing Page
│   ├── Login
│   └── Sign Up
├── Dashboard
│   ├── Overview
│   └── [Features]
└── Settings
    ├── Profile
    └── Preferences
```

---

## 3. User Flows

### 3.1 [Flow Name]

**Trigger:** [What initiates this flow]
**Goal:** [What user accomplishes]

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   START     │     │   Step 1    │     │   Step 2    │
│  [Trigger]  │────▶│  [Action]   │────▶│  [Action]   │
└─────────────┘     └─────────────┘     └──────┬──────┘
                                               │
                    ┌──────────────────────────┴──────┐
                    │                                 │
                    ▼                                 ▼
            ┌─────────────┐                  ┌─────────────┐
            │  Success    │                  │   Error     │
            └─────────────┘                  └─────────────┘
```

**Steps:**
1. **[Screen]** — [User action] → [System response]
2. **[Screen]** — [User action] → [System response]

---

## 4. Screen Inventory

### 4.1 Screen List

| # | Screen Name | Route | Purpose | Priority |
|---|-------------|-------|---------|----------|
| 1 | Landing | `/` | Convert visitors | P0 |
| 2 | Dashboard | `/dashboard` | Overview hub | P0 |

### 4.2 Screen Specifications

#### Screen: [Name]

**Route:** `/path`
**Purpose:** [What this accomplishes]

**Wireframe:**
```
┌─────────────────────────────────────────────────────────┐
│  [Logo]                    [Nav Item] [Nav] [User▼]    │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │              [Page Title]                        │   │
│  │              [Subtitle]                          │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   Card 1     │  │   Card 2     │  │   Card 3     │  │
│  │   [Content]  │  │   [Content]  │  │   [Content]  │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**States:**
- **Empty:** [What shows when no data]
- **Loading:** [Loading indicator]
- **Error:** [Error display]

---

## 5. Component Library

### 5.1 Core Components

| Component | Usage | Variants |
|-----------|-------|----------|
| Button | Primary actions | Primary, Secondary, Destructive |
| Input | Form entry | Text, Email, Password |
| Card | Content container | Default, Clickable |
| Modal | Overlays | Dialog, Alert |

---

## 6. Interaction Patterns

### 6.1 Form Handling
- Inline validation on blur
- Loading state on submit
- Success/Error feedback

### 6.2 Navigation
**Primary:** [Sidebar/Top nav]
**Breadcrumbs:** [When used]

### 6.3 Destructive Actions
- Confirmation dialog required
- Clear warning message
- Undo when possible

---

## 7. Responsive Design

### 7.1 Breakpoints

| Name | Min Width | Changes |
|------|-----------|---------|
| Mobile | 0px | Single column |
| Tablet | 640px | Two columns |
| Desktop | 1024px | Full layout |

### 7.2 Mobile Adaptations

| Desktop | Mobile |
|---------|--------|
| Sidebar nav | Bottom tabs |
| Data table | Card list |
| Modal | Full-screen sheet |

---

## 8. Accessibility

- WCAG 2.1 AA compliance
- Keyboard navigation
- Screen reader support
- Color contrast ≥ 4.5:1
```

## File Output

Save as: `[PRODUCT-NAME]-USER-FLOWS.md`
