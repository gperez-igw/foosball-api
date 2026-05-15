---
name: file-ownership-verify
description: >-
  Verifies that each implementer agent has written only within its assigned
  file ownership area. Detects scope violations where an agent modified files
  belonging to another team or role. Use after implementation phases and
  before milestone review.
license: MIT
metadata:
  author: agentflow
  version: "1.0"
  recommended_for: [code-reviewer, architect, frontend, backend]
---

# Skill: file-ownership-verify

Verify that implementers stayed within their assigned file areas.

## When to use
- After implementation phase, before milestone review
- When multiple implementers work in the same repository
- As part of reviewer checklist (Phase 3)

## Ownership Rules

File ownership is determined by the team assignment and role:

### Default ownership map

| Role | Owns | Must NOT modify |
|------|------|-----------------|
| Frontend (team-XX) | `src/` frontend code, `public/`, component files, frontend tests | Backend routes, DB models, API handlers, other team's frontend |
| Backend (team-XX) | `src/` backend code, routes, models, migrations, backend tests | Frontend components, UI files, other team's backend |
| Prototyper | `.agentflow/teams/*/frontend/prototypes/` | `src/`, designer files, spec files, PM files |
| Reviewer (Architect) | `.agentflow/architect/`, `README.md` | Team implementation files (may read, not write) |
| Code Reviewer | `.agentflow/teams/*/shared/code-review.md` | Implementation code (reads only), spec files, PM files |
| Lead (PM) | `.agentflow/pm/`, `.agentflow/decisions/` | Implementation code, spec files |
| Designer | `.agentflow/designer/` | Implementation code, spec files, PM files |
| QA | `.agentflow/teams/*/qa/`, test files | Implementation source code (reads only) |

### Custom ownership

If `.agentflow/architect/setup/teams.md` defines custom file ownership per team,
those rules override the defaults above. Read teams.md first.

## Steps

### 1. Determine file ownership map

1. Read `.agentflow/architect/setup/teams.md` — team scopes and file assignments
2. Read git log for the current sprint branch:
   ```bash
   git log --name-only --pretty=format:"%H %an" origin/main..HEAD
   ```
3. Group modified files by author/committer

### 2. Check each commit

For each commit in the sprint:
1. Identify the agent that made it (from commit message scope: `feat(frontend/team-01)`)
2. List files modified in that commit
3. Check each file against the ownership map
4. Flag violations

### 3. Alternative: check by file diff

If commit attribution is unclear:
1. List all files changed in the sprint: `git diff --name-only origin/main..HEAD`
2. For each file, determine which team/role should own it
3. Verify the file was modified by the correct agent (check progress.md references)

## Output

```markdown
## File Ownership Verification — Sprint [XX]
Date: [date]

### Ownership Map
| Area | Owner | Files |
|------|-------|-------|
| Frontend | team-01/frontend | src/components/, src/pages/, src/styles/ |
| Backend | team-01/backend | src/routes/, src/models/, src/middleware/ |
| Specs | architect | .agentflow/architect/specs/ |

### Violations Found
| File | Expected Owner | Actual Author | Commit | Severity |
|------|----------------|---------------|--------|----------|
| src/models/user.ts | team-01/backend | team-01/frontend | abc123 | HIGH |
| .env | (none) | team-01/backend | def456 | CRITICAL |

### Clean Files
[N] files checked, [M] owned correctly

### Verdict: CLEAN / VIOLATIONS FOUND
Violations: [count]
Critical: [count] (secrets, config, cross-team writes)
```

Return report to reviewer or lead.

## Severity Levels
- **CRITICAL**: secrets committed, config files modified, files outside any team scope
- **HIGH**: cross-team writes (frontend modifying backend or vice versa)
- **MEDIUM**: writing in shared areas without coordination
- **LOW**: minor scope boundary issues (e.g., shared utility files)
