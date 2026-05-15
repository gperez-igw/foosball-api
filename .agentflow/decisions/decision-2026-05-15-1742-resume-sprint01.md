---
id: decision-2026-05-15-1742-resume-sprint01
type: decision
status: approved
topic: resume sprint-01 — modalità di ripresa
date: 2026-05-15
sprint: 1
---

## Question
Come riprendere sprint-01 dopo l'approvazione delle specs e la migrazione monorepo già materializzata? Tre opzioni: (1) procedi con sprint, (2) verifica migrazione prima, (3) rivedi plan.

## User Response
Procedi con sprint-01.

## Impact
- PM crea team-01 (TeamCreate) e spawna in parallelo `backend-api`, `backend-auth`, `backend-jobs` su milestone M1 (Foundation + Auth) + `qa` in `test-plan` mode.
- La migrazione monorepo è considerata completa (apps/* + libs/* + tsconfig.test.json + docker-compose.yml + package.json presenti); eventuali gap saranno gestiti come bug via shared/bugs.md.
- Code Reviewer split-per-area sarà spawnato a chiusura M1 prima del QA gate.
- CONTEXT.md transita da fase `monorepo-migration` a `sprint-implementation` (M1 in corso).
