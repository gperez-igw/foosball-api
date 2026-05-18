---
name: security-review
description: >-
  Performs security review of implemented code against OWASP Top 10, auth flow
  validation, input sanitization, and secrets management. Use at milestone
  checkpoints before marking code as ready. Produces a structured security
  report with severity ratings.
license: MIT
metadata:
  author: agentflow
  version: "1.0"
  recommended_for: [code-reviewer, qa, architect]
---

# Skill: security-review

Verify that implemented code meets security standards before milestone approval.

## When to use
- Before any milestone review
- After implementing authentication/authorization flows
- After adding user input handling (forms, API endpoints)
- When a change request modifies security-sensitive areas

## Steps

### 1. Identify Security Surface

Read the team's implementation files and identify:
- **Authentication endpoints**: login, register, password reset, OAuth callbacks
- **Authorization checks**: middleware, guards, decorators, role checks
- **User input handlers**: forms, API request bodies, query parameters, file uploads
- **Data output**: API responses, rendered templates, error messages
- **External integrations**: third-party APIs, payment processors, email services
- **Database queries**: raw SQL, ORM queries, search functionality

### 2. OWASP Top 10 Checklist

For each category, check the codebase:

**A01 — Broken Access Control**
- [ ] Every API endpoint has authorization check (not just authentication)
- [ ] Role-based access enforced server-side (not just UI hiding)
- [ ] No direct object reference without ownership verification (IDOR)
- [ ] CORS configured restrictively (not `*`)
- [ ] No path traversal in file operations

**A02 — Cryptographic Failures**
- [ ] Passwords hashed with bcrypt/argon2/scrypt (NOT md5/sha1/sha256)
- [ ] No secrets in source code (API keys, DB passwords, JWT secrets)
- [ ] Sensitive data not logged (passwords, tokens, PII)
- [ ] HTTPS enforced for all external communication
- [ ] JWT tokens have expiration and proper signing algorithm

**A03 — Injection**
- [ ] All database queries use parameterized queries or ORM (no string concatenation)
- [ ] No `eval()`, `exec()`, `Function()` on user input
- [ ] Command injection prevented (no `os.system()` / `child_process.exec()` with user input)
- [ ] Template injection prevented (user input not in template strings)

**A04 — Insecure Design**
- [ ] Rate limiting on authentication endpoints
- [ ] Account lockout after failed attempts
- [ ] No sensitive data in URL parameters
- [ ] Session invalidation on logout and password change

**A05 — Security Misconfiguration**
- [ ] Debug mode disabled in production config
- [ ] Default credentials not present
- [ ] Error messages do not expose stack traces or internal paths
- [ ] Security headers set (CSP, X-Frame-Options, X-Content-Type-Options)

**A06 — Vulnerable Components**
- [ ] No known vulnerable dependencies (check package.json / requirements.txt versions)
- [ ] Dependencies pinned to specific versions

**A07 — Authentication Failures**
- [ ] Password requirements enforced (minimum length, complexity)
- [ ] Session tokens are cryptographically random
- [ ] Multi-factor authentication available for sensitive operations (if in spec)

**A08 — Data Integrity Failures**
- [ ] Input validation on all user-supplied data (type, length, range, format)
- [ ] File upload validation (type, size, content inspection)
- [ ] No deserialization of untrusted data

**A09 — Logging and Monitoring**
- [ ] Authentication events logged (login, logout, failed attempts)
- [ ] Authorization failures logged
- [ ] No sensitive data in logs

**A10 — Server-Side Request Forgery (SSRF)**
- [ ] No user-controlled URLs in server-side HTTP requests
- [ ] If URL input required, allowlist validation applied

### 3. Auth Flow Verification

If authentication is implemented:
1. Trace the complete login flow: request -> validation -> token generation -> response
2. Trace the session management: token storage -> middleware check -> refresh -> logout
3. Verify password reset flow: request -> token generation -> email -> reset -> invalidation
4. Check for common auth bugs:
   - Token not invalidated on password change
   - Refresh token reuse after rotation
   - Missing CSRF protection on state-changing endpoints
   - Session fixation (session ID not regenerated after login)

### 4. Input Sanitization Verification

For each endpoint accepting user input:
1. Identify all input sources (body, query, params, headers, cookies)
2. Verify validation exists (type checking, length limits, format regex)
3. Verify sanitization for output context:
   - HTML output: XSS prevention (escaping or CSP)
   - SQL: parameterized queries
   - Shell: no user input in commands
   - File paths: no traversal (../)

## Output

```markdown
## Security Review — Milestone [X]
Date: [date]
Team: [team-id]
Reviewer: [agent]

### Summary
| Category | Items Checked | Pass | Fail | N/A |
|----------|---------------|------|------|-----|
| Access Control | [N] | [N] | [N] | [N] |
| Cryptography | [N] | [N] | [N] | [N] |
| Injection | [N] | [N] | [N] | [N] |
| Auth Flow | [N] | [N] | [N] | [N] |
| Input Validation | [N] | [N] | [N] | [N] |
| Configuration | [N] | [N] | [N] | [N] |

### Critical Findings (must fix before merge)
- **[SEVERITY: CRITICAL/HIGH]** [finding] — [file:line]
  Risk: [what could happen]
  Fix: [specific remediation]

### Warnings (should fix)
- **[SEVERITY: MEDIUM]** [finding] — [file:line]
  Risk: [what could happen]
  Fix: [specific remediation]

### Informational
- **[SEVERITY: LOW]** [finding]

### Verdict: SECURE / FINDINGS
Critical issues: [count]
High issues: [count]
```

Return report to the reviewer or lead for inclusion in milestone review.

## Important
- Focus on actual code, not theoretical risks
- Every finding must reference a specific file and line
- Provide concrete fix, not just "sanitize input"
- Mark N/A for categories that don't apply (e.g., no auth = A07 is N/A)
- Do NOT modify code — report only
