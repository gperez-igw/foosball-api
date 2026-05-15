---
id: decision-2026-05-15-1708-team-composition
type: decision
status: approved
topic: team-composition
date: 2026-05-15
sprint: null
---

## Question
Approvare la composizione team proposta in `.agentflow/pm/setup.md`?

Proposta: Designer=0, Prototyper=0 (skip — API-only), Architect=1, QA=1,
Backend N>1 (3 implementer + 1 reviewer), Code Reviewer=1.

Opzioni presentate:
- Approva (Recommended)
- Modifica composizione
- Rifiuta

## User Response
**Approva**. La composizione viene confermata così com'è.

## Impact
- Skip Designer e Prototyper formalmente decretato — non verranno spawnati in questo ciclo di sprint.
- Architect procede direttamente in Phase 2 (Spec setup) senza upstream Designer/Prototyper.
- Backend N>1: 3 implementer paralleli + 1 reviewer. Riduce il wall-clock time dello sprint-01 a costo di overhead di coordinamento (file shared mediati dal PM).
- In caso di futuro frontend (iterazione separata), Designer/Prototyper potranno essere ri-attivati via nuovo briefing di iterazione.
