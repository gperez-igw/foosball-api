# Security Stack Reference — foosball-api

Stack: NestJS 11 + Fastify + Azure MSAL + JWT + TypeORM + MySQL

---

## Authentication Guards

### Correct: JwtAuthGuard on all non-public routes (default closed)

```typescript
// apps/api: apply globally, whitelist public routes with @Public() decorator
app.useGlobalGuards(new JwtAuthGuard(reflector));

// Mark public endpoints explicitly:
@Public()
@Get('health')
healthCheck() {}
```

### Anti-pattern: opt-in guard (apply only where needed)

```typescript
// WRONG — easy to forget guard on new endpoints, leaving them open
@UseGuards(JwtAuthGuard)
@Get('protected')
getData() {}
// New endpoint without @UseGuards is silently public
```

---

## Admin Authorization

### Correct: read is_admin from JWT payload only

```typescript
@Roles('admin')
@UseGuards(RolesGuard)
@Delete('/admin/matches/:id')
deleteMatch(@Req() req: FastifyRequest) {
  const isAdmin = req.user.is_admin; // from JWT payload
}
```

### Anti-pattern: querying DB to check admin on hot path

```typescript
// WRONG — DB call on every admin endpoint; defeats JWT stateless design
const user = await this.usersService.findById(req.user.sub);
if (!user.is_admin) throw new ForbiddenException();
```

---

## Input Validation

### Correct: DTO with class-validator + whitelist pipe

```typescript
export class CreateMatchDto {
  @IsEnum(['1v1', '2v2', '4v4'])
  matchType: string = '2v2';

  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(8)
  @IsInt({ each: true })
  @IsPositive({ each: true })
  playerIds: number[];
}
```

### Anti-pattern: no validation on array inputs

```typescript
// WRONG — allows 100 players in a 2v2 match, integer overflow attacks
playerIds: any[]
```

---

## SQL Injection prevention

### Correct: always use TypeORM parameterized queries

```typescript
qb.where('m.id = :id AND m.status = :status', { id: matchId, status: 'confirmed' })
```

### Anti-pattern: string interpolation in queries

```typescript
// WRONG — SQL injection vector
qb.where(`m.id = ${matchId}`) // critical vulnerability
```

---

## JWT Token Security

### Correct: short-lived access token, hash refresh token

```typescript
// Access token: 15 min expiry, contains { sub, email, is_admin, azure_oid }
// Refresh token: 24h, single-use, sha256 hash stored in DB
const hash = crypto.createHash('sha256').update(token).digest('hex');
```

### Anti-pattern: long-lived access tokens or raw refresh token in DB

```
// WRONG — access token > 1 hour expiry increases blast radius on leak
// WRONG — raw refresh token in DB: breach = immediate account takeover
```

---

## Secrets handling

### Correct: all secrets via env vars, validated at startup

```typescript
// Use @nestjs/config with Joi validation schema
const validationSchema = Joi.object({
  APP_JWT_SECRET: Joi.string().min(32).required(),
  AZURE_CLIENT_SECRET: Joi.string().required(),
  DB_PASSWORD: Joi.string().required(),
});
```

### Anti-pattern: default fallback values for secrets

```typescript
// WRONG — empty string default silently passes validation
jwtSecret: process.env.APP_JWT_SECRET ?? 'default-secret'
```

---

## Rate limiting

### Correct: global + per-group throttle with @nestjs/throttler

```typescript
ThrottlerModule.forRoot([{ name: 'global', ttl: 60000, limit: 100 }])
// Auth routes override:
@Throttle({ global: { ttl: 60000, limit: 10 } })
@Controller('auth')
```

### Anti-pattern: no rate limiting on auth endpoints

```
// WRONG — brute force on /auth/refresh is trivial without throttle
```

---

## OWASP Top 10 considerations for this stack

1. **A01 Broken Access Control**: Default-closed guard pattern prevents forgotten endpoints.
2. **A02 Cryptographic Failures**: SHA-256 for refresh tokens; APP_JWT_SECRET min 32 chars.
3. **A03 Injection**: TypeORM parameterized queries; class-validator whitelist pipes.
4. **A05 Security Misconfiguration**: `synchronize:false`; CORS via env only; no debug in prod.
5. **A07 Authentication Failures**: Single-use refresh token rotation prevents replay attacks.
6. **A09 Logging/Monitoring**: Log every admin override with before/after snapshots; log auth events.

---

## Audit log immutability

```typescript
// NEVER add UPDATE or DELETE routes for audit_logs table
// NEVER add ON DELETE CASCADE from matches to audit_logs
// Application layer enforces append-only: only INSERT in AuditLogRepository
```
