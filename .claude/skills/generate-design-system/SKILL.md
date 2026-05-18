---
name: generate-design-system
description: >-
  Produce a complete design system from project briefing and reference materials.
  Creates system.md (manifesto + tokens), components.md (inventory with states),
  and wireframes.md (layouts + user flows). Uses .agentflow/references/ as methodology guides.
license: MIT
metadata:
  author: agentflow
  version: "1.0"
  recommended_for: [designer]
---

# Generate Design System

## When to use
- During project setup after PM writes setup.md
- During sprint start to refine the design system for new features

## Steps

### 1. Gather Context
- Read `.agentflow/iterations/000-initial.md` for user briefing
- Read `.agentflow/pm/setup.md` (setup) or `.agentflow/pm/sprints/sprint-NN/plan.md` (sprint)
- Read `.agentflow/references/frontend-design.md` — aesthetics guidelines
- Read `.agentflow/references/canvas-design.md` — philosophy methodology
- Read `.agentflow/references/design-system.md` — documentation approach
- If `assets:` field in .agentflow/CONTEXT.md → read available assets

### 2. Create Design Philosophy
Follow the canvas-design methodology:
1. **Name the visual movement** — 1-2 evocative words that capture the aesthetic
2. **Articulate the philosophy** — 4-6 paragraphs covering:
   - Space and form
   - Color and material
   - Scale and rhythm
   - Composition and balance
   - Visual hierarchy
3. **Emphasize craftsmanship** — the result must feel meticulously crafted

### 3. Define Design Tokens
Follow the design-system.md methodology:

**Color Palette** — minimum 8 colors:
| Descriptive Name | Hex | Functional Role |
|------------------|-----|-----------------|
| [Evocative name] | #XXXXXX | [Specific use] |

- Use descriptive names (not "Primary Blue" but "Deep Ocean Trust")
- Include hex codes for precision
- Explain functional role for each

**Typography** — following frontend-design anti-patterns:
- Display font: distinctive, characterful (NEVER Inter, Roboto, Arial)
- Body font: refined, readable complement
- Scale: h1 through caption with specific sizes
- Weights: which weights for which contexts

**Spacing** — base unit + consistent scale
**Breakpoints** — mobile, tablet, desktop, wide
**Elevation** — shadow system from flat to dramatic
**Border Radius** — named system (sharp → pill)
**Motion** — animation principles and timing

### 4. Build Component Inventory
For each component:
- **Name**: clear, consistent naming convention
- **Description**: what it is and when to use it
- **States**: default, hover, focus, active, disabled, loading, empty, error, success
- **Variants**: size (sm/md/lg), color (primary/secondary/ghost), style variations
- **Interactions**: click, hover, keyboard, touch behavior
- **Accessibility**: ARIA roles, labels, keyboard navigation, focus management
- **Token references**: which design tokens apply

### 5. Design Page Layouts
For each page/view:
- **Layout**: ASCII wireframe showing grid and component placement
- **Responsive**: behavior at each breakpoint
- **Components used**: reference to components.md entries
- **Information hierarchy**: what the user sees first, second, third

For user flows:
- Step-by-step navigation paths
- Entry points and exit points
- Decision branches

### 6. Write Output Files
- `.agentflow/designer/system.md` — philosophy + all tokens
- `.agentflow/designer/components.md` — complete component inventory
- `.agentflow/designer/wireframes.md` — all page layouts + user flows

All files must have YAML frontmatter with `status: draft`.

## Quality Checklist
- [ ] Design philosophy is 4-6 paragraphs, not generic
- [ ] Color palette has 8+ colors with hex + name + role
- [ ] Typography avoids generic AI fonts
- [ ] Every component has ALL states defined
- [ ] Wireframes cover ALL breakpoints
- [ ] WCAG 2.1 AA compliance documented
- [ ] No cookie-cutter or template aesthetics
