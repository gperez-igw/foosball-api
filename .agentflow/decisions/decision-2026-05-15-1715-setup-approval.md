---
id: decision-2026-05-15-1715-setup-approval
type: decision
status: approved
topic: architect-setup-approval-and-tech-choices
date: 2026-05-15
sprint: null
---

## Question
Approvare i deliverable di setup dell'Architect (`teams.md`, `architecture.md`, `README.md`, `review.md`) e confermare 3 scelte tecniche aperte?

Opzioni presentate:
- Setup approval: Approva / Request changes / Rifiuta
- ORM: TypeORM (Recommended) / Prisma
- Refresh token storage: MySQL (Recommended) / Redis
- Monorepo apps: 4 apps (Recommended) / 3 apps (producer fuso in worker)

## User Response
- **Setup**: Approva
- **ORM**: TypeORM
- **Refresh token storage**: MySQL
- **Apps**: 4 apps (api + auth + worker + producer)

Tutti i default raccomandati dall'Architect sono stati confermati.

## Impact
- Architect procede a Phase 3 (sprint-01 specs): `api.yaml`, `schema.sql`, `test-criteria.md`.
- Migrazione monorepo eseguita dall'Architect in setup, prima di qualsiasi implementer (evita race condition N>1).
- Stack confermato per gli implementer: NestJS 11 + Fastify + TypeORM + MySQL + Redis + BullMQ + Azure MSAL + Swagger.
- 4 apps (api, auth, worker, producer) → 4 entry point indipendenti in `apps/*`.
- File ownership N>1 confermato come definito dall'Architect in `teams.md`:
  - `backend-api` → `apps/api/`, `libs/matches/`, `libs/leaderboard/`
  - `backend-auth` → `apps/auth/`, `libs/auth/`, `libs/users/`
  - `backend-jobs` → `apps/worker/`, `apps/producer/`, `libs/events/`
- Refresh tokens persistiti in tabella MySQL `refresh_tokens` (rotazione single-use, 24h).
- Residual risks segnalati dall'Architect (Jest+nodenext, swagger+fastify version pinning, migration ordering N>1) presi in carico dal PM per coordinamento sprint-01.
