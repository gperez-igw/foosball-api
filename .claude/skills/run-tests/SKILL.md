---
name: run-tests
description: >-
  Executes test plan against team implementations. Runs unit, integration,
  and e2e tests, compares results against test-criteria.md acceptance
  criteria. Produces structured test report. Use at milestone checkpoints.
license: MIT
metadata:
  author: agentflow
  version: "1.0"
  recommended_for: [qa]
---

# Skill: run-tests

Execute tests and produce a structured report for the QA agent.

## Steps

### 0. Test Environment Setup (CRITICAL)
Before running any test, ensure test isolation:
- **Database**: tests MUST use mocks or in-memory DB, never real connections.
  - Python: set `DATABASE_URL=sqlite:///:memory:` or use `pytest-mock`
  - Node.js: set `DATABASE_URL=sqlite::memory:` or use `jest.mock` for DB layer
  - Go: use `sqlmock` or in-memory SQLite
- **External APIs**: mock all HTTP calls to external services
- **Network**: use `localhost` or `127.0.0.1` for local services — agents run on the host machine
- Check for `.env.test` or `test` config — use it if present
- If no test isolation exists, create a minimal test env before proceeding

1. Read `.agentflow/teams/[team]/qa/test-plan.md` — test cases to execute
2. Read `.agentflow/architect/specs/test-criteria.md` — acceptance criteria
3. Read `.agentflow/architect/specs/api.yaml` — expected API contracts
4. Read team progress files — what was implemented and where

### Backend Tests
5. Identify the project's test framework from source code:
   - Python: look for `pytest`, `unittest` in requirements/pyproject
   - Node.js: look for `jest`, `vitest`, `mocha` in package.json
   - Go: built-in `go test`
6. Run existing test suite via Bash:
   - `cd` to project source directory
   - Set test environment variables (DATABASE_URL for in-memory DB, etc.)
   - Execute test runner with verbose output
   - Capture stdout/stderr
7. If no test suite exists, perform API contract verification:
   - Check that route files define all api.yaml endpoints
   - Check that response schemas match api.yaml definitions
   - Check that DB models match schema.sql tables

### Frontend Tests
8. Identify frontend test setup:
   - Look for test files (`*.test.*`, `*.spec.*`)
   - Check for test runner in package.json scripts
9. Run frontend tests if available
10. If no test suite, perform structural verification:
    - Check that all components from ui-components.md exist
    - Check that API client calls match api.yaml endpoints

### Integration Tests
11. If both frontend and backend are runnable:
    - Verify API calls from frontend match backend routes
    - Check data flow: frontend form → API request → DB write
12. Cross-reference test-criteria.md acceptance criteria:
    - Map each Given/When/Then to test results
    - Mark: covered + passing, covered + failing, not covered

## Output

```markdown
## Test Report — Milestone [X]
Date: [date]
Team: [team-id]

### Summary
| Category | Total | Pass | Fail | Skip |
|----------|-------|------|------|------|
| Backend Unit | 15 | 13 | 2 | 0 |
| Frontend Unit | 8 | 8 | 0 | 0 |
| Integration | 5 | 3 | 1 | 1 |

### Test Criteria Coverage
| Criterion (from test-criteria.md) | Status | Test Reference | Notes |
|-----------------------------------|--------|----------------|-------|
| User can register with email | PASS | backend/test_auth.py::test_register | |
| Invalid email returns 422 | FAIL | backend/test_auth.py::test_register_invalid | Returns 400 instead of 422 |

### Failures (blocking)
- **[test name]** — [file:line]
  Expected: [expected]
  Actual: [actual]
  Spec ref: [api.yaml#/path or schema.sql#table]

### Warnings (non-blocking)
- [description]

### Verdict: PASS / BLOCKED
Blocking issues: [count and list]
```

Return report to QA agent for writing to report.md.
