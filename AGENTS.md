# 🏕️ Route Planner - Universal AI Guidelines & Architecture (`AGENTS.md`)

This document serves as the **universal single source of truth** for all AI coding assistants (GitHub Copilot, Gemini CLI, Claude Code, Cursor, Windsurf, ChatGPT, etc.) working on the **Route Planner** repository.

---

## 1. Project Overview & Vision

* **Name:** Route Planner (`route-planner`)
* **Purpose:** A lightweight, high-performance web application designed for Italian scout groups (Clan / Fuoco) to collect individual summer availability and automatically calculate the best continuous dates for their summer Route (July and August).
* **Language & Tone:** Italian copy for all user-facing UI elements, alerts, toasts, and buttons.
* **Deployment Target:** [Vercel](https://vercel.com) using `@vercel/node` and static file routing (`vercel.json`).

---

## 2. Core Architectural Principles & Hard Constraints

Any AI modifying this codebase MUST follow these strict rules:

1. **Zero-Build Architecture**:
   - **DO NOT** introduce frameworks (React, Vue, Svelte, Angular, Solid).
   - **DO NOT** introduce CSS preprocessors or utility frameworks (Tailwind, Sass, Less, PostCSS).
   - **DO NOT** add build tools, bundlers, or compilers (Webpack, Vite, Rollup, Babel, TypeScript).
   - All code must remain native Vanilla HTML5, CSS3, and modern browser JavaScript (ES6+).
2. **CommonJS for Backend**:
   - `app.js` and all Node.js scripts MUST use `require()` and `module.exports`.
   - Never use ES module syntax (`import`/`export`) in backend files unless explicitly commanded by the user to migrate the entire repository.
3. **Separation of Concerns**:
   - HTML views reside in `views/*.html`.
   - Client-side scripts reside in `public/js/*.js`.
   - Global stylesheet resides in `public/css/styles.css`.
   - Server logic and API routes reside in `app.js`.
4. **Vercel Serverless Compatibility**:
   - `app.js` is both a local Express server and a serverless function handler.
   - `app.listen()` must ONLY be called when `require.main === module` (local execution).
   - `app.js` must always end with `module.exports = app;`.
   - All `/api` routes must be wrapped with the lazy initialization middleware `ensureDatabase()` to protect against serverless cold-start connection race conditions.

---

## 3. Directory Structure & File Map

```text
route2025/
├── .github/
│   └── copilot-instructions.md   # GitHub Copilot entry point (references AGENTS.md)
├── views/                        # Static HTML views
│   ├── clan-select.html          # Clan onboarding / selection page
│   ├── home.html                 # Group dashboard with stats and action cards
│   ├── add.html                  # Availability form (drag & tap calendar)
│   ├── modify.html               # Availability editor (member picker + calendar)
│   └── results.html              # Results dashboard (heatmap, best slot, modal)
├── public/                       # Static public assets served by Express / Vercel
│   ├── css/
│   │   └── styles.css            # Modern Alpine design system & variables
│   └── js/
│       ├── clan-select.js        # Logic for clan creation & selection
│       ├── home.js               # Logic for dashboard stats & member chips
│       ├── add.js                # Logic for day selection & submission
│       ├── modify.js             # Logic for member data loading & updating
│       └── results.js            # Heatmap computation, best slot algorithm & modal
├── app.js                        # Express app, Neon SQL queries & API routes
├── dbtest.js                     # Standalone CLI tool to verify Neon connectivity
├── vercel.json                   # Vercel deployment routes and builds
├── GEMINI.md                     # Gemini CLI entry point (references AGENTS.md)
├── AGENTS.md                     # Universal AI guidelines (this file)
└── package.json                  # Dependencies and scripts (type: commonjs)
```

---

## 4. Database Schema & Data Models

* **Database Engine:** PostgreSQL via **Neon Serverless** (`@neondatabase/serverless`).
* **Connection Protocol:** Over-the-wire HTTP SQL query execution (`neon(connectionString)`).
* **Safe Interpolation:** Always use tagged template literals (`sql\`SELECT ...\``) for automatic parameterized sanitization against SQL injections.

### Table: `clans`
Stores distinct scout groups.
```sql
CREATE TABLE IF NOT EXISTS clans (
    name TEXT PRIMARY KEY
);
```

### Table: `availability`
Stores individual member availability.
```sql
CREATE TABLE IF NOT EXISTS availability (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    clan TEXT NOT NULL,
    days JSONB NOT NULL,
    UNIQUE (name, clan)
);

CREATE INDEX IF NOT EXISTS idx_availability_clan ON availability (clan);
CREATE UNIQUE INDEX IF NOT EXISTS availability_name_clan_unique ON availability (name, clan);
```

### `days` JSONB Structure:
An array of ISO date strings in `YYYY-MM-DD` format spanning July 1st to August 31st (max 62 items):
```json
["2026-07-15", "2026-07-16", "2026-07-17", "2026-08-01"]
```

---

## 5. REST API Specifications

All endpoints return JSON and handle errors with appropriate HTTP status codes (200, 400, 404, 500, 503).

| Method | Endpoint | Query / Body Params | Description |
|---|---|---|---|
| `GET` | `/api/clans` | — | Returns `{ status, count, clans: string[] }` |
| `POST` | `/api/clan` | `{ clanName: string }` | Creates a new clan or returns existing |
| `GET` | `/api/members` | `?clan=Name` | Returns member names and days count `{ members: [{ name, day_count }] }` |
| `GET` | `/api/availability` | `?clan=Name` | Returns all availability rows for the specified clan |
| `GET` | `/api/user/:name` | `?clan=Name` | Returns availability record for a specific member |
| `POST` | `/api/availability` | `{ name, days, clan }` | Atomic case-insensitive upsert of member availability |
| `PUT` | `/api/availability` | `{ name, days, clan }` | Updates availability of an existing member |
| `DELETE` | `/api/availability` | `{ name, clan }` | Removes a member's response from the clan |

---

## 6. Frontend & Mobile UX Rules

### Mobile Touch vs Scrolling (CRITICAL):
* **NEVER hijack vertical finger movement**: When adding touch events to calendar cells, always distinguish between a **tap** (< 8px movement) and a **page scroll** (> 8px movement).
* If the user scrolls, DO NOT toggle any day cell.
* Calendar grid container must preserve `touch-action: pan-y;` so mobile page scroll is 100% butter-smooth.
* Day cells use `touch-action: manipulation;` to eliminate 300ms double-tap zoom delays.
* Provide the **"📅 Seleziona Periodo"** range tool so mobile users can tap Start Date and End Date instead of dragging across rows.

### Desktop Calendar Sizing:
* Calendar grid is centered with `max-width: 620px;` and cell height `40px` on desktop.
* Avoid full-screen square cells (`aspect-ratio: 1/1`) on desktop so all 10 rows (July & August) fit comfortably on a single screen without vertical scrolling.

### Month Transition:
* Calendar spans July 1st to August 31st of the target year (2026).
* Day 1 of July and Day 1 of August display month indicator badges (`1 Lug`, `1 Ago`).
* Deterministic date generation (`${YEAR}-${month}-${day}`) must be used instead of `date.toISOString()` to prevent UTC/DST midnight shifts.

### Active Clan State:
* Active group is persisted in `localStorage.getItem('currentClan')`.
* On any page (`/home`, `/add`, `/modify`, `/results`), if `currentClan` is missing, the script redirects the user to `/clan-select`.
* The navbar always shows the active clan pill with a link to switch groups.

### Design System ("Modern Alpine"):
* **Theme Tokens**: Use CSS variables defined in `:root` of `styles.css`:
  - `--bg-base`: Deep Slate `#0a1114`
  - `--primary`: Emerald Pine `#10b981`
  - `--accent`: Campfire Amber `#f59e0b`
  - `--july-color`: Alpine Sky `#38bdf8`
  - `--august-color`: Sunset Violet `#a78bfa`
* **Feedback**: Never use browser blocking `alert()` calls. Use the custom toast system (`showToast(msg, type)`).

---

## 7. Development & Verification Commands

```bash
# Start local development server on port 3000
npm start

# Test database connectivity directly against Neon PostgreSQL
node dbtest.js

# Fast syntax validation of all JavaScript files (Node.js check)
node -c app.js
node -c public/js/clan-select.js
node -c public/js/home.js
node -c public/js/add.js
node -c public/js/modify.js
node -c public/js/results.js
```
