---
id: decision-2026-05-15-1708-backend-split
type: decision
status: approved
topic: backend-split-ownership
date: 2026-05-15
sprint: null
---

## Question
Confermare lo split N>1 backend proposto nel briefing (backend-api / backend-auth / backend-jobs + reviewer) con file ownership esclusivi?

Opzioni presentate:
- Conferma split (Recommended)
- Lascia decidere all'Architect
- Passa a N=1

## User Response
**Lascia decidere all'Architect**. Lo split proposto nel briefing diventa indicativo;
l'Architect è autorizzato a ridefinire i file ownership in `teams.md` in base alla sua analisi del codebase NestJS esistente.

## Impact
- Lo `agents:` block nel briefing è un'**indicazione**, non un vincolo: nomi (`backend-api`, `backend-auth`, `backend-jobs`, `backend-reviewer`) e numerosità (3+1) restano, ma le `owns:` paths possono cambiare.
- L'Architect è il decisore finale sulla suddivisione: nel suo `teams.md` deve giustificare lo split scelto (criteri: coesione, accoppiamento, footprint dei file shared).
- Il PM presenterà la proposta dell'Architect all'utente come parte dell'approvazione `architect/specs/review.md`. L'utente potrà rifiutare o richiedere modifiche.
- Vincolo invariato dal briefing: N=3 implementer + 1 reviewer, comunicazione inter-servizio solo via BullMQ.
