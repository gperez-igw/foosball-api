---
id: feature-admin-db-managed
type: spec
project: foosball-api
sprint: "01"
created_by: architect
created_at: 2026-05-18
status: approved
requires_decision: false
---

# Feature Spec — Admin Role: DB-Managed (Decoupled from Azure AD)

## Decision reference

`.agentflow/decisions/decision-2026-05-18-1308-admin-db-managed.md`

## Summary

`is_admin` is no longer derived from Azure AD group membership. It is a plain
database column (default `false`) managed exclusively via direct SQL. The Azure
SSO login is used only for identity: `oid`, `email`, `displayName`. The
callback upsert must never touch `is_admin`. The JWT still carries `is_admin`,
but reads it from the DB user row immediately after upsert, not from any Azure
claim.

---

## What is deleted entirely

| Artifact | What to remove |
|----------|----------------|
| `libs/auth/src/azure-ad.service.ts` | Delete the entire `getGroupsFromGraph()` method (lines 47-86). Keep `getAuthCodeUrl()` and `exchangeCode()`. |
| `libs/auth/src/auth.service.ts` | Remove `this.adminGroupId` field and its assignment in the constructor (`config.getOrThrow('ADMIN_AZURE_GROUP_ID')`). Remove the `groupsInToken` / `claimNames` / Graph fallback block in `handleCallback()`. Remove the `isAdmin` local variable from `handleCallback()`. Stop passing `isAdmin` to `userService.upsertFromAzure()`. |
| `.env.example` | Remove the `ADMIN_AZURE_GROUP_ID` line and its comment. |
| `.env` | Remove the `ADMIN_AZURE_GROUP_ID` line (if present). |
| `test/auth-sso.e2e-spec.ts` | Remove `ADMIN_GROUP_ID` constant, remove it from `TEST_CONFIG`, remove `mockFetch` and `global.fetch = mockFetch`, remove `buildMsalResult` `claimNames` parameter and usage, remove test blocks `6f` and `6g` entirely. Update `6a` and `6b` per new behaviour (see test-criteria.md §6a–6b). |

---

## File-by-file code changes

### 1. `libs/auth/src/azure-ad.service.ts`

**Action**: delete `getGroupsFromGraph()` method.

Remove lines 47-86 (the entire `async getGroupsFromGraph(accessToken: string): Promise<string[]>` method including the `ServiceUnavailableException` import if it is only used there).

After change the file exports only `getAuthCodeUrl()` and `exchangeCode()`.
The `Logger` import and instance can be removed if no longer used (check — currently used only inside `getGroupsFromGraph`).

### 2. `libs/auth/src/auth.service.ts`

**Action**: simplify `handleCallback()`, remove `adminGroupId`.

Remove from constructor:
```typescript
// DELETE these two lines:
this.adminGroupId = this.config.getOrThrow<string>('ADMIN_AZURE_GROUP_ID');
```

Remove from class field declarations:
```typescript
// DELETE:
private readonly adminGroupId: string;
```

In `handleCallback()`, replace the entire admin-detection block with nothing —
just remove it:

```typescript
// DELETE from handleCallback():
let isAdmin = false;
const groupsInToken = idTokenClaims['groups'] as string[] | undefined;
const claimNames = idTokenClaims['_claim_names'] as Record<string, string> | undefined;

if (groupsInToken) {
  isAdmin = groupsInToken.includes(this.adminGroupId);
} else if (claimNames?.groups) {
  const graphToken = msalResult.accessToken;
  const graphGroups = await this.azureAdService.getGroupsFromGraph(graphToken);
  isAdmin = graphGroups.includes(this.adminGroupId);
}
```

Change the upsert call from:
```typescript
const user = await this.userService.upsertFromAzure({ azureOid, email, displayName, isAdmin });
```
to:
```typescript
const user = await this.userService.upsertFromAzure({ azureOid, email, displayName });
```

The resulting `handleCallback()` body after the MSAL exchange is:
```typescript
const idTokenClaims = msalResult.idTokenClaims as Record<string, unknown>;
const azureOid = idTokenClaims['oid'] as string;
const email = (idTokenClaims['preferred_username'] ?? idTokenClaims['email']) as string;
const displayName = (idTokenClaims['name'] ?? email) as string;

const user = await this.userService.upsertFromAzure({ azureOid, email, displayName });
return this.tokenService.issueTokenPair(user);
```

The `ConfigService` injected in the constructor is no longer needed for auth
logic. Keep the import and injection only if `ConfigService` is still used
elsewhere in the class (it is not — remove the injection and the import).

### 3. `libs/users/src/user.service.ts`

**Action**: remove `isAdmin` from `UpsertUserInput`.

Change the interface:
```typescript
// BEFORE:
export interface UpsertUserInput {
  azureOid: string;
  email: string;
  displayName: string;
  isAdmin: boolean;
}

// AFTER:
export interface UpsertUserInput {
  azureOid: string;
  email: string;
  displayName: string;
}
```

`upsertFromAzure()` passes the input straight through to the repository — no
other changes needed in the service method body.

### 4. `libs/users/src/user.repository.ts`

**Action**: change upsert so existing users never have `is_admin` overwritten,
and new users rely on the DB column default.

Change the `upsert()` signature:
```typescript
// BEFORE:
async upsert(data: {
  azureOid: string;
  email: string;
  displayName: string;
  isAdmin: boolean;
}): Promise<UserEntity>

// AFTER:
async upsert(data: {
  azureOid: string;
  email: string;
  displayName: string;
}): Promise<UserEntity>
```

Change the existing-user branch — do NOT assign `isAdmin`:
```typescript
// BEFORE (existing user branch):
if (existing) {
  existing.email = data.email;
  existing.displayName = data.displayName;
  existing.isAdmin = data.isAdmin;   // DELETE this line
  return this.repo.save(existing);
}

// AFTER:
if (existing) {
  existing.email = data.email;
  existing.displayName = data.displayName;
  return this.repo.save(existing);
}
```

Change the new-user creation — do NOT set `isAdmin` (let the DB default 0 apply):
```typescript
// BEFORE (new user branch):
const user = this.repo.create({
  azureOid: data.azureOid,
  email: data.email,
  displayName: data.displayName,
  isAdmin: data.isAdmin,   // DELETE this line
});

// AFTER:
const user = this.repo.create({
  azureOid: data.azureOid,
  email: data.email,
  displayName: data.displayName,
});
```

TypeORM will use the entity column default (`false`) for new rows, which maps
to the MySQL `DEFAULT 0`. Verify `UserEntity.isAdmin` has `@Column({ default: false })`.

### 5. `apps/auth/src/app.config.ts` (or equivalent NestJS config file)

**Action**: if `ADMIN_AZURE_GROUP_ID` is validated in a Joi schema or a config
factory (e.g., `Joi.object({ ADMIN_AZURE_GROUP_ID: Joi.string().required() })`),
remove that entry. The variable must no longer be required at startup.

Search for `ADMIN_AZURE_GROUP_ID` in `apps/auth/src/` and remove any validation
reference. If the ConfigService call was the only usage, the config file requires
no other changes.

### 6. `.env.example` and `.env`

Remove:
```
# Azure AD Group ObjectId whose members receive is_admin=true
ADMIN_AZURE_GROUP_ID=your-admin-group-object-id
```

### 7. `test/auth-sso.e2e-spec.ts`

Changes needed to align tests with new behavior:

- Remove `ADMIN_GROUP_ID` constant.
- Remove `ADMIN_AZURE_GROUP_ID` from `TEST_CONFIG`.
- Remove `mockFetch` declaration and `global.fetch = mockFetch`.
- Remove `mockFetch.mockReset()` from `beforeEach`.
- Change `buildMsalResult` to only produce tokens with identity claims (no `groups`):
  ```typescript
  function buildMsalResult() {
    return {
      accessToken: 'mock-graph-access-token',
      idTokenClaims: {
        oid: AZURE_OID,
        preferred_username: USER_EMAIL,
        name: DISPLAY_NAME,
      },
    };
  }
  ```
- Update the `UserRepository` mock's `upsert` function: remove the `isAdmin`
  parameter. For new users set `isAdmin = false` (default). For existing users
  do NOT update `isAdmin`:
  ```typescript
  upsert: jest.fn(async (data: { azureOid: string; email: string; displayName: string }) => {
    const existing = users.get(data.azureOid);
    if (existing) {
      existing.email = data.email;
      existing.displayName = data.displayName;
      existing.updatedAt = new Date();
      return existing;
    }
    const u = new UserEntity();
    u.id = userIdSeq++;
    u.azureOid = data.azureOid;
    u.email = data.email;
    u.displayName = data.displayName;
    u.isAdmin = false;   // DB default
    u.createdAt = new Date();
    u.updatedAt = new Date();
    users.set(u.azureOid, u);
    userById.set(u.id, u);
    return u;
  }),
  ```
- Rewrite test `6a` (new user → is_admin=false) per test-criteria.md §6a.
- Rewrite test `6b` (existing user with is_admin=true in DB → is_admin preserved) per test-criteria.md §6b.
  For 6b: call `seedUser({ isAdmin: true })` before the callback call so the
  user pre-exists in the store with `isAdmin=true`. After login, assert
  `payload.is_admin === true` and `savedUser.isAdmin === true`.
- Delete test blocks `6f` (Graph fallback) and `6g` (503) entirely.
- Update `6d` (token refresh): `buildMsalResult()` call no longer needs an
  argument — remove `[ADMIN_GROUP_ID]` argument from `mockMsalClient
  .acquireTokenByCode.mockResolvedValue(buildMsalResult([ADMIN_GROUP_ID]))`.
- Update `6h` (logout): same as above — remove argument from `buildMsalResult`.
- `mockMsalClient.acquireTokenByCode.mockResolvedValue(buildMsalResult([ADMIN_GROUP_ID]))`:
  replace all remaining occurrences (in `beforeAll` and `beforeEach`) with
  `mockMsalClient.acquireTokenByCode.mockResolvedValue(buildMsalResult())`.

---

## Schema impact

No migration required. The `users.is_admin` column already exists with
`DEFAULT 0` in the current schema. The column comment is updated in
`schema.sql` (already done in the spec) but that comment change does not
require a DDL migration.

**Bootstrap of the first admin** (documented risk):
There is no API endpoint to promote a user to admin. The first admin must be
set directly in MySQL:

```sql
UPDATE users SET is_admin = 1 WHERE email = 'admin@company.com';
```

This is intentional per the user decision. Document in `README.md` or
`docs/DEPLOYMENT.md` under "Admin bootstrap".

---

## JWT impact

No change to the JWT payload shape. The JWT still contains `is_admin` as a
boolean. The value is now read from `user.isAdmin` returned by the upsert,
which reflects the DB row. The `TokenService.issueTokenPair()` method requires
no changes.

---

## Env var impact

`ADMIN_AZURE_GROUP_ID` is removed. Any deployment environment (CI, staging,
production) that sets this variable can remove it without effect. If a startup
config validator (Joi) required it, that requirement is removed.

---

## Risk

**Bootstrap of the first admin**: once the feature is deployed, no user will be
admin unless an admin row already exists in the DB. In a fresh environment the
first admin must be set manually via SQL before admin-only endpoints can be
used. This is a deployment concern, not a code concern. Document it.

**Existing deployments**: if any currently-running instance has users who
gained `is_admin=true` via the Azure groups flow, those rows are unaffected —
the column value is preserved. The only change is that future logins no longer
re-sync the value, so group membership changes in Azure AD will no longer
propagate to `is_admin`. This is the intended behavior per the decision.
