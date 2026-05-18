---
name: reviewer-checklist
description: >-
  Structured review protocol for the Code Reviewer role. Ensures consistent,
  thorough code reviews across all implementations using the 8 quality pillars.
  Use when reviewing milestone deliverables, CR implementations, or spec changes.
  Covers correctness, maintainability, readability, efficiency, security,
  error handling, testability, UX/UI fidelity, and spec compliance.
license: MIT
metadata:
  author: agentflow
  version: "2.0"
  recommended_for: [code-reviewer]
---

# Skill: reviewer-checklist

Structured protocol for reviewing implementations at milestone checkpoints.

## When to use
- Milestone review (implementations from one or more teams)
- CR implementation review
- Spec change review before approval
- Post-merge verification
- Re-review after implementers fix issues

## Review Protocol

### Phase 1 — Spec Compliance

1. Read the relevant specs:
   - `.agentflow/architect/specs/api.yaml` — API contracts
   - `.agentflow/architect/specs/schema.sql` — database schema
   - `.agentflow/architect/specs/ui-components.md` — UI specification
   - `.agentflow/architect/specs/test-criteria.md` — acceptance criteria

2. For each implemented item, verify:

| Check | How to verify |
|-------|---------------|
| Endpoint exists | Route file defines the path and method from api.yaml |
| Request schema matches | Handler reads expected fields with correct types |
| Response schema matches | Handler returns fields defined in api.yaml |
| Status codes correct | All specified status codes are handled (200, 400, 404, etc.) |
| DB table exists | Model/migration defines all columns from schema.sql |
| Column types match | ORM types map correctly to SQL types |
| Foreign keys present | Relationships defined match schema.sql constraints |
| UI component exists | Component file implements the spec |
| Component states | All states handled (loading, empty, error, success) |
| Acceptance criteria | Each Given/When/Then from test-criteria.md is covered |

### Phase 2 — 8 Quality Pillars

For each file changed, evaluate against all 8 pillars:

**Pillar 1: Correctness**
- [ ] Logic handles edge cases (null, empty, overflow, concurrent access)
- [ ] Async operations have proper error handling and cleanup
- [ ] Resource cleanup on all exit paths (DB connections, file handles)
- [ ] No race conditions or timing issues
- [ ] Business logic matches spec requirements exactly

**Pillar 2: Maintainability**
- [ ] Clean separation of concerns (routing, business logic, data access)
- [ ] DRY — no duplicated logic that should be shared
- [ ] Functions/components are focused (single responsibility)
- [ ] Dependencies are explicit and injectable
- [ ] No unnecessary coupling between modules

**Pillar 3: Readability**
- [ ] Clear, descriptive naming (variables, functions, components)
- [ ] Comments where logic is non-obvious (not everywhere)
- [ ] Consistent formatting and code style
- [ ] Reasonable file sizes — no god files
- [ ] Import organization follows project conventions

**Pillar 4: Efficiency**
- [ ] No N+1 queries or unnecessary database round-trips
- [ ] No unnecessary re-renders (React/Vue)
- [ ] Database queries use indexes appropriately
- [ ] No unnecessary computation in hot paths
- [ ] Reasonable bundle size considerations

**Pillar 5: Security**
- [ ] No secrets in committed code
- [ ] SQL queries are parameterized (no string concatenation)
- [ ] User input is validated before use
- [ ] Auth checks present on protected endpoints
- [ ] XSS prevention (output encoding, sanitization)
- [ ] CSRF protection where applicable
- [ ] Reference `security-review` skill for the full check

**Pillar 6: Error Handling**
- [ ] Error handling is specific (not catch-all swallow)
- [ ] Clear, user-facing error messages
- [ ] Graceful degradation on failure
- [ ] Resource cleanup on error paths
- [ ] Error responses follow consistent format across endpoints

**Pillar 7: Testability**
- [ ] Code is testable in isolation
- [ ] Dependencies are injectable (no hardcoded singletons)
- [ ] Side effects are isolated and mockable
- [ ] Pure functions where possible
- [ ] Test-friendly interfaces (no hidden state)

**Pillar 8: UX/UI Fidelity**
- [ ] Design tokens applied correctly (colors, spacing, typography from designer/system.md)
- [ ] All component states implemented (hover, focus-visible, active, disabled, loading, error, empty)
- [ ] Responsive behavior at 375/768/1280px breakpoints
- [ ] Contrast ratio >= 4.5:1 for text, >= 3:1 for UI elements
- [ ] Transitions present (150ms hover, 200ms state, 300ms open/close)
- [ ] Reference `design-quality` skill for the full standard

### Phase 3 — Cross-Team Impact

1. Read `.agentflow/architect/setup/teams.md` — team boundaries
2. Check if changes affect shared interfaces:
   - API endpoints consumed by other teams
   - Shared database tables (foreign keys, shared columns)
   - Shared types or contracts
3. If cross-team impact found:
   - Verify the consuming team is aware (check their progress.md)
   - Flag if spec update is needed (use `dependency-check` skill)

### Phase 4 — File Ownership Verification

1. Use `file-ownership-verify` skill
2. Verify Frontend only modified frontend files
3. Verify Backend only modified backend files
4. Flag any cross-boundary writes

## Output

```markdown
## Code Review Report

### Summary
[Overview: what was implemented, overall quality, files reviewed]

### Pillar Scores
| Pillar | Score | Notes |
|--------|-------|-------|
| Correctness | PASS/WARN/FAIL | |
| Maintainability | PASS/WARN/FAIL | |
| Readability | PASS/WARN/FAIL | |
| Efficiency | PASS/WARN/FAIL | |
| Security | PASS/WARN/FAIL | |
| Error Handling | PASS/WARN/FAIL | |
| Testability | PASS/WARN/FAIL | |
| UX/UI Fidelity | PASS/WARN/FAIL | |

### Spec Compliance
| Item | Type | Status | Notes |
|------|------|--------|-------|
| POST /auth/login | API | PASS | |
| users table | DB | PASS | |
| LoginForm | UI | WARN | Missing loading state |

### Critical
[Bugs, security issues, breaking changes — MUST be fixed.
Include file:line references.]

### Improvements
[Quality, performance, patterns — SHOULD be fixed.
Include file:line references.]

### Nitpicks
[Style, formatting, naming — optional.
Include file:line references.]

### Cross-Team Impact
- [None / list of impacts with affected teams]

### File Ownership
- [CLEAN / list of violations]

### Scope Analysis
- Implemented but not in spec: [list or "none"]
- In spec but not implemented: [list or "none"]

### Verdict: Approved / Request Changes
Blocking issues: [count and list]
Non-blocking notes: [count and list]
```

Return report to PM.

## Important
- Every FAIL or Request Changes verdict must have specific, actionable items
- Reference exact file:line for every finding
- Do NOT rewrite code — describe what needs to change
- If unsure whether something is a blocker, mark WARN not FAIL
- Score each pillar independently — a FAIL in one does not mean all fail
