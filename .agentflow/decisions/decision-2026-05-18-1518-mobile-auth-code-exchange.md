---
id: decision-2026-05-18-1518-mobile-auth-code-exchange
type: decision
status: accepted
topic: mobile-sso-deep-link-flow
date: 2026-05-18 15:18
sprint: 1
---

## Question

Un client mobile (Tauri) deve effettuare il login Azure SSO. Oggi il backend non
fa redirect post-callback: `GET /connect` restituisce direttamente il token pair
come JSON 200. Per il mobile servono i deep link `foosball://auth/callback`. Due
flussi proposti:
- A) Redirect deep link: `/connect` fa `reply.redirect('foosball://auth/callback#...token...')`.
  Semplice lato client ma i token passano nell'URL del deep link.
- B) Code exchange separato: `foosball://auth/callback` registrato come redirect
  URI su Azure, il client mobile cattura il `code` dal deep link e lo scambia con
  un endpoint backend dedicato (es. `POST /connect/exchange`). I token non passano
  mai dall'URL.

## User Response

Flusso **B** — code exchange separato.

## Impact

- Nuovo endpoint backend pubblico per lo scambio del `code` (POST, body JSON) che
  restituisce il token pair — riusa la logica di `handleCallback`.
- Il backend resta confidential client: il client secret NON va sul mobile, lo
  scambio code→token avviene sul backend.
- Vincolo OAuth2: il `redirect_uri` usato nella richiesta di autorizzazione deve
  combaciare con quello usato nello scambio del code. Serve quindi un secondo
  redirect URI (`foosball://auth/callback`) accanto a quello web → nuova config
  e flusso di login client-aware (web vs mobile).
- Spec impattate: api.yaml (nuovo endpoint + eventuale variante login),
  architecture.md, test-criteria.md, docs.
- Flusso: Architect produce feature-spec → PM presenta → backend-auth implementa
  → code review.

## Follow-up — protezione CSRF del parametro `state` (2026-05-18 15:30)

La spec dell'Architect ha sollevato un punto aperto: nello scambio server-side
stateless, MSAL Node non valida il nonce `state`. Opzioni: best-effort (accetta e
logga, no validazione stretta) vs CSRF stretto con nonce store Redis a TTL breve.

**User Response**: best-effort. Il `state` viene accettato e loggato ma non
validato in modo stretto — adeguato per un client mobile interno/fidato.
La validazione stretta resta come possibile follow-up se il threat model cambia.
