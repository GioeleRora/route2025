# Copilot Instructions

This repository contains project-specific instructions and conventions for GitHub Copilot.
The master universal instructions are maintained in [`AGENTS.md`](../AGENTS.md). Refer to `AGENTS.md` for full specifications, database schema, API contracts, and UX rules.

## Quick Reference & Constraints
- **Commands:**
  - `npm start` — runs `node app.js` (local server on port 3000)
  - `node dbtest.js` — checks Neon PostgreSQL connectivity
  - `node -c app.js` — validates JavaScript syntax
- **Stack:**
  - Express.js + `@neondatabase/serverless` (CommonJS `require`)
  - Vanilla HTML in `views/`, CSS in `public/css/styles.css`, JS in `public/js/`
  - Zero-build step: do not introduce React, Tailwind, or bundlers
  - Deployment on Vercel via `@vercel/node` and static routes (`vercel.json`)
- **Key Conventions:**
  - Database schema: `clans` (`name` PK) and `availability` (`id` SERIAL PK, `name`, `clan`, `days` JSONB, indexed on `clan` and unique `(name, clan)`).
  - API endpoints: `/api/clans`, `/api/clan`, `/api/members`, `/api/availability`, `/api/user/:name`.
  - Cold-start protection: all `/api` routes use `ensureDatabase()` middleware.
  - Mobile touch safety: never let touch events interfere with vertical page scroll; distinguish tap (< 8px movement) from scroll.
  - Desktop calendar: keep cells compact (40px height, max-width 620px) so July and August fit cleanly on a single screen.
  - UI Language: all copy must remain in Italian.

See [`AGENTS.md`](../AGENTS.md) for full architectural guidelines.
