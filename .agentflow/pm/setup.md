---
status: approved
date: 2026-05-15
approved_at: 2026-05-15 17:08
project: foosball-api
mode: continue
briefing: briefings/foosball-api.md
decisions:
  - decision-2026-05-15-1708-team-composition
  - decision-2026-05-15-1708-backend-split
---

# Project Setup — Team Proposal

## Sintesi briefing
API NestJS in monorepo per registrare partite di calcetto aziendali con conferma a quorum, leaderboard utenti/coppie, e SSO Azure. Solo backend, comunicazione inter-servizio via BullMQ.

## Mode
`continue` — la repo ha già uno scaffold NestJS 11 (`src/app.module.ts`, `src/main.ts`, `package.json`). L'Architect riorganizzerà la struttura in monorepo (`apps/*` + `libs/*`) lavorando sull'esistente, non da zero.

## Composizione team proposta

| Ruolo | N | Note |
|---|---|---|
| Designer | 0 | **SKIP** — progetto API-only, nessuna UI da disegnare |
| Prototyper | 0 | **SKIP** — nessun prototipo HTML necessario |
| Architect | 1 | Setup → specs → review → docs |
| QA | 1 | Test plan + execution su flussi critici (vedi DoD briefing) |
| Backend (N>1) | 3 implementer + 1 reviewer | Split per servizio (vedi sotto) |
| Code Reviewer | 1 | Review backend prima del QA gate |

### Backend N>1 — split per area (da briefing)

| Agente | Area esclusiva (proposta) |
|---|---|
| `backend-api` | `apps/api/`, `libs/matches/`, `libs/leaderboard/` |
| `backend-auth` | `apps/auth/`, `libs/auth/`, `libs/users/` |
| `backend-jobs` | `apps/worker/`, `apps/producer/`, `libs/jobs/`, `libs/events/` |
| `backend-reviewer` | reviewer (no write area) |

File condivisi (`package.json`, `nest-cli.json`, `tsconfig*.json`, `docker-compose.yml`, `.env.example`, `libs/common/`, `libs/database/`): owner = Architect durante setup; durante sprint il primo a richiederne modifica passa via PM.

## Razionale skip Designer/Prototyper

Briefing dichiara esplicitamente in Non-scope: "Nessun Frontend (UI). Solo sviluppo API." Designer e Prototyper producono artefatti UI (design system, wireframe, prototipo HTML/CSS) che non hanno consumer in questo progetto. Eseguire quelle fasi sarebbe puro overhead.

In caso futuro venga aggiunto un frontend (iterazione separata), si potrà ri-attivare la fase Designer con `/briefing` di iterazione.

## Skill Discovery — stack da coprire

CLI `npx skills` non disponibile in questo ambiente. L'Architect e gli implementer useranno:
- conoscenza nativa del modello sullo stack (NestJS, Fastify, MySQL, BullMQ, Azure AD/MSAL, Swagger/OpenAPI)
- skill AgentFlow già installate (`.claude/skills/`: validate-spec, check-consistency, security-review, run-tests, reviewer-checklist, codebase-analysis, github-setup, ecc.)

Se servisse uno skill pack stack-specifico in futuro (es. un set NestJS), si può installare manualmente in `.claude/skills/` o caricare via MCP.

## Milestones di alto livello (orientative — sprint-01)

1. **M1 — Foundation**: monorepo apps/+libs/, docker-compose, Fastify adapter, base auth Azure SSO + middleware ruoli.
2. **M2 — Match domain**: CRUD partite, conferma quorum (metà+1), immutabilità post-conferma, audit log admin.
3. **M3 — Leaderboard + observability**: query leaderboard utenti/coppie con filtri temporali; logging eventi BullMQ con retry+DLQ verificabile.
4. **M4 — Hardening**: test coverage ≥ 80%, e2e critici verdi, Swagger pubblicato, CI verde, README.

L'Architect può rinegoziare la suddivisione M1-M4 in base alla sua analisi del codebase.

## Risk register (iniziale)

- **R1** — Migrazione scaffold → monorepo NestJS: il setup attuale ha `src/` flat; la conversione tocca file condivisi. Mitigazione: l'Architect fa la migrazione in setup, prima di qualsiasi implementer (evita conflitti N>1).
- **R2** — Comunicazione BullMQ tipizzata: rischio di drift tra producer e consumer. Mitigazione: definire i payload eventi in `libs/events/` shared.
- **R3** — Token Azure AD + claim `groups`: il claim `groups` ha caps (richiede group claim configuration in Azure App). Mitigazione: l'Architect documenta la configurazione richiesta nel README; fallback su Graph API se gruppi > limite.

## Da approvare

- [ ] Composizione team (incluso skip Designer/Prototyper)
- [ ] Split N>1 backend per area
- [ ] Milestones di massima

Una volta approvato, PM procede a Skill Discovery e Architect setup.
