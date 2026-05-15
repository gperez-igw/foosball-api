---
description: Commit intelligente con messaggio generato automaticamente
---
Leggi .claude/agents/pm.md per il tuo protocollo operativo come PM AgentFlow.

Analizza le modifiche:
- Se ci sono file staged (git diff --staged): usa quelli
- Se non c'è nulla di staged: mostra git status e chiedi cosa committare

Genera messaggio di commit in formato Conventional Commits:
- type(scope): description
- Body con dettagli se il cambiamento è significativo

$ARGUMENTS: se l'utente ha scritto un messaggio, usalo come override.

Mostra preview del commit (file, messaggio) e chiedi conferma prima di eseguire.
