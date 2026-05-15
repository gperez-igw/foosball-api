---
name: bug-formatter
description: >-
  Formats a bug report correctly for shared/bugs.md with all required
  fields. Use when frontend or backend needs to report a bug between
  them — ensures complete reproduction steps, spec reference, and severity.
license: MIT
metadata:
  author: agentflow
  version: "1.0"
  recommended_for: [frontend, backend, qa]
---

# Skill: bug-formatter

Create a well-structured bug entry in shared/bugs.md.

## Steps

1. Read `.agentflow/architect/specs/api.yaml` to find the relevant spec reference
2. Read `.agentflow/teams/[team]/shared/bugs.md` to get next bug ID
3. Append to `.agentflow/teams/[team]/shared/bugs.md`:

```markdown
---
id: bug-[XXX]
type: bug
created_by: [frontend|backend]
assigned_to: [backend|frontend]
created_at: [YYYY-MM-DD]
status: open
severity: [critical|high|medium|low]
requires_decision: false
---

## Bug [XXX] — [Brief Title]

### Problem
[Clear description of what is wrong]

### Expected (per spec)
Spec reference: [api.yaml#/path or ui-components.md#component]
[What the spec says should happen]

### Actual behavior
[What is actually happening]

### Reproduction
1. [step]
2. [step]
3. [result]

### Sample (if applicable)
Request: [curl or payload]
Response received: [actual response]

### Severity rationale
critical=blocks milestone / high=major feature broken /
medium=partial / low=cosmetic or edge case
```

Return bug ID to calling agent.
