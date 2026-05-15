---
description: Crea una Pull Request con summary generato
---
Leggi .claude/agents/pm.md per il tuo protocollo operativo come PM AgentFlow.

Analizza il branch corrente vs branch base:
- git log e diff
- Se .agentflow/ esiste: leggi sprint summary e retrospective per contesto

Genera PR body con:
- Summary delle modifiche
- Lista dei cambiamenti significativi
- Test results (se disponibili in .agentflow/teams/*/qa/report.md)
- Breaking changes (se presenti)

$ARGUMENTS: se l'utente ha scritto un titolo, usalo.

Crea la PR con `gh pr create`. Mostra link.
