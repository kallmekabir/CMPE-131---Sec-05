# SpartIN API reference

Base URL `http://localhost:3000`. All bodies are JSON. Protected routes need `Authorization: Bearer <accessToken>`.

Success: `{ "success": true, "data": ..., "message"?: "..." }`
Error: `{ "success": false, "error": { "code": "EVENT_FULL", "message": "This event is full.", "details": {} }, "requestId": "..." }` (`X-Request-Id` header carries the same id).

IDs are UUIDs; malformed ids return 400. Dates are ISO 8601 with a `Z`/offset. Roles: `PARTICIPANT`, `ORGANIZER`.

## Error codes

| Status | Code                                                                    |
| ------ | ----------------------------------------------------------------------- |
| 400    | `VALIDATION_ERROR` (`details.fields.<name>` lists messages), `EMAIL_NOT_ALLOWED` |
| 401    | `UNAUTHENTICATED` (missing), `INVALID_TOKEN`, `TOKEN_EXPIRED`           |
| 403    | `FORBIDDEN`, `EMAIL_NOT_VERIFIED`                                       |
| 404    | `NOT_FOUND`                                                             |
| 409    | `CONFLICT`, `EVENT_FULL`, `EVENT_UNAVAILABLE`                           |
| 413    | `VALIDATION_ERROR` (body over 100 KB)                                   |
| 429    | `RATE_LIMITED`                                                          |
| 500    | `INTERNAL_ERROR`                                                        |
| 503    | `DEPENDENCY_UNAVAILABLE` (calendar/sharing/email provider down)         |

422 is not used; semantic validation errors are 400.

## Health

`GET /health` (public) -> 200 `{ status: "ok", database: "up" }`; 503 when the database is down.

## Auth (rate limited: 10 requests / 15 min / IP)

| Method & URL | Auth | Body | Success | Errors |
| --- | --- | --- | --- | --- |
| `POST /api/auth/register` | public | `name` (1-100), `universityEmail` (approved domain), `password` (10-72), optional `displayName` (1-50), `major` (<=100). Extra fields such as `role` are ignored; role is always `PARTICIPANT` | 201 `{ user, verificationEmailSent }` | 400, 409 (email exists), 429 |
| `POST /api/auth/login` | public | `universityEmail`, `password` | 200 `{ accessToken, refreshToken, expiresIn, user }` | 400, 401 (same message for wrong password and unknown email), 403 `EMAIL_NOT_VERIFIED`, 429 |
| `POST /api/auth/verify-email` | public | `token` | 200 `{ verified: true }` | 400, 401 (invalid/used/expired) |
| `POST /api/auth/refresh` | public | `refreshToken` | 200 new token pair; old refresh token is revoked (single use) | 400, 401 |
| `POST /api/auth/logout` | public | `refreshToken` | 204 | 400 |
| `GET /api/auth/me` | any role | - | 200 own profile | 401 |

```bash
curl -s -X POST localhost:3000/api/auth/login -H 'Content-Type: application/json' \
  -d '{"universityEmail":"participant.dev@sjsu.edu","password":"DevOnly-Password-1"}'
```

## Users (any authenticated role)

| Method & URL | Notes |
| --- | --- |
| `GET /api/users/me` | own profile (the only place the email is returned) |
| `PATCH /api/users/me` | any of `name`, `displayName`, `major` (nullable), `interests[]` (<=20), `skills[]` (<=20). **Unknown fields (e.g. `role`, `universityEmail`) -> 400** |
| `GET /api/users/me/events?limit=` | `{ organizing: EventCard[], attending: EventCard[] }` (limit 1-50, default 20) |
| `GET /api/users/me/participation?limit=` | `[{ status, waitlistPosition, event }]` |

## Events

`EventCard`: `id, title, description, startsAt, endsAt, location, capacity (null = unlimited), waitlistEnabled, imageUrl, tags, status, organizer {id, displayName, major}, joinedCount, spotsLeft, viewerStatus (none|joined|waitlisted|passed|left|full), waitlistPosition`.

| Method & URL | Role | Description |
| --- | --- | --- |
| `GET /api/events` | any | Query: `q`, `tag`, `from`, `to`, `feed`, `includePassed`, `page` (>=1), `limit` (1-50, default 20). Returns `{ items, page, limit, total, hasMore }` ordered by start time. Excludes cancelled, deleted and ended events and the caller's passed events |
| `GET /api/events/:eventId` | any | one EventCard; 404 if missing/deleted |
| `POST /api/events` | ORGANIZER | 201. Body: `title` (1-120, no `<>`), `description` (1-5000), `startsAt` (future), `location` (1-200, no `<>`), optional `endsAt` (>= startsAt), `capacity` (int >= 0 or null), `waitlistEnabled` (default false), `imageUrl` (https), `tags` (<=10, 1-30 chars, lowercased). Unknown fields (e.g. `organizerId`) -> 400. Owner is always the caller |
| `PATCH /api/events/:eventId` | owner | partial update, same rules; at least one field. 409 if `capacity` < joined count. Raising capacity promotes the waitlist |
| `POST /api/events/:eventId/reschedule` | owner | `{ startsAt, endsAt? }` |
| `DELETE /api/events/:eventId` | owner | 204 (soft delete); repeat -> 404 |
| `GET /api/events/:eventId/participants?limit=` | owner | joined then waitlisted users (public fields only, no emails) |

Non-owners (including other organizers) get 403 on owner routes; participants get 403 on all organizer routes.

## Participation (any authenticated role)

Result: `{ eventId, status, waitlistPosition, joinedCount, alreadyApplied, nextEvent }` (`nextEvent` on join/pass: the next eligible EventCard or `null`).

| Method & URL | Behavior |
| --- | --- |
| `POST /api/events/:eventId/join` | `joined`, or `waitlisted` with `waitlistPosition` when full and waitlist enabled. Full without waitlist -> 409 `EVENT_FULL`. Cancelled/ended -> 409 `EVENT_UNAVAILABLE`. Repeating returns the existing state (`alreadyApplied: true`) without a second row |
| `POST /api/events/:eventId/leave` | -> `left`; if the user was joined, the next waitlisted user is promoted atomically. No participation -> 404; after a pass -> 409; repeat is idempotent |
| `POST /api/events/:eventId/pass` | -> `passed` (idempotent). Joined/waitlisted users must leave first (409) |
| `GET /api/events/:eventId/status` | `{ status: none\|joined\|waitlisted\|passed\|left\|full, waitlistPosition, joinedCount, capacity, waitlistEnabled }` |

The user is always taken from the token; any `userId` in the body is ignored.

```bash
TOKEN=...   # accessToken from login
curl -s -X POST localhost:3000/api/events/$EVENT_ID/join -H "Authorization: Bearer $TOKEN"
# {"success":true,"data":{"eventId":"...","status":"waitlisted","waitlistPosition":1,"joinedCount":2,"alreadyApplied":false,"nextEvent":{...}}}
curl -s -X POST localhost:3000/api/events/$FULL_EVENT_ID/join -H "Authorization: Bearer $TOKEN"
# 409 {"success":false,"error":{"code":"EVENT_FULL","message":"This event is full.","details":{}},"requestId":"..."}
```

## Integrations and recommendations (any authenticated role)

| Method & URL | Success | Adapter failure |
| --- | --- | --- |
| `GET /api/events/:eventId/map` | `{ available, location, mapUrl, navigationUrl }` | 200 with `available: false`, URLs `null`, text `location` fallback |
| `GET /api/events/:eventId/navigation-link` | `{ available, location, navigationUrl }` | same fallback |
| `GET /api/events/:eventId/share-link` | `{ url, deepLink }` | 503 `DEPENDENCY_UNAVAILABLE` |
| `GET /api/events/:eventId/calendar-link` | `{ googleCalendarUrl, ics }` | 503; no event data is touched |
| `GET /api/recommendations/events?limit=` | `[{ score, event }]` from the discovery feed; score = 2 per matching interest + 1 per skill + 1 for major, matched against event tags; ties by start time then id | n/a |

Map, share and calendar adapters currently build links locally (no third-party calls); the failure paths are tested with mocked adapters.
