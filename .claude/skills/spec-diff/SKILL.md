---
name: spec-diff
description: >-
  Produces a readable diff of specs before and after a change request.
  Use when architect modifies specs due to a CR and needs to document
  exactly what changed for teams and the user.
license: MIT
metadata:
  author: agentflow
  version: "1.0"
  recommended_for: [architect]
---

# Skill: spec-diff

Document what changed in specs after a CR is applied.

## Steps

1. Read the CR file in `.agentflow/architect/change-requests/cr-XXX.md`
2. Read the current (post-modification) spec files
3. Using the CR description, reconstruct what changed
4. Append a `## Spec Diff` section to the CR file:

```markdown
## Spec Diff — CR [id]
Date: [date]
Files modified: [list]

### api.yaml
#### Added
- [new endpoints or fields]
#### Modified
- [changed endpoints or fields]
#### Removed
- [removed items]

### schema.sql
#### Added
- [new tables or columns]
#### Modified
- [altered columns or indexes]
#### Removed
- [dropped items]

### architecture.md
#### Decisions added
- [new architectural decisions]

### Impact summary
| Team | Role | Impact | Action required |
|------|------|--------|----------------|
| team-01 | backend | Direct | Implement new table |
| team-01 | frontend | Direct | Add new UI component |
| team-02 | backend | None | |
```

Return diff to Architect.
