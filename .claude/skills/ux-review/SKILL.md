---
name: ux-review
description: >-
  Self-verifies UX quality before frontend signals milestone-ready.
  Checks state coverage (loading/empty/error/success), accessibility,
  responsiveness, and copy tone against ui-components.md standards.
license: MIT
metadata:
  author: agentflow
  version: "1.0"
  recommended_for: [frontend]
---

# Skill: ux-review

Verify UX quality before milestone-ready.

## Steps

1. Read `.agentflow/architect/specs/ui-components.md`
2. Read `.agentflow/teams/[team]/frontend/progress.md` — what was implemented
3. Determine review type: **prototype** or **implementation**
   - If `prototypes/` directory exists and milestone is prototype → prototype review
   - Otherwise → implementation review

### Prototype Review
For each HTML file in `.agentflow/teams/[team]/frontend/prototypes/`:

**Design tokens:** colors, typography, spacing match ui-components.md exactly
**Component coverage:** every component from ui-components.md appears in at least one prototype
**States:** all interaction states represented (default, hover, focus, disabled, empty, error, loading)
**Accessibility:** semantic HTML, ARIA labels, proper heading hierarchy, form labels
**Responsiveness:** layout works at mobile 320px / tablet 768px / desktop 1024px
**Content:** realistic sample data (not "Lorem ipsum"), meaningful labels and messages

### Implementation Review
For each component verify:

**States:** loading / empty / error / success
**Accessibility:** semantic HTML, ARIA labels, keyboard nav, color contrast
**Responsiveness:** mobile 320px / tablet 768px / desktop 1024px
**Copy:** error messages human-readable, empty states suggest action, follows brand voice
**Prototype fidelity:** implementation matches approved prototypes visually

## Output

```markdown
## UX Review
Date: [date]
Type: prototype | implementation

### Components
| Component | States | A11y | Responsive | Copy | Result |
|-----------|--------|------|------------|------|--------|
| LoginForm | ✅ | ✅ | ✅ | ✅ | PASS |
| Dashboard | ⚠️ no empty | ✅ | ✅ | ✅ | WARN |

### Blocking issues (must fix)
- [issue] — [component] — [what to fix]

### Non-blocking (track as backlog)
- [issue]

### Verdict: PASS / WARN / FAIL
```

If FAIL → set `status: blocked` in progress.md and list issues in issues.md.
If PASS/WARN → include report in milestone-ready progress.md.
