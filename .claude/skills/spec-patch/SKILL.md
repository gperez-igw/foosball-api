---
name: spec-patch
description: >-
  Applies lightweight, non-structural spec changes without a formal CR.
  For adding nullable fields, straightforward CRUD endpoints, or component
  variants that follow existing patterns. Enforces a threshold: changes
  touching >2 tables or >3 endpoints require a formal CR instead.
license: MIT
metadata:
  author: agentflow
  version: "1.0"
  recommended_for: [architect]
---

# Skill: spec-patch

Apply small spec modifications without the overhead of a formal Change Request.

## When to use
- Adding a nullable column to an existing table
- Adding a straightforward CRUD endpoint following existing patterns
- Adding a component variant within the existing design system
- Fixing a typo or clarification in spec text
- Adding an index for performance

## When NOT to use (require formal CR instead)
- Change touches more than 2 tables
- Change touches more than 3 endpoints
- Change modifies authentication/authorization logic
- Change alters existing field types or constraints
- Change removes or renames existing endpoints/tables/components
- Change introduces a new architectural pattern

## Steps

1. **Impact assessment** — count affected items:
   - Tables affected: list them
   - Endpoints affected: list them
   - Components affected: list them
2. **Threshold check**:
   - If >2 tables OR >3 endpoints → STOP, use `generate-cr` skill instead
   - If within threshold → proceed
3. **Apply patch** to relevant spec files:
   - `schema.sql` — add column/index with inline comment `-- patch-NNN`
   - `api.yaml` — add endpoint/field with comment referencing patch
   - `ui-components.md` — add component variant
4. **Validate** — use `validate-spec` skill to verify consistency
5. **Document** — write `.agentflow/architect/patches/patch-NNN.md`:
   - Derive NNN: list `.agentflow/architect/patches/` and increment max
   - Include: what changed, why, which spec files were modified
6. **Notify** — use `git-ops` skill Operation A to commit spec changes

## Patch file format

```markdown
---
id: patch-NNN
type: spec-patch
project: [project_name]
sprint: [NN]
created_by: architect
created_at: [YYYY-MM-DD]
status: applied
tables_affected: [count]
endpoints_affected: [count]
---

# Spec Patch NNN — [short title]

## Reason
[Why this change is needed — usually from a team issue or tech guidance]

## Changes
- `schema.sql`: Added column `field_name` (nullable) to `table_name`
- `api.yaml`: Added field `field_name` to `GET /endpoint` response schema

## Impact
- Teams affected: [team-NN]
- No structural change — existing behavior unchanged
- Validated with `validate-spec`: consistent
```

Return to Architect agent after documenting the patch.
