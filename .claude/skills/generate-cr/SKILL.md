---
name: generate-cr
description: >-
  Generates a properly formatted change request file with correct ID,
  frontmatter, and all required sections. Use when pm or architect needs
  to open a new change request.
license: MIT
metadata:
  author: agentflow
  version: "1.0"
  recommended_for: [pm, architect]
---

# Skill: generate-cr

Create a new properly formatted CR file.

## Steps

1. List files in `.agentflow/architect/change-requests/` to find highest existing CR number
2. Increment by 1 for the new ID (e.g. cr-004)
3. Create `.agentflow/architect/change-requests/cr-[XXX].md`:

```markdown
---
id: cr-[XXX]
type: change-request
project: [project_name]
sprint: [current_sprint]
created_by: [pm|architect]
created_at: [YYYY-MM-DD]
source: [user|pm|architect|team-XX]
status: open
requires_decision: false
---

# Change Request [XXX] — [Brief Title]

## Request Description
[What is being requested or what problem was found]

## Source
Reference: [file and section that triggered this CR]

## PM Analysis
<!-- To be filled by PM -->
### Sprint impact
- Current sprint: [impact]
- Backlog impact: [items to add/modify/remove]

### Options
- **Option A**: [description] — Pro: [x] / Con: [x]
- **Option B**: [description] — Pro: [x] / Con: [x]

### PM Recommendation
[Preferred option with rationale]

## Architect Analysis
<!-- To be filled by Architect -->
### Technical impact
- Specs to modify: [list]
- Effort: [S/M/L]
- Inconsistency risk: [low/medium/high]

### Options
- **Option A**: [technical feasibility]
- **Option B**: [technical feasibility]

### Architect Recommendation
[Preferred option with rationale]

## User Decision
<!-- PM presents options via AskUserQuestion; outcome recorded in decisions/decision-*.md -->
[ ] Option A
[ ] Option B
[ ] Other: ___

## Resolution
Decision: 
Date: 
Actions:
- [ ] PM: [action]
- [ ] Architect: [action]
- [ ] [team]: [action]
```

Return file path to calling agent.
