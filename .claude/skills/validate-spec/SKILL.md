---
name: validate-spec
description: >-
  Validates OpenAPI yaml and SQL schema for internal consistency. Use when
  architect needs to verify that api.yaml and schema.sql are coherent, types
  match, and all endpoints reference real tables.
license: MIT
metadata:
  author: agentflow
  version: "1.0"
  recommended_for: [architect]
---

# Skill: validate-spec

Validate `.agentflow/architect/specs/api.yaml` and `.agentflow/architect/specs/schema.sql` for consistency.

## Steps

1. Read `.agentflow/architect/specs/api.yaml`
2. Read `.agentflow/architect/specs/schema.sql`
3. Check:
   - `api.yaml` is valid OpenAPI 3.0 structure
   - `schema.sql` is syntactically valid
   - Request/response fields in api.yaml match columns in schema.sql tables
   - Data types are consistent (string→VARCHAR/TEXT, number→INT/DECIMAL, boolean→TINYINT/BOOL)
   - Every endpoint that reads/writes data references a real table

## Output

Produce a validation report:

```markdown
## Spec Validation Report
Date: [date]

### api.yaml — Valid OpenAPI 3.0: YES/NO
Issues: [list or "none"]

### schema.sql — Syntactically valid: YES/NO
Issues: [list or "none"]

### Cross-consistency
| Endpoint | Table | Field Check | Result |
|----------|-------|-------------|--------|
| POST /auth/login | users | email, password_hash | ✅ OK |
| GET /users/{id} | users | id, email, name | ⚠️ MISMATCH: name not in schema |

### Overall: PASS / FAIL
Blocking issues: [list or "none"]
```

Return report to Architect. If FAIL, list all issues clearly.
