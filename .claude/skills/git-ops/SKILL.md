---
name: git-ops
description: >-
  Handles all Git operations for AgentFlow agents: committing at milestone,
  creating sprint branches, and opening GitHub PRs at sprint end. Use when
  an agent needs to commit completed work, or when the lead needs to open a PR
  for user review. Always reads repo config from .agentflow/CONTEXT.md.
license: MIT
metadata:
  author: agentflow
  version: "2.0"
  recommended_for: [architect, frontend, backend, qa]
---

# Skill: git-ops

Standardized Git operations for AgentFlow agents.
Always read repo configuration from `.agentflow/CONTEXT.md` before any Git operation.

## Read repo config

```bash
# Parse from .agentflow/CONTEXT.md github section
GITHUB_ORG=$(grep "org:" "$PROJECT_DIR/.agentflow/CONTEXT.md" | head -1 | awk '{print $2}')
STRUCTURE=$(grep "structure:" "$PROJECT_DIR/.agentflow/CONTEXT.md" | head -1 | awk '{print $2}')

# For mono-repo: REPO_DIR = PROJECT_DIR (everything in one repo)
# For multi-repo: REPO_DIR = separate clone per component (see .agentflow/CONTEXT.md repos list)
# Read .agentflow/CONTEXT.md repos section to get each repo's local path and URL
```

Repo directory conventions:
- **Mono-repo**: `REPO_DIR=$PROJECT_DIR` — workspace root is the git repo
- **Multi-repo**: `REPO_DIR=$PROJECT_DIR/<component>-repo/` — each component has its own clone directory, which Architect sets up during `github-setup`

---

## Operation A — Commit at milestone

Called by: implementer agents (after milestone-ready); reviewer (after specs updated).

```bash
SPRINT_NUM=$(grep "^current_sprint:" "$PROJECT_DIR/.agentflow/CONTEXT.md" | awk '{print $2}')
SPRINT_BRANCH="sprint-$(printf '%02d' "$SPRINT_NUM")"

cd "$REPO_DIR"

# Verify correct branch — checkout if needed
CURRENT=$(git branch --show-current)
if [[ "$CURRENT" != "$SPRINT_BRANCH" ]]; then
  git fetch origin
  git checkout "$SPRINT_BRANCH" 2>/dev/null \
    || git checkout -b "$SPRINT_BRANCH" "origin/$SPRINT_BRANCH"
fi

# Stage ONLY files in agent's write scope — never stage everything
# Frontend stages:
git add ".agentflow/teams/$TEAM_ID/frontend/"

# Backend stages:
git add ".agentflow/teams/$TEAM_ID/backend/"

# Architect stages:
git add ".agentflow/architect/specs/" ".agentflow/architect/reviews/" ".agentflow/architect/setup/" "README.md"

# PM stages:
git add ".agentflow/pm/sprints/" ".agentflow/decisions/" ".agentflow/CONTEXT.md" "CLAUDE.md"

# Build commit message
# Format: <type>(<scope>): <description> [sprint-NN milestone-MM]
COMMIT_MSG="feat(frontend/team-01): implement login form [sprint-01 milestone-1]"
# Types: feat, fix, spec, docs, chore, test
# Scope: frontend/<team>, backend/<team>, architect, pm

git commit -m "$COMMIT_MSG"
git push origin "$SPRINT_BRANCH"

# Record commit hash in progress.md frontmatter
HASH=$(git rev-parse --short HEAD)
# Update: last_commit: "$HASH"
# Update: last_commit_at: "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
```

If `git push` fails due to conflict:
```bash
git pull --rebase origin "$SPRINT_BRANCH"
git push origin "$SPRINT_BRANCH"
```

---

## Operation B — Create next sprint branch (Architect/reviewer only)

Called by: reviewer (Architect role) at start of new sprint, after previous sprint is merged to main.

```bash
NEXT_SPRINT_NUM=...  # derive: current sprint number + 1
NEXT_BRANCH="sprint-$(printf '%02d' "$NEXT_SPRINT_NUM")"

cd "$REPO_DIR"
git checkout main
git pull origin main

git checkout -b "$NEXT_BRANCH"
git push -u origin "$NEXT_BRANCH"

echo "Branch $NEXT_BRANCH created from main"
```

**Multi-repo**: repeat for each repo listed in `.agentflow/CONTEXT.md github.repos`.

After creating all branches, update `.agentflow/CONTEXT.md`:
```yaml
# Update current_branch for each repo entry in the github section
```

---

## Operation C — Open Pull Request (lead/PM only)

Called by: lead at sprint end, after summary.md and CHANGELOG.md are complete.

```bash
SPRINT_NUM=$(grep "^current_sprint:" "$PROJECT_DIR/.agentflow/CONTEXT.md" | awk '{print $2}')
SPRINT_BRANCH="sprint-$(printf '%02d' "$SPRINT_NUM")"
SPRINT_PAD=$(printf '%02d' "$SPRINT_NUM")

# Read summary and changelog into variables
SUMMARY=$(cat "$PROJECT_DIR/.agentflow/pm/sprints/sprint-${SPRINT_PAD}/summary.md")
CHANGELOG=$(cat "$PROJECT_DIR/.agentflow/pm/sprints/sprint-${SPRINT_PAD}/CHANGELOG.md")

# Build PR body in a temp file to avoid quoting issues
PR_BODY_FILE=$(mktemp /tmp/agentflow-pr-XXXXXX.md)
cat > "$PR_BODY_FILE" << PRBODY
## Sprint ${SPRINT_PAD} Summary

${SUMMARY}

---

## Changelog

${CHANGELOG}

---

## Checklist
- [ ] All milestone reviews passed
- [ ] No open blocking bugs
- [ ] Specs up to date
- [ ] test-criteria.md coverage verified

> Merge to complete sprint ${SPRINT_PAD}.
PRBODY

REPO_NAME=$(grep "name:" "$PROJECT_DIR/.agentflow/CONTEXT.md" | head -1 | awk '{print $2}')

gh pr create \
  --repo "${GITHUB_ORG}/${REPO_NAME}" \
  --base main \
  --head "$SPRINT_BRANCH" \
  --title "Sprint ${SPRINT_PAD} — $(head -1 "$PROJECT_DIR/.agentflow/pm/sprints/sprint-${SPRINT_PAD}/summary.md" | sed 's/^# //')" \
  --body-file "$PR_BODY_FILE"

rm -f "$PR_BODY_FILE"

# Get PR URL and record it
PR_URL=$(gh pr view --repo "${GITHUB_ORG}/${REPO_NAME}" --head "$SPRINT_BRANCH" --json url -q .url)
```

**Multi-repo**: run `gh pr create` for each repo, collect all URLs.

After PR(s) created → notify the lead via SendMessage with PR URL(s) so the lead can inform the user.

---

## Operation D — Post-merge cleanup (reviewer/Architect only)

Called by: reviewer (Architect role) after lead confirms the PR has been merged.
The lead triggers this by sending a message to the reviewer after the user merges the PR.

```bash
SPRINT_NUM=...
SPRINT_PAD=$(printf '%02d' "$SPRINT_NUM")
SPRINT_BRANCH="sprint-${SPRINT_PAD}"

cd "$REPO_DIR"
git checkout main
git pull origin main

# Delete local sprint branch (remote kept for history)
git branch -d "$SPRINT_BRANCH" 2>/dev/null || true

# Tag the completed sprint
git tag "sprint-${SPRINT_PAD}-complete"
git push origin "sprint-${SPRINT_PAD}-complete"
```

**Multi-repo**: repeat for each repo.

Then immediately run **Operation B** to create the next sprint branch.

---

## Commit message conventions

| Type   | When to use                              |
|--------|------------------------------------------|
| feat   | New feature or component                 |
| fix    | Bug fix                                  |
| spec   | Architect spec changes (api.yaml, etc.)  |
| docs   | README, CLAUDE.md, architecture.md       |
| chore  | Setup, config, build, git structure      |
| test   | Test files, test-criteria.md updates     |

Scope examples: `frontend/team-01`, `backend/team-01`, `architect`, `pm`

---

## Error handling

| Error | Action |
|-------|--------|
| `git push` conflict | `git pull --rebase origin <branch>` then push again |
| `gh pr create` — PR already exists | `gh pr list --head <branch>` to get URL |
| Branch already exists on remote | `git checkout -b <branch> origin/<branch>` |
| Nothing to commit | Log "nothing to commit" and skip — not an error |
| GITHUB_TOKEN expired | Message the lead: "GitHub auth expired, cannot push" |
| `REPO_DIR` not set | Read .agentflow/CONTEXT.md github.repos section to find local path |
