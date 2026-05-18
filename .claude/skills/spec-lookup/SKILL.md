---
name: spec-lookup
description: >-
  Finds a specific endpoint, table, or UI component in specs without
  reading entire files. Use when frontend or backend needs to quickly
  look up the exact definition of one item from api.yaml, schema.sql,
  or ui-components.md.
license: MIT
metadata:
  author: agentflow
  version: "1.0"
  recommended_for: [code-reviewer, frontend, backend]
---

# Skill: spec-lookup

Find specific spec content fast.

## Input
Type: `endpoint` | `table` | `component`
Name: the specific item to find

## Steps

### Endpoint lookup
1. Read `.agentflow/architect/specs/api.yaml`
2. Find matching path and method
3. Return: full definition, request schema, all response schemas, auth requirements, examples

### Table lookup
1. Read `.agentflow/architect/specs/schema.sql`
2. Find matching CREATE TABLE
3. Return: full table definition, indexes, foreign keys, comments

### Component lookup
1. Read `.agentflow/architect/specs/ui-components.md`
2. Find matching component section
3. Return: description, states, interaction patterns, accessibility notes

## Output

```markdown
## Spec Lookup: [type] / [name]
Source: [file and section]

### Definition
[extracted content]

### Related notes from architecture.md
[any relevant architectural notes]
```

Return to calling agent immediately.
