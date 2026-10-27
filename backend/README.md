# SpartIN Backend

REST API for SpartIN (SJSU transfer-student event discovery). Node.js, TypeScript, Express, PostgreSQL, Prisma, Zod, Jest/Supertest, k6.

Docs: [API reference](../docs/backend/API.md) · [Decisions & assumptions](../docs/backend/DECISIONS.md) · [QA handoff](../docs/backend/QA.md)

## Quick start

```bash
cd backend
cp .env.example .env          # dev-only values; never commit .env
npm install
npm run db:up                 # Postgres on :5432 (dev) and :5433 (tests, in-memory)
npm run db:deploy             # apply migrations
npm run db:seed               # fake dev accounts + events
npm run dev                   # http://localhost:3000/health
```

## Commands

| Task                  | Command                                           |
| --------------------- | ------------------------------------------------- |
| Start server (dev)    | `npm run dev`                                     |
| Build / run built     | `npm run build && npm start`                      |
| Migrations (dev / CI) | `npm run db:migrate` / `npm run db:deploy`        |
| Reset dev database    | `npm run db:reset` (destroys local data)          |
| Seed dev data         | `npm run db:seed`                                 |
| Unit tests            | `npm run test:unit`                               |
| Integration tests     | `npm run test:integration` (needs `db_test`)      |
| Security tests        | `npm run test:security`                           |
| Smoke test            | `npm run test:smoke`                              |
| All tests + coverage  | `npm run test:coverage`                           |
| Type check / lint     | `npm run typecheck` / `npm run lint`              |
| Format check / fix    | `npm run format:check` / `npm run format`         |
| Load test             | see [QA handoff](../docs/backend/QA.md#load-test) |

Tests run against the `db_test` container (`TEST_DATABASE_URL`, port 5433); migrations are applied automatically by Jest's global setup.

## Architecture

```
src/
  config/        env parsing + validation (fails fast at startup)
  routes/        URL -> controller wiring, auth/role middleware placement
  controllers/   HTTP only: parse input (Zod), call a service, shape the response
  services/      business rules: auth, events, join/leave/pass/waitlist, recommendations
  repositories/  all Prisma queries and transactions (incl. event row locking)
  domain/        pure types and rules: capacity decisions, authorization, email, recommendation scoring
  validators/    Zod schemas
  adapters/      authentication, email, maps, calendar, sharing (interfaces + default/mock impls)
  middleware/    authenticate, requireRole, rate limit, request id
  errors/        AppError + central error handler
  logging/       pino with secret redaction
prisma/          schema, migrations, seed scripts
tests/           unit, integration, security, smoke, performance (k6)
```

Responses use `{ success, data, message? }` and `{ success: false, error: { code, message, details }, requestId }`.

## Environment variables

Validated at startup in `src/config/index.ts`; the process exits with a field-level message (never the secret value) if invalid.

| Variable                                    | Default          | Notes                                                                 |
| ------------------------------------------- | ---------------- | --------------------------------------------------------------------- |
| `NODE_ENV`                                  | `development`    | `development`, `test`, `production`                                   |
| `PORT`                                      | `3000`           |                                                                       |
| `DATABASE_URL`                              | required         | PostgreSQL URL                                                        |
| `TEST_DATABASE_URL`                         | port 5433 DB     | used by tests                                                         |
| `JWT_ACCESS_SECRET`                         | required         | at least 32 chars                                                     |
| `ACCESS_TOKEN_TTL_SECONDS`                  | `900`            |                                                                       |
| `REFRESH_TOKEN_TTL_SECONDS`                 | `1209600`        | refresh tokens are opaque, hashed in DB, rotated on use               |
| `ALLOWED_EMAIL_DOMAINS`                     | `sjsu.edu`       | comma-separated exact domains                                         |
| `AUTH_PROVIDER`                             | `local`          | `dev` auto-verifies emails and is rejected when `NODE_ENV=production` |
| `CORS_ORIGINS`                              | empty (deny all) | comma-separated frontend origins                                      |
| `PUBLIC_APP_URL`                            | localhost:8081   | base for share links and verification links                           |
| `LOG_LEVEL`                                 | `info`           | `debug`, `info`, `warn`, `error`, `silent`                            |
| `AUTH_RATE_LIMIT_MAX`, `API_RATE_LIMIT_MAX` | `10` / `300`     | per IP: auth per 15 min, API per minute                               |

## Security summary

Helmet headers, CORS allow-list, 100 KB body limit, Zod validation on every input, Prisma parameterized queries, bcrypt password hashing, JWT (HS256, algorithm pinned) access tokens, rotating hashed refresh tokens, per-IP rate limits, request IDs, log redaction of auth headers/tokens/passwords, generic 500 messages with no stack traces. Deploy behind HTTPS (`trust proxy` is enabled in production).

## Known limitations

See [QA handoff](../docs/backend/QA.md#known-limitations) and [decisions needing confirmation](../docs/backend/DECISIONS.md#needs-team-confirmation).
