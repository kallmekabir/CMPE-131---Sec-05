# Deploying the SpartIN beta

Frontend → Vercel (static). API + Postgres → Render (Blueprint in `render.yaml`).

## 1. Gmail app password (verification emails)
1. Use a dedicated Gmail account for the project (not a personal one).
2. Google Account → Security → turn on **2-Step Verification**.
3. Google Account → Security → **App passwords** → create one named "SpartIN". Copy the 16 characters.
4. Values you'll paste into Render: `SMTP_USER` = the Gmail address, `SMTP_PASS` = the app password (spaces removed).

## 2. API on Render
1. render.com → **New → Blueprint** → connect this GitHub repo → it reads `render.yaml`.
2. Fill the prompted variables: `SMTP_USER`, `SMTP_PASS`, and temporarily put `https://placeholder.vercel.app` in `CORS_ORIGINS` and `PUBLIC_APP_URL` (fixed in step 4).
3. Deploy. When live, open `https://<your-api>.onrender.com/health`.
Free tier notes: the API sleeps after ~15 min idle (first request takes ~30s) and the free Postgres expires after 30 days — fine for a beta.

## 3. Frontend on Vercel
1. vercel.com → **Add New → Project** → import this repo.
2. **Root Directory: `frontend`**. Framework preset: Vite.
3. Environment variable: `VITE_API_URL` = `https://<your-api>.onrender.com` (no trailing slash).
4. Deploy, then copy the Vercel URL.

## 4. Point the API at the frontend
In Render → spartin-api → Environment: set `CORS_ORIGINS` and `PUBLIC_APP_URL` to the Vercel URL (no trailing slash). Render redeploys.

## 5. Smoke test
Register with an `@sjsu.edu` address → click the link in the email → log in → create, swipe, join an event.
Dev seed accounts do **not** exist in production (don't run `db:seed` there).
