# QA handoff

## Setup

```bash
cd backend && cp .env.example .env && npm install
npm run db:up && npm run db:deploy && npm run db:seed && npm run dev
```

Postman collection: [`SpartIN.postman_collection.json`](SpartIN.postman_collection.json) (set `baseUrl`; run **Login** requests first, they store tokens).

## Dev-only seed accounts

All use password `DevOnly-Password-1` (fake, local only; `npm run db:seed` refuses to run in production).

| Email | Role | Purpose |
| --- | --- | --- |
| `organizer.dev@sjsu.edu` | ORGANIZER | owns most seeded events |
| `organizer2.dev@sjsu.edu` | ORGANIZER | owns "Resume Workshop"; use to test cross-owner 403 |
| `participant.dev@sjsu.edu` | PARTICIPANT | interests: music, hiking |
| `nonorganizer.dev@sjsu.edu` | PARTICIPANT | unauthorized-for-organizer-actions user |
| `unverified.dev@sjsu.edu` | PARTICIPANT | email not verified (login returns 403) |
| `filler1..4.dev@sjsu.edu` | PARTICIPANT | occupy seats / waitlist |

Seeded events: normal events; **FULL: No Waitlist** (2/2, waitlist off); **FULL: Waitlist Enabled** (2/2 + 1 waitlisted); **Open: Waitlist Enabled**; unlimited capacity; capacity 0; no end time; 120-char title; already ended; cancelled.

## Test commands

| What | Command |
| --- | --- |
| Everything + coverage | `npm run test:coverage` |
| Unit / Integration / Security / Smoke | `npm run test:unit` / `test:integration` / `test:security` / `test:smoke` |
| Pre-merge checks | `npm run typecheck && npm run lint && npm run format:check && npm run build` |

## Smoke test (`tests/smoke/smoke.test.ts`)

Covers: health + DB connection; login; event listing; organizer creates event; participant joins; duplicate join keeps one row; full event waitlists / returns `EVENT_FULL`; non-owner organizer and participant get 403 on update. (Starting the real process is covered by `curl localhost:3000/health` after `npm run dev`; the test mounts the same app in-process.)

## Requirements -> tests

The requirements documents were not available, so this maps the written brief, not the PRD/SFDS numbering.

| Requirement | Tests |
| --- | --- |
| Approved university email only | `unit/email`, `integration/auth` (register non-sjsu) |
| Email verification, provider failure tolerated | `integration/auth` (verification flow, email outage) |
| Missing / invalid / expired / malformed token | `unit/authMiddleware`, `unit/tokenService`, `security/auth` |
| Rate-limited auth | `security/auth` (429 after limit) |
| No password/hash/token leakage | `security/auth`, `security/authorization` (private fields), `integration/users` |
| Role cannot be self-changed | `integration/users` (protected fields), `security/authorization` (escalation) |
| Event create/read/update/reschedule/delete | `integration/events` |
| Event validation, no record on invalid input | `unit/eventValidation`, `integration/events` |
| Organizer-only and owner-only | `unit/authorization`, `integration/events`, `security/authorization` |
| Pagination, filtering, exclusion of cancelled/deleted/ended/passed | `integration/events` |
| Join under / exactly at capacity / full + waitlist / full without waitlist | `unit/capacity`, `integration/participation` |
| Duplicate and repeated joins idempotent | `integration/participation` (idempotent, same user x10 concurrent) |
| Leave and waitlist promotion in order | `integration/participation`, `integration/events` (capacity increase) |
| Concurrent joins never exceed capacity; no duplicate rows | `integration/participation` (25 users -> 5 seats; gap-free positions) |
| Pass, next event returned | `integration/participation` |
| Users cannot alter others' participation | `integration/participation`, `security/authorization` |
| SQL-injection-style input | `integration/events`, `security/*` |
| Map / navigation / share / calendar success + failure | `unit/adapters`, `integration/integrations` |
| Recommendations deterministic | `unit/recommendation`, `integration/integrations` |
| Error mapping, request ids, safe 500s | `unit/errorHandler`, `integration/health` |
| Config validation at startup | `unit/config` |

## Coverage

`npm run test:coverage` (189 tests): 97.3% statements / 98.6% lines / 88.8% branches over `services`, `domain`, `validators`, `errors`, `middleware`, `adapters`. Threshold 80% is enforced. Repositories and controllers are exercised by integration tests but excluded from the percentage.

## Load test

Setup used for the recorded run:

```bash
cd backend
npm run db:up && npm run db:deploy
npm run db:seed:load                                   # 1,200 events, 300 users (wipes the dev DB)
npm run build
AUTH_RATE_LIMIT_MAX=1000000 API_RATE_LIMIT_MAX=10000000 LOG_LEVEL=error PORT=3100 node dist/server.js &
docker run --rm -i -v "$PWD/tests/performance:/scripts:ro" -e BASE_URL=http://host.docker.internal:3100 \
  -e VUS=100 -e DURATION=45s grafana/k6 run /scripts/load.js      # or: npm run test:load if k6 is installed
npm run db:seed                                        # restore normal dev data
```

Recorded result (one MacBook: k6 in Docker, Postgres 16 in Docker, single Node process, dev DB):

| Metric | Result | Target |
| --- | --- | --- |
| Virtual users | 100 concurrent (60 s total) | >= 100 |
| Requests | 42,712, 0 failed (409s counted as expected) | |
| p95, all requests | 300 ms | < 2,000 ms |
| p95 list / detail / join / pass / participation | 410 / 98 / 290 / 284 / 204 ms | < 2,000 ms |
| Seeded events | 1,200 | >= 1,000 |
| Event-list query inside Postgres (`EXPLAIN ANALYZE`, 1,200 events) | 0.09 ms | ~ 200 ms |

The load mix contains no third-party calls (map/calendar/share adapters build links locally and are not in the script), so these numbers are backend + database only. This is a single local run, not a CI gate or production sizing.

## Release checklist

- [ ] `typecheck`, `lint`, `format:check`, `build` pass; `test:coverage` green with CI Postgres
- [ ] `npx prisma migrate deploy` succeeds on a copy of the target database
- [ ] `AUTH_PROVIDER=local`, strong `JWT_ACCESS_SECRET`, `CORS_ORIGINS` set to the real app origins, HTTPS terminating in front of the API
- [ ] A real email adapter is configured (otherwise nobody can verify and log in)
- [ ] No dev seed run against the target database
- [ ] PR has developer review + QA review for any auth, authorization, event, participation, waitlist or API change
- [ ] No open blocker/critical defects

## Known limitations

- Requirements documents were unavailable; assumptions are in `DECISIONS.md`.
- No real email delivery, DUO/SSO, password reset or organizer onboarding yet.
- Rate limiting is in-memory per process; use a shared store (e.g. Redis) when running multiple instances.
- Map/calendar/share adapters generate links only; no live Google API integration, no geocoding.
- Participants are not notified of reschedules or cancellations.
- GitHub Actions workflow is written but has not run on GitHub yet.
- The dev database was used for the load run; results will vary on other hardware.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `Cannot connect to the Docker daemon` | start Docker Desktop, then `npm run db:up` |
| `Invalid environment configuration` at start | compare `.env` with `.env.example`; `JWT_ACCESS_SECRET` needs 32+ chars |
| Integration tests fail with `ECONNREFUSED :5433` | `npm run db:up` (the `db_test` container) |
| `429 RATE_LIMITED` while testing by hand | wait 15 min, restart the server, or raise `AUTH_RATE_LIMIT_MAX` in `.env` |
| Login returns 403 `EMAIL_NOT_VERIFIED` | use `AUTH_PROVIDER=dev` locally or a seeded verified account |
| Port 5432 already used | stop local Postgres or change the port mapping in `docker-compose.yml` |
| Reset everything | `npm run db:reset && npm run db:seed` |
