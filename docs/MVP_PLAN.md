# SpartIN MVP Plan (Alpha → Final)

Prepared 11-13-2026 after reviewing every project document (PRD, SAD, SFDS, Project Plan, Test Plan, TR template) and the whole GitHub repo. Written for a team with **basic React / HTML / Node knowledge**: every design choice below favors "easy to read and change" over "clever".

---

## 1. Where the project stands today

| Area | Status | Notes |
| --- | --- | --- |
| Requirements docs (PRD, SAD, SFDS, PP, TP) | Done | Consistent on features; inconsistent on platform (see §2.1) |
| Backend API (`backend/`) | **Done & strong** | Express + TypeScript + PostgreSQL + Prisma. Auth, event CRUD, join/pass/leave, waitlist, map/share/calendar links, recommendations. **189/189 tests pass** locally |
| Frontend | **Did not exist** | Nothing in the repo; this is the critical gap for the Alpha |
| Frontend ↔ backend integration | Not started | Issue #9 was closed but no client code exists |
| Alpha Test Report | Not started | Due with the Alpha release (11/15) |

**Conclusion:** the backend already delivers almost every HIGH-priority requirement. The MVP is blocked only on a usable frontend plus honest testing.

---

## 2. Key decisions

### 2.1 Frontend platform: React **web** app (mobile-first), not React Native
The Project Plan / Test Plan / SFDS mention React Native + iOS + Xcode/Detox, but:

- PRD **NFR-06** requires Chrome **and Safari, desktop and mobile** → that's a website.
- SAD §1.2: "Users can access SpartIN through a **web-based interface**."
- PRD §4.3: "support commonly used modern **web browsers**."
- Project Plan: iOS App Store publishing costs $99 and is out of scope.
- The team knows basic React; React Native adds Expo/Xcode/simulator tooling with a 2-day runway.

**Decision:** Vite + React + React Router, plain CSS, `fetch`. Designed phone-first so it looks like the SFDS mockups on an iPhone in Safari, and still works on a laptop.
**Doc follow-up:** record this deviation in the TR "Known Issues" and update the Test Plan environment (§4) in the next revision.

### 2.2 Who can create events
PRD §4.1: *"users can create any casual events"*. The backend only let seeded `ORGANIZER` accounts create events and every registered user was a `PARTICIPANT`, so a real new user could never host.
**Decision (approved):** any logged-in (email-verified) user can create events; **edit / reschedule / delete / participant list stay owner-only** (NFR-02 still holds — the server checks ownership, not the UI).

### 2.3 Database
PostgreSQL 16 (already chosen by the backend; it needs row locks + array columns). Local options: Homebrew `postgresql@16` **or** Docker Desktop + `npm run db:up`.

---

## 3. MVP scope

### Alpha release (11/15) — must work end-to-end
| PRD req | Feature | Screen |
| --- | --- | --- |
| NFR-07, TP TC-001 | Register (SJSU email only), log in, log out, stay logged in | Login / Register |
| FR-01, FR-03 | Swipe deck: swipe right = Join, left = Pass, tap = details. **Buttons and ←/→ keys do the same** (PRD §6.2 anticipated mouse/keyboard) | Home |
| FR-07 | Join a full event → waitlisted with position; full w/o waitlist → clear message; Leave promotes next | Home, Event Details |
| FR-02 | Create, edit, reschedule, delete own events; capacity + waitlist toggle | Create / Edit Event |
| FR-04 (partial) | Location text + Directions link; Map tab with campus map embed, event list, search | Event Details, Map |
| FR-06 (partial) | "Use my location" button (asks permission only when tapped; page still works if denied) | Map |
| FR-05 (partial) | Share = copy link / native share sheet | Event Details |
| FR-08 (partial) | Add to Google Calendar link + .ics download (Apple/Outlook) | Event Details |
| — | My Events (hosting / attending) and Calendar agenda (your events grouped by day) | My Events, Calendar |
| — | Profile: name, major, interests, skills (edit) | Profile |
| NFR-01 | Field-level error messages from the server, shown under each input | All forms |
| NFR-03 | No emails shown on public cards / participant lists | All |

### Final delivery (12/06) — next sprint
- Calendar tab grid (day/week/month view, SFDS Figure 2) — the Alpha has an agenda list.
- Map with a pin per event and a live "you are here" marker (FR-04/FR-06 full) — the Alpha embeds one location at a time.
- "For You" ordering using `/api/recommendations/events` (FR-09).
- Skeleton loaders polish, image upload (backend currently accepts https image URLs only).
- Real email verification provider (backend has the adapter slot; currently dev mode auto-verifies).
- Deploy (Docker image already exists for backend; frontend is static files → any static host).

### Future / out of scope
SMS reminders (FR-10), DUO/SSO, NFR-04 no-show auto-release, password reset, native iOS app.

---

## 4. Frontend design (explained for basic React)

### 4.1 Folder layout
```
frontend/
  index.html
  vite.config.js          dev server on port 8081 (the backend already allows this origin)
  .env.example            VITE_API_URL=http://localhost:3000
  src/
    main.jsx              starts React, wraps the app in <BrowserRouter> + <AuthProvider>
    App.jsx               the list of routes (which page shows for which URL)
    api.js                THE ONLY FILE THAT CALLS THE BACKEND (fetch + token handling)
    AuthContext.jsx       who is logged in; login(), logout(), register()
    utils/format.js       date as mm-dd-yyyy, time as h:mm AM/PM (PRD §4.3)
    components/           small reusable pieces
      Layout.jsx          page frame + bottom nav: Home · Calendar · ＋Create · Map · Profile (SFDS mockup)
      SwipeCard.jsx       the big draggable/tappable event card
      EventListItem.jsx   one row in My Events / Calendar / Map lists
      Common.jsx          ProtectedRoute, FormField, ErrorBanner, Toast, Skeleton, PageHeader, StatusBadge
      Icons.jsx           inline SVG icons (no icon library)
    pages/                one file per screen
      LoginPage  RegisterPage  HomePage  EventDetailsPage  EventFormPage (create AND edit)
      MyEventsPage  CalendarPage  MapPage  ProfilePage      (404 is inline in App.jsx)
    styles.css            one stylesheet, CSS variables for colors
```

### 4.2 How data flows (the 3 rules)
1. **Pages never call `fetch` directly.** They call functions in `api.js`, e.g. `api.joinEvent(id)`. If the backend URL or response shape changes, only `api.js` changes.
2. **Logged-in user lives in `AuthContext`.** Any component can do `const { user, logout } = useAuth()`.
3. **Each page loads its own data** with `useEffect` + `useState` (`loading`, `error`, `data`) — no Redux, no React Query. Easy to read top-to-bottom.

### 4.3 Auth/token handling (inside `api.js`)
- Login returns `accessToken` (15 min) + `refreshToken` (single-use, 14 days). Both kept in `localStorage`.
- Every request sends `Authorization: Bearer <accessToken>`.
- On a `401 TOKEN_EXPIRED`, `api.js` refreshes **once** (a single shared promise so two parallel requests don't both burn the single-use refresh token), then retries. If refresh fails → logout.

### 4.4 The swipe deck
- Deck = `GET /api/events?feed=true` (excludes events you already joined/passed). `HomePage` keeps the array; `deck[0]` is the top card.
- Pointer events (`onPointerDown/Move/Up`) move the card; past ~100 px it commits. Works with mouse and touch, no library.
- Join → `POST /events/:id/join`; Pass → `POST /events/:id/pass`. The response shows a toast: "Joined!", "Waitlisted – #2", or the server's error (e.g. "This event is full.").
- Keyboard: ← pass, → join, Enter = details. Visible Pass / Join buttons for accessibility.

### 4.5 API endpoints the frontend uses
`POST /auth/register|login|refresh|logout`, `GET/PATCH /users/me`, `GET /users/me/events`, `GET /events`, `GET /events/:id`, `POST /events`, `PATCH /events/:id`, `POST /events/:id/reschedule`, `DELETE /events/:id`, `POST /events/:id/join|pass|leave`, `GET /events/:id/participants|navigation-link|share-link|calendar-link`.

---

## 5. Backend changes for the Alpha
1. `routes/events.ts`: drop the `ORGANIZER` role gate; any authenticated user may create.
2. `domain/authorization.ts`: manage = **owner only** (role no longer matters).
3. Update the 4 affected tests (unit authorization, integration events, security authorization) and API.md / DECISIONS.md.
4. Local `.env`: raise `AUTH_RATE_LIMIT_MAX` for testing (10 logins per 15 min per IP locks out a QA session).

---

## 6. Running everything locally
```bash
# 1. database (pick one)
brew install postgresql@16 && brew services start postgresql@16   # then create role/db (see frontend/README.md)
#   or: Docker Desktop + (cd backend && npm run db:up)

# 2. backend
cd backend && cp .env.example .env && npm install && npm run db:deploy && npm run db:seed && npm run dev

# 3. frontend (new terminal)
cd frontend && npm install && npm run dev      # http://localhost:8081
```
Seed logins (password `DevOnly-Password-1`): `participant.dev@sjsu.edu`, `organizer.dev@sjsu.edu`.

---

## 7. Testing plan for the Alpha Test Report
- **Automated:** backend `npm run test:coverage` (unit/integration/security/smoke) — record pass counts.
- **Manual (QA script):** reuse Test Plan IDs TC-001…TC-0xx; run on **Chrome (macOS)**, **Safari (macOS)**, **Safari (iPhone)**; Chrome DevTools mobile emulation counts only as a supplement.
- **Load (NFR-05):** k6 script exists (`backend/tests/performance/load.js`); re-run before Final if time allows.
- Record only what was actually run. Anything not run is marked "Not run – assigned to QA".

---

## 8. Recommendations
1. **Freeze scope now.** The Alpha is the list in §3; everything else goes into GitHub Issues labeled `final` or `future` (PP risk "scope creep" = High/High).
2. **Pair each frontend page with an owner** (e.g. Dev: Asfi = Home/Swipe + Details, Alex = Create/Edit + My Events; SA Evan = api.js/auth review; QA Cristhian/Sean = TR test execution on Safari/iPhone; PMM Brandon = usability walkthrough; PM Kabir = TR assembly + minutes).
3. **Small PRs into `main`**, each reviewed by one Dev + one QA (Project Plan §7 rule). Run `npm run build` before every PR.
4. **Log every TR bug as a GitHub Issue** with the TR Bug ID in the title (Test Plan §7.1) so the bug list is traceable.
5. **Update docs** next revision: Test Plan §4 (web browsers instead of iPhone app/Detox), SFDS §8 (React web instead of React Native), DECISIONS.md "how does a user become an organizer" → resolved.
6. **Before Final:** deploy somewhere public (Render/Railway/Fly for API + Postgres, Netlify/Vercel for the static frontend) so testers outside the team can use it — required for meaningful usability feedback.

---

## 9. Alpha status (11-13-2026)
- Branch `feature/frontend-alpha` (not merged, not pushed): new `frontend/`, backend permission change, docs.
- Verified end-to-end in a Chromium-based browser at phone and desktop widths: register/login/logout, session refresh, swipe join/pass (drag, buttons, keys), details, waitlist + promotion, create/edit/reschedule/delete, owner-only 403, My Events, Calendar agenda, Map list/search, location-denied path, profile edit, server-down screen. Backend suite 190/190.
- **Still to run by QA:** Safari (macOS + iPhone), Android/Windows Chrome, manual re-run of steps that were scripted (dialogs, new tabs), map embed, k6 load test.
- Draft Alpha Test Report: `LOBOS_SpartIN_Alpha_TR_v1.0_DRAFT.docx` (course folder) — minutes, attendees and contribution levels are left for the team.
