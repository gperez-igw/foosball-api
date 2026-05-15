---
name: design-review
description: >-
  Prepare a design review summary for user approval. Verifies completeness,
  accessibility compliance, token consistency, and component coverage.
  Produces .agentflow/designer/review.md with requires_decision: true.
license: MIT
metadata:
  author: agentflow
  version: "1.0"
  recommended_for: [designer, prototyper]
---

# Design Review

## When to use
- After generating or updating the design system
- Before the Architect begins writing specs
- The review is the gate between design and specification

## Steps

### 1. Read Design Files
- `.agentflow/designer/system.md` — design philosophy + tokens
- `.agentflow/designer/components.md` — component inventory
- `.agentflow/designer/wireframes.md` — page layouts + user flows

### 2. Verify Completeness

**Design System (system.md)**:
- [ ] Design philosophy present (4-6 paragraphs, named movement)
- [ ] Color palette: 8+ colors with hex + descriptive name + role
- [ ] Typography: display + body fonts, full scale, weights
- [ ] Spacing scale defined
- [ ] Breakpoints defined (mobile, tablet, desktop, wide)
- [ ] Elevation/shadow system defined
- [ ] Border radius system defined
- [ ] Motion principles defined

**Components (components.md)**:
- [ ] All UI elements from wireframes have corresponding components
- [ ] Every component has ALL states (default, hover, focus, active, disabled, loading, empty, error, success)
- [ ] Variants documented (size, color, style)
- [ ] Interactions specified
- [ ] Token references correct (colors, typography, spacing match system.md)

**Wireframes (wireframes.md)**:
- [ ] All pages/views from project scope are covered
- [ ] Each page has responsive behavior at all breakpoints
- [ ] User flows connect pages logically
- [ ] Information hierarchy is clear

### 3. Check Accessibility (WCAG 2.1 AA)
- [ ] Color contrast ratios adequate (4.5:1 for normal text, 3:1 for large text)
- [ ] Focus states defined for all interactive components
- [ ] ARIA roles specified where needed
- [ ] Keyboard navigation paths documented
- [ ] Touch targets adequate for mobile (44x44px minimum)

### 4. Check Consistency
- [ ] All color references in components match system.md palette
- [ ] All typography in components matches system.md scale
- [ ] Spacing values in wireframes match system.md scale
- [ ] Component names consistent between components.md and wireframes.md
- [ ] No orphan tokens (defined but unused) or missing tokens (used but undefined)

### 5. Write Review Summary

Write `.agentflow/designer/review.md` with:

```yaml
---
status: draft
requires_decision: true
created_by: designer
created_at: YYYY-MM-DD
---
```

**Sections**:
1. **Design Philosophy** — 1-paragraph summary of the visual direction
2. **Color Palette** — table with name, hex, role for all colors
3. **Typography** — font choices with rationale
4. **Component Coverage** — count + list of components, note any gaps
5. **Page/View Coverage** — count + list of pages, note any gaps
6. **Accessibility** — WCAG compliance status, any known issues
7. **Open Questions** — trade-offs or decisions that need user input

### 6. Notify Lead
- Set `requires_decision: true` in frontmatter
- Send message to the lead (PM) that design review is ready for user approval
- STOP and wait for lead to relay user decision

## Important
The review summary must be concise enough for a non-designer to understand
and approve. Use visual examples (color swatches as hex codes, font names)
rather than abstract descriptions. Flag any trade-offs that require user input.
