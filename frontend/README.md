# SpartIN Frontend (Alpha)

Mobile-first React web app for SpartIN. Plain React + React Router + `fetch` + one CSS file — no state libraries, no UI kits — so anyone who knows basic React can read and change it.

Design plan and reasoning: [`../docs/MVP_PLAN.md`](../docs/MVP_PLAN.md). Backend API: [`../docs/backend/API.md`](../docs/backend/API.md).

## Run it

You need the backend running first (see [`../backend/README.md`](../backend/README.md)).

```bash
cd frontend
cp .env.example .env     # VITE_API_URL=http://localhost:3000
npm install
npm run dev              # http://localhost:8081
```

Port **8081** matters: the backend only accepts requests from origins listed in its `CORS_ORIGINS` (8081 is there by default) and builds share links with `PUBLIC_APP_URL=http://localhost:8081`.

Production build: `npm run build` → static files in `dist/` (host anywhere; set `VITE_API_URL` to the deployed API before building).

### Running Postgres without Docker (macOS)

```bash
brew install postgresql@16 && brew services start postgresql@16
/opt/homebrew/opt/postgresql@16/bin/psql -d postgres -c "CREATE ROLE spartin LOGIN PASSWORD 'spartin_dev_only' CREATEDB;"
/opt/homebrew/opt/postgresql@16/bin/psql -d postgres -c "CREATE DATABASE spartin OWNER spartin;"
/opt/homebrew/opt/postgresql@16/bin/psql -d postgres -c "CREATE DATABASE spartin_test OWNER spartin;"
```

Then in `backend/.env` set `TEST_DATABASE_URL=postgresql://spartin:spartin_dev_only@localhost:5432/spartin_test` (no second container on 5433), and for manual QA raise `AUTH_RATE_LIMIT_MAX` (default 10 logins per 15 min per IP locks testers out).

## Where things are

| File | What it does |
| --- | --- |
| `src/main.jsx` | Starts React; wraps the app in the router and `AuthProvider` |
| `src/App.jsx` | URL → page table |
| `src/api.js` | **Only** file that calls the backend. Handles tokens, refresh, errors |
| `src/AuthContext.jsx` | Logged-in user; `useAuth()` gives `user`, `login`, `register`, `logout` |
| `src/utils/format.js` | Dates as mm-dd-yyyy, times as h:mm AM/PM (PRD 4.3) |
| `src/components/Layout.jsx` | Bottom navigation bar (SFDS mockup) |
| `src/components/SwipeCard.jsx` | Drag / tap card using pointer events |
| `src/components/Common.jsx` | `ProtectedRoute`, `FormField`, `Toast`, `Skeleton`, `StatusBadge`, … |
| `src/pages/*` | One file per screen |
| `src/styles.css` | All styles; colors are CSS variables at the top |

## Pages

| URL | Page | Requirement |
| --- | --- | --- |
| `/login`, `/register` | Log in / sign up (SJSU email only) | NFR-07 |
| `/` | Swipe deck: drag right = join, left = pass, tap = details; buttons and ←/→ keys too | FR-01, FR-03, FR-07 |
| `/events/:id` | Details, join/leave/pass, directions, share, add to calendar; owner: edit/delete/participants | FR-03–05, FR-08 |
| `/events/new`, `/events/:id/edit` | Create / edit / reschedule | FR-02 |
| `/my-events` | Attending & hosting | — |
| `/calendar` | Agenda of your events (grid view planned for Final) | — |
| `/map` | Campus map, event list with search, "use my location" | FR-04, FR-06 |
| `/profile` | Profile, interests/skills edit, changelog, log out | FR-09 data |

## Adding a page (recipe)

1. Create `src/pages/MyNewPage.jsx` that returns some JSX.
2. If it needs data, add a function to `src/api.js` and call it inside `useEffect`.
3. Add a `<Route path="/my-new" element={<MyNewPage />} />` in `src/App.jsx`.

## Manual test accounts

Seeded by `npm run db:seed` in the backend (dev only), password `DevOnly-Password-1`:
`participant.dev@sjsu.edu`, `organizer.dev@sjsu.edu`, `organizer2.dev@sjsu.edu`, `nonorganizer.dev@sjsu.edu`, `filler1..4.dev@sjsu.edu`, `unverified.dev@sjsu.edu` (cannot log in).
In development (`AUTH_PROVIDER=dev`) any new `@sjsu.edu` account you register is verified automatically.
