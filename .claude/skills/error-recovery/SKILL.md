---
name: error-recovery
description: >-
  Guidance for recovering from common errors during agent execution.
  Covers build failures, test failures, git conflicts, API errors,
  timeout recovery, and stuck states. Agents self-recover using this
  protocol and escalate to the PM when blocked.
license: MIT
metadata:
  author: agentflow
  version: "1.0"
  recommended_for: [pm, designer, prototyper, architect, frontend, backend, code-reviewer, qa]
---

# Skill: error-recovery

Structured approach to recovering from errors during execution.

## When to use
- When a command fails unexpectedly
- When tests fail and the cause is unclear
- When git operations fail (conflict, push rejected, auth error)
- When the agent is stuck and unsure how to proceed
- When a previous attempt at the same task failed

## Recovery Protocol

### Step 1 — Classify the Error

Read the error output and classify:

| Category | Indicators | Go to |
|----------|------------|-------|
| Build failure | `npm ERR!`, `SyntaxError`, `ModuleNotFoundError`, compile errors | Section A |
| Test failure | `FAIL`, assertion errors, timeout in test runner | Section B |
| Git failure | `CONFLICT`, `rejected`, `fatal:`, `Permission denied` | Section C |
| Dependency failure | `ENOENT`, `Cannot find module`, version mismatch | Section D |
| Timeout / stuck | No progress, repeated same action, circular dependency | Section E |
| Unknown | Error doesn't fit above categories | Section F |

### Section A — Build Failures

1. Read the FULL error message — the root cause is usually in the first error, not the last
2. Check for common causes:
   - Missing import: add the import
   - Type error: check the spec for correct types
   - Syntax error: fix the syntax at the indicated line
3. After fixing, run the build again to verify
4. If the same error recurs after fix:
   - Re-read the error — you may have fixed the wrong instance
   - Check if there are multiple files with the same error
5. If unfixable after 2 attempts:
   - Document the error in `issues.md` with `status: blocked`
   - Message the lead: "Build failure I cannot resolve — [error summary]"

### Section B — Test Failures

1. Read the failing test to understand what it expects
2. Read the implementation to see what it does
3. Determine: is the test wrong or the implementation wrong?
   - Check the spec (api.yaml, test-criteria.md) — the spec is the source of truth
4. Fix the code (not the test) unless the test contradicts the spec
5. Re-run only the failing test first (faster feedback)
6. If test passes in isolation but fails in suite: look for shared state, missing cleanup
7. If unfixable after 2 attempts:
   - Document in `issues.md` with failing test name and error
   - Message the lead with findings

### Section C — Git Failures

**Merge conflict:**
```bash
git status  # see which files conflict
# For each conflicted file:
# 1. Read the file — look for <<<<<<< markers
# 2. Determine correct resolution (usually keep both changes if non-overlapping)
# 3. Edit the file to resolve
git add <resolved-files>
git commit -m "fix: resolve merge conflict in <files>"
```

**Push rejected (non-fast-forward):**
```bash
git pull --rebase origin <branch>
# If conflicts arise during rebase, resolve each one, then:
git rebase --continue
git push origin <branch>
```

**Authentication failure:**
- Check if `gh auth status` succeeds
- If not, message the lead: "GitHub auth expired, cannot push"

### Section D — Dependency Failures

1. Check if the dependency is installed: `npm ls <package>` or `pip show <package>`
2. If missing: install it following the project's package manager
3. If version conflict: check the lock file, do NOT force-install a different version
4. If the dependency is system-level (native lib, binary):
   - Document in issues.md
   - Message the lead: "Missing system dependency: [name]"

### Section E — Timeout / Stuck

If you realize you've been working on the same problem for too long or
making no progress:

1. Stop the current approach
2. Summarize what you've tried and what failed
3. Consider alternative approaches:
   - Can you simplify the implementation?
   - Can you skip this item and work on something else?
   - Is there a dependency that needs to be resolved first?
4. Message the lead with:
   - What you're trying to do
   - What you've tried (briefly)
   - What you think is blocking you
   - Suggested next step

Do NOT:
- Retry the same failing command more than 2 times
- Make increasingly complex fixes without understanding the root cause
- Stay silent when stuck — always communicate to the lead

### Section F — Unknown Errors

1. Read the full error output carefully
2. Search the codebase for similar patterns (grep for the error message)
3. Check if it's an environment issue (wrong directory, missing env var)
4. If still unclear after 5 minutes of investigation:
   - Document everything you know in a message to the lead
   - Include: error output, what you were doing, files involved
   - Let the lead decide whether to reassign, get help, or skip

## Retry Discipline

- **Maximum 2 retries** for the same error with the same approach
- After 2 retries, you MUST change approach or escalate
- Each retry must be DIFFERENT from the previous attempt
- Log what you tried: "Attempt 1: [approach]. Attempt 2: [different approach]."

## Escalation Template

When messaging the lead about an unrecoverable error:

```
BLOCKED: [one-line summary]

What I was doing: [task description]
Error: [key error message]
Attempts:
1. [what I tried first]
2. [what I tried second]
Root cause (if known): [your best guess]
Suggested action: [what you think should happen next]
```
