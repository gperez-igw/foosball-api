---
id: decision-2026-05-18-0834-resume-audit-first
type: decision
status: accepted
topic: resume-sprint01-audit-first
date: 2026-05-18 08:34
sprint: 1
---

## Question

Sprint-01 ripreso con `/resume`. Il codice backend esistente (90 file in apps/+libs/)
risulta più avanzato di quanto indicato nelle RESUME-NOTES, che parlavano di solo
"skeleton". Non esistono file progress-{api,auth,jobs}.md, quindi manca una stima
affidabile di completamento. Opzioni presentate:
- A) Audit Architect del codice esistente vs specs, poi rilancio implementer.
- B) Rilancio immediato dei 3 implementer con auto-inventario.
- C) Salto implementer, vado diretto a Code Review + QA.

## User Response

Opzione A — "Audit prima, poi implementa". L'utente vuole prima un audit Architect
del codice esistente contro le specs (cosa è completo / cosa manca per area), poi
rilancio dei 3 implementer con istruzioni precise basate sull'audit.

## Impact

- PM spawna Architect in mode `analyze` per produrre un report code-vs-spec per le
  3 aree backend (api, auth, jobs).
- I 3 implementer (backend-api, backend-auth, backend-jobs) NON vengono rilanciati
  finché l'audit non è completo.
- Dopo l'audit: PM rilancia gli implementer con il delta esatto da completare,
  riducendo il rischio di rilavorazione.
- Coordinamento: in questo ambiente i tool Agent Teams non sono disponibili; PM
  spawna i subagent direttamente via Agent tool.
