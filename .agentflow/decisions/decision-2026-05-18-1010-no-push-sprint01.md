---
id: decision-2026-05-18-1010-no-push-sprint01
type: decision
status: accepted
topic: sprint01-close-no-push
date: 2026-05-18 10:10
sprint: 1
---

## Question

Sprint-01 chiuso, tutto committato in locale su `master` (HEAD 40f55a6).
`origin/master` fermo al commit iniziale (9b41d3f). Opzioni di pubblicazione:
- A) Branch `sprint-01` dall'HEAD locale + push + PR `sprint-01` → `master`.
- B) Push diretto di `master` su origin, senza PR.
- C) Non pushare — lasciare tutto in locale.

## User Response

Opzione C — "Non pushare". L'utente vuole lasciare il lavoro dello sprint-01
committato solo in locale e decidere in seguito come pubblicarlo.

## Impact

- Nessun push, nessun branch remoto, nessuna PR aperta per lo sprint-01.
- I 5 commit dello sprint-01 restano su `master` locale (9b41d3f..40f55a6).
- Sprint Close Checklist: GATE 1-4 completati; gli step git-ops (commit PM files,
  apertura PR) sono completati solo per la parte commit locale — la pubblicazione
  remota è esplicitamente differita su richiesta utente.
- Quando l'utente vorrà pubblicare: ricreare un branch dall'HEAD e aprire la PR,
  oppure push diretto, a sua scelta.
