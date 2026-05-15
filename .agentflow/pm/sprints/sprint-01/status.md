---
id: sprint-01-status
sprint: 1
project: foosball-api
team: sprint-01
status: paused
updated: 2026-05-15 17:46
---

# Sprint-01 Status — PAUSED

Sprint messo in pausa dall'utente subito dopo lo spawn dei 3 backend implementer (17:45 → 17:46). Shutdown_request inviato a tutti e 3. Ripresa: vedi CONTEXT.md "Next Steps".

## Teammates (paused)
| Name | Task | Status | Owner area | Progress file |
|---|---|---|---|---|
| backend-api | #1 Backend: api | shutdown requested | apps/api, libs/matches, libs/leaderboard | .agentflow/teams/team-01/backend/progress-api.md |
| backend-auth | #2 Backend: auth | shutdown requested | apps/auth, libs/auth, libs/users | .agentflow/teams/team-01/backend/progress-auth.md |
| backend-jobs | #3 Backend: jobs | shutdown requested | apps/worker, apps/producer, libs/events | .agentflow/teams/team-01/backend/progress-jobs.md |

## Task graph
```
#1 backend-api  ─┐
#2 backend-auth ─┼─→ #4 Code Review ─→ #5 QA ─→ #6 Architect Review ─→ #7 Docs
#3 backend-jobs ─┘
```

## Coordination notes
- Migration order: backend-auth FIRST (users, refresh_tokens), then backend-api (matches, ...).
- backend-jobs ships `libs/events/` typed contracts early so backend-api can publish.
- backend-api uses JwtAuthGuard from libs/auth (stub allowed until backend-auth lands).
- Shared file edits (package.json deps, .env.example, tsconfig) flow through PM (team-lead).

## Awaiting
- Resume utente. Al resume: re-spawn dei 3 implementer (template in pm.md), task #1-#3 ancora in_progress.

## Blockers
- None.
