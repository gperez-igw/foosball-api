---
id: spec-feature-001
type: spec
project: foosball-api
sprint: null
created_by: architect
created_at: 2026-05-18
status: approved
requires_decision: false
---

# Feature Implementation Brief — Mobile OAuth2 Code Exchange (Flow B)

Decision: `.agentflow/decisions/decision-2026-05-18-1518-mobile-auth-code-exchange.md`
Specs updated: `api.yaml`, `architecture.md`, `test-criteria.md` (scenarios 6b-1 … 6b-10)

---

## Overview

Add support for the Azure AD SSO "separate code exchange" flow used by the
mobile (Tauri) client:

1. `GET /auth/login?client=mobile` returns `200 { url }` (not a 302).
2. `POST /connect/exchange` accepts `{ code, state }` and returns the token pair.

The web flow (`GET /auth/login` / `GET /connect`) is **not changed**.

---

## Environment Variable

Add to `.env.example`:

```ini
# ─── Azure AD / MSAL — Mobile deep-link (Tauri) ─────────────────────────────
# Must be registered as a Reply URL in the Azure App Registration.
# The custom scheme is handled by the Tauri app on the client device.
AZURE_MOBILE_REDIRECT_URI=foosball://auth/callback
```

Also add to any `.env.test` or CI environment config used by the test suite
(unit tests that mock MSAL can use any string value, but the env var must be
present so `ConfigService.getOrThrow` does not throw).

---

## File-by-file Changes

### 1. `libs/auth/src/azure-ad.service.ts`

**What to change:**
- Read `AZURE_MOBILE_REDIRECT_URI` from config (use `getOrThrow`).
- Expose two readonly properties: `webRedirectUri` and `mobileRedirectUri`.
- Make `getAuthCodeUrl(redirectUri: string)` accept a `redirectUri` parameter
  instead of always using `this.redirectUri`. Keep backward compatibility:
  rename the old field `this.webRedirectUri`.
- Make `exchangeCode(code: string, state: string, redirectUri: string)` accept
  a `redirectUri` parameter. The `state` parameter is kept (forwarded to MSAL
  as part of the auth code request context — even though MSAL's current API does
  not accept `state` in `acquireTokenByCode`, keep the signature stable for
  future use; MSAL validates the state nonce internally via the token response).

**Resulting public interface:**

```typescript
class AzureAdService {
  readonly webRedirectUri: string;
  readonly mobileRedirectUri: string;

  getAuthCodeUrl(redirectUri: string): Promise<string>;
  exchangeCode(code: string, state: string, redirectUri: string): Promise<msal.AuthenticationResult>;
}
```

**Implementation note:** `acquireTokenByCode` does not take a `state` param in
MSAL Node — the state is validated by MSAL internally from the cached auth-code
flow context when using auth code flows with redirect. Since this project uses a
server-side exchange without an MSAL cache session, pass only `code`, `scopes`,
and `redirectUri` to `acquireTokenByCode`. The `state` parameter on
`exchangeCode()` is reserved for explicit validation if needed; the backend can
optionally log/verify it but MSAL will not reject it.

---

### 2. `libs/auth/src/auth.service.ts`

**What to change:**

- Update `getLoginUrl()` to accept an optional `client: 'web' | 'mobile'` param:

```typescript
getLoginUrl(client: 'web' | 'mobile' = 'web'): Promise<string> {
  const redirectUri = client === 'mobile'
    ? this.azureAdService.mobileRedirectUri
    : this.azureAdService.webRedirectUri;
  return this.azureAdService.getAuthCodeUrl(redirectUri);
}
```

- Update existing `handleCallback(code, state)` to pass `this.azureAdService.webRedirectUri`
  to `exchangeCode`:

```typescript
async handleCallback(code: string, state: string): Promise<TokenPair> {
  // validation unchanged
  const msalResult = await this.azureAdService.exchangeCode(
    code, state, this.azureAdService.webRedirectUri,
  );
  // upsert + tokenPair unchanged
}
```

- Add new method `handleMobileExchange(code: string, state: string)`:

```typescript
async handleMobileExchange(code: string, state: string): Promise<TokenPair> {
  if (!code || !state) {
    throw new BadRequestException({
      code: 'INVALID_CALLBACK',
      message: 'Missing or invalid authorization code',
    });
  }
  let msalResult: msal.AuthenticationResult;
  try {
    msalResult = await this.azureAdService.exchangeCode(
      code, state, this.azureAdService.mobileRedirectUri,
    );
  } catch (err) {
    throw new UnauthorizedException({
      code: 'MOBILE_EXCHANGE_FAILED',
      message: 'Azure AD rejected the authorization code',
    });
  }
  if (!msalResult) {
    throw new UnauthorizedException({
      code: 'MOBILE_EXCHANGE_FAILED',
      message: 'Azure AD rejected the authorization code',
    });
  }
  const idTokenClaims = msalResult.idTokenClaims as Record<string, unknown>;
  const azureOid = idTokenClaims['oid'] as string;
  const email = (idTokenClaims['preferred_username'] ?? idTokenClaims['email']) as string;
  const displayName = (idTokenClaims['name'] ?? email) as string;
  const user = await this.userService.upsertFromAzure({ azureOid, email, displayName });
  return this.tokenService.issueTokenPair(user);
}
```

Add `UnauthorizedException` to the import from `@nestjs/common`.

---

### 3. `apps/auth/src/auth.controller.ts`

**What to change:**

Update the `login()` handler to accept a `client` query param and branch:

```typescript
@Public()
@Throttle({ default: { ttl: 60000, limit: 10 } })
@Get('login')
async login(
  @Query('client') client: string,
  @Res() reply: FastifyReply,
): Promise<void> {
  const clientType = client === 'mobile' ? 'mobile' : 'web';
  const url = await this.authService.getLoginUrl(clientType);
  if (clientType === 'mobile') {
    reply.status(200).send({ url });
  } else {
    reply.redirect(url, 302);
  }
}
```

No new imports needed beyond what is already present.

---

### 4. `apps/auth/src/connect.controller.ts`

**What to change:**

Add a new route handler `POST /connect/exchange` in the existing `ConnectController`.
Import `Post`, `Body` from `@nestjs/common`. The `@Public()` decorator is already
available from the shared lib.

```typescript
@Public()
@Post('connect/exchange')
async mobileExchange(
  @Body() body: { code?: string; state?: string },
  @Res() reply: FastifyReply,
): Promise<void> {
  if (!body?.code || !body?.state) {
    reply.status(400).send({
      error: {
        code: 'INVALID_CALLBACK',
        message: 'Missing or invalid authorization code',
      },
    });
    return;
  }
  try {
    const tokenPair = await this.authService.handleMobileExchange(body.code, body.state);
    reply.status(200).send(tokenPair);
  } catch (err: any) {
    // Re-throw NestJS HTTP exceptions so the global filter handles them.
    // UnauthorizedException thrown by handleMobileExchange will produce 401.
    // BadRequestException will produce 400.
    throw err;
  }
}
```

**Important**: The controller class is `@Controller()` (no prefix). The route
`@Post('connect/exchange')` must be registered WITHOUT adding a prefix — verify
that `ConnectController` is still `@Controller()` (no argument), not
`@Controller('connect')`. If a prefix is ever added in a refactor, adjust
accordingly.

**Alternative placement**: If the team prefers, a separate `ConnectExchangeController`
with `@Controller('connect')` and `@Post('exchange')` is equally valid and
keeps concerns separated. Either approach is acceptable — the resulting route
must be `POST /connect/exchange`.

---

### 5. `apps/auth/src/app.module.ts`

No changes required if option A (add handler to existing `ConnectController`) is chosen.

If the team creates a new `ConnectExchangeController`, add it to the `controllers`
array in `AppModule`:

```typescript
controllers: [AuthController, ConnectController, ConnectExchangeController, UsersController],
```

---

### 6. `.env.example`

Add the new variable (see "Environment Variable" section above).
Place it immediately after the existing `AZURE_REDIRECT_URI` line.

---

## Validation Summary

The `code` and `state` fields in `POST /connect/exchange` are validated at two levels:

1. **Controller level**: explicit truthy check on `body.code` and `body.state`
   before calling the service (returns 400 `INVALID_CALLBACK` on failure).
2. **Service level**: `handleMobileExchange` has its own guard and throws
   `BadRequestException` if either is falsy.

This is the same two-level validation pattern used in `GET /connect` today.

---

## What Does NOT Change

- `GET /connect` and its spec in api.yaml — unchanged.
- `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me` — unchanged.
- The database schema (schema.sql) — no new tables or columns.
- The BullMQ event contracts — unchanged.
- All existing unit tests for `ConnectController`, `AuthController`, `AuthService`,
  and `AzureAdService` must continue to pass. The signature changes to `getAuthCodeUrl`
  and `exchangeCode` require updating call sites in the existing specs to pass the
  redirect URI argument explicitly.

---

## Risk Notes

1. **MSAL state handling**: MSAL Node's `acquireTokenByCode` was designed for the
   confidential auth code flow with a server-side session cache. In a stateless
   server exchange (no MSAL cache), MSAL may not validate the `state` nonce
   internally. The backend should log a warning if `state` cannot be validated
   and consider keeping the state check as a best-effort advisory rather than a
   hard block — or maintain a short-TTL in-memory/Redis store of issued state
   nonces if strict CSRF protection is required. **Recommendation**: defer strict
   state validation to a follow-up if the mobile client is internal/trusted;
   document the limitation.

2. **Azure App Registration**: `foosball://auth/callback` must be added as a
   Reply URL of type "Mobile and desktop applications" in the Azure App
   Registration before this flow will work end-to-end. This is an Azure admin
   action outside the codebase.

3. **Existing test fixtures**: Any unit test that calls `azureAdService.getAuthCodeUrl()`
   or `azureAdService.exchangeCode()` with the old arity (no `redirectUri`) will
   need to be updated to pass the URI. The jest mocks are straightforward to update.
