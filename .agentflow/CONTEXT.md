---
project: foosball-api
phase: sprint-implementation
status: paused
mode: sprint
current_sprint: 1
briefing: briefings/foosball-api.md
autonomy: supervised
updated: 2026-05-15 17:46
---

## Current State
Phase: Sprint-01 implementation **PAUSED** dall'utente subito dopo spawn. Team `sprint-01` creato, 7 task in pipeline, 3 implementer backend (api/auth/jobs) appena spawnati in parallelo e poi ricevuto shutdown request. Riprendere con `/resume` → rilanciare i 3 backend implementer (i task #1, #2, #3 sono ancora in_progress nel team task list).
Sprint: 1.

## Completed
- 2026-05-15: Briefing approvato.
- 2026-05-15 17:08: Setup PM approvato — Designer/Prototyper skip, backend N>1.
- 2026-05-15 17:08: Backend split delegato all'Architect.
- 2026-05-15 17:15: Setup Architect approvato — TypeORM, refresh token MySQL, 4 apps.
- 2026-05-15 17:35: Specs sprint-01 approvate — quorum floor(n/2)+1, draw = 0 wins, leaderboard coppie su tutte le partite.
- 2026-05-15 17:40: Migrazione monorepo materializzata (apps/api, apps/auth, apps/worker, apps/producer + 8 libs).
- 2026-05-15 17:42: Resume sprint-01 approvato dall'utente.

## Active Agents
- (Nessuno — sprint paused 17:46. backend-api, backend-auth, backend-jobs ricevuto shutdown_request).

## Decisions Made
- Team: skip Designer/Prototyper, backend N>1 (3 impl + 1 reviewer), QA=1.
- Stack: NestJS 11 + Fastify + TypeORM + MySQL + Redis + BullMQ + Azure MSAL + Swagger.
- 4 apps: `apps/api`, `apps/auth`, `apps/worker`, `apps/producer`.
- File ownership: backend-api (apps/api + libs/matches + libs/leaderboard); backend-auth (apps/auth + libs/auth + libs/users); backend-jobs (apps/worker + apps/producer + libs/events).
- Refresh token MySQL, JWT 15min, is_admin cached.
- Quorum: floor(n/2)+1 (1v1→2, 2v2→3, 4v4→5).
- Draw: 0 wins per entrambe.
- Leaderboard coppie: tutte le partite (4v4 → 6 coppie per win).
- Audit log: soft FK, preserva history su delete match.
- Migration order: auth → api → jobs.
- Resume mode: procedi con sprint senza re-review della migrazione (decision-2026-05-15-1742-resume-sprint01.md).

## Next Steps (al resume)
1. `/resume` → rileggere `.agentflow/teams/team-01/backend/progress-{api,auth,jobs}.md` per capire dove si erano fermati.
2. Re-spawnare i 3 implementer nel team esistente `sprint-01` con stessa prompt (template in `.claude/agents/pm.md`) — i task #1, #2, #3 esistono già in_progress, non ricrearli.
3. Monitor → Code Reviewer (#4) → QA (#5) → Architect Review (#6) → Docs (#7).
4. Sprint close checklist → PR.

## Resume notes
- Team `sprint-01` esiste già: NON chiamare TeamCreate di nuovo.
- Task graph esiste già (1-7 con blockedBy): NON ricreare i task.
- I 3 implementer erano stati spawnati alle ~17:45 e fermati alle 17:46 — probabilmente NON hanno scritto file di codice; verificare in apps/ libs/ prima di ripartire.

## Blockers
- Nessuno.
