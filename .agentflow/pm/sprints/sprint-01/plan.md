---
id: sprint-01-plan
status: open
sprint: 1
project: foosball-api
team: team-01
created_at: 2026-05-15
approved_at: null
---

# Sprint-01 Plan — foosball-api MVP

## Sprint Goal
Consegnare l'MVP completo del foosball-api come da briefing: monorepo NestJS+Fastify funzionante, Azure SSO con ruoli, CRUD partite con conferma a quorum e immutabilità post-conferma, leaderboard utenti/coppie con filtri temporali, eventi BullMQ tipizzati, Swagger pubblicato, CI verde, DoD del briefing soddisfatto.

## Scope incluso
Tutte le user story della DoD del briefing:
- Foundation monorepo (4 apps + libs) — fatto in setup dall'Architect, validato in sprint.
- Azure SSO + ruoli admin/user via claim `groups` con fallback Graph API.
- CRUD partite (1v1, 2v2, 4v4 - default 2v2), aggiunta giocatori, inserimento risultato.
- Conferma quorum (metà + 1), blocco modifica in conferma, annulla conferma da creatore.
- Immutabilità post-conferma, override admin con audit log.
- Leaderboard utenti e coppie con filtri (settimana, mese, anno, totale).
- Eventi BullMQ tipizzati con retry + DLQ verificabili end-to-end.
- Swagger su `/api/docs`, test coverage backend ≥ 80%, e2e flussi critici, CI verde.

## Scope NON incluso (out of sprint-01)
- Tornei/bracket.
- Notifiche push o integrazioni Slack/Teams.
- Frontend.

Se durante lo sprint emerge complessità che richiede uno split in sprint-02, il PM escala all'utente.

## Milestones

| ID | Goal | Owner principale |
|---|---|---|
| **M1** | Foundation + Auth: monorepo migrato, docker-compose, Fastify adapter, Azure SSO end-to-end, ruoli funzionanti | `backend-auth` (drive) + `backend-api` (Fastify adapter su apps/api) |
| **M2** | Match domain: schema partite/giocatori/conferme/audit, CRUD endpoint, logica quorum, immutabilità, override admin | `backend-api` (drive) + `backend-jobs` (eventi match.created/result.confirmed) |
| **M3** | Leaderboard + jobs: query utenti/coppie con filtri, producer cron, worker consumer con retry/DLQ | `backend-api` (leaderboard) + `backend-jobs` (cron + worker) |
| **M4** | Quality gate: Swagger completo, coverage ≥ 80%, e2e suite verdi, CI verde, README aggiornato | tutti (chiusura) + QA |

I milestone sono indicativi — il task graph reale viene definito dopo che l'Architect produce le specs (api.yaml, schema.sql, test-criteria.md) in `specs` mode.

## Acceptance Criteria (sprint-level)
Tutti gli e2e elencati nel briefing DoD devono essere verdi:
- Creazione partita → aggiunta giocatori → inserimento risultato.
- Conferma raggiunge quorum (metà+1) → risultato immutabile.
- Tentativo modifica in conferma → 403/409.
- Creatore annulla conferma → consensi a 0, risultato modificabile.
- Admin override risultato confermato → consentito + audit log.
- Login SSO Azure → token validato, ruolo assegnato via gruppo AD.
- Leaderboard utenti/coppie corretti su tutti i filtri.

Coverage backend ≥ 80% (statement). CI: lint + unit + e2e + build tutte le 4 apps.

## Team assignment
- **Architect**: produrrà specs (api.yaml, schema.sql, test-criteria.md), eseguirà migrazione monorepo, presiederà code review N>1 split-per-area via Code Reviewer teammate.
- **backend-api** (`apps/api/`, `libs/matches/`, `libs/leaderboard/`): match domain + leaderboard query + Fastify adapter su API.
- **backend-auth** (`apps/auth/`, `libs/auth/`, `libs/users/`): MSAL flow, JWT interno + refresh token MySQL, ruoli + Graph fallback.
- **backend-jobs** (`apps/worker/`, `apps/producer/`, `libs/events/`): producer cron, worker consumer, payload tipizzati EventEnvelope, retry + DLQ.
- **backend-reviewer**: review codice di tutti gli implementer prima di QA.
- **QA**: test plan da test-criteria.md, esecuzione, report.

## Coordination notes (rischi residui dall'Architect)
1. **Migration ordering N>1**: i PR contenenti migrations TypeORM devono essere mergiati nell'ordine raccomandato dall'Architect — `backend-auth` (users, refresh_tokens) → `backend-api` (matches, match_players, confirmations, audit_logs) → `backend-jobs` (se necessario). Il PM coordina.
2. **Jest + `module: nodenext`**: validare presto la config Jest (tsconfig di test separato in `module: commonjs`) — bloccante per le test suite. Architect documenta nelle specs.
3. **Fastify + Swagger version pinning**: l'Architect verifica e pinna le versioni in `package.json` prima dello spawn implementer; eventuale patch via change request leggero.

## Definition of Sprint Done
- Tutti i 4 milestone chiusi.
- DoD del briefing soddisfatta (vedi Acceptance Criteria sopra).
- Code review approvati per ogni area (frontend N/A — solo backend).
- QA report PASS con npm test (unit + e2e) e coverage ≥ 80%.
- README e Swagger completi.
- PR aperta al main con CHANGELOG e summary.

## Next step
PM spawna Architect in `specs` mode con questo plan come contesto, per produrre `api.yaml`, `schema.sql`, `test-criteria.md`.
