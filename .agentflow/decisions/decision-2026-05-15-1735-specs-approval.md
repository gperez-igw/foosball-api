---
id: decision-2026-05-15-1735-specs-approval
type: decision
status: approved
topic: sprint-01-specs-approval-and-business-rules
date: 2026-05-15
sprint: "01"
---

## Question
Approvare le specs sprint-01 (api.yaml, schema.sql, test-criteria.md) e confermare 3 regole di business aperte?

Opzioni presentate:
- Specs approval: Approva / Request changes / Rifiuta
- Quorum: floor(n/2)+1 (Recommended) / ceil(n/2)
- Pareggi: nessuna vittoria (Recommended) / vittoria entrambe / vieta pareggio
- Leaderboard coppie scope: tutte le partite (Recommended) / solo 2v2 / 2v2 + 4v4 con coppie fisse

## User Response
- **Specs**: Approva
- **Quorum**: `floor(n/2) + 1` (stricter) — 1v1→2, 2v2→3, 4v4→5
- **Pareggi**: 0 win per entrambe le squadre (draw NON conta come vittoria)
- **Leaderboard coppie**: tutte le partite. 2v2 → 1 coppia per win; 4v4 → C(4,2)=6 coppie per win.

Tutti i default raccomandati dall'Architect sono stati confermati.

## Impact
- Implementer ricevono regole di business definitive.
- `libs/matches/src/confirmation.service.ts` implementa `quorumRequired = floor(totalPlayers / 2) + 1`.
- Leaderboard logic (`libs/leaderboard/`):
  - draw (scoreA == scoreB) → nessuna vittoria conteggiata.
  - winning team in 4v4 → genera 6 entry coppie sulla `pair_wins`/equivalente.
- Test-criteria.md e BullMQ event contracts (`match.confirmed.winnerTeam: 'A' | 'B' | 'draw'`) confermati.
- Audit log: soft FK su `audit_logs.entity_id` confermato (no cascade, preserva audit history).
- Migration sequence enforced: Phase 1 (backend-auth: users, refresh_tokens) → Phase 2 (backend-api: matches, match_players, match_confirmations, audit_logs) → Phase 3 (backend-jobs: no SQL).
- Stack references in `references/*.md` (root) sono autorizzate come deliverable Architect condivisi.

## Next steps post-decision
1. Architect esegue la **migrazione monorepo** (scaffold flat src/ → apps/api + apps/auth + apps/worker + apps/producer + libs/*), aggiunge `tsconfig.test.json`, `docker-compose.yml`, `.env.example`, pinning Fastify+Swagger in package.json.
2. PM crea team sprint-01 (TeamCreate), task graph, e spawna i 3 implementer paralleli (backend-api, backend-auth, backend-jobs) con QA in test-plan mode.
