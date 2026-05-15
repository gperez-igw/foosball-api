---
name: codebase-analysis
description: >-
  Analyzes an existing codebase to extract stack, patterns, structure,
  and conventions. Produces architecture.md and draft spec files.
  Used by Architect during setup (mode: continue) and iterations.
license: MIT
metadata:
  author: agentflow
  version: "2.0"
  recommended_for: [architect]
---

# Skill: codebase-analysis

Analyze an existing codebase and produce a structured report with draft specs.

## When to use
When `.agentflow/CONTEXT.md` has `mode: continue` — the project workspace contains
an existing codebase that the agents will extend.

## Steps

### 1. Survey the project root
```bash
ls -la $PROJECT_DIR
cat $PROJECT_DIR/package.json 2>/dev/null || true
cat $PROJECT_DIR/requirements.txt 2>/dev/null || true
cat $PROJECT_DIR/go.mod 2>/dev/null || true
cat $PROJECT_DIR/Cargo.toml 2>/dev/null || true
cat $PROJECT_DIR/pom.xml 2>/dev/null || true
```

### 2. Identify tech stack
Look for:
- **Backend**: package.json (Express, Fastify, Nest), requirements.txt (Django, FastAPI, Flask), go.mod, Cargo.toml
- **Frontend**: package.json (React, Vue, Angular, Next, Nuxt, Svelte), framework config files
- **Database**: .env files (DATABASE_URL), ORM configs (prisma/, sequelize config, alembic/)
- **Infrastructure**: Dockerfile, docker-compose.yml, k8s/, terraform/

### 3. Map directory structure
```bash
find $PROJECT_DIR -type f -name "*.ts" -o -name "*.tsx" -o -name "*.js" \
  -o -name "*.jsx" -o -name "*.py" -o -name "*.go" -o -name "*.rs" \
  -o -name "*.java" | head -100
```

### 4. Identify patterns and conventions
Read 3-5 representative source files to extract:
- Naming conventions (camelCase, snake_case, kebab-case)
- Folder structure pattern (by feature, by type, by domain)
- Import patterns (absolute, relative, aliases)
- State management approach (if frontend)
- API design pattern (REST, GraphQL, RPC)
- Error handling conventions
- Test framework and test file location

### 5. Check existing API contracts
Look for:
- `swagger.yaml`, `openapi.yaml`, `api.yaml` — existing API specs
- Route definitions in code (Express routes, FastAPI decorators, etc.)
- GraphQL schema files

### 6. Check existing database schema
Look for:
- Migration files (prisma/migrations/, alembic/versions/, db/migrate/)
- Schema files (prisma/schema.prisma, models.py, schema.sql)
- Seed files

### 7. Check test infrastructure
- Test files pattern (*.test.ts, *.spec.ts, test_*.py, *_test.go)
- Test config (jest.config, vitest.config, pytest.ini, conftest.py)
- CI/CD config (.github/workflows/, .gitlab-ci.yml)

### 8. Generate draft api.yaml

Use the same grep patterns documented in the `spec-verify` skill (do NOT duplicate
the pattern list — refer to spec-verify when scanning):

- Express/Fastify: `router.get|post|put|delete|patch`
- Django/Flask/FastAPI: `@app.route|path(|@api_view|@router.`
- Go: `HandleFunc|Handle|router.`
- Next.js/Remix: `app/api/` or `pages/api/` directory structure

For each route found, extract: HTTP method, path, handler name.
Write `.agentflow/architect/specs/api.yaml` with `status: draft`:

```yaml
---
status: draft
created_by: architect
created_at: YYYY-MM-DD
note: "Auto-generated from codebase — requires Architect validation"
---
openapi: "3.0.3"
info:
  title: [project name]
  version: "1.0.0"
paths:
  /detected/route:
    get:
      operationId: detectedHandler
      summary: "[AUTO] Detected from source — verify and complete"
      responses:
        "200":
          description: "[AUTO] Fill in response schema"
```

If an existing OpenAPI/Swagger file was found in Step 5, use it as the base
instead of scanning routes. Copy it into api.yaml and set `status: draft`.

### 9. Generate draft schema.sql

Use the same grep patterns documented in the `spec-verify` skill:

- Prisma: read `schema.prisma` directly
- SQLAlchemy: `class.*Model|Column(`
- Sequelize: model files in `models/`
- TypeORM: `@Entity|@Column`
- Django: `class.*models.Model`
- Raw SQL: `CREATE TABLE`

For each table found, extract: name, columns, types, foreign keys.
Write `.agentflow/architect/specs/schema.sql` with draft header:

```sql
-- =============================================================================
-- Auto-generated from codebase — requires Architect validation
-- status: draft
-- created_at: YYYY-MM-DD
-- =============================================================================

CREATE TABLE detected_table (
    -- [AUTO] Detected from source — verify column types and constraints
    id SERIAL PRIMARY KEY,
    detected_column VARCHAR(255)  -- [AUTO] verify type
);
```

If existing migration files were found in Step 6, extract the final schema
state from them rather than scanning model code.

### 10. Generate draft ui-components.md

Scan for UI components:

- React: `export.*function|export.*const` in `.tsx` / `.jsx` files
- Vue: `<template>` blocks in `.vue` files
- Svelte: `.svelte` files
- Angular: `@Component` decorator in `.ts` files

For each component found, extract: name, file path, detected props/inputs.
Write `.agentflow/architect/specs/ui-components.md` with `status: draft`:

```markdown
---
status: draft
created_by: architect
created_at: YYYY-MM-DD
note: "Auto-generated from codebase — requires Architect validation"
---

# UI Components

## Design Tokens
[AUTO] Extract from existing theme/config files if found, otherwise leave empty.

## Component Inventory

### ComponentName
- **File**: `src/components/ComponentName.tsx`
- **Props**: `[AUTO] detected props`
- **States**: `[AUTO] fill in: loading / empty / error / success`
```

### 11. Skip when no code found

If the codebase has no detectable routes, models, or components (e.g., a
documentation-only repo or empty project), skip Steps 8-10 and note in
architecture.md that no draft specs were generated.

## Output

Write findings into `.agentflow/architect/specs/architecture.md` with this structure:

```markdown
## Existing Codebase Analysis

### Tech Stack (detected)
- Backend: [framework] [language] [version]
- Frontend: [framework] [language] [version]
- Database: [type] [ORM/driver]
- Infrastructure: [Docker/K8s/etc.]

### Directory Structure
```
[tree output]
```

### Conventions
- Naming: [convention]
- Folder pattern: [by feature / by type / etc.]
- Imports: [pattern]
- Tests: [framework, location pattern]

### Existing API Endpoints
[list of discovered endpoints or link to existing spec]

### Existing Database Schema
[list of tables/models or link to existing schema]

### Constraints (from existing code)
- [dependency versions to respect]
- [patterns to follow for consistency]
- [files/modules not to modify]

### Draft Specs Generated
- api.yaml: [YES/NO] — [N endpoints detected]
- schema.sql: [YES/NO] — [N tables detected]
- ui-components.md: [YES/NO] — [N components detected]
```

Additionally, write draft spec files as described in Steps 8-10.
All draft specs have `status: draft` — the Architect must validate and
promote to `status: approved` before they trigger teams.

## Important
- Do NOT modify any existing code during analysis
- Do NOT delete or overwrite existing files
- Only ADD AgentFlow management files (.agentflow/architect/specs/, etc.)
- Respect existing .gitignore — do not commit AgentFlow internals
- All generated specs are DRAFTS — mark `[AUTO]` on anything inferred
- Refer to `spec-verify` skill for grep patterns — do not maintain duplicates
