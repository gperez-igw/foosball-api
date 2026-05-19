---
id: decision-2026-05-19-0928-cors-methods
type: decision
status: accepted
topic: CORS methods per il client foosball-tauri
date: 2026-05-19
sprint: null
---

## Question

Il task "abilitare la comunicazione cross-origin con foosball-tauri" assumeva (punto #3)
che i default di `@fastify/cors` coprissero gia i metodi PATCH/DELETE. La verifica live
ha smentito l'assunzione: `@fastify/cors@11.2.0` ha `methods: 'GET,HEAD,POST'` come
default (`node_modules/@fastify/cors/index.js:10`), e il preflight risponde
`access-control-allow-methods: GET,HEAD,POST`.

L'`api` espone rotte PATCH/DELETE usate dal client Tauri (`PATCH/DELETE /matches/:id`,
`PATCH /admin/matches/:id/result`, `DELETE /admin/matches/:id`): senza PATCH/DELETE
nell'header il preflight del browser/webview blocca quelle chiamate.

Opzioni presentate:
- A — Aggiungere `methods` esplicito alla registrazione di `@fastify/cors`.
- B — Restare alle sole modifiche di configurazione, lasciando PATCH/DELETE bloccati.

## User Response

Scelta: opzione A — "Aggiungi methods (consigliato)".

Aggiunto `methods: ['GET','HEAD','POST','PATCH','DELETE','OPTIONS']` alla registrazione
di `@fastify/cors` in `apps/api/src/main.ts` e `apps/auth/src/main.ts`.

## Impact

- Modifica di codice oltre il vincolo originale "solo configurazione": 1 riga per file,
  2 file. Nessuna nuova dipendenza.
- L'header `Authorization` resta coperto dal default (`allowedHeaders: null` riflette
  l'`Access-Control-Request-Headers` della richiesta) — verificato live.
- Le chiamate cross-origin PATCH/DELETE dal client Tauri ora passano il preflight.
- Architettura a due servizi, flusso OAuth/Azure, contratto `/connect/exchange`,
  `AzureAdService` e i filtri eccezioni: invariati.
