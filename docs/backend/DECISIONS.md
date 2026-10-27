# Backend decisions and assumptions

The five requirements documents (PRD, SFDS, SAD, Project-Plan, Test-Plan) were **not in the repository** when this backend was built (`docs/requirements/` did not exist). Everything below was decided from the written brief. Reconcile with the documents when they are added.

## Decisions made

| #   | Decision                                                                                                                      | Reason                                                                |
| --- | ----------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| 1   | PostgreSQL (not SQLite)                                                                                                       | foreign keys, row locks, concurrent capacity updates, load testing    |
| 2   | Express + Prisma + Zod                                                                                                        | default stack; no backend existed. Issue #19 mentions researching C, not adopted |
| 3   | Pass is stored as a `participations` row with status `PASSED`                                                                 | simplest; one unique `(user_id, event_id)` row per user and event     |
| 4   | `full` is a computed viewer status, never stored; joining a full event without a waitlist returns 409 `EVENT_FULL`            | nothing to persist                                                    |
| 5   | `DELETE /events/:id` is a soft delete: `status=CANCELLED` + `deleted_at`; participations are kept, event 404s afterwards       | preserves history, no dangling rows                                   |
| 6   | `POST /reschedule` replaces `startsAt`; omitted `endsAt` becomes null                                                         | avoids an end time that precedes the new start                        |
| 7   | Waitlist order is `(queued_at, participation_id)`; position is computed, not stored. Re-joining after leaving re-queues at the back | deterministic and cannot drift                                     |
| 8   | Capacity/waitlist changes run in a transaction holding `SELECT ... FOR UPDATE` on the event row                               | serializes joins/leaves per event; DB CHECK and unique constraints back it up |
| 9   | Waitlisted users are promoted whenever a spot opens (leave, capacity increase), even if the waitlist was later disabled       | no stranded queue; the flag only controls new entries                 |
| 10  | Lowering capacity below the joined count is rejected (409)                                                                    | no silent eviction                                                    |
| 11  | Default discovery hides `PASSED` events; `feed=true` also hides joined/waitlisted (swipe deck); `includePassed=true` shows them | matches "passed events should not reappear"                        |
| 12  | Events that already ended (or started with no end time) are excluded from discovery and cannot be joined                      | "available events"                                                    |
| 13  | Only `@sjsu.edu` exact-domain emails are accepted (`ALLOWED_EMAIL_DOMAINS`)                                                   | subdomains such as `mail.sjsu.edu` are rejected on purpose            |
| 14  | Text safety: control characters rejected everywhere; `<` `>` rejected in title/location/tags; descriptions are plain text the client must not render as HTML | JSON API; output encoding is the client's job |
| 15  | `POST /api/auth/register` always creates `PARTICIPANT`                                                                        | no self-service organizer                                             |

## Needs team confirmation

1. **How does a user become an organizer?** Currently only by direct database/seed change. Options: admin endpoint, approved-organizer email list, or an application flow.
2. **Real email provider.** `UnconfiguredEmailAdapter` is the default and returns a controlled failure; registration still succeeds and reports `verificationEmailSent: false`. With `AUTH_PROVIDER=local`, users cannot log in until a real adapter delivers the verification link.
3. **DUO/institutional login.** Not implemented. Implement `AuthProvider` (or add a new login route) once the university integration details exist.
4. **Soft-delete vs. separate "cancel" and "delete"** if the PRD distinguishes them.
5. **Notification of participants** on reschedule/cancel is not implemented.
6. **Password reset** is not implemented (no email provider yet).
7. **Admin role** does not exist; only owners can manage events.
8. **Requirements documents** need reconciling (see top).
