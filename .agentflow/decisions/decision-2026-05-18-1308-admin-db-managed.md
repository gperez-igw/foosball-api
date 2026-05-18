---
id: decision-2026-05-18-1308-admin-db-managed
type: decision
status: accepted
topic: admin-decoupled-from-azure
date: 2026-05-18 13:08
sprint: 1
---

## Question

Oggi lo stato admin di un utente (`is_admin`) è derivato dal claim `groups` di
Azure AD (appartenenza a `ADMIN_AZURE_GROUP_ID`) con fallback Microsoft Graph API.
L'utente vuole scollegare l'admin dal login Azure: deve essere un'informazione
salvata a database e modificabile autonomamente. Due domande poste:
1. Come modificare lo stato admin una volta scollegato da Azure?
2. Cosa fare del codice gruppi Azure + fallback Graph, che serviva solo all'admin?

## User Response

1. **Solo colonna DB** — `is_admin` resta una semplice colonna del database,
   modificabile direttamente via SQL/strumento DB. Nessun endpoint API dedicato.
2. **Rimuovi tutto** — eliminare estrazione gruppi, fallback Graph API e la env
   `ADMIN_AZURE_GROUP_ID`. Il login Azure serve solo per l'identità (oid, email,
   nome).

## Impact

- **Modello admin**: `is_admin` è una colonna DB (default `false`), non più
  derivata da Azure. Gestione manuale via database.
- **Login/callback**: alla login NON si tocca più `is_admin`. Nuovo utente →
  `is_admin = false` (default DB). Utente esistente → si preserva il valore DB
  (l'upsert non deve sovrascrivere `is_admin`).
- **Codice da rimuovere**: estrazione `groups` dal token, fallback Graph API,
  env `ADMIN_AZURE_GROUP_ID`, risposta `503 AZURE_GRAPH_UNAVAILABLE` legata al
  fallback.
- **Spec impattate**: api.yaml (operazione callback), test-criteria.md
  (Scenario 6 — 6a/6b cambiano, 6f/6g obsoleti), eventualmente schema.sql.
- **Bootstrap primo admin**: il primo admin va impostato direttamente a DB.
- **Flusso**: Architect aggiorna le spec → PM presenta → backend-auth implementa
  → code review.
