---
description: Valida il formato di un file briefing AgentFlow
---
$ARGUMENTS contiene il path al file briefing.

Se $ARGUMENTS è vuoto: chiedi il path.
Se il file non esiste: errore chiaro.

Valida il formato briefing v4:
- Frontmatter YAML presente e parsabile?
- Campi obbligatori: project, tech_stack
- Sezione team: almeno un ruolo definito?
- Workflow.autonomy: valore valido (supervised | full-auto)?
- Body markdown: almeno una sezione di descrizione?

Mostra errori specifici con riga e suggerimento di fix.
