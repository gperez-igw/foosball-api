---
status: open
updated: 2026-05-15
---

# Backlog — foosball-api

Backlog vuoto. Verrà popolato dall'Architect durante setup (proposta milestone) e raffinato dal PM in sprint planning.

## Items proposti (placeholder, in attesa di setup approvato)

- Foundation: monorepo apps/+libs/, docker-compose dev (MySQL+Redis), Fastify adapter, .env.example
- Auth: Azure SSO (MSAL), middleware ruoli admin/user via claim `groups`, cache `is_admin` su DB
- Match domain: CRUD partite (1v1/2v2/4v4 default 2v2), aggiunta giocatori, inserimento risultato
- Match domain: conferma quorum (metà+1), blocco modifica in conferma, annulla conferma da creatore
- Match domain: immutabilità post-conferma, override admin con audit log
- Leaderboard: query utenti + coppie, filtri temporali (settimana/mese/anno/totale)
- Jobs: producer + worker BullMQ tipizzati, retry + DLQ
- Quality: Swagger /api/docs, test coverage ≥ 80%, e2e flussi critici, CI verde
