---
project: foosball-api
tech_stack:
  - NestJS 11 (monorepo)
  - Fastify
  - TypeScript
  - MySQL
  - Redis
  - BullMQ
  - Azure SSO (Microsoft Auth)
  - Swagger
mode: continue
workflow:
  autonomy: supervised
team:
  backend: 3
  qa: 1
  frontend: 0
  designer: 0
agents:
  backend:
    - name: backend-api
      owns:
        - apps/api/
        - libs/matches/
        - libs/leaderboard/
    - name: backend-auth
      owns:
        - apps/auth/
        - libs/auth/
        - libs/users/
    - name: backend-jobs
      owns:
        - apps/worker/
        - apps/producer/
        - libs/jobs/
        - libs/events/
    - name: backend-reviewer
      reviewer: true
---

# Foosball API

## Contesto e obiettivo
Un servizio API per l'azienda che permetta di registrare, salvare e visualizzare i risultati delle partite di calcetto durante la pausa pranzo.

## Scope (cosa SI fa)
- Creazione e modifica partite (1v1, 2v2, 4v4 - default 2v2)
- Aggiunta giocatori partecipanti alla partita
- Inserimento del risultato finale
- Conferma risultato: per confermare, (metà + 1) dei giocatori devono accettare il risultato
- Impossibilità di modificare il risultato durante la fase di accettazione
- Il creatore della partita può annullare l'accettazione, modificare il risultato e far ripartire la conferma da 0
- Risultato completamente confermato immutabile (salvo amministratori)
- Visualizzazioni/API richieste:
  - Creazione/modifica partita
  - Vista per conferma risultati
  - Leaderboard utenti con più vittorie (filtri: settimana, mesi, anni, totale)
  - Leaderboard coppie con più vittorie (filtri: settimana, mesi, anni, totale)
  - Modifica dati utente
- Autenticazione tramite SSO Microsoft (Azure App)
- Struttura monorepo NestJS: worker BullMQ, producer, servizio API, servizio auth.
- Comunicazione tra servizi tramite eventi BullMQ.

## Non-scope (cosa NON si fa)
- Nessun Frontend (UI). Solo sviluppo API.
- Express (sostituito da Fastify).

## Utenti / attori
- Utenti: creano partite, partecipano, confermano risultati, vedono le classifiche.
- Amministratori: possono cancellare o modificare i risultati confermati.

## Vincoli tecnici
- Database: MySQL — migrations versionate, idempotenti e riproducibili (ORM a scelta dell'Architect tra TypeORM e Prisma)
- Redis + BullMQ per job e schedulazioni; le code sono tipizzate end-to-end e configurate con retry + DLQ
- Web server: Fastify al posto di Express
- Swagger raggiungibile su `/api/docs` per la documentazione delle API
- Struttura a monorepo NestJS con apps separate (`apps/api`, `apps/auth`, `apps/worker`, `apps/producer`) e libs condivise (`libs/common`, `libs/database`, ...)
- Comunicazione inter-servizio esclusivamente via eventi BullMQ — no chiamate HTTP interne tra apps
- Gestione ruoli (admin vs user): assegnata in base al claim `groups` del token Azure AD;
  Group ID admin configurabile via env (`ADMIN_AZURE_GROUP_ID`).
  Il ruolo viene sincronizzato su DB locale al login (flag `is_admin`) come cache leggibile dai servizi senza dover ri-parsare il token
- `.env.example` completo con tutte le variabili richieste; nessun segreto committato
- `docker-compose.yml` per sviluppo locale (MySQL + Redis) avviabile con un solo comando

## Definition of Done
- Architettura monorepo impostata: 4 apps (`api`, `auth`, `worker`, `producer`) buildable e avviabili indipendentemente
- Code BullMQ funzionanti end-to-end: il `producer` pubblica eventi tipizzati, il `worker` li consuma con retry + DLQ verificabili
- Test coverage backend ≥ 80% (statement) sulla business logic (accettazione/conferma, conteggio vittorie, ruoli)
- E2E sui flussi critici tutti verdi:
  - Creazione partita → aggiunta giocatori → inserimento risultato
  - Conferma risultato raggiunge il quorum (metà + 1) e diventa immutabile
  - Tentativo di modifica risultato in fase di conferma → bloccato (403/409)
  - Creatore annulla la conferma → contatore consensi torna a 0 e il risultato torna modificabile
  - Admin modifica un risultato confermato → consentito e tracciato in audit log
  - Login SSO Azure → token validato e ruolo (admin/user) assegnato in base al gruppo AD
  - Leaderboard utenti e coppie restituiscono valori corretti su tutti i filtri temporali
- Swagger su `/api/docs` con tutti gli endpoint documentati (schema, esempi, codici errore)
- CI verde: lint + unit test + e2e + build di tutte le apps
- README con istruzioni di setup locale (`docker compose up` + comando di start) e `.env.example` allineato
