# Copilot instructions

## Commands

- `npm start` — runs `node app.js`
- `node dbtest.js` — checks Neon connectivity with `POSTGRES_URL`, `DATABASE_URL`, or direct PG env vars
- `npm test` — placeholder in `package.json` and currently exits with `Error: no test specified`

No build or lint scripts are defined in `package.json`.

## Architecture

- `app.js` is the entry point and owns both the HTTP server and the API.
- The app uses Express + `body-parser` on top of Neon’s serverless Postgres driver.
- Startup loads `.env`, picks `POSTGRES_URL` first, then `DATABASE_URL`, then exits if neither exists.
- On boot, the server retries the DB connection and bootstraps the `availability` table, including a legacy upgrade path for missing `clan` and `id` columns.
- Frontend pages are static HTML in `views/`; browser logic lives in `public/js/`; shared styles are in `public/css/styles.css`.
- `vercel.json` maps `/api/*` to `app.js` and serves the HTML/CSS/JS assets as static routes.
- Clan selection is stored in `localStorage.currentClan` and reused by the home, add, modify, and results flows.
- Availability data is clan-scoped, stored as `JSONB` days, and the results page computes the best slot client-side from fetched availability rows.

## Conventions

- Keep CommonJS (`require`/`module.exports`) unless the whole app is migrated.
- Preserve the existing route split: `/api/*` for data, `/home`, `/add`, `/modify`, `/results`, and `/clan-select` for pages.
- When changing availability logic, keep `name` trimming/normalization and the `(name, clan)` uniqueness rule aligned between server and client.
- Keep date handling aligned with the fixed July–August 2026 calendar used across add, modify, and results pages.
- Preserve the current Italian UI copy and page flow unless the whole surface is being redesigned.
- If you touch routing or file paths, keep `app.js` and `vercel.json` in sync.
