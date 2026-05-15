# Backend Stack Reference — foosball-api

Stack: NestJS 11 + Fastify + TypeScript 5.7 + TypeORM 0.3.x

---

## NestJS + Fastify Adapter

### Correct: bootstrap with NestFastifyApplication

```typescript
import { NestFastifyApplication, FastifyAdapter } from '@nestjs/platform-fastify';
const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
await app.listen(3000, '0.0.0.0'); // Fastify requires explicit '0.0.0.0' for Docker
```

### Anti-pattern: using NestFactory.create without Fastify generic

```typescript
// WRONG — returns Express-based app, Fastify adapter not activated
const app = await NestFactory.create(AppModule, new FastifyAdapter());
```

### Correct: Swagger setup with Fastify

```typescript
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
const config = new DocumentBuilder().setTitle('Foosball API').addBearerAuth().build();
const document = SwaggerModule.createDocument(app, config);
SwaggerModule.setup('api/docs', app, document); // no leading slash for Fastify path
```

### Anti-pattern: using @fastify/swagger directly alongside @nestjs/swagger

```
// WRONG — @nestjs/swagger manages its own Fastify plugin registration.
// Do NOT also install @fastify/swagger separately — causes double-registration panic.
```

---

## Fastify + CORS

### Correct

```typescript
import fastifyCors from '@fastify/cors';
await app.register(fastifyCors, { origin: process.env.CORS_ORIGINS?.split(',') ?? false });
```

### Anti-pattern: using NestJS CORS (Express-style) with Fastify

```typescript
// WRONG — app.enableCors() calls an Express-specific internal; use fastifyCors plugin instead
app.enableCors({ origin: '*' });
```

---

## TypeORM + NestJS

### Correct: entity registration per module

```typescript
TypeOrmModule.forFeature([MatchEntity, MatchPlayerEntity]) // in MatchModule
```

### Anti-pattern: loading all entities in DataSource config

```typescript
// WRONG — auto-loading by glob is non-deterministic in monorepo builds
entities: ['dist/**/*.entity.js'] // breaks with nodenext resolution
```

### Correct: entities array as class references

```typescript
entities: [UserEntity, RefreshTokenEntity, MatchEntity, MatchPlayerEntity, MatchConfirmationEntity, AuditLogEntity]
```

### Correct: migrations run at startup (not synchronize)

```typescript
synchronize: false,
migrationsRun: true,
migrations: [AddUsersTable, AddMatchesTable], // explicit class references
```

### Anti-pattern: synchronize in any environment

```typescript
synchronize: true // NEVER — drops and recreates columns in production
```

---

## Class-validator + ValidationPipe

### Correct: global pipe with whitelist

```typescript
app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
```

### Anti-pattern: missing transform:true

```typescript
// WRONG — without transform:true, @Type(() => Number) in query params is ignored
new ValidationPipe({ whitelist: true })
```

---

## BullMQ + NestJS

### Correct: processor with typed job

```typescript
@Processor(QUEUE_MATCHES)
export class MatchWorker extends WorkerHost {
  async process(job: Job<EventEnvelope<MatchConfirmedPayload>>): Promise<void> {
    if (job.data.version !== 1) { /* handle version mismatch */ return; }
    const payload = job.data.payload;
  }
}
```

### Anti-pattern: no version check before destructuring

```typescript
// WRONG — future version bumps will silently break consumers
const { matchId } = job.data.payload;
```

---

## Error handling

### Correct: NestJS exception filter for consistent error envelope

```typescript
throw new ConflictException({ code: 'MATCH_ALREADY_CONFIRMED', message: '...', details: { matchId } });
```

### Anti-pattern: throwing plain Error

```typescript
// WRONG — bypasses global exception filter, returns unformatted 500
throw new Error('Match already confirmed');
```

---

## Jest + module: nodenext (critical pitfall)

### Correct: separate tsconfig for tests

```json
// tsconfig.test.json (used by ts-jest)
{ "extends": "./tsconfig.json", "compilerOptions": { "module": "CommonJS", "moduleResolution": "node" } }
```

```json
// jest config transform block:
"transform": { "^.+\\.ts$": ["ts-jest", { "tsconfig": "tsconfig.test.json" }] }
```

### Anti-pattern: running Jest with module: nodenext

```
// WRONG — ts-jest cannot transpile ESM .js extension imports required by nodenext
// Results in: "Cannot find module './foo.js'"
```

---

## Security pitfalls

- NEVER interpolate user input into TypeORM QueryBuilder strings. Use parameters:
  `qb.where('m.id = :id', { id: matchId })` — never `.where(\`m.id = ${matchId}\`)`
- NEVER read `is_admin` from request body. Read from `req.user.is_admin` (JWT payload only).
- NEVER store tokens in logs. Mask with `token.slice(0,8) + '...'`.
