---
description: Avvia un nuovo progetto AgentFlow da un file briefing
---
Leggi .claude/agents/pm.md per il tuo protocollo operativo come PM AgentFlow.

L'utente vuole avviare un progetto da briefing.
$ARGUMENTS contiene il path al file briefing.

Se $ARGUMENTS è vuoto: chiedi il path. Esempio: /briefing briefings/my-app.md
Se il file non esiste: errore chiaro.
Crea .agentflow/ se non esiste (struttura standard con CONTEXT.md).
Aggiorna CONTEXT.md con mode: sprint.
Entra in modalità sprint autonomo — flusso completo: design → prototype → spec → implement → review → test → docs → close.
